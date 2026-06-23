import { GoogleGenAI } from '@google/genai';
import type { Logger } from '../logger.js';
import type { AgentResponse, AgentTool, ChatMessage, Citation } from './types.js';

const MAX_TOOL_ITERATIONS = 5;

export interface GeminiResult {
  text: string;
  functionCalls: { name: string; args: Record<string, unknown> }[];
  candidates: {
    groundingMetadata?: { groundingChunks?: { web?: { title?: string; uri?: string } }[] };
  }[];
}

export interface GeminiClient {
  generateContent(req: {
    model: string;
    contents: unknown[];
    config: Record<string, unknown>;
  }): Promise<GeminiResult>;
}

export function createRealClient(apiKey: string): GeminiClient {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generateContent(req) {
      const r = await ai.models.generateContent(req as never);
      return {
        text: r.text ?? '',
        functionCalls: (r.functionCalls ?? []).map((f) => ({
          name: f.name ?? '',
          args: (f.args ?? {}) as Record<string, unknown>,
        })),
        candidates: (r.candidates ?? []) as GeminiResult['candidates'],
      };
    },
  };
}

export interface GeminiDeps {
  client?: GeminiClient;
  /** Injectable delay (defaults to real setTimeout); overridden in tests to avoid waiting. */
  sleep?: (ms: number) => Promise<void>;
  /** Max retry attempts after the first try on a transient failure. Default 3. */
  maxRetries?: number;
  /** Base backoff delay in ms; grows exponentially per attempt. Default 500. */
  baseDelayMs?: number;
  /** Per-attempt timeout in ms; 0 disables. Default 30000. */
  timeoutMs?: number;
}

export class GeminiAgent {
  private readonly client: GeminiClient;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly cfg: { apiKey: string; model: string },
    private readonly logger: Logger,
    deps?: GeminiDeps,
  ) {
    this.client = deps?.client ?? createRealClient(cfg.apiKey);
    this.sleep = deps?.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = deps?.maxRetries ?? 3;
    this.baseDelayMs = deps?.baseDelayMs ?? 500;
    this.timeoutMs = deps?.timeoutMs ?? 30000;
  }

  /** Calls the Gemini client with a per-attempt timeout and exponential-backoff retry. */
  private async generateWithResilience(req: {
    model: string;
    contents: unknown[];
    config: Record<string, unknown>;
  }): Promise<GeminiResult> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.withTimeout(this.client.generateContent(req));
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          { attempt, maxRetries: this.maxRetries, err: (err as Error).message },
          'Gemini call failed',
        );
        if (attempt < this.maxRetries) await this.sleep(this.baseDelayMs * 2 ** attempt);
      }
    }
    throw lastErr;
  }

  private withTimeout(p: Promise<GeminiResult>): Promise<GeminiResult> {
    if (!this.timeoutMs) return p;
    return new Promise<GeminiResult>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Gemini request timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs,
      );
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  async ask(history: ChatMessage[], tools: AgentTool[] = []): Promise<AgentResponse> {
    const contents: unknown[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
    const toolMap = new Map(tools.map((t) => [t.name, t]));

    const toolConfig: Record<string, unknown>[] = [{ googleSearch: {} }];
    if (tools.length > 0) {
      toolConfig.push({
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      });
    }

    const citations: Citation[] = [];
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await this.generateWithResilience({
        model: this.cfg.model,
        contents,
        config: { tools: toolConfig },
      });
      this.collectCitations(result, citations);

      if (result.functionCalls.length > 0 && toolMap.size > 0) {
        contents.push({
          role: 'model',
          parts: result.functionCalls.map((fc) => ({ functionCall: fc })),
        });
        for (const fc of result.functionCalls) {
          const tool = toolMap.get(fc.name);
          const output = tool ? await this.safeCall(tool, fc.args) : `Unknown tool: ${fc.name}`;
          contents.push({
            role: 'user',
            parts: [{ functionResponse: { name: fc.name, response: { result: output } } }],
          });
        }
        continue;
      }
      return {
        text: result.text || 'I could not produce an answer.',
        citations: dedupe(citations),
      };
    }
    return {
      text: "I couldn't complete this request — too many tool steps. Please rephrase.",
      citations: dedupe(citations),
    };
  }

  private async safeCall(tool: AgentTool, args: Record<string, unknown>): Promise<string> {
    try {
      return await tool.call(args);
    } catch (err) {
      this.logger.warn({ tool: tool.name, err: (err as Error).message }, 'tool call failed');
      return `Tool ${tool.name} failed: ${(err as Error).message}`;
    }
  }

  private collectCitations(result: GeminiResult, into: Citation[]): void {
    for (const c of result.candidates) {
      for (const chunk of c.groundingMetadata?.groundingChunks ?? []) {
        if (chunk.web?.uri)
          into.push({ title: chunk.web.title ?? chunk.web.uri, uri: chunk.web.uri });
      }
    }
  }
}

function dedupe(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => (seen.has(c.uri) ? false : (seen.add(c.uri), true)));
}

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
  client: GeminiClient;
}

export class GeminiAgent {
  private readonly client: GeminiClient;

  constructor(
    private readonly cfg: { apiKey: string; model: string },
    private readonly logger: Logger,
    deps?: GeminiDeps,
  ) {
    this.client = deps?.client ?? createRealClient(cfg.apiKey);
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
      const result = await this.client.generateContent({
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

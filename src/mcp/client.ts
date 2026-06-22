import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { AgentTool } from '../agent/types.js';

export interface McpConnection {
  listTools(): Promise<
    { name: string; description?: string; inputSchema: Record<string, unknown> }[]
  >;
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

export interface McpClientDeps {
  connect(cfg: McpServerConfig): Promise<McpConnection>;
}

export function createRealConnect(): McpClientDeps['connect'] {
  return async (cfg) => {
    const client = new Client({ name: 'pulse', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: cfg.command, args: cfg.args });
    await client.connect(transport);
    return {
      async listTools() {
        const r = await client.listTools();
        return r.tools.map((t) => ({
          name: t.name,
          ...(t.description ? { description: t.description } : {}),
          inputSchema: (t.inputSchema ?? { type: 'object' }) as Record<string, unknown>,
        }));
      },
      async callTool(name, args) {
        const r = await client.callTool({ name, arguments: args });
        const content = (r.content ?? []) as { type: string; text?: string }[];
        return (
          content
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('\n') || JSON.stringify(r)
        );
      },
      async close() {
        await client.close();
      },
    };
  };
}

export class McpClientManager {
  private readonly connections: McpConnection[] = [];
  private readonly agentTools: AgentTool[] = [];
  private readonly connect: McpClientDeps['connect'];

  constructor(
    private readonly servers: McpServerConfig[],
    private readonly logger: Logger,
    deps?: McpClientDeps,
  ) {
    this.connect = deps?.connect ?? createRealConnect();
  }

  async connectAll(): Promise<void> {
    for (const srv of this.servers) {
      try {
        const conn = await this.connect(srv);
        this.connections.push(conn);
        const tools = await conn.listTools();
        for (const t of tools) {
          this.agentTools.push({
            name: t.name,
            description: t.description ?? t.name,
            parameters: t.inputSchema,
            call: (args) => conn.callTool(t.name, args),
          });
        }
        this.logger.info({ server: srv.name, tools: tools.length }, 'connected to MCP server');
      } catch (err) {
        this.logger.warn(
          { server: srv.name, err: (err as Error).message },
          'MCP server unavailable — skipping',
        );
      }
    }
  }

  tools(): AgentTool[] {
    return this.agentTools;
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.connections.map((c) => c.close()));
  }
}

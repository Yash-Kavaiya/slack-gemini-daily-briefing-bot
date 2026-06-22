export interface Citation {
  title: string;
  uri: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AgentResponse {
  text: string;
  citations: Citation[];
}

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema describing the tool's parameters. */
  parameters: Record<string, unknown>;
  call(args: Record<string, unknown>): Promise<string>;
}

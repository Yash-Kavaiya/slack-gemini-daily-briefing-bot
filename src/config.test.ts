import { describe, it, expect } from 'vitest';
import { loadConfig } from './config.js';

const base = {
  SLACK_BOT_TOKEN: 'xoxb-1',
  SLACK_APP_TOKEN: 'xapp-1',
  SLACK_SIGNING_SECRET: 'secret',
  GEMINI_API_KEY: 'key',
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig(base);
    expect(c.gemini.model).toBe('gemini-2.0-flash');
    expect(c.briefing.cron).toBe('0 9 * * *');
    expect(c.healthPort).toBe(3000);
    expect(c.briefing.channel).toBeUndefined();
  });

  it('parses topics and mcp servers', () => {
    const c = loadConfig({
      ...base,
      BRIEFING_TOPICS: 'ai, markets ,sports',
      MCP_SERVERS: JSON.stringify([{ name: 'fs', command: 'npx', args: ['-y', 'srv'] }]),
    });
    expect(c.briefing.topics).toEqual(['ai', 'markets', 'sports']);
    expect(c.mcpServers[0]?.name).toBe('fs');
  });

  it('throws when a required var is missing', () => {
    expect(() => loadConfig({ ...base, GEMINI_API_KEY: '' })).toThrow(/GEMINI_API_KEY/);
  });

  it('throws on invalid MCP_SERVERS json', () => {
    expect(() => loadConfig({ ...base, MCP_SERVERS: 'not json' })).toThrow(/MCP_SERVERS/);
  });
});

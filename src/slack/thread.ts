import type { ChatMessage } from '../agent/types.js';

export interface SlackMsg {
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
}

export function messagesToHistory(messages: SlackMsg[], botUserId: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    const text = stripMention(m.text ?? '', botUserId).trim();
    if (!text) continue;
    const isBot = Boolean(m.bot_id) || m.user === botUserId;
    out.push({ role: isBot ? 'model' : 'user', text });
  }
  return out;
}

function stripMention(text: string, botUserId: string): string {
  return text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').replace(/\s+/g, ' ');
}

import cron, { type ScheduledTask } from 'node-cron';
import type { GeminiAgent } from '../agent/gemini.js';
import type { Logger } from '../logger.js';
import { buildBriefing } from './briefing.js';
import { formatBriefing } from '../slack/format.js';

export interface Poster {
  postMessage(args: { channel: string; text: string; blocks: unknown[] }): Promise<unknown>;
}

export interface SchedulerOptions {
  cron: string;
  channel?: string;
  topics: string[];
  agent: Pick<GeminiAgent, 'ask'>;
  poster: Poster;
  logger: Logger;
  scheduleFn?: typeof cron.schedule;
}

export class BriefingScheduler {
  private task?: ScheduledTask;

  constructor(private readonly opts: SchedulerOptions) {}

  start(): void {
    if (!this.opts.channel) {
      this.opts.logger.warn('BRIEFING_CHANNEL not set — daily briefing disabled');
      return;
    }
    const schedule = this.opts.scheduleFn ?? cron.schedule;
    this.task = schedule(this.opts.cron, () => {
      void this.runOnce();
    });
    this.opts.logger.info(
      { cron: this.opts.cron, channel: this.opts.channel },
      'briefing scheduled',
    );
  }

  stop(): void {
    this.task?.stop();
  }

  async runOnce(): Promise<void> {
    if (!this.opts.channel) return;
    try {
      const res = await buildBriefing(this.opts.agent, this.opts.topics);
      const { text, blocks } = formatBriefing(this.opts.topics, res);
      await this.opts.poster.postMessage({ channel: this.opts.channel, text, blocks });
      this.opts.logger.info('daily briefing posted');
    } catch (err) {
      this.opts.logger.error({ err: (err as Error).message }, 'briefing failed');
    }
  }
}

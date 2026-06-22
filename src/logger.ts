import pino from 'pino';
export type { Logger } from 'pino';

export function createLogger(level: string): pino.Logger {
  return pino({
    level,
    redact: {
      paths: [
        '*.token',
        '*.botToken',
        '*.appToken',
        '*.apiKey',
        '*.signingSecret',
        'headers.authorization',
      ],
      censor: '[REDACTED]',
    },
  });
}

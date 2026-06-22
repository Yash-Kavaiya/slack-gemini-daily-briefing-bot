import { describe, it, expect } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('creates a logger at the requested level', () => {
    const log = createLogger('debug');
    expect(log.level).toBe('debug');
    expect(typeof log.info).toBe('function');
  });
});

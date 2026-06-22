import { describe, it, expect } from 'vitest';
import { messagesToHistory } from './thread.js';

describe('messagesToHistory', () => {
  it('maps bot messages to model and others to user, stripping mentions', () => {
    const history = messagesToHistory(
      [
        { user: 'U1', text: '<@UBOT> hi there' },
        { bot_id: 'B1', user: 'UBOT', text: 'hello!' },
        { user: 'U1', text: 'follow up' },
        { user: 'U1', text: '' },
      ],
      'UBOT',
    );
    expect(history).toEqual([
      { role: 'user', text: 'hi there' },
      { role: 'model', text: 'hello!' },
      { role: 'user', text: 'follow up' },
    ]);
  });
});

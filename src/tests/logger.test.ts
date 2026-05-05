import { describe, expect, test } from 'bun:test';
import { sanitizeLogPayload } from '../logger';

describe('sanitizeLogPayload', () => {
  test('redacts sensitive values recursively', () => {
    expect(
      sanitizeLogPayload({
        AZURE_OPENAI_API_KEY: 'secret-key',
        spreadsheetId: 'sheet-id',
        nested: {
          token: 'token-value',
          safe: 'visible',
        },
      }),
    ).toEqual({
      AZURE_OPENAI_API_KEY: '[REDACTED]',
      spreadsheetId: '[REDACTED]',
      nested: {
        token: '[REDACTED]',
        safe: 'visible',
      },
    });
  });
});

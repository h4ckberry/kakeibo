import { expect, test } from 'bun:test';
import { parseUserConfigsYaml } from '../src/services/config';
import type { UserConfig } from '../src/types';

// Simple YAML payload for unit testing parsing/validation
const validYaml = `- id: family
  spreadsheetId: sheetFamily
  driveInboxFolderId: inbox-family
  driveProcessedFolderId: processed-family
- id: work
  spreadsheetId: sheetWork
  driveInboxFolderId: inbox-work
  driveProcessedFolderId: processed-work`;

const invalidYaml = `- id: family
  spreadsheetId: sheetFamily`;

const emptyYaml = '[]';

test('parses valid YAML into UserConfig[]', () => {
  const result = parseUserConfigsYaml(validYaml) as UserConfig[];
  expect(Array.isArray(result)).toBe(true);
  expect(result.length).toBe(2);
  expect(result[0]).toHaveProperty('id', 'family');
  expect(result[1]).toHaveProperty('driveProcessedFolderId', 'processed-work');
});

test('throws on invalid YAML lacking required fields', () => {
  expect(() => parseUserConfigsYaml(invalidYaml)).toThrow();
});

test('throws on empty YAML array', () => {
  expect(() => parseUserConfigsYaml(emptyYaml)).toThrow();
});

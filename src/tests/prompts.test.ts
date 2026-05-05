import { describe, expect, test } from 'bun:test';
import {
  buildFewShotSection,
  loadPrompt,
  type PromptName,
} from '../services/prompts';

describe('loadPrompt', () => {
  test('loads markdown prompts from the prompts directory', async () => {
    const prompt = await loadPrompt('analyze-receipt');
    expect(prompt).toContain('レシート画像');
  });

  test('replaces template variables', async () => {
    const prompt = await loadPrompt('system', {
      CATEGORIES: 'カテゴリ',
      FEW_SHOT: '過去分類',
    });

    expect(prompt).toContain('カテゴリ');
    expect(prompt).toContain('過去分類');
  });

  test('rejects unknown prompt names', async () => {
    await expect(loadPrompt('../package' as PromptName)).rejects.toThrow(
      'Unknown prompt',
    );
  });

  test('builds few-shot section with purchased item and category item', () => {
    expect(
      buildFewShotSection([
        {
          purchasedItem: '黒酢もずく',
          majorCategory: '変動費',
          minorCategory: '食費',
          categoryItem: '食料品',
        },
      ]),
    ).toContain('| 黒酢もずく | 変動費 | 食費 | 食料品 |');
  });
});

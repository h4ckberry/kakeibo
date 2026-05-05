import type { Category, RecentItem } from '../types';

const PROMPTS_DIR = './prompts';
const PROMPT_NAMES = [
  'analyze-receipt',
  'kakeibo-batch-agent',
  'system',
] as const;

export type PromptName = (typeof PROMPT_NAMES)[number];

export async function loadPrompt(
  name: PromptName,
  variables?: Record<string, string>,
): Promise<string> {
  assertPromptName(name);
  const file = Bun.file(`${PROMPTS_DIR}/${name}.md`);
  let content = await file.text();

  if (!variables) {
    return content;
  }

  for (const [key, value] of Object.entries(variables)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  return content;
}

function assertPromptName(name: string): asserts name is PromptName {
  if (!PROMPT_NAMES.includes(name as PromptName)) {
    throw new Error(`Unknown prompt: ${name}`);
  }
}

export function formatCategoriesForPrompt(categories: Category[]): string {
  if (categories.length === 0) {
    return '（カテゴリデータなし）';
  }

  const lines = ['| 大項目 | 小項目 | 費目 |', '|--------|--------|------|'];
  for (const category of categories) {
    lines.push(
      `| ${category.majorCategory} | ${category.minorCategory} | ${category.categoryItem} |`,
    );
  }

  return lines.join('\n');
}

export function buildFewShotSection(items: RecentItem[]): string {
  if (items.length === 0) {
    return '';
  }

  const lines = [
    '## この家計簿の過去分類実績',
    '',
    '同じ購入品目や似た購入品目があった場合は、以下の分類を優先してください：',
    '',
    '| 購入品目 | 大項目 | 小項目 | 費目 |',
    '|----------|--------|--------|------|',
  ];

  for (const item of items) {
    lines.push(
      `| ${item.purchasedItem} | ${item.majorCategory} | ${item.minorCategory} | ${item.categoryItem} |`,
    );
  }

  return lines.join('\n');
}

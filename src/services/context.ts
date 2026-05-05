import type { Category, KakeiboBatchConfig, RecentItem } from '../types';
import { buildFewShotSection } from './prompts';
import { fetchCategories, fetchRecentItemsFromAllSheets } from './sheets';

export interface KakeiboContext {
  categories: Category[];
  recentItems: RecentItem[];
  fewShotText: string;
}

export async function prepareKakeiboContext(
  config: KakeiboBatchConfig,
): Promise<KakeiboContext> {
  const categories = await fetchCategories({
    spreadsheetId: config.spreadsheetId,
  });
  const recentItems = await fetchRecentItemsFromAllSheets({
    spreadsheetId: config.spreadsheetId,
    limit: 30,
  });

  return {
    categories,
    recentItems,
    fewShotText: buildFewShotSection(recentItems),
  };
}

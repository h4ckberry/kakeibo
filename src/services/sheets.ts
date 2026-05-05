import type { sheets_v4 } from 'googleapis';
import { google } from 'googleapis';
import { log } from '../logger';
import {
  type Category,
  type RecentItem,
  type Transactions,
  TransactionsSchema,
} from '../types';

const SHEET_HEADER = [
  '日付',
  '店舗名',
  '大項目',
  '小項目',
  '費目',
  '購入品目',
  '金額',
];
const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const DEFAULT_CATEGORY_RANGE = '分類カテゴリ!A:C';

export interface SheetsOptions {
  sheets?: sheets_v4.Sheets;
}

export interface AppendTransactionsOptions extends SheetsOptions {
  spreadsheetId: string;
  sheetName: string;
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface FetchRecentItemsOptions extends SheetsOptions {
  spreadsheetId: string;
  sheetName: string;
  limit?: number;
}

export interface GetOrCreateSheetOptions extends SheetsOptions {
  spreadsheetId: string;
  sheetName: string;
}

export interface FetchCategoriesOptions extends SheetsOptions {
  spreadsheetId: string;
  range?: string;
}

export function getSheetsClient(): sheets_v4.Sheets {
  const auth = new google.auth.GoogleAuth({
    scopes: SHEETS_SCOPES,
  });

  return google.sheets({ version: 'v4', auth });
}

export async function getOrCreateSheet(
  options: GetOrCreateSheetOptions,
): Promise<string> {
  const sheets = options.sheets ?? getSheetsClient();
  const { spreadsheetId, sheetName } = options;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  const existingSheets =
    spreadsheet.data.sheets?.map((s) => s.properties?.title) ?? [];

  if (existingSheets.includes(sheetName)) {
    return sheetName;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:G1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [SHEET_HEADER],
    },
  });

  return sheetName;
}

export async function fetchCategories(
  options: FetchCategoriesOptions,
): Promise<Category[]> {
  const sheets = options.sheets ?? getSheetsClient();
  const range = options.range ?? DEFAULT_CATEGORY_RANGE;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: options.spreadsheetId,
    range,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) {
    return [];
  }

  return rows.slice(1).reduce<Category[]>((categories, row) => {
    const majorCategory = (row[0] ?? '').toString().trim();
    const minorCategory = (row[1] ?? '').toString().trim();
    const categoryItem = (row[2] ?? '').toString().trim();

    if (majorCategory && minorCategory && categoryItem) {
      categories.push({ majorCategory, minorCategory, categoryItem });
    }

    return categories;
  }, []);
}

export async function fetchRecentItems(
  options: FetchRecentItemsOptions,
): Promise<RecentItem[]> {
  const sheets = options.sheets ?? getSheetsClient();
  const { spreadsheetId, sheetName, limit = 50 } = options;

  const metadata = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:G`,
  });

  const rows = metadata.data.values;
  if (!rows || rows.length <= 1) {
    return [];
  }

  const dataRows = rows.slice(1);
  const recentRows = dataRows.slice(-limit);

  return recentRows.reduce<RecentItem[]>((items, row) => {
    const categoryItem = (row[4] ?? '').toString().trim();
    const purchasedItem = (row[5] ?? '').toString().trim();
    const majorCategory = (row[2] ?? '').toString().trim();
    const minorCategory = (row[3] ?? '').toString().trim();

    if (purchasedItem && majorCategory && minorCategory && categoryItem) {
      items.push({
        purchasedItem,
        majorCategory,
        minorCategory,
        categoryItem,
      });
    }

    return items;
  }, []);
}

export async function fetchRecentItemsFromAllSheets(
  options: Omit<FetchRecentItemsOptions, 'sheetName'>,
): Promise<RecentItem[]> {
  const sheets = options.sheets ?? getSheetsClient();
  const { spreadsheetId, limit = 30 } = options;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  const sheetNames =
    spreadsheet.data.sheets
      ?.map((s) => s.properties?.title)
      .filter((name): name is string => !!name) ?? [];
  const fySheets = sheetNames.filter((name) => /^FY\d+$/.test(name));

  const allItems: RecentItem[] = [];
  for (const sheetName of fySheets) {
    try {
      const items = await fetchRecentItems({
        spreadsheetId,
        sheetName,
        limit,
        sheets,
      });
      allItems.push(...items);
    } catch (error) {
      log('WARN', 'Failed to fetch recent items from sheet, skipping', {
        sheetName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const seen = new Set<string>();
  const deduped: RecentItem[] = [];
  for (const item of [...allItems].reverse()) {
    const key = `${item.purchasedItem}|${item.majorCategory}|${item.minorCategory}|${item.categoryItem}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.unshift(item);
    }
  }

  return deduped;
}

export async function appendTransactions(
  transactions: Transactions,
  options: AppendTransactionsOptions,
): Promise<sheets_v4.Schema$AppendValuesResponse> {
  const parsedTransactions = TransactionsSchema.parse(transactions);
  const sheets = options.sheets ?? getSheetsClient();
  const { spreadsheetId, sheetName } = options;
  const values = toSheetValues(parsedTransactions);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:G`,
    valueInputOption: options.valueInputOption ?? 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values,
    },
  });

  return response.data;
}

export function toSheetValues(transactions: Transactions): unknown[][] {
  return TransactionsSchema.parse(transactions).map((transaction) => [
    transaction.date,
    transaction.storeName,
    transaction.majorCategory,
    transaction.minorCategory,
    transaction.categoryItem,
    transaction.purchasedItem,
    transaction.amount,
  ]);
}

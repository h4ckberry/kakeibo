import { z } from 'zod';

export const TransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  storeName: z.string(),
  majorCategory: z.string(),
  minorCategory: z.string(),
  categoryItem: z.string(),
  purchasedItem: z.string(),
  amount: z.number(),
});

export const TransactionsSchema = z.array(TransactionSchema).min(1);

export type Transaction = z.infer<typeof TransactionSchema>;
export type Transactions = z.infer<typeof TransactionsSchema>;

export type ReceiptImageMimeType = 'image/jpeg' | 'image/png';

export interface ReceiptImage {
  id: string;
  name: string;
  mimeType: ReceiptImageMimeType;
}

export interface Category {
  majorCategory: string;
  minorCategory: string;
  categoryItem: string;
}

export interface RecentItem {
  purchasedItem: string;
  majorCategory: string;
  minorCategory: string;
  categoryItem: string;
}

export interface ProcessedReceipt {
  fileId: string;
  fileName: string;
  transactions: Transaction[];
}

export interface BatchError {
  fileId?: string;
  fileName?: string;
  stage: 'list' | 'download' | 'analyze' | 'append' | 'move';
  message: string;
}

export interface KakeiboBatchConfig {
  spreadsheetId: string;
  azureOpenAiApiKey: string;
  azureOpenAiEndpoint: string;
  volcanoAzureModel: string;
  driveInboxFolderId: string;
  driveProcessedFolderId: string;
}

export interface KakeiboBatchResult {
  found: number;
  analyzed: number;
  appended: number;
  appendedByFy: Record<string, number>;
  moved: number;
  errors: BatchError[];
  exitCode: 0 | 1;
}

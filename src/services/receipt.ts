import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { errorToMessage } from '../logger';
import {
  type Category,
  type ProcessedReceipt,
  type Transaction,
  TransactionSchema,
} from '../types';
import { formatCategoriesForPrompt, loadPrompt } from './prompts';

const UNKNOWN_DATE = '0000-00-00';
const UNKNOWN_TEXT = 'unknown';
const UNKNOWN_AMOUNT = -1;

const AnalysisResultSchema = z.object({
  items: z.array(TransactionSchema),
});

export class UnreadableReceiptError extends Error {
  constructor(message = 'Receipt image is unreadable.') {
    super(message);
    this.name = 'UnreadableReceiptError';
  }
}

export class ReceiptAnalysisError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ReceiptAnalysisError';
  }
}

export interface AnalyzeReceiptOptions {
  apiKey: string;
  endpoint: string;
  model: string;
  categories?: Category[];
  fewShotText?: string;
}

function createFoundryProvider(options: AnalyzeReceiptOptions) {
  return createOpenAI({
    baseURL: options.endpoint,
    apiKey: options.apiKey,
    headers: {
      'api-key': options.apiKey,
    },
  });
}

export async function analyzeReceipt(
  imageBuffer: Buffer,
  options: AnalyzeReceiptOptions,
): Promise<Transaction[]> {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new UnreadableReceiptError('Receipt image data is empty.');
  }

  const provider = createFoundryProvider(options);
  const categories = options.categories ?? [];
  const fewShotText = options.fewShotText ?? '';

  try {
    const categoryText = formatCategoriesForPrompt(categories);
    const systemPrompt = await loadPrompt('system', {
      CATEGORIES: categoryText,
      FEW_SHOT: fewShotText,
    });
    const userPrompt = await loadPrompt('analyze-receipt');

    const result = await generateObject({
      model: provider(options.model),
      schema: AnalysisResultSchema,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text' as const,
              text: userPrompt,
            },
            {
              type: 'image' as const,
              image: imageBuffer,
            },
          ],
        },
      ],
    });

    const validTransactions = result.object.items.filter(
      (transaction) => !isUnreadableTransaction(transaction),
    );

    if (validTransactions.length === 0) {
      throw new UnreadableReceiptError(
        'Receipt image is unclear; no readable items found.',
      );
    }

    return validTransactions;
  } catch (error) {
    if (error instanceof UnreadableReceiptError) {
      throw error;
    }

    throw new ReceiptAnalysisError(
      `Failed to analyze receipt image: ${errorToMessage(error)}`,
      { cause: error },
    );
  }
}

export function getFiscalYear(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const fiscalYear = month >= 4 ? year : year - 1;

  return `FY${fiscalYear.toString().slice(-2)}`;
}

export function groupTransactionsByFiscalYear(
  receipts: ProcessedReceipt[],
): Record<string, Transaction[]> {
  const fiscalYearGroups: Record<string, Transaction[]> = {};

  for (const receipt of receipts) {
    for (const transaction of receipt.transactions) {
      const fiscalYear = getFiscalYear(transaction.date);
      fiscalYearGroups[fiscalYear] ??= [];
      fiscalYearGroups[fiscalYear].push(transaction);
    }
  }

  return fiscalYearGroups;
}

export function isUnreadableTransaction(transaction: Transaction): boolean {
  return (
    transaction.date === UNKNOWN_DATE ||
    transaction.amount === UNKNOWN_AMOUNT ||
    transaction.storeName.trim().toLowerCase() === UNKNOWN_TEXT ||
    transaction.majorCategory.trim().toLowerCase() === UNKNOWN_TEXT ||
    transaction.minorCategory.trim().toLowerCase() === UNKNOWN_TEXT ||
    transaction.categoryItem.trim().toLowerCase() === UNKNOWN_TEXT ||
    transaction.purchasedItem.trim().toLowerCase() === UNKNOWN_TEXT
  );
}

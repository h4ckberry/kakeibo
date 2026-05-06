import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { ENV } from '../../env';
import { loadUserConfigs } from '../../services/config';
import { prepareKakeiboContext } from '../../services/context';
import {
  downloadImageBuffer,
  getReceiptImages,
  moveFileToProcessed,
} from '../../services/drive';
import {
  analyzeReceipt,
  groupTransactionsByFiscalYear,
} from '../../services/receipt';
import { appendTransactions, getOrCreateSheet } from '../../services/sheets';
import type { ProcessedReceipt, Transaction, UserConfig } from '../../types';

const emptyInputSchema = z.object({});

async function loadAdkUserConfig(): Promise<UserConfig> {
  const configs = await loadUserConfigs(
    ENV.USER_CONFIGS_PARAMETER,
    ENV.USER_CONFIGS_VERSION,
  );
  const selected = ENV.ADK_USER_CONFIG_ID
    ? configs.find((config) => config.id === ENV.ADK_USER_CONFIG_ID)
    : configs[0];

  if (!selected) {
    throw new Error('No ADK user config is available');
  }

  return selected;
}

export const listReceiptsTool = new FunctionTool({
  name: 'list_receipts',
  description:
    'List receipt image files in the configured Google Drive inbox folder.',
  parameters: emptyInputSchema,
  execute: async () => {
    const config = await loadAdkUserConfig();
    return {
      receipts: await getReceiptImages(config.driveInboxFolderId),
    };
  },
});

export const prepareContextTool = new FunctionTool({
  name: 'prepare_kakeibo_context',
  description:
    'Fetch categories, recent items, and few-shot prompt context for receipt analysis.',
  parameters: emptyInputSchema,
  execute: async () => {
    const config = await loadAdkUserConfig();
    return prepareKakeiboContext({
      spreadsheetId: config.spreadsheetId,
      azureOpenAiApiKey: ENV.AZURE_OPENAI_API_KEY,
      azureOpenAiEndpoint: ENV.AZURE_OPENAI_ENDPOINT,
      volcanoAzureModel: ENV.VOLCANO_AZURE_MODEL,
      driveInboxFolderId: config.driveInboxFolderId,
      driveProcessedFolderId: config.driveProcessedFolderId,
    });
  },
});

export const analyzeReceiptTool = new FunctionTool({
  name: 'analyze_receipt',
  description:
    'Download and analyze one receipt image, returning extracted transactions.',
  parameters: z.object({
    fileId: z.string().min(1),
    fileName: z.string().min(1),
    categories: z
      .array(
        z.object({
          majorCategory: z.string(),
          minorCategory: z.string(),
          categoryItem: z.string(),
        }),
      )
      .default([]),
    fewShotText: z.string().default(''),
  }),
  execute: async ({ fileId, fileName, categories, fewShotText }) => {
    const imageBuffer = await downloadImageBuffer(fileId);
    const transactions = await analyzeReceipt(imageBuffer, {
      apiKey: ENV.AZURE_OPENAI_API_KEY,
      endpoint: ENV.AZURE_OPENAI_ENDPOINT,
      model: ENV.VOLCANO_AZURE_MODEL,
      categories,
      fewShotText,
    });

    return {
      fileId,
      fileName,
      transactions,
    } satisfies ProcessedReceipt;
  },
});

export const writeTransactionsTool = new FunctionTool({
  name: 'write_transactions',
  description:
    'Group transactions by fiscal year and append them to Google Sheets.',
  parameters: z.object({
    receipts: z.array(
      z.object({
        fileId: z.string(),
        fileName: z.string(),
        transactions: z.array(
          z.object({
            date: z.string(),
            storeName: z.string(),
            majorCategory: z.string(),
            minorCategory: z.string(),
            categoryItem: z.string(),
            purchasedItem: z.string(),
            amount: z.number(),
          }),
        ),
      }),
    ),
  }),
  execute: async ({ receipts }) => {
    const config = await loadAdkUserConfig();
    const transactionsByFiscalYear = groupTransactionsByFiscalYear(
      receipts as ProcessedReceipt[],
    );
    const appendedByFy: Record<string, number> = {};
    let totalAppended = 0;

    for (const [sheetName, transactions] of Object.entries(
      transactionsByFiscalYear,
    )) {
      await getOrCreateSheet({
        spreadsheetId: config.spreadsheetId,
        sheetName,
      });
      await appendTransactions(transactions as Transaction[], {
        spreadsheetId: config.spreadsheetId,
        sheetName,
      });
      appendedByFy[sheetName] = transactions.length;
      totalAppended += transactions.length;
    }

    return { appended: totalAppended, appendedByFy };
  },
});

export const moveProcessedReceiptsTool = new FunctionTool({
  name: 'move_processed_receipts',
  description:
    'Move successfully processed receipt files from inbox to processed folder.',
  parameters: z.object({
    fileIds: z.array(z.string().min(1)),
  }),
  execute: async ({ fileIds }) => {
    const config = await loadAdkUserConfig();
    const moved: string[] = [];
    for (const fileId of fileIds) {
      await moveFileToProcessed(fileId, {
        inboxFolderId: config.driveInboxFolderId,
        processedFolderId: config.driveProcessedFolderId,
      });
      moved.push(fileId);
    }

    return { moved };
  },
});

export const kakeiboAdkTools = [
  prepareContextTool,
  listReceiptsTool,
  analyzeReceiptTool,
  writeTransactionsTool,
  moveProcessedReceiptsTool,
];

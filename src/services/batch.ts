import { errorToMessage, log } from '../logger';
import type {
  BatchError,
  KakeiboBatchConfig,
  KakeiboBatchResult,
  ProcessedReceipt,
} from '../types';
import { prepareKakeiboContext } from './context';
import {
  downloadImageBuffer,
  getReceiptImages,
  moveFileToProcessed,
} from './drive';
import {
  analyzeReceipt,
  groupTransactionsByFiscalYear,
  UnreadableReceiptError,
} from './receipt';
import { appendTransactions, getOrCreateSheet } from './sheets';

export async function runKakeiboBatch(
  config: KakeiboBatchConfig,
): Promise<KakeiboBatchResult> {
  log('INFO', 'Batch job started', { agentFramework: 'adk' });

  const errors: BatchError[] = [];
  const receiptImages = await getReceiptImages(config.driveInboxFolderId);
  log('INFO', `Found ${receiptImages.length} receipt(s)`, {
    count: receiptImages.length,
  });

  if (receiptImages.length === 0) {
    log('INFO', 'No receipts to process, exiting');
    return emptyResult(0);
  }

  const context = await prepareKakeiboContext(config);
  log('INFO', 'Prepared kakeibo context', {
    categoryCount: context.categories.length,
    recentItemCount: context.recentItems.length,
    fewShotLength: context.fewShotText.length,
  });

  const processedReceipts: ProcessedReceipt[] = [];

  for (const receiptImage of receiptImages) {
    let imageBuffer: Buffer;

    try {
      imageBuffer = await downloadImageBuffer(receiptImage.id);
    } catch (error) {
      errors.push({
        fileId: receiptImage.id,
        fileName: receiptImage.name,
        stage: 'download',
        message: errorToMessage(error),
      });
      continue;
    }

    try {
      log('INFO', `Analyzing ${receiptImage.name}...`);
      const transactions = await analyzeReceipt(imageBuffer, {
        apiKey: config.azureOpenAiApiKey,
        endpoint: config.azureOpenAiEndpoint,
        model: config.volcanoAzureModel,
        categories: context.categories,
        fewShotText: context.fewShotText,
      });

      log('INFO', `Analyzed ${receiptImage.name}`, {
        itemCount: transactions.length,
      });

      processedReceipts.push({
        fileId: receiptImage.id,
        fileName: receiptImage.name,
        transactions,
      });
    } catch (error) {
      log(
        error instanceof UnreadableReceiptError ? 'WARN' : 'ERROR',
        'Analyze failed',
        {
          fileId: receiptImage.id,
          fileName: receiptImage.name,
          error: errorToMessage(error),
        },
      );
      errors.push({
        fileId: receiptImage.id,
        fileName: receiptImage.name,
        stage: 'analyze',
        message: errorToMessage(error),
      });
    }
  }

  if (processedReceipts.length === 0) {
    log('WARN', 'No receipts could be analyzed', {
      found: receiptImages.length,
      errorCount: errors.length,
    });
    return buildResult(
      receiptImages.length,
      processedReceipts,
      0,
      {},
      0,
      errors,
    );
  }

  const transactionsByFiscalYear =
    groupTransactionsByFiscalYear(processedReceipts);
  const appendedByFy: Record<string, number> = {};
  let totalAppended = 0;

  for (const [fiscalYear, transactions] of Object.entries(
    transactionsByFiscalYear,
  )) {
    try {
      log('INFO', `Writing ${transactions.length} items to ${fiscalYear}...`);
      const sheetName = await getOrCreateSheet({
        spreadsheetId: config.spreadsheetId,
        sheetName: fiscalYear,
      });

      await appendTransactions(transactions, {
        spreadsheetId: config.spreadsheetId,
        sheetName,
      });

      appendedByFy[fiscalYear] = transactions.length;
      totalAppended += transactions.length;
      log('INFO', `Appended to ${fiscalYear}`, { count: transactions.length });
    } catch (error) {
      const message = `${fiscalYear}: ${errorToMessage(error)}`;
      errors.push({ stage: 'append', message });
      throw new Error(`Batch failed during append: ${message}`, {
        cause: error,
      });
    }
  }

  let moved = 0;
  for (const processedReceipt of processedReceipts) {
    try {
      await moveFileToProcessed(processedReceipt.fileId, {
        inboxFolderId: config.driveInboxFolderId,
        processedFolderId: config.driveProcessedFolderId,
      });
      moved += 1;
    } catch (error) {
      errors.push({
        fileId: processedReceipt.fileId,
        fileName: processedReceipt.fileName,
        stage: 'move',
        message: errorToMessage(error),
      });
    }
  }

  const result = buildResult(
    receiptImages.length,
    processedReceipts,
    totalAppended,
    appendedByFy,
    moved,
    errors,
  );

  log('INFO', 'Batch job completed', {
    found: result.found,
    analyzed: result.analyzed,
    appended: result.appended,
    appendedByFy: result.appendedByFy,
    moved: result.moved,
    errorCount: result.errors.length,
  });

  if (result.errors.length > 0) {
    log('WARN', 'Completed with errors', { errors: result.errors });
  }

  return result;
}

function emptyResult(exitCode: 0 | 1): KakeiboBatchResult {
  return {
    found: 0,
    analyzed: 0,
    appended: 0,
    appendedByFy: {},
    moved: 0,
    errors: [],
    exitCode,
  };
}

function buildResult(
  found: number,
  processedReceipts: ProcessedReceipt[],
  appended: number,
  appendedByFy: Record<string, number>,
  moved: number,
  errors: BatchError[],
): KakeiboBatchResult {
  return {
    found,
    analyzed: processedReceipts.length,
    appended,
    appendedByFy,
    moved,
    errors,
    exitCode: errors.length > 0 ? 1 : 0,
  };
}

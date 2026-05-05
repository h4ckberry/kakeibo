import { ENV } from '../env';
import { errorToMessage, log } from '../logger';
import { runKakeiboBatch } from '../services/batch';

export async function runCloudRunJob(): Promise<void> {
  try {
    const result = await runKakeiboBatch({
      spreadsheetId: ENV.SPREADSHEET_ID,
      azureOpenAiApiKey: ENV.AZURE_OPENAI_API_KEY,
      azureOpenAiEndpoint: ENV.AZURE_OPENAI_ENDPOINT,
      volcanoAzureModel: ENV.VOLCANO_AZURE_MODEL,
      driveInboxFolderId: ENV.DRIVE_INBOX_FOLDER_ID,
      driveProcessedFolderId: ENV.DRIVE_PROCESSED_FOLDER_ID,
    });

    process.exitCode = result.exitCode;
  } catch (error) {
    log('ERROR', 'Batch job failed', { error: errorToMessage(error) });
    process.exitCode = 1;
  }
}

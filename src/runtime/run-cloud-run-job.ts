import { ENV } from '../env';
import { errorToMessage, log } from '../logger';
import { runKakeiboBatch } from '../services/batch';
import { loadUserConfigs } from '../services/config';

export async function runCloudRunJob(): Promise<void> {
  try {
    const userConfigs = await loadUserConfigs(
      ENV.USER_CONFIGS_PARAMETER,
      ENV.USER_CONFIGS_VERSION,
    );
    log('INFO', 'Loaded user configs', { count: userConfigs.length });
    let finalExitCode: 0 | 1 = 0;

    for (const user of userConfigs) {
      try {
        log('INFO', 'Starting user batch', { userId: user.id });
        const result = await runKakeiboBatch({
          spreadsheetId: user.spreadsheetId,
          azureOpenAiApiKey: ENV.AZURE_OPENAI_API_KEY,
          azureOpenAiEndpoint: ENV.AZURE_OPENAI_ENDPOINT,
          volcanoAzureModel: ENV.VOLCANO_AZURE_MODEL,
          driveInboxFolderId: user.driveInboxFolderId,
          driveProcessedFolderId: user.driveProcessedFolderId,
        });

        log('INFO', 'Completed user batch', {
          userId: user.id,
          exitCode: result.exitCode,
        });

        if (result.exitCode !== 0) {
          finalExitCode = 1;
        }
      } catch (error) {
        log('ERROR', 'Failed user batch', {
          userId: user.id,
          error: errorToMessage(error),
        });
        finalExitCode = 1;
      }
    }

    process.exitCode = finalExitCode;
  } catch (error) {
    log('ERROR', 'Batch job failed', { error: errorToMessage(error) });
    process.exitCode = 1;
  }
}

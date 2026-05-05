import { z } from 'zod';

const envSchema = z.object({
  SPREADSHEET_ID: z.string().min(1, 'SPREADSHEET_ID is required'),
  AZURE_OPENAI_API_KEY: z.string().min(1, 'AZURE_OPENAI_API_KEY is required'),
  AZURE_OPENAI_ENDPOINT: z
    .string()
    .url('AZURE_OPENAI_ENDPOINT must be a valid URL'),
  VOLCANO_AZURE_MODEL: z.string().min(1, 'VOLCANO_AZURE_MODEL is required'),
  DRIVE_INBOX_FOLDER_ID: z.string().min(1, 'DRIVE_INBOX_FOLDER_ID is required'),
  DRIVE_PROCESSED_FOLDER_ID: z
    .string()
    .min(1, 'DRIVE_PROCESSED_FOLDER_ID is required'),
});

export const ENV = envSchema.parse(process.env);

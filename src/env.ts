import { z } from 'zod';

const envSchema = z.object({
  AZURE_OPENAI_API_KEY: z.string().min(1, 'AZURE_OPENAI_API_KEY is required'),
  AZURE_OPENAI_ENDPOINT: z
    .string()
    .url('AZURE_OPENAI_ENDPOINT must be a valid URL'),
  VOLCANO_AZURE_MODEL: z.string().min(1, 'VOLCANO_AZURE_MODEL is required'),
  USER_CONFIGS_PARAMETER: z
    .string()
    .min(1, 'USER_CONFIGS_PARAMETER is required'),
  USER_CONFIGS_VERSION: z.string().min(1, 'USER_CONFIGS_VERSION is required'),
  ADK_USER_CONFIG_ID: z.string().min(1).optional(),
});

export const ENV = envSchema.parse(process.env);

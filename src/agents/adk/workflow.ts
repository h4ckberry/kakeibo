import { LlmAgent, SequentialAgent } from '@google/adk';
import { kakeiboAdkTools } from '../../adapters/adk/tools';

const model = process.env.ADK_MODEL ?? 'gemini-2.5-flash';
const workflowInstruction = await Bun.file(
  'prompts/kakeibo-batch-agent.md',
).text();

const kakeiboBatchAgent = new LlmAgent({
  name: 'KakeiboBatchAgent',
  model,
  description:
    'Runs the kakeibo receipt-processing batch workflow through framework adapters.',
  instruction: workflowInstruction,
  tools: kakeiboAdkTools,
  outputKey: 'kakeibo_batch_result',
});

export const rootAgent = new SequentialAgent({
  name: 'KakeiboBatchWorkflow',
  description:
    'Deterministic ADK workflow container for the kakeibo Cloud Run Job.',
  subAgents: [kakeiboBatchAgent],
});

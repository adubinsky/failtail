import { z } from 'zod';
import { runCommand, checkCommandExists, detectAuthError } from '../utils/process.js';
import { LogResult } from '../types.js';

export const renderLogsSchema = z.object({
  service: z.string().describe('Render service name or ID'),
  tail: z.boolean().optional().default(true).describe('Stream logs continuously'),
  tail_seconds: z.number().optional().default(10).describe('Seconds to collect logs when tailing'),
});

export type RenderLogsInput = z.infer<typeof renderLogsSchema>;

export async function renderLogs(input: RenderLogsInput): Promise<LogResult> {
  const exists = await checkCommandExists('render');
  if (!exists) {
    return {
      success: false,
      logs: '',
      error: 'Render CLI not found. Install it from: https://render.com/docs/cli',
    };
  }

  const args = ['logs', input.service];

  const result = await runCommand({
    command: 'render',
    args,
    tail: input.tail,
    tailSeconds: input.tail_seconds,
  });

  // Check for auth errors and provide helpful message
  if (!result.success) {
    const authError = detectAuthError(result.error || result.logs, 'render');
    if (authError) {
      return { ...result, error: authError };
    }
  }

  return result;
}

export const renderToolDefinition = {
  name: 'render_logs',
  description: 'Tail logs from a Render service. Requires Render CLI to be installed and authenticated (render login).',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Render service name or ID',
      },
      tail: {
        type: 'boolean',
        description: 'Stream logs continuously (default: true)',
        default: true,
      },
      tail_seconds: {
        type: 'number',
        description: 'Seconds to collect logs when tailing (default: 10)',
        default: 10,
      },
    },
    required: ['service'],
  },
};

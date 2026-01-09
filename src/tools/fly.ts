import { z } from 'zod';
import { runCommand, checkCommandExists, detectAuthError } from '../utils/process.js';
import { LogResult } from '../types.js';

export const flyLogsSchema = z.object({
  app: z.string().describe('Fly.io app name'),
  tail: z.boolean().optional().default(true).describe('Stream logs continuously'),
  tail_seconds: z.number().optional().default(10).describe('Seconds to collect logs when tailing'),
  region: z.string().optional().describe('Filter by region (e.g., "iad", "lhr")'),
  machine: z.string().optional().describe('Filter by machine ID'),
  json: z.boolean().optional().describe('Output in JSON format'),
});

export type FlyLogsInput = z.infer<typeof flyLogsSchema>;

export async function flyLogs(input: FlyLogsInput): Promise<LogResult> {
  // Try both 'fly' and 'flyctl' commands
  let command = 'fly';
  let exists = await checkCommandExists('fly');

  if (!exists) {
    command = 'flyctl';
    exists = await checkCommandExists('flyctl');
  }

  if (!exists) {
    return {
      success: false,
      logs: '',
      error: 'Fly.io CLI not found. Install it with: brew install flyctl',
    };
  }

  const args = ['logs', '-a', input.app];

  // Fly.io tails by default, use --no-tail for snapshot
  if (!input.tail) {
    args.push('--no-tail');
  }

  if (input.region) {
    args.push('--region', input.region);
  }

  if (input.machine) {
    args.push('--machine', input.machine);
  }

  if (input.json) {
    args.push('--json');
  }

  const result = await runCommand({
    command,
    args,
    tail: input.tail,
    tailSeconds: input.tail_seconds,
  });

  // Check for auth errors and provide helpful message
  if (!result.success) {
    const authError = detectAuthError(result.error || result.logs, 'fly');
    if (authError) {
      return { ...result, error: authError };
    }
  }

  return result;
}

export const flyToolDefinition = {
  name: 'fly_logs',
  description: 'Tail logs from a Fly.io application. Requires Fly CLI to be installed and authenticated (fly auth login).',
  inputSchema: {
    type: 'object',
    properties: {
      app: {
        type: 'string',
        description: 'Fly.io app name',
      },
      tail: {
        type: 'boolean',
        description: 'Stream logs continuously (default: true). Set to false for snapshot only.',
        default: true,
      },
      tail_seconds: {
        type: 'number',
        description: 'Seconds to collect logs when tailing (default: 10)',
        default: 10,
      },
      region: {
        type: 'string',
        description: 'Filter by region (e.g., "iad", "lhr", "fra")',
      },
      machine: {
        type: 'string',
        description: 'Filter by machine ID',
      },
      json: {
        type: 'boolean',
        description: 'Output in JSON format',
      },
    },
    required: ['app'],
  },
};

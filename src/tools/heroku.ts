import { z } from 'zod';
import { runCommand, checkCommandExists, detectAuthError } from '../utils/process.js';
import { LogResult } from '../types.js';

export const herokuLogsSchema = z.object({
  app: z.string().describe('Heroku app name'),
  tail: z.boolean().optional().default(true).describe('Stream logs continuously'),
  tail_seconds: z.number().optional().default(10).describe('Seconds to collect logs when tailing'),
  source: z.enum(['app', 'heroku']).optional().describe('Filter by source'),
  process_type: z.string().optional().describe('Filter by process type (e.g., "web", "worker")'),
  dyno_name: z.string().optional().describe('Filter by specific dyno'),
  num_lines: z.number().optional().describe('Number of historical lines to fetch'),
});

export type HerokuLogsInput = z.infer<typeof herokuLogsSchema>;

export async function herokuLogs(input: HerokuLogsInput): Promise<LogResult> {
  const exists = await checkCommandExists('heroku');
  if (!exists) {
    return {
      success: false,
      logs: '',
      error: 'Heroku CLI not found. Install it with: brew install heroku/brew/heroku',
    };
  }

  const args = ['logs', '-a', input.app];

  if (input.tail) {
    args.push('--tail');
  }

  if (input.source) {
    args.push('--source', input.source);
  }

  if (input.process_type) {
    args.push('--process-type', input.process_type);
  }

  if (input.dyno_name) {
    args.push('--dyno-name', input.dyno_name);
  }

  if (input.num_lines !== undefined) {
    args.push('--num', input.num_lines.toString());
  }

  const result = await runCommand({
    command: 'heroku',
    args,
    tail: input.tail,
    tailSeconds: input.tail_seconds,
  });

  // Check for auth errors and provide helpful message
  if (!result.success) {
    const authError = detectAuthError(result.error || result.logs, 'heroku');
    if (authError) {
      return { ...result, error: authError };
    }
  }

  return result;
}

export const herokuToolDefinition = {
  name: 'heroku_logs',
  description: 'Tail logs from a Heroku application. Requires Heroku CLI to be installed and authenticated (heroku login).',
  inputSchema: {
    type: 'object',
    properties: {
      app: {
        type: 'string',
        description: 'Heroku app name',
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
      source: {
        type: 'string',
        enum: ['app', 'heroku'],
        description: 'Filter by source ("app" for application logs, "heroku" for system logs)',
      },
      process_type: {
        type: 'string',
        description: 'Filter by process type (e.g., "web", "worker")',
      },
      dyno_name: {
        type: 'string',
        description: 'Filter by specific dyno name',
      },
      num_lines: {
        type: 'number',
        description: 'Number of historical lines to fetch',
      },
    },
    required: ['app'],
  },
};

import { z } from 'zod';
import { runCommand, checkCommandExists, detectAuthError } from '../utils/process.js';
import { LogResult } from '../types.js';

export const dockerLogsSchema = z.object({
  container: z.string().describe('Container name or ID'),
  tail: z.boolean().optional().default(true).describe('Stream logs continuously'),
  tail_seconds: z.number().optional().default(10).describe('Seconds to collect logs when tailing'),
  num_lines: z.number().optional().describe('Number of historical lines to fetch'),
  timestamps: z.boolean().optional().describe('Show timestamps'),
  since: z.string().optional().describe('Show logs since timestamp (e.g., "2024-01-01" or "10m")'),
  until: z.string().optional().describe('Show logs until timestamp'),
});

export type DockerLogsInput = z.infer<typeof dockerLogsSchema>;

export async function dockerLogs(input: DockerLogsInput): Promise<LogResult> {
  const exists = await checkCommandExists('docker');
  if (!exists) {
    return {
      success: false,
      logs: '',
      error: 'Docker CLI not found. Please install Docker.',
    };
  }

  const args = ['logs'];

  if (input.tail) {
    args.push('--follow');
  }

  if (input.num_lines !== undefined) {
    args.push('--tail', input.num_lines.toString());
  } else if (input.tail) {
    // Default to last 100 lines when tailing
    args.push('--tail', '100');
  }

  if (input.timestamps) {
    args.push('--timestamps');
  }

  if (input.since) {
    args.push('--since', input.since);
  }

  if (input.until) {
    args.push('--until', input.until);
  }

  args.push(input.container);

  const result = await runCommand({
    command: 'docker',
    args,
    tail: input.tail,
    tailSeconds: input.tail_seconds,
  });

  // Check for auth errors and provide helpful message
  if (!result.success) {
    const authError = detectAuthError(result.error || result.logs, 'docker');
    if (authError) {
      return { ...result, error: authError };
    }
  }

  return result;
}

export const dockerToolDefinition = {
  name: 'docker_logs',
  description: 'Tail logs from a Docker container. Requires Docker to be installed and running.',
  inputSchema: {
    type: 'object',
    properties: {
      container: {
        type: 'string',
        description: 'Container name or ID',
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
      num_lines: {
        type: 'number',
        description: 'Number of historical lines to fetch (default: 100 when tailing)',
      },
      timestamps: {
        type: 'boolean',
        description: 'Show timestamps',
      },
      since: {
        type: 'string',
        description: 'Show logs since timestamp (e.g., "2024-01-01", "10m", "1h")',
      },
      until: {
        type: 'string',
        description: 'Show logs until timestamp',
      },
    },
    required: ['container'],
  },
};

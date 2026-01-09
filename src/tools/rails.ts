import { z } from 'zod';
import { runCommand, checkCommandExists } from '../utils/process.js';
import { LogResult } from '../types.js';
import { existsSync } from 'fs';

export const railsLogsSchema = z.object({
  path: z.string().optional().describe('Path to log file'),
  environment: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development')
    .describe('Rails environment'),
  num_lines: z.number().optional().default(100).describe('Number of historical lines to show'),
  tail: z.boolean().optional().default(true).describe('Stream logs continuously'),
  tail_seconds: z.number().optional().default(10).describe('Seconds to collect logs when tailing'),
  ssh_host: z.string().optional().describe('SSH host for remote log tailing'),
});

export type RailsLogsInput = z.infer<typeof railsLogsSchema>;

export async function railsLogs(input: RailsLogsInput): Promise<LogResult> {
  // Determine the log file path
  let logPath = input.path;
  if (!logPath) {
    logPath = `log/${input.environment}.log`;
  }

  if (input.ssh_host) {
    // Remote log tailing via SSH
    const exists = await checkCommandExists('ssh');
    if (!exists) {
      return {
        success: false,
        logs: '',
        error: 'SSH command not found',
      };
    }

    const tailCmd = input.tail
      ? `tail -n ${input.num_lines} -f ${logPath}`
      : `tail -n ${input.num_lines} ${logPath}`;

    return runCommand({
      command: 'ssh',
      args: [input.ssh_host, tailCmd],
      tail: input.tail,
      tailSeconds: input.tail_seconds,
    });
  } else {
    // Local log tailing
    if (!existsSync(logPath)) {
      return {
        success: false,
        logs: '',
        error: `Log file not found: ${logPath}. Make sure you're in a Rails project directory.`,
      };
    }

    const args = ['-n', input.num_lines.toString()];
    if (input.tail) {
      args.push('-f');
    }
    args.push(logPath);

    return runCommand({
      command: 'tail',
      args,
      tail: input.tail,
      tailSeconds: input.tail_seconds,
    });
  }
}

export const railsToolDefinition = {
  name: 'rails_logs',
  description:
    'Tail Rails application logs. Works with local log files or remote servers via SSH.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'Path to log file (default: log/{environment}.log)',
      },
      environment: {
        type: 'string',
        enum: ['development', 'production', 'test'],
        description: 'Rails environment (default: development)',
        default: 'development',
      },
      num_lines: {
        type: 'number',
        description: 'Number of historical lines to show (default: 100)',
        default: 100,
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
      ssh_host: {
        type: 'string',
        description:
          'SSH host for remote log tailing (e.g., "user@server.com")',
      },
    },
    required: [],
  },
};

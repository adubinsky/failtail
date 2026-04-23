import { z } from 'zod';
import { createWriteStream } from 'fs';
import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { runCommand, checkCommandExists, detectAuthError, parseDuration, spawnTailProcess } from '../utils/process.js';
import { LogResult } from '../types.js';
import { sessionManager } from '../utils/session.js';

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

// --- fly_capture: long-running log capture to file ---

export const flyCaptureSchema = z.object({
  app: z.string().describe('Fly.io app name'),
  duration: z.string().optional().default('5m').describe('How long to capture logs (e.g. "30s", "5m", "1h", "1h30m")'),
  output_dir: z.string().optional().describe('Directory to write log file (default: ~/.failtail/captures)'),
  region: z.string().optional().describe('Filter by region (e.g., "iad", "lhr")'),
  machine: z.string().optional().describe('Filter by machine ID'),
  json: z.boolean().optional().describe('Output in JSON format'),
});

export type FlyCaptureInput = z.infer<typeof flyCaptureSchema>;

export async function flyCapture(input: FlyCaptureInput): Promise<LogResult> {
  // Resolve CLI command
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

  // Parse duration
  let durationMs: number;
  try {
    durationMs = parseDuration(input.duration ?? '5m');
  } catch (e) {
    return {
      success: false,
      logs: '',
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Prepare output directory and file
  const outputDir = input.output_dir || join(homedir(), '.failtail', 'captures');
  mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${input.app}-${timestamp}.log`;
  const filePath = join(outputDir, fileName);

  // Build args
  const args = ['logs', '-a', input.app];
  if (input.region) args.push('--region', input.region);
  if (input.machine) args.push('--machine', input.machine);
  if (input.json) args.push('--json');

  // Spawn process
  const proc = spawnTailProcess(command, args);
  if (!proc) {
    return {
      success: false,
      logs: '',
      error: `Failed to spawn ${command} process.`,
    };
  }

  // Stream to file
  const fileStream = createWriteStream(filePath, { flags: 'a' });
  proc.stdout?.pipe(fileStream);
  proc.stderr?.pipe(fileStream);

  // Check for early auth errors (give it 3 seconds)
  const authError = await new Promise<string | null>((resolve) => {
    let stderr = '';
    const onData = (data: Buffer) => {
      stderr += data.toString();
    };
    proc.stderr?.on('data', onData);

    proc.on('close', () => {
      const err = detectAuthError(stderr, 'fly');
      resolve(err);
    });

    setTimeout(() => {
      proc.stderr?.removeListener('data', onData);
      resolve(null);
    }, 3000);
  });

  if (authError) {
    proc.kill('SIGTERM');
    fileStream.close();
    return { success: false, logs: '', error: authError };
  }

  // Register session
  const sessionId = sessionManager.createSession('fly', proc, {
    app: input.app,
    filePath,
    duration: durationMs,
  });

  // Auto-stop after duration
  setTimeout(() => {
    const session = sessionManager.getSession(sessionId);
    if (session && session.status === 'running') {
      session.status = 'completed';
      proc.kill('SIGTERM');
    }
    fileStream.close();
  }, durationMs);

  // Close file stream when process exits
  proc.on('close', () => {
    fileStream.close();
  });

  const durationLabel = input.duration ?? '5m';
  return {
    success: true,
    logs: `Capture started.\n\nSession ID: ${sessionId}\nFile: ${filePath}\nDuration: ${durationLabel}\nApp: ${input.app}\n\nUse list_sessions to check status, or stop_tail to end early.`,
    sessionId,
  };
}

export const flyCaptureToolDefinition = {
  name: 'fly_capture',
  description: 'Capture Fly.io logs to a local file for a specified duration. Runs in the background and streams logs to disk. The file can then be analyzed by AI or other tools.',
  inputSchema: {
    type: 'object',
    properties: {
      app: {
        type: 'string',
        description: 'Fly.io app name',
      },
      duration: {
        type: 'string',
        description: 'How long to capture logs (e.g. "30s", "5m", "1h", "1h30m"). Default: "5m". Max: 4h.',
        default: '5m',
      },
      output_dir: {
        type: 'string',
        description: 'Directory to write the log file. Default: ~/.failtail/captures',
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

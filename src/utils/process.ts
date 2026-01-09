import { spawn, ChildProcess } from 'child_process';
import { LogResult } from '../types.js';

export interface SpawnOptions {
  command: string;
  args: string[];
  timeout?: number;
  tail?: boolean;
  tailSeconds?: number;
}

export async function runCommand(options: SpawnOptions): Promise<LogResult> {
  const { command, args, timeout = 30000, tail = false, tailSeconds = 10 } = options;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        if (error.message.includes('ENOENT')) {
          resolve({
            success: false,
            logs: '',
            error: `Command not found: ${command}. Please ensure it is installed and in your PATH.`,
          });
        } else {
          resolve({
            success: false,
            logs: '',
            error: error.message,
          });
        }
      }
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        if (code === 0 || tail) {
          resolve({
            success: true,
            logs: stdout || stderr,
          });
        } else {
          resolve({
            success: false,
            logs: stdout,
            error: stderr || `Process exited with code ${code}`,
          });
        }
      }
    });

    if (tail) {
      // For tailing, collect output for the specified duration then kill the process
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill('SIGTERM');
          resolve({
            success: true,
            logs: stdout || stderr || '(No logs received during tail period)',
          });
        }
      }, tailSeconds * 1000);
    } else {
      // For non-tailing commands, use the standard timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill('SIGTERM');
          resolve({
            success: false,
            logs: stdout,
            error: `Command timed out after ${timeout}ms`,
          });
        }
      }, timeout);
    }
  });
}

export function spawnTailProcess(
  command: string,
  args: string[]
): ChildProcess | null {
  try {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });
    return proc;
  } catch {
    return null;
  }
}

export async function checkCommandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', [command], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    proc.on('error', () => {
      resolve(false);
    });
  });
}

export interface AuthErrorPattern {
  patterns: RegExp[];
  loginCommand: string;
  loginUrl?: string;
}

export const AUTH_ERROR_PATTERNS: Record<string, AuthErrorPattern> = {
  heroku: {
    patterns: [
      /not logged in/i,
      /authentication required/i,
      /invalid credentials/i,
      /heroku: Press any key to open/i,
      /Error: Missing required flag/i,
    ],
    loginCommand: 'heroku login',
    loginUrl: 'https://dashboard.heroku.com',
  },
  fly: {
    patterns: [
      /not logged in/i,
      /authentication required/i,
      /unauthorized/i,
      /please login/i,
      /No access token/i,
    ],
    loginCommand: 'fly auth login',
    loginUrl: 'https://fly.io/app/sign-in',
  },
  render: {
    patterns: [
      /not logged in/i,
      /authentication required/i,
      /unauthorized/i,
      /invalid.*token/i,
    ],
    loginCommand: 'render login',
    loginUrl: 'https://dashboard.render.com',
  },
  docker: {
    patterns: [
      /unauthorized/i,
      /authentication required/i,
      /denied.*access/i,
    ],
    loginCommand: 'docker login',
  },
};

export function detectAuthError(
  output: string,
  service: keyof typeof AUTH_ERROR_PATTERNS
): string | null {
  const config = AUTH_ERROR_PATTERNS[service];
  if (!config) return null;

  const combinedOutput = output.toLowerCase();

  for (const pattern of config.patterns) {
    if (pattern.test(output)) {
      let message = `Authentication required. Please run: ${config.loginCommand}`;
      if (config.loginUrl) {
        message += `\n\nOr sign in at: ${config.loginUrl}`;
      }
      return message;
    }
  }

  return null;
}

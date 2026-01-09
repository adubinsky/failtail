import { ChildProcess } from 'child_process';

export interface LogSession {
  id: string;
  service: string;
  process: ChildProcess;
  startedAt: Date;
  app?: string;
  container?: string;
}

export interface LogResult {
  success: boolean;
  logs: string;
  sessionId?: string;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: Record<string, unknown>) => Promise<LogResult>;
}

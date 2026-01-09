import { ChildProcess } from 'child_process';
import { LogSession } from '../types.js';
import { randomUUID } from 'crypto';

class SessionManager {
  private sessions: Map<string, LogSession> = new Map();

  createSession(
    service: string,
    process: ChildProcess,
    metadata?: { app?: string; container?: string }
  ): string {
    const id = randomUUID().slice(0, 8);
    const session: LogSession = {
      id,
      service,
      process,
      startedAt: new Date(),
      ...metadata,
    };
    this.sessions.set(id, session);

    // Clean up session when process exits
    process.on('close', () => {
      this.sessions.delete(id);
    });

    return id;
  }

  getSession(id: string): LogSession | undefined {
    return this.sessions.get(id);
  }

  stopSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    try {
      session.process.kill('SIGTERM');
      this.sessions.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  listSessions(): LogSession[] {
    return Array.from(this.sessions.values());
  }

  stopAllSessions(): void {
    for (const session of this.sessions.values()) {
      try {
        session.process.kill('SIGTERM');
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.sessions.clear();
  }
}

export const sessionManager = new SessionManager();

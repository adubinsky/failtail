import { ChildProcess } from 'child_process';
import { statSync } from 'fs';
import { LogSession } from '../types.js';
import { randomUUID } from 'crypto';

export interface SessionInfo {
  id: string;
  service: string;
  startedAt: Date;
  status: 'running' | 'completed' | 'stopped';
  app?: string;
  container?: string;
  filePath?: string;
  duration?: number;
  fileSizeBytes?: number;
}

class SessionManager {
  private sessions: Map<string, LogSession> = new Map();

  createSession(
    service: string,
    process: ChildProcess,
    metadata?: { app?: string; container?: string; filePath?: string; duration?: number }
  ): string {
    const id = randomUUID().slice(0, 8);
    const session: LogSession = {
      id,
      service,
      process,
      startedAt: new Date(),
      status: 'running',
      ...metadata,
    };
    this.sessions.set(id, session);

    // Update status when process exits
    process.on('close', () => {
      const s = this.sessions.get(id);
      if (s && s.status === 'running') {
        s.status = 'completed';
      }
    });

    return id;
  }

  getSession(id: string): LogSession | undefined {
    return this.sessions.get(id);
  }

  getSessionInfo(id: string): SessionInfo | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const info: SessionInfo = {
      id: session.id,
      service: session.service,
      startedAt: session.startedAt,
      status: session.status,
      app: session.app,
      container: session.container,
      filePath: session.filePath,
      duration: session.duration,
    };

    if (session.filePath) {
      try {
        const stat = statSync(session.filePath);
        info.fileSizeBytes = stat.size;
      } catch {
        // File may not exist yet
      }
    }

    return info;
  }

  stopSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    try {
      session.status = 'stopped';
      session.process.kill('SIGTERM');
      return true;
    } catch {
      return false;
    }
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((session) => {
      const info: SessionInfo = {
        id: session.id,
        service: session.service,
        startedAt: session.startedAt,
        status: session.status,
        app: session.app,
        container: session.container,
        filePath: session.filePath,
        duration: session.duration,
      };

      if (session.filePath) {
        try {
          const stat = statSync(session.filePath);
          info.fileSizeBytes = stat.size;
        } catch {
          // File may not exist yet
        }
      }

      return info;
    });
  }

  stopAllSessions(): void {
    for (const session of this.sessions.values()) {
      try {
        session.status = 'stopped';
        session.process.kill('SIGTERM');
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.sessions.clear();
  }

  clearCompleted(): number {
    let cleared = 0;
    for (const [id, session] of this.sessions) {
      if (session.status !== 'running') {
        this.sessions.delete(id);
        cleared++;
      }
    }
    return cleared;
  }
}

export const sessionManager = new SessionManager();

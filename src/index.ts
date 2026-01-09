#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { herokuLogs, herokuLogsSchema, herokuToolDefinition } from './tools/heroku.js';
import { flyLogs, flyLogsSchema, flyToolDefinition } from './tools/fly.js';
import { renderLogs, renderLogsSchema, renderToolDefinition } from './tools/render.js';
import { ngrokLogs, ngrokLogsSchema, ngrokToolDefinition } from './tools/ngrok.js';
import { railsLogs, railsLogsSchema, railsToolDefinition } from './tools/rails.js';
import { dockerLogs, dockerLogsSchema, dockerToolDefinition } from './tools/docker.js';
import { sessionManager } from './utils/session.js';

const server = new Server(
  {
    name: 'failtail',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      herokuToolDefinition,
      flyToolDefinition,
      renderToolDefinition,
      ngrokToolDefinition,
      railsToolDefinition,
      dockerToolDefinition,
      {
        name: 'stop_tail',
        description: 'Stop an active log tailing session',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'ID of the tailing session to stop',
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'list_sessions',
        description: 'List all active log tailing sessions',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'heroku_logs': {
        const input = herokuLogsSchema.parse(args);
        const result = await herokuLogs(input);
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? result.logs
                : `Error: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'fly_logs': {
        const input = flyLogsSchema.parse(args);
        const result = await flyLogs(input);
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? result.logs
                : `Error: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'render_logs': {
        const input = renderLogsSchema.parse(args);
        const result = await renderLogs(input);
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? result.logs
                : `Error: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'ngrok_logs': {
        const input = ngrokLogsSchema.parse(args);
        const result = await ngrokLogs(input);
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? result.logs
                : `Error: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'rails_logs': {
        const input = railsLogsSchema.parse(args);
        const result = await railsLogs(input);
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? result.logs
                : `Error: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'docker_logs': {
        const input = dockerLogsSchema.parse(args);
        const result = await dockerLogs(input);
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? result.logs
                : `Error: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'stop_tail': {
        const sessionId = args?.session_id as string;
        if (!sessionId) {
          return {
            content: [{ type: 'text', text: 'Error: session_id is required' }],
            isError: true,
          };
        }
        const stopped = sessionManager.stopSession(sessionId);
        return {
          content: [
            {
              type: 'text',
              text: stopped
                ? `Session ${sessionId} stopped`
                : `Session ${sessionId} not found`,
            },
          ],
          isError: !stopped,
        };
      }

      case 'list_sessions': {
        const sessions = sessionManager.listSessions();
        if (sessions.length === 0) {
          return {
            content: [{ type: 'text', text: 'No active sessions' }],
          };
        }
        const sessionList = sessions
          .map(
            (s) =>
              `${s.id}: ${s.service} (started ${s.startedAt.toISOString()})`
          )
          .join('\n');
        return {
          content: [{ type: 'text', text: sessionList }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Cleanup on exit
process.on('SIGINT', () => {
  sessionManager.stopAllSessions();
  process.exit(0);
});

process.on('SIGTERM', () => {
  sessionManager.stopAllSessions();
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

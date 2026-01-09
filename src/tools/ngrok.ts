import { z } from 'zod';
import { LogResult } from '../types.js';

export const ngrokLogsSchema = z.object({
  port: z.number().optional().default(4040).describe('ngrok inspection port'),
  limit: z.number().optional().default(50).describe('Number of recent requests to fetch'),
});

export type NgrokLogsInput = z.infer<typeof ngrokLogsSchema>;

interface NgrokRequest {
  uri: string;
  id: string;
  tunnel_name: string;
  remote_addr: string;
  start: string;
  duration: number;
  request: {
    method: string;
    proto: string;
    headers: Record<string, string[]>;
    uri: string;
    raw: string;
  };
  response?: {
    status: string;
    status_code: number;
    proto: string;
    headers: Record<string, string[]>;
    raw: string;
  };
}

interface NgrokApiResponse {
  requests: NgrokRequest[];
}

export async function ngrokLogs(input: NgrokLogsInput): Promise<LogResult> {
  const url = `http://localhost:${input.port}/api/requests/http?limit=${input.limit}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          logs: '',
          error: `ngrok inspection API not available at port ${input.port}. Make sure ngrok is running.`,
        };
      }
      return {
        success: false,
        logs: '',
        error: `Failed to fetch ngrok logs: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as NgrokApiResponse;
    const requests = data.requests || [];

    if (requests.length === 0) {
      return {
        success: true,
        logs: '(No requests captured yet)',
      };
    }

    const formattedLogs = requests
      .map((req) => {
        const timestamp = new Date(req.start).toISOString();
        const method = req.request.method;
        const uri = req.request.uri;
        const status = req.response?.status_code || 'pending';
        const duration = req.duration ? `${req.duration}ns` : '-';

        return `[${timestamp}] ${method} ${uri} -> ${status} (${duration})`;
      })
      .join('\n');

    return {
      success: true,
      logs: formattedLogs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('ECONNREFUSED')) {
      return {
        success: false,
        logs: '',
        error: `Cannot connect to ngrok inspection API at localhost:${input.port}. Make sure ngrok is running.`,
      };
    }

    return {
      success: false,
      logs: '',
      error: `Failed to fetch ngrok logs: ${message}`,
    };
  }
}

export const ngrokToolDefinition = {
  name: 'ngrok_logs',
  description:
    'Fetch request/response logs from ngrok\'s local inspection API. Requires ngrok to be running locally.',
  inputSchema: {
    type: 'object',
    properties: {
      port: {
        type: 'number',
        description: 'ngrok inspection port (default: 4040)',
        default: 4040,
      },
      limit: {
        type: 'number',
        description: 'Number of recent requests to fetch (default: 50)',
        default: 50,
      },
    },
    required: [],
  },
};

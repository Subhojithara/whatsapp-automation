import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

export function registerSessionTools(server: McpServer) {
  server.tool(
    'list_sessions',
    'List all WhatsApp sessions',
    {},
    async () => {
      try {
        const result = await api.get('/sessions');
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: String(error?.message || error) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'create_session',
    'Create a new WhatsApp session',
    {
      name: z.string().describe('Name of the session'),
      engine: z.string().optional().describe('Engine type (e.g., bailey, wwebjs)'),
    },
    async ({ name, engine }: { name: string; engine?: string }) => {
      try {
        const result = await api.post('/sessions', { name, engine });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: String(error?.message || error) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'get_session',
    'Get details for a specific session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const result = await api.get(`/sessions/${session_id}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: String(error?.message || error) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'delete_session',
    'Delete a specific session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const result = await api.delete(`/sessions/${session_id}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: String(error?.message || error) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'start_session',
    'Start an existing session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const result = await api.post(`/sessions/${session_id}/start`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: String(error?.message || error) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'stop_session',
    'Stop a running session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const result = await api.post(`/sessions/${session_id}/stop`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: String(error?.message || error) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'restart_session',
    'Restart a running session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const result = await api.post(`/sessions/${session_id}/restart`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: String(error?.message || error) }],
          isError: true
        };
      }
    }
  );
}

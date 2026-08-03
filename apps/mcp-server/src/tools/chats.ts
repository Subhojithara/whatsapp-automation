import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

export function registerChatTools(server: McpServer) {
  server.tool(
    'list_chats',
    'List chats for a session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const result = await api.get(`/sessions/${session_id}/chats`);
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
    'get_chat_messages',
    'Get messages for a specific chat',
    {
      session_id: z.string().describe('ID of the session'),
      chat_id: z.string().describe('ID of the chat'),
    },
    async ({ session_id, chat_id }: { session_id: string; chat_id: string }) => {
      try {
        const result = await api.get(`/sessions/${session_id}/chats/${chat_id}/messages`);
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
    'sync_chats',
    'Sync chats for a session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const result = await api.post(`/sessions/${session_id}/chats/sync`);
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
    'mark_chat_read',
    'Mark a chat as read',
    {
      session_id: z.string().describe('ID of the session'),
      chat_id: z.string().describe('ID of the chat'),
    },
    async ({ session_id, chat_id }: { session_id: string; chat_id: string }) => {
      try {
        const result = await api.post(`/sessions/${session_id}/chats/${chat_id}/read`);
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

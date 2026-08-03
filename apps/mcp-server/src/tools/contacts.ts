import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

export function registerContactTools(server: McpServer) {
  server.tool(
    'list_contacts',
    'List contacts for a session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const result = await api.get(`/sessions/${session_id}/contacts`);
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
    'search_contacts',
    'Search contacts for a session',
    {
      session_id: z.string().describe('ID of the session'),
      query: z.string().describe('Search query'),
    },
    async ({ session_id, query }: { session_id: string; query: string }) => {
      try {
        const result = await api.get(`/sessions/${session_id}/contacts/search?query=${encodeURIComponent(query)}`);
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
    'sync_contacts',
    'Sync contacts for a session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const result = await api.post(`/sessions/${session_id}/contacts/sync`);
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
    'get_profile_picture',
    'Get profile picture for a contact',
    {
      session_id: z.string().describe('ID of the session'),
      contact_id: z.string().describe('ID or phone number of the contact'),
    },
    async ({ session_id, contact_id }: { session_id: string; contact_id: string }) => {
      try {
        const result = await api.get(`/sessions/${session_id}/contacts/${contact_id}/profile-picture`);
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

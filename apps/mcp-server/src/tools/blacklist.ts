import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

/**
 * Registers blacklist-related tools with the MCP server.
 * @param server The MCP Server instance
 */
export function registerBlacklistTools(server: McpServer) {
  server.tool(
    'get_blacklist',
    'Get the current blacklist',
    {},
    async () => {
      try {
        const result = await api.get('/blacklist');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'add_to_blacklist',
    'Add a phone number to the blacklist',
    {
      phoneNumber: z.string(),
      reason: z.string().optional()
    },
    async (args: { phoneNumber: string; reason?: string }) => {
      try {
        const result = await api.post('/blacklist', args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'remove_from_blacklist',
    'Remove a phone number from the blacklist',
    {
      id: z.string().describe('Blacklist entry ID')
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.delete(`/blacklist/${id}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

/**
 * Registers recipient-related tools with the MCP server.
 * @param server The MCP Server instance
 */
export function registerRecipientTools(server: McpServer) {
  server.tool(
    'list_campaign_recipients',
    'List all recipients for a specific campaign',
    {
      id: z.string().describe('Campaign ID')
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.get(`/campaigns/${id}/recipients`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'update_campaign_recipient',
    'Update a recipient in a campaign',
    {
      id: z.string().describe('Campaign ID'),
      recipient_id: z.string().describe('Recipient ID'),
      customVariablesJson: z.string().optional(),
      nextScheduledAt: z.string().optional()
    },
    async ({ id, recipient_id, ...body }: { id: string; recipient_id: string; customVariablesJson?: string; nextScheduledAt?: string }) => {
      try {
        const result = await api.put(`/campaigns/${id}/recipients/${recipient_id}`, body);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'list_campaign_logs',
    'List logs for a specific campaign',
    {
      id: z.string().describe('Campaign ID')
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.get(`/campaigns/${id}/logs`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );
}

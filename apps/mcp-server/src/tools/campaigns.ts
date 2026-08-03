import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

/**
 * Registers campaign-related tools with the MCP server.
 * @param server The MCP Server instance
 */
export function registerCampaignTools(server: McpServer) {
  server.tool(
    'list_campaigns',
    'List all campaigns',
    {},
    async () => {
      try {
        const result = await api.get('/campaigns');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'get_campaign',
    'Get a specific campaign by ID',
    {
      campaign_id: z.string().describe('The ID of the campaign')
    },
    async ({ campaign_id }: { campaign_id: string }) => {
      try {
        const result = await api.get(`/campaigns/${campaign_id}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'create_campaign',
    'Create a new campaign',
    {
      name: z.string(),
      description: z.string().optional(),
      sessionIds: z.array(z.string()).optional(),
      steps: z.array(z.object({
        stepNumber: z.number().optional(),
        body: z.string().optional(),
        templateText: z.string().optional(),
        template_text: z.string().optional(),
        text: z.string().optional(),
        delayAfterPreviousSec: z.number().optional()
      })),
      antiBanConfig: z.object({
        minDelayMs: z.number().optional(),
        maxDelayMs: z.number().optional(),
        dailyLimit: z.number().optional(),
        workingHoursStart: z.string().optional(),
        workingHoursEnd: z.string().optional()
      }).optional()
    },
    async (args: any) => {
      try {
        const payload = {
          ...args,
          steps: args.steps?.map((s: any, idx: number) => ({
            stepNumber: s.stepNumber ?? (idx + 1),
            delayAfterPreviousSec: s.delayAfterPreviousSec ?? 0,
            templateText: s.templateText || s.template_text || s.body || s.text || ''
          }))
        };
        const result = await api.post('/campaigns', payload);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'update_campaign',
    'Update an existing campaign',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional()
    },
    async ({ id, ...body }: { id: string; name?: string; description?: string }) => {
      try {
        const result = await api.put(`/campaigns/${id}`, body);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'delete_campaign',
    'Delete a campaign',
    {
      id: z.string()
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.delete(`/campaigns/${id}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'clone_campaign',
    'Clone an existing campaign',
    {
      id: z.string()
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.post(`/campaigns/${id}/clone`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'start_campaign',
    'Start a campaign',
    {
      id: z.string()
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.post(`/campaigns/${id}/start`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'pause_campaign',
    'Pause a running campaign',
    {
      id: z.string()
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.post(`/campaigns/${id}/pause`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'stop_campaign',
    'Stop a campaign',
    {
      id: z.string()
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.post(`/campaigns/${id}/stop`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'retry_failed_recipients',
    'Retry failed recipients in a campaign',
    {
      id: z.string()
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.post(`/campaigns/${id}/retry`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'import_recipients',
    'Import recipients to a campaign',
    {
      id: z.string(),
      recipients: z.array(z.object({
        phoneNumber: z.string(),
        customVariables: z.record(z.string()).optional()
      }))
    },
    async ({ id, recipients }: { id: string; recipients: Array<{ phoneNumber: string; customVariables?: Record<string, string> }> }) => {
      try {
        const result = await api.post(`/campaigns/${id}/import-recipients`, { recipients });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'export_campaign_results',
    'Export results of a campaign',
    {
      id: z.string()
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.get(`/campaigns/${id}/export`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );
}

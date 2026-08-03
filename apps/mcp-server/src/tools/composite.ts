import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

/**
 * Registers high-level composite tools with the MCP server.
 * @param server The MCP Server instance
 */
export function registerCompositeTools(server: McpServer) {
  server.tool(
    'send_campaign_message',
    'Validates phone number and sends a text message in one call',
    {
      session_id: z.string(),
      phone_number: z.string(),
      message: z.string()
    },
    async ({ session_id, phone_number, message }: { session_id: string; phone_number: string; message: string }) => {
      try {
        const validation: any = await api.post('/phone-validation', {
          sessionId: session_id,
          phoneNumbers: [phone_number]
        });

        const sendResult = await api.post(`/sessions/${session_id}/messages/send-text`, {
          to: phone_number,
          text: message
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ validation, sendResult }, null, 2)
          }]
        };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'send_bulk_messages',
    'Sends messages to multiple numbers with configurable delay',
    {
      session_id: z.string(),
      phone_numbers: z.array(z.string()),
      message: z.string(),
      delay_ms: z.number().optional().default(3000)
    },
    async ({ session_id, phone_numbers, message, delay_ms }: { session_id: string; phone_numbers: string[]; message: string; delay_ms?: number }) => {
      try {
        const results: any[] = [];
        const delay = delay_ms ?? 3000;

        for (const phone of phone_numbers) {
          try {
            const res = await api.post(`/sessions/${session_id}/messages/send-text`, {
              to: phone,
              text: message
            });
            results.push({ phone_number: phone, status: 'SUCCESS', result: res });
          } catch (err: any) {
            results.push({ phone_number: phone, status: 'FAILED', error: err?.message || String(err) });
          }
          if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        return { content: [{ type: 'text', text: JSON.stringify({ total: phone_numbers.length, results }, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'create_and_start_campaign',
    'Creates a campaign, imports recipients, and starts execution in one all-in-one wizard call',
    {
      name: z.string(),
      session_ids: z.array(z.string()),
      recipients: z.array(z.object({
        phoneNumber: z.string(),
        customVariables: z.record(z.string()).optional()
      })),
      steps: z.array(z.object({
        stepNumber: z.number(),
        body: z.string(),
        delayAfterPreviousSec: z.number()
      })),
      anti_ban_config: z.object({
        minDelayMs: z.number(),
        maxDelayMs: z.number(),
        dailyLimit: z.number(),
        workingHoursStart: z.string().optional(),
        workingHoursEnd: z.string().optional()
      }).optional()
    },
    async (args: any) => {
      try {
        // 1. Create campaign
        const campaign: any = await api.post('/campaigns', {
          name: args.name,
          sessionIds: args.session_ids,
          steps: args.steps,
          antiBanConfig: args.anti_ban_config
        });
        const campaignId = campaign.id;

        // 2. Import recipients
        let importRes = null;
        if (args.recipients && args.recipients.length > 0) {
          importRes = await api.post(`/campaigns/${campaignId}/import-recipients`, { recipients: args.recipients });
        }

        // 3. Start campaign
        const startedCampaign = await api.post(`/campaigns/${campaignId}/start`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              campaignId,
              campaign: startedCampaign,
              importSummary: importRes
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'get_campaign_dashboard',
    'Gets campaign details, recipients, logs, and computes aggregated real-time statistics',
    {
      campaign_id: z.string()
    },
    async ({ campaign_id }: { campaign_id: string }) => {
      try {
        const campaign: any = await api.get(`/campaigns/${campaign_id}`);
        const recipients: any[] = (await api.get(`/campaigns/${campaign_id}/recipients`)) || [];
        const logs: any[] = (await api.get(`/campaigns/${campaign_id}/logs`)) || [];

        const totalRecipients = recipients.length;
        const sent = recipients.filter((r) => r.status === 'SENT' || r.status === 'REPLIED' || r.status === 'DELIVERED').length;
        const delivered = recipients.filter((r) => r.status === 'DELIVERED' || r.status === 'REPLIED').length;
        const replied = recipients.filter((r) => r.status === 'REPLIED').length;
        const failed = recipients.filter((r) => r.status === 'FAILED').length;
        const pending = recipients.filter((r) => r.status === 'PENDING').length;
        const progressPercent = totalRecipients > 0 ? Math.round(((totalRecipients - pending) / totalRecipients) * 100) : 0;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              campaign,
              stats: {
                totalRecipients,
                sent,
                delivered,
                replied,
                failed,
                pending,
                progressPercent
              },
              recentLogsCount: logs.length
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'full_system_status',
    'Gets overall system summary across sessions and campaigns',
    {},
    async () => {
      try {
        const sessions: any[] = (await api.get('/sessions')) || [];
        const campaigns: any[] = (await api.get('/campaigns')) || [];

        const connectedSessions = sessions.filter((s) => s.status === 'CONNECTED').length;
        const activeCampaigns = campaigns.filter((c) => c.status === 'RUNNING' || c.status === 'IN_PROGRESS').length;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              sessionsSummary: {
                total: sessions.length,
                connected: connectedSessions,
                sessions
              },
              campaignsSummary: {
                total: campaigns.length,
                active: activeCampaigns,
                campaigns
              },
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );
}

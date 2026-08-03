import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Registers prompts with the MCP server.
 * @param server The MCP Server instance
 */
export function registerPrompts(server: McpServer) {
  server.prompt(
    'campaign-wizard',
    'A multi-step prompt guiding the AI through campaign creation',
    {
      campaign_name: z.string().describe('The name of the campaign to create')
    },
    ({ campaign_name }: { campaign_name: string }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Let's create a new campaign named "${campaign_name}".\n\nPlease guide me through the following steps:\n1. Defining the campaign description and selecting sessions.\n2. Creating the message templates/steps.\n3. Configuring anti-ban settings.\n4. Importing recipients.`
            }
          }
        ]
      };
    }
  );

  server.prompt(
    'troubleshoot-session',
    'Diagnostic prompt to troubleshoot a session',
    {
      session_id: z.string().describe('The ID of the session to troubleshoot')
    },
    ({ session_id }: { session_id: string }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I need help troubleshooting session "${session_id}".\n\nPlease use the available tools to check its status, recent logs, and connectivity, then provide a diagnostic summary and recommended fixes.`
            }
          }
        ]
      };
    }
  );

  server.prompt(
    'daily-report',
    'Returns a reporting prompt for daily statistics',
    {
      date: z.string().optional().describe('Optional date for the report (YYYY-MM-DD)')
    },
    ({ date }: { date?: string }) => {
      const reportDate = date || new Date().toISOString().split('T')[0];
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please generate a daily report for ${reportDate}.\n\nFetch the full system status, active campaigns, and recent logs, then summarize the total messages sent, delivered, failed, and replied for this date.`
            }
          }
        ]
      };
    }
  );
}

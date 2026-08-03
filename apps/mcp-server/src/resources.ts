import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { api } from './api-client.js';

/**
 * Registers resources with the MCP server.
 * @param server The MCP Server instance
 */
export function registerResources(server: McpServer) {
  server.resource(
    'sessions-status',
    'reachout://sessions/status',
    async (uri) => {
      try {
        const sessions = await api.get('/sessions');
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(sessions, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to fetch sessions: ${error?.message || error}`);
      }
    }
  );

  server.resource(
    'campaigns-active',
    'reachout://campaigns/active',
    async (uri) => {
      try {
        const campaigns: any = await api.get('/campaigns');
        const activeCampaigns = Array.isArray(campaigns) 
          ? campaigns.filter((c) => c.status === 'RUNNING' || c.status === 'IN_PROGRESS')
          : campaigns;
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(activeCampaigns, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to fetch active campaigns: ${error?.message || error}`);
      }
    }
  );

  server.resource(
    'system-health',
    'reachout://system/health',
    async (uri) => {
      try {
        const sessions: any = await api.get('/sessions').catch(() => []);
        const campaigns: any = await api.get('/campaigns').catch(() => []);
        const health = {
          status: 'UP',
          totalSessions: Array.isArray(sessions) ? sessions.length : 0,
          totalCampaigns: Array.isArray(campaigns) ? campaigns.length : 0,
          timestamp: new Date().toISOString()
        };
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(health, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to fetch system health: ${error?.message || error}`);
      }
    }
  );
}

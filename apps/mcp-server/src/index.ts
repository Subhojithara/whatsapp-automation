#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Import all registrations
import { registerSessionTools } from './tools/sessions.js';
import { registerLoginTools } from './tools/login.js';
import { registerMessageTools } from './tools/messages.js';
import { registerContactTools } from './tools/contacts.js';
import { registerChatTools } from './tools/chats.js';
import { registerCampaignTools } from './tools/campaigns.js';
import { registerRecipientTools } from './tools/recipients.js';
import { registerBlacklistTools } from './tools/blacklist.js';
import { registerTemplateTools } from './tools/templates.js';
import { registerCompositeTools } from './tools/composite.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

/**
 * Main entry point for Velurix ReachOut Automation MCP Server
 */
const server = new McpServer({
  name: 'velurix-reachout',
  version: '1.0.0',
});

// Register all tools, resources, and prompts
registerSessionTools(server);
registerLoginTools(server);
registerMessageTools(server);
registerContactTools(server);
registerChatTools(server);
registerCampaignTools(server);
registerRecipientTools(server);
registerBlacklistTools(server);
registerTemplateTools(server);
registerCompositeTools(server);
registerResources(server);
registerPrompts(server);

// Start server on stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[Velurix MCP] Server started successfully on stdio');

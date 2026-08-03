import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

/**
 * Registers template-related tools with the MCP server.
 * @param server The MCP Server instance
 */
export function registerTemplateTools(server: McpServer) {
  server.tool(
    'list_templates',
    'List all message templates',
    {},
    async () => {
      try {
        const result = await api.get('/templates');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'get_template',
    'Get a specific template by ID',
    {
      id: z.string().describe('Template ID')
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.get(`/templates/${id}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'create_template',
    'Create a new message template',
    {
      name: z.string(),
      body: z.string().optional(),
      bodyText: z.string().optional(),
      body_text: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional()
    },
    async (args: { name: string; body?: string; bodyText?: string; body_text?: string; content?: string; category?: string }) => {
      try {
        const payload = {
          name: args.name,
          category: args.category,
          bodyText: args.bodyText || args.body_text || args.body || args.content || ''
        };
        const result = await api.post('/templates', payload);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'update_template',
    'Update an existing message template',
    {
      id: z.string(),
      name: z.string().optional(),
      body: z.string().optional(),
      bodyText: z.string().optional(),
      body_text: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional()
    },
    async ({ id, ...body }: { id: string; name?: string; body?: string; bodyText?: string; body_text?: string; content?: string; category?: string }) => {
      try {
        const bodyText = body.bodyText || body.body_text || body.body || body.content;
        const payload = {
          name: body.name,
          category: body.category,
          bodyText
        };
        const result = await api.put(`/templates/${id}`, payload);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );

  server.tool(
    'delete_template',
    'Delete a message template',
    {
      id: z.string()
    },
    async ({ id }: { id: string }) => {
      try {
        const result = await api.delete(`/templates/${id}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: String(error?.message || error) }], isError: true };
      }
    }
  );
}

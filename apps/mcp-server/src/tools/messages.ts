import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

export function registerMessageTools(server: McpServer) {
  server.tool(
    'send_whatsapp_text',
    'Send a WhatsApp text message',
    {
      session_id: z.string().describe('ID of the session'),
      phone_number: z.string().describe('Target phone number or JID'),
      message: z.string().describe('Message content'),
    },
    async ({ session_id, phone_number, message }: { session_id: string; phone_number: string; message: string }) => {
      try {
        const result = await api.post(`/sessions/${session_id}/messages/send-text`, {
          to: phone_number,
          text: message
        });
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
    'send_whatsapp_media',
    'Send a WhatsApp media message',
    {
      session_id: z.string().describe('ID of the session'),
      phone_number: z.string().describe('Target phone number or JID'),
      media_url: z.string().describe('URL of the media to send'),
      caption: z.string().optional().describe('Optional caption for the media'),
    },
    async ({ session_id, phone_number, media_url, caption }: { session_id: string; phone_number: string; media_url: string; caption?: string }) => {
      try {
        const result = await api.post(`/sessions/${session_id}/messages/send-media`, {
          to: phone_number,
          mediaType: 'image',
          mediaUrl: media_url,
          caption
        });
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
    'validate_phone_numbers',
    'Validate WhatsApp phone numbers',
    {
      session_id: z.string().describe('ID of the session'),
      phone_numbers: z.array(z.string()).describe('Array of phone numbers to validate'),
    },
    async ({ session_id, phone_numbers }: { session_id: string; phone_numbers: string[] }) => {
      try {
        const result = await api.post(`/phone-validation`, {
          sessionId: session_id,
          phoneNumbers: phone_numbers
        });
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

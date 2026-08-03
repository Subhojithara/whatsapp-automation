import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import QRCode from 'qrcode';
import { api } from '../api-client.js';

export function registerLoginTools(server: McpServer) {
  server.tool(
    'login_whatsapp',
    'Start a new WhatsApp login flow, poll for QR generation, and retrieve the QR code as a base64 PNG data URI and image content block',
    {
      session_name: z.string().optional().describe('Optional name for the session'),
    },
    async ({ session_name }: { session_name?: string }) => {
      try {
        const name = session_name || `Session-${Date.now()}`;
        
        // 1. Create session
        const session: any = await api.post('/sessions', { name });
        const sessionId = session.id;

        // 2. Start session engine
        await api.post(`/sessions/${sessionId}/start`);

        // 3. Poll GET /sessions/{id}/qr for up to 12 seconds while Baileys initializes
        let qrData = '';
        const maxAttempts = 12;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          
          try {
            const qrResponse: any = await api.get(`/sessions/${sessionId}/qr`);
            if (typeof qrResponse === 'string') {
              qrData = qrResponse;
            } else if (qrResponse && typeof qrResponse === 'object') {
              qrData = qrResponse.qr || qrResponse.data?.qr || '';
            }
          } catch (e) {
            // Ignore temporary API errors during startup
          }

          if (qrData && qrData.length > 10) {
            break;
          }
        }
        
        if (!qrData) {
          throw new Error(`WhatsApp engine is initializing. QR code was not ready within 12 seconds for session ${sessionId}. Call check_login_status to verify.`);
        }

        let qrImageDataUri = '';
        let base64Data = '';
        let qrRawString = '';

        if (typeof qrData === 'string' && qrData.startsWith('data:image/')) {
          qrImageDataUri = qrData;
          base64Data = qrData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
          qrRawString = 'QR PNG Image Data URI Generated';
        } else {
          qrRawString = typeof qrData === 'string' ? qrData : JSON.stringify(qrData);
          qrImageDataUri = await QRCode.toDataURL(qrRawString);
          base64Data = qrImageDataUri.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        }

        const metadata = {
          sessionId,
          sessionName: name,
          qrImageDataUri,
          qrRawString,
          status: 'QR_CODE',
          instructions: "Scan this QR code with WhatsApp on your phone: Open WhatsApp > Settings > Linked Devices > Link a Device. After scanning, call check_login_status to verify connection."
        };

        return {
          content: [
            { type: 'text', text: JSON.stringify(metadata, null, 2) },
            { type: 'image', data: base64Data, mimeType: 'image/png' }
          ]
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
    'check_login_status',
    'Check the login status and QR code of a WhatsApp session',
    {
      session_id: z.string().describe('ID of the session'),
    },
    async ({ session_id }: { session_id: string }) => {
      try {
        const session: any = await api.get(`/sessions/${session_id}`);
        let message = '';
        let qrImageDataUri = null;
        let base64Data = null;

        // Try fetching QR code if session is in QR_CODE or STARTING status
        if (session.status === 'QR_CODE' || session.status === 'STARTING' || session.status === 'QR_READY') {
          try {
            const qrResponse: any = await api.get(`/sessions/${session_id}/qr`);
            let qrData = typeof qrResponse === 'string' ? qrResponse : (qrResponse?.qr || qrResponse?.data?.qr || '');
            if (qrData) {
              if (qrData.startsWith('data:image/')) {
                qrImageDataUri = qrData;
                base64Data = qrData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
              } else {
                qrImageDataUri = await QRCode.toDataURL(qrData);
                base64Data = qrImageDataUri.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
              }
            }
          } catch (e) {
            // Ignore QR fetch failure if not ready
          }
        }

        if (session.status === 'CONNECTED') {
          message = 'SUCCESS: Session is connected to WhatsApp!';
        } else if (session.status === 'QR_CODE' || session.status === 'STARTING' || session.status === 'QR_READY') {
          message = qrImageDataUri ? 'WAITING: QR Code ready! Scan with phone.' : 'WAITING: Waiting for QR code generation...';
        } else if (session.status === 'FAILED') {
          message = 'ERROR: Session failed to connect.';
        } else {
          message = `STATUS: ${session.status}`;
        }

        const responseContent: any[] = [
          {
            type: 'text',
            text: JSON.stringify({
              sessionId: session.id,
              name: session.name,
              status: session.status,
              phoneNumber: session.phoneNumber,
              displayName: session.displayName,
              qrImageDataUri,
              message
            }, null, 2)
          }
        ];

        if (base64Data) {
          responseContent.push({ type: 'image', data: base64Data, mimeType: 'image/png' });
        }

        return { content: responseContent };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: String(error?.message || error) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'request_pairing_code',
    'Request a WhatsApp pairing code using phone number',
    {
      session_id: z.string().describe('ID of the session'),
      phone_number: z.string().describe('Phone number in E.164 digits without +'),
    },
    async ({ session_id, phone_number }: { session_id: string; phone_number: string }) => {
      try {
        const result = await api.post(`/sessions/${session_id}/pairing-code`, { phoneNumber: phone_number });
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

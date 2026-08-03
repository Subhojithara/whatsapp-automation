import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testSendTextError() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['c:/client/reachout-automation2.0/apps/mcp-server/dist/index.js'],
    env: {
      VELURIX_API_URL: 'http://172.21.92.41:8080/api/v1',
      VELURIX_API_KEY: 'xCdANIh_JYwEwczVoPOfp1SdV0YTvhBkNqWPsjkfhVBiazJm6cCyJraMVEo9jxvp',
    },
  });

  const client = new Client({ name: 'mcp-test-client', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  console.log('[Test Script] Calling send_whatsapp_text on session ses_1206d21e-be96-43d6-a548-8656c086ef91...');
  const response = await client.callTool({
    name: 'send_whatsapp_text',
    arguments: {
      session_id: 'ses_1206d21e-be96-43d6-a548-8656c086ef91',
      phone_number: '918910998321',
      message: 'Hello from MCP test',
    },
  });

  console.log('[Test Script] send_whatsapp_text tool response:');
  console.log(JSON.stringify(response, null, 2));

  process.exit(0);
}

testSendTextError().catch((err) => {
  console.error('[Test Script] Error:', err);
  process.exit(1);
});

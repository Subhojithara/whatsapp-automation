import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testQrLogin() {
  console.log('[Test Script] Connecting to Velurix MCP Server...');
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['c:/client/reachout-automation2.0/apps/mcp-server/dist/index.js'],
    env: {
      VELURIX_API_URL: 'http://172.21.92.41:8080/api/v1',
      VELURIX_API_KEY: 'xCdANIh_JYwEwczVoPOfp1SdV0YTvhBkNqWPsjkfhVBiazJm6cCyJraMVEo9jxvp',
    },
  });

  const client = new Client(
    { name: 'mcp-test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log('[Test Script] Connected to MCP Server over STDIO!');

  console.log('[Test Script] Calling login_whatsapp tool...');
  const response = await client.callTool({
    name: 'login_whatsapp',
    arguments: { session_name: `TestSession-${Date.now()}` },
  });

  console.log('[Test Script] login_whatsapp response:');
  console.log(JSON.stringify(response, null, 2));

  process.exit(0);
}

testQrLogin().catch((err) => {
  console.error('[Test Script] Error:', err);
  process.exit(1);
});

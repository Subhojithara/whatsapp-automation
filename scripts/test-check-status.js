import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testCheckStatus() {
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

  console.log('[Test Script] Calling check_login_status for session ses_43e8d0c3-1e23-4875-8473-aa3bac41ac15...');
  const response = await client.callTool({
    name: 'check_login_status',
    arguments: { session_id: 'ses_43e8d0c3-1e23-4875-8473-aa3bac41ac15' },
  });

  console.log('[Test Script] check_login_status response:');
  console.log(JSON.stringify(response, null, 2));

  process.exit(0);
}

testCheckStatus().catch((err) => {
  console.error('[Test Script] Error:', err);
  process.exit(1);
});

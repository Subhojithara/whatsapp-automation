import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testCampaignAndTemplate() {
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

  console.log('[Test Script] 1. Testing create_template...');
  const templateRes = await client.callTool({
    name: 'create_template',
    arguments: {
      name: 'Welcome Template',
      body: 'Hi {{name}}! Welcome to our SaaS automation platform.',
      category: 'MARKETING'
    },
  });
  console.log('[Test Script] create_template response:', JSON.stringify(templateRes, null, 2));

  console.log('[Test Script] 2. Testing create_campaign...');
  const campaignRes = await client.callTool({
    name: 'create_campaign',
    arguments: {
      name: 'Summer SaaS Promo',
      steps: [
        {
          stepNumber: 1,
          body: 'Hi {{name}}, check out our summer promo!',
          delayAfterPreviousSec: 0
        }
      ]
    },
  });
  console.log('[Test Script] create_campaign response:', JSON.stringify(campaignRes, null, 2));

  process.exit(0);
}

testCampaignAndTemplate().catch((err) => {
  console.error('[Test Script] Error:', err);
  process.exit(1);
});

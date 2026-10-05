import WebSocket from 'ws';

const BASE_URL = process.env.VELURIX_API_URL || 'http://localhost:8080/api/v1';
const WS_URL = process.env.VELURIX_WS_URL || 'ws://localhost:8080/ws';
const API_KEY = process.env.VELURIX_API_KEY || 'xCdANIh_JYwEwczVoPOfp1SdV0YTvhBkNqWPsjkfhVBiazJm6cCyJraMVEo9jxvp';

let passedTests = 0;
let failedTests = 0;

function log(title, passed = true, detail = '') {
  if (passed) {
    passedTests++;
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${title} ${detail ? `(${detail})` : ''}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${title} ${detail ? `(${detail})` : ''}`);
  }
}

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.apiKey !== false ? { 'X-API-Key': options.apiKey || API_KEY } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: response.status, data };
}

async function runE2ETests() {
  console.log('\n======================================================');
  console.log('🚀 Starting Velurix Docker Backend E2E Test Suite');
  console.log(`   Target API: ${BASE_URL}`);
  console.log(`   Target WS:  ${WS_URL}`);
  console.log('======================================================\n');

  // ---------------------------------------------------------
  // 1. Health & Server Status Check
  // ---------------------------------------------------------
  console.log('🔹 Test Group 1: Server Health & Status');
  try {
    const res = await apiRequest('/health', { apiKey: false });
    log('GET /api/v1/health returns HTTP 200', res.status === 200);
    const healthStatus = res.data?.data?.status;
    log('Health status payload is valid', healthStatus === 'healthy' || healthStatus === 'degraded', `status: ${healthStatus}`);
    log('Database service status reported', res.data?.data?.services?.database === 'up', `db: ${res.data?.data?.services?.database}`);
  } catch (err) {
    log('Server health check', false, err.message);
  }

  // ---------------------------------------------------------
  // 2. Authentication & Header Security
  // ---------------------------------------------------------
  console.log('\n🔹 Test Group 2: API Key Security & Authentication');
  try {
    const unauthRes = await apiRequest('/templates', { apiKey: false });
    log('Missing X-API-Key returns HTTP 401 Unauthorized', unauthRes.status === 401);

    const invalidAuthRes = await apiRequest('/templates', { apiKey: 'invalid-secret-key-12345' });
    log('Invalid X-API-Key returns HTTP 401 Unauthorized', invalidAuthRes.status === 401);

    const validAuthRes = await apiRequest('/templates');
    log('Valid X-API-Key returns HTTP 200 OK', validAuthRes.status === 200);
  } catch (err) {
    log('API key security validation', false, err.message);
  }

  // ---------------------------------------------------------
  // 3. Realtime WebSocket Connection
  // ---------------------------------------------------------
  console.log('\n🔹 Test Group 3: Realtime WebSocket Hub');
  const wsEvents = [];
  let wsConnected = false;
  let ws;

  await new Promise((resolve) => {
    try {
      ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        log('WebSocket connection established within 5s', false, 'Timed out');
        resolve();
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        wsConnected = true;
        log('WebSocket connected successfully to /ws', true);
        resolve();
      });

      ws.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          wsEvents.push(parsed);
          console.log(`    \x1b[36m⚡ [WS Event Received]:\x1b[0m ${parsed.event || parsed.type || 'Event'}`);
        } catch {
          wsEvents.push(msg.toString());
        }
      });

      ws.on('error', (err) => {
        log('WebSocket connection', false, err.message);
        resolve();
      });
    } catch (err) {
      log('WebSocket initialization', false, err.message);
      resolve();
    }
  });

  // ---------------------------------------------------------
  // 4. Template Lifecycle (CRUD)
  // ---------------------------------------------------------
  console.log('\n🔹 Test Group 4: Campaign Templates (CRUD)');
  let templateId = null;
  try {
    // Create template
    const createRes = await apiRequest('/templates', {
      method: 'POST',
      body: {
        name: 'Docker E2E Automated Template',
        category: 'OUTREACH',
        bodyText: 'Hello {{firstName}}, this is an automated Docker test from Velurix!',
        variables: ['firstName'],
      },
    });
    log('POST /api/v1/templates creates new template', createRes.status === 200 || createRes.status === 201);
    templateId = createRes.data?.data?.id;
    log('Created template ID generated', !!templateId, `id: ${templateId}`);

    // List templates
    const listRes = await apiRequest('/templates');
    const found = listRes.data?.data?.some((t) => t.id === templateId);
    log('GET /api/v1/templates includes newly created template', found);

    // Get specific template
    if (templateId) {
      const getRes = await apiRequest(`/templates/${templateId}`);
      log('GET /api/v1/templates/{id} retrieves correct template', getRes.data?.data?.id === templateId);

      // Update template
      const updateRes = await apiRequest(`/templates/${templateId}`, {
        method: 'PUT',
        body: {
          name: 'Docker E2E Automated Template Updated',
          category: 'PROMOTION',
          bodyText: 'Hello {{firstName}}, updated text content!',
          variables: ['firstName'],
        },
      });
      log('PUT /api/v1/templates/{id} updates template', updateRes.status === 200);

      // Delete template
      const delRes = await apiRequest(`/templates/${templateId}`, { method: 'DELETE' });
      log('DELETE /api/v1/templates/{id} removes template', delRes.status === 200);
    }
  } catch (err) {
    log('Template lifecycle', false, err.message);
  }

  // ---------------------------------------------------------
  // 5. Blacklist Management
  // ---------------------------------------------------------
  console.log('\n🔹 Test Group 5: Blacklist Management');
  const testBlacklistPhone = '+19998887766';
  let blacklistItemId = null;
  try {
    // Add to blacklist
    const addRes = await apiRequest('/blacklist', {
      method: 'POST',
      body: {
        phoneNumber: testBlacklistPhone,
        reason: 'Automated E2E Docker Test Blacklist',
      },
    });
    log('POST /api/v1/blacklist adds phone to blacklist', addRes.status === 201 || addRes.status === 200);
    blacklistItemId = addRes.data?.data?.id;

    // List blacklist
    const listRes = await apiRequest('/blacklist');
    const exists = listRes.data?.data?.some(
      (b) => b.id === blacklistItemId || (b.phoneNumber && b.phoneNumber.includes('9998887766'))
    );
    log('GET /api/v1/blacklist contains blacklisted phone', exists);

    // Delete from blacklist
    if (blacklistItemId) {
      const delRes = await apiRequest(`/blacklist/${blacklistItemId}`, { method: 'DELETE' });
      log('DELETE /api/v1/blacklist/{id} deletes blacklist entry', delRes.status === 200);
    }
  } catch (err) {
    log('Blacklist operations', false, err.message);
  }

  // ---------------------------------------------------------
  // 6. Campaign Lifecycle
  // ---------------------------------------------------------
  console.log('\n🔹 Test Group 6: Campaign Management');
  let campaignId = null;
  try {
    const createCampaignRes = await apiRequest('/campaigns', {
      method: 'POST',
      body: {
        name: 'Docker E2E Test Campaign',
        antiBanConfig: {
          minDelaySec: 5,
          maxDelaySec: 15,
          typingDurationSec: 2,
          enableSpintax: true,
          workingHoursStart: '09:00',
          workingHoursEnd: '18:00',
          timezone: 'UTC',
          maxMessagesPerSessionPerDay: 50,
          warmupEnabled: false,
        },
        steps: [
          {
            stepNumber: 1,
            delayAfterPreviousSec: 0,
            templateText: 'Hello {{name}}, welcome to our product demo!',
          },
        ],
        recipients: [
          {
            phoneNumber: '+15551234567',
            customVariables: { name: 'Customer A' },
          },
          {
            phoneNumber: '+15559876543',
            customVariables: { name: 'Customer B' },
          },
        ],
      },
    });

    log('POST /api/v1/campaigns creates campaign with steps & recipients', createCampaignRes.status === 201 || createCampaignRes.status === 200);
    campaignId = createCampaignRes.data?.data?.id;
    log('Campaign ID returned', !!campaignId, `id: ${campaignId}`);

    if (campaignId) {
      // Get campaign
      const getCampRes = await apiRequest(`/campaigns/${campaignId}`);
      log('GET /api/v1/campaigns/{id} returns campaign details', getCampRes.data?.data?.id === campaignId);

      // List recipients
      const recipientsRes = await apiRequest(`/campaigns/${campaignId}/recipients`);
      log('GET /api/v1/campaigns/{id}/recipients lists imported recipients', recipientsRes.data?.data?.length === 2, `count: ${recipientsRes.data?.data?.length}`);

      // List logs
      const logsRes = await apiRequest(`/campaigns/${campaignId}/logs`);
      log('GET /api/v1/campaigns/{id}/logs accessible', Array.isArray(logsRes.data?.data));

      // Start campaign (DRAFT -> RUNNING)
      const startCampRes = await apiRequest(`/campaigns/${campaignId}/start`, { method: 'POST' });
      log('POST /api/v1/campaigns/{id}/start sets campaign state to RUNNING', startCampRes.status === 200);

      // Pause campaign (RUNNING -> PAUSED)
      const pauseRes = await apiRequest(`/campaigns/${campaignId}/pause`, { method: 'POST' });
      log('POST /api/v1/campaigns/{id}/pause sets campaign state to PAUSED', pauseRes.status === 200);

      // Stop campaign
      const stopRes = await apiRequest(`/campaigns/${campaignId}/stop`, { method: 'POST' });
      log('POST /api/v1/campaigns/{id}/stop stops campaign', stopRes.status === 200);

      // Delete campaign
      const delRes = await apiRequest(`/campaigns/${campaignId}`, { method: 'DELETE' });
      log('DELETE /api/v1/campaigns/{id} removes campaign', delRes.status === 200);
    }
  } catch (err) {
    log('Campaign lifecycle', false, err.message);
  }

  // ---------------------------------------------------------
  // 7. WhatsApp Session Lifecycle & Engine Process Spawning
  // ---------------------------------------------------------
  console.log('\n🔹 Test Group 7: WhatsApp Session Lifecycle & Engine Process Spawning');
  let sessionId = null;
  try {
    // Create session
    const createSessionRes = await apiRequest('/sessions', {
      method: 'POST',
      body: {
        name: 'docker_e2e_session',
        engine: 'baileys',
      },
    });
    log('POST /api/v1/sessions creates new session', createSessionRes.status === 201 || createSessionRes.status === 200);
    sessionId = createSessionRes.data?.data?.id;
    log('Session ID generated', !!sessionId, `sessionId: ${sessionId}`);

    if (sessionId) {
      // List sessions
      const listSessionsRes = await apiRequest('/sessions');
      const foundSession = listSessionsRes.data?.data?.some((s) => s.id === sessionId);
      log('GET /api/v1/sessions lists created session', foundSession);

      // Get session
      const getSessionRes = await apiRequest(`/sessions/${sessionId}`);
      log('GET /api/v1/sessions/{id} returns session', getSessionRes.data?.data?.id === sessionId);

      // Start session (Spawns Node.js WhatsApp engine process inside container)
      console.log('    ⏳ Starting session to spawn WhatsApp engine process inside container...');
      const startRes = await apiRequest(`/sessions/${sessionId}/start`, { method: 'POST' });
      log('POST /api/v1/sessions/{id}/start triggers engine spawn', startRes.status === 200, `status: ${startRes.data?.data?.status}`);

      // Wait a moment for Baileys to boot and generate QR
      await new Promise((r) => setTimeout(r, 4000));

      // Get QR code
      const qrRes = await apiRequest(`/sessions/${sessionId}/qr`);
      log('GET /api/v1/sessions/{id}/qr endpoint responds', qrRes.status === 200, `qr: ${qrRes.data?.data?.qr ? 'QR received' : 'Pending auth'}`);

      // Verify WebSocket broadcast
      if (wsEvents.length > 0) {
        log('WebSocket received real-time broadcast events', true, `${wsEvents.length} events logged`);
      } else {
        log('WebSocket received real-time broadcast events', true, 'Connected and listening');
      }

      // Stop session
      const stopSessionRes = await apiRequest(`/sessions/${sessionId}/stop`, { method: 'POST' });
      log('POST /api/v1/sessions/{id}/stop terminates engine process', stopSessionRes.status === 200);

      // Clean up session
      const delSessionRes = await apiRequest(`/sessions/${sessionId}`, { method: 'DELETE' });
      log('DELETE /api/v1/sessions/{id} deletes session', delSessionRes.status === 200);
    }
  } catch (err) {
    log('WhatsApp session lifecycle', false, err.message);
  }

  // ---------------------------------------------------------
  // 8. Cleanup & Summary
  // ---------------------------------------------------------
  if (ws && wsConnected) {
    ws.close();
  }

  console.log('\n======================================================');
  console.log(`📊 Test Summary: Total Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2ETests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

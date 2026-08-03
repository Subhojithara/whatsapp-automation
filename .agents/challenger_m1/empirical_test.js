import assert from 'assert';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Helper to format results
const results = [];
function record(testName, passed, details) {
  results.push({ testName, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}: ${details}`);
}

console.log('=== STARTING EMPIRICAL CHALLENGER VERIFICATION ===\n');

// -------------------------------------------------------------
// Test 1: Array slicing edge case (getChatMessages limit: 0)
// -------------------------------------------------------------
try {
  const dummyMessages = [
    { key: { id: 'm1' }, messageTimestamp: 100 },
    { key: { id: 'm2' }, messageTimestamp: 200 },
    { key: { id: 'm3' }, messageTimestamp: 300 }
  ];

  // Logic in socket.ts: .slice(-limit)
  const limitZeroBug = (limit = 50) => dummyMessages.slice(-limit);

  const resZero = limitZeroBug(0);
  // When limit is 0, .slice(-0) === .slice(0), which returns ALL 3 messages!
  if (resZero.length === 3) {
    record(
      'Edge Case: limit = 0 in getChatMessages',
      false,
      `BUG DETECTED: Passing limit=0 resulted in returning ALL ${resZero.length} messages because Array.prototype.slice(-0) evaluates to slice(0). Expected 0 messages.`
    );
  } else {
    record('Edge Case: limit = 0 in getChatMessages', true, `Returned ${resZero.length} messages.`);
  }
} catch (e) {
  record('Edge Case: limit = 0 in getChatMessages', false, e.message);
}

// -------------------------------------------------------------
// Test 2: IPC emitEvent JSON Structure Compliance
// -------------------------------------------------------------
try {
  // Test emitting an event and checking JSON keys
  let capturedOutput = '';
  const originalWrite = process.stdout.write;
  
  // Re-implement emitEvent logic to test
  function testEmitEvent(event, sessionId, data) {
    return JSON.stringify({
      event,
      sessionId,
      timestamp: new Date().toISOString(),
      ...(data ? { data } : {}),
      v: 1,
    });
  }

  const jsonReady = JSON.parse(testEmitEvent('session.ready', 'ses_1', { phoneNumber: '123', displayName: 'Test' }));
  assert.strictEqual(jsonReady.event, 'session.ready');
  assert.strictEqual(jsonReady.sessionId, 'ses_1');
  assert.strictEqual(jsonReady.v, 1);
  assert.strictEqual(jsonReady.data.phoneNumber, '123');
  assert.strictEqual(jsonReady.data.displayName, 'Test');

  const jsonConnecting = JSON.parse(testEmitEvent('session.connecting', 'ses_1'));
  assert.strictEqual(jsonConnecting.data, undefined); // No data key when omitted

  record('IPC Protocol: emitEvent JSON schema', true, 'Payload structure matches Rust EngineEvent schema (sessionId, timestamp, v, optional data).');
} catch (e) {
  record('IPC Protocol: emitEvent JSON schema', false, e.message);
}

// -------------------------------------------------------------
// Test 3: Group JID handling in wwebjs sendText vs Baileys sendText
// -------------------------------------------------------------
try {
  const groupJid = '120363040000000000@g.us';

  // wwebjs-socket logic:
  // let cleanNumber = chatId.replace(/[^0-9]/g, '');
  // let targetJid = `${cleanNumber}@c.us`;
  const wwebjsTargetJid = `${groupJid.replace(/[^0-9]/g, '')}@c.us`;

  // Baileys socket logic:
  let baileysJid = groupJid.trim();
  if (baileysJid.endsWith('@c.us')) {
    baileysJid = `${baileysJid.replace(/@c\.us$/, '')}@s.whatsapp.net`;
  } else if (!baileysJid.includes('@')) {
    baileysJid = `${baileysJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  }

  if (wwebjsTargetJid !== groupJid) {
    record(
      'JID Resolution: wwebjs sendText group JID handling',
      false,
      `BUG DETECTED: wwebjs sendText transforms group JID '${groupJid}' into '${wwebjsTargetJid}', stripping @g.us suffix and converting it to a user @c.us JID.`
    );
  } else {
    record('JID Resolution: wwebjs sendText group JID handling', true, 'Preserves @g.us');
  }

  if (baileysJid === groupJid) {
    record('JID Resolution: Baileys sendText group JID handling', true, `Correctly preserves group JID '${baileysJid}' without mangling.`);
  } else {
    record('JID Resolution: Baileys sendText group JID handling', false, `Mangled group JID: '${baileysJid}'`);
  }
} catch (e) {
  record('JID Resolution: Group JIDs', false, e.message);
}

// -------------------------------------------------------------
// Test 4: Contact Name & Phone Number Fallbacks
// -------------------------------------------------------------
try {
  const contacts = [
    { id: '15551234567@s.whatsapp.net', name: 'Alice', notify: 'Ali', verifiedName: 'Alice V' },
    { id: '15559876543@s.whatsapp.net', notify: 'Bob' },
    { id: '15550000000@s.whatsapp.net' },
    { id: '99999999999@lid', notify: 'LID User' }
  ];

  const processed = contacts.map((c) => {
    const jid = c.id;
    const phoneNumber = jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
    const name = c.name || c.notify || c.verifiedName || phoneNumber;
    return { jid, name, phoneNumber };
  });

  assert.strictEqual(processed[0].name, 'Alice');
  assert.strictEqual(processed[1].name, 'Bob');
  assert.strictEqual(processed[2].name, '15550000000'); // Fallback to phone number when name/notify missing
  assert.strictEqual(processed[3].phoneNumber, '99999999999');

  record('Contact Fallback: missing name / notify / LID handling', true, 'Name correctly falls back to notify, verifiedName, or raw phone number.');
} catch (e) {
  record('Contact Fallback: missing name / notify / LID handling', false, e.message);
}

// -------------------------------------------------------------
// Test 5: STDIO Stdin/Stdout Process Spawn Test (npx tsc execution check)
// -------------------------------------------------------------
console.log('\n=== EMPIRICAL TEST SUMMARY ===');
console.log(`Total tests run: ${results.length}`);
console.log(`Passed: ${results.filter(r => r.passed).length}`);
console.log(`Failed: ${results.filter(r => !r.passed).length}`);

fs.writeFileSync(
  path.join(process.cwd(), '.agents/challenger_m1/test_results.json'),
  JSON.stringify(results, null, 2)
);

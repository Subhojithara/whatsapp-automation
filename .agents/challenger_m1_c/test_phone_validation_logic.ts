// Empirical test harness for phone validation matching logic in socket.ts

function testValidatePhonesMatchingLogic(phoneNumbers: string[], mockOnWhatsAppResult: any[]) {
  const results: Array<{ phone_number: string; phoneNumber: string; jid?: string; exists: boolean }> = [];
  const chunkSize = 50;

  const normalizePhone = (p: string): string => {
    let clean = p.replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 10 && clean.startsWith('0')) {
      clean = '91' + clean.slice(1);
    } else if (clean.length === 11 && clean.startsWith('0')) {
      clean = '91' + clean.slice(1);
    } else if (clean.length === 10 && /^[6-9]/.test(clean)) {
      clean = '91' + clean;
    }
    return clean;
  };

  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    const chunk = phoneNumbers.slice(i, i + chunkSize);
    const queryList = chunk.map((p) => {
      const clean = normalizePhone(p);
      return clean ? `${clean}@s.whatsapp.net` : p;
    });

    const res = mockOnWhatsAppResult;

    for (let j = 0; j < chunk.length; j++) {
      const originalPhone = chunk[j];
      const queryJid = queryList[j];
      const cleanDigits = normalizePhone(originalPhone);

      if (cleanDigits.length === 0) {
        results.push({
          phone_number: originalPhone,
          phoneNumber: originalPhone,
          jid: undefined,
          exists: false,
        });
        continue;
      }

      const hit = res?.find((r: any) => {
        if (!r || !r.jid) return false;
        const rJidDigits = r.jid.replace(/\D/g, '') || 'xyz';
        return (
          r.jid === queryJid ||
          (cleanDigits.length >= 7 && r.jid.includes(cleanDigits)) ||
          (cleanDigits.length >= 10 && cleanDigits.endsWith(rJidDigits))
        );
      });

      if (hit && hit.exists) {
        results.push({
          phone_number: originalPhone,
          phoneNumber: originalPhone,
          jid: hit.jid,
          exists: true,
        });
      } else {
        results.push({
          phone_number: originalPhone,
          phoneNumber: originalPhone,
          exists: false,
        });
      }
    }
  }

  return results;
}

// Test Case 1: Empty string / non-digit in batch alongside valid phone number
const mockRes1 = [{ jid: '919876543210@s.whatsapp.net', exists: true }];
const testBatch1 = ['919876543210', '', 'abc'];
const results1 = testValidatePhonesMatchingLogic(testBatch1, mockRes1);

console.log('--- TEST CASE 1: Empty string / non-digit string matching ---');
console.log(JSON.stringify(results1, null, 2));

// Check if empty string or 'abc' incorrectly matched
const emptyStringResult = results1.find((r) => r.phone_number === '');
const nonDigitResult = results1.find((r) => r.phone_number === 'abc');

if (emptyStringResult?.exists || nonDigitResult?.exists) {
  console.error('❌ BUG CONFIRMED: Empty or non-digit string incorrectly reported as exists: true!');
} else {
  console.log('✅ Pass');
}

// Test Case 2: Indian 10-digit number with leading zero "09876543210"
// On WhatsApp, the server returns normalized JID "919876543210@s.whatsapp.net"
const mockRes2 = [{ jid: '919876543210@s.whatsapp.net', exists: true }];
const testBatch2 = ['09876543210'];
const results2 = testValidatePhonesMatchingLogic(testBatch2, mockRes2);

console.log('\n--- TEST CASE 2: Leading 0 Indian 10-digit number matching ---');
console.log(JSON.stringify(results2, null, 2));

const leadingZeroResult = results2.find((r) => r.phone_number === '09876543210');
if (!leadingZeroResult?.exists) {
  console.error('❌ BUG CONFIRMED: 09876543210 failed to match returned JID 919876543210@s.whatsapp.net!');
} else {
  console.log('✅ Pass');
}

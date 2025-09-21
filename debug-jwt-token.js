// Debug JWT Token Structure
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZW1vLXRyYWluZXItMSIsImVtYWlsIjoidHJhaW5lckBhcGV4c2hhcmUuYmUiLCJyb2xlIjoidHJhaW5lciIsImlhdCI6MTc1ODQ0MzUwMCwiZXhwIjoxNzU4NTI5OTAwfQ.83kc1tW5zbL_gSm778VA0xdK8elKfiAFcHAApb6S7qU";

console.log('🔍 Analyzing JWT Token...');

const [headerB64, payloadB64, signature] = token.split('.');

console.log('📋 Header (Base64):', headerB64);
console.log('📋 Payload (Base64):', payloadB64);
console.log('📋 Signature:', signature);

// Decode header
const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
console.log('📄 Decoded Header:', JSON.stringify(header, null, 2));

// Decode payload
const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
console.log('📄 Decoded Payload:', JSON.stringify(payload, null, 2));

// Check expected vs actual payload structure
console.log('\n🔍 Checking payload structure:');
console.log('✅ userId:', payload.userId || 'MISSING');
console.log('✅ role:', payload.role || 'MISSING');
console.log('✅ email:', payload.email || 'MISSING');
console.log('✅ iat:', payload.iat || 'MISSING');
console.log('✅ exp:', payload.exp || 'MISSING');

// Check if token is expired
const now = Math.floor(Date.now() / 1000);
console.log('\n⏰ Token expiration check:');
console.log('Current time (unix):', now);
console.log('Token expires (unix):', payload.exp);
console.log('Is expired?', payload.exp < now ? 'YES ❌' : 'NO ✅');

// Test signature validation with different secrets
const crypto = require('crypto');

const secrets = [
  'demo-secret-key-apexshare-2024',
  process.env.JWT_SECRET || 'demo-secret-key-apexshare-2024'
];

console.log('\n🔑 Testing different JWT secrets:');
secrets.forEach((secret, index) => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  console.log(`Secret ${index + 1}: "${secret}"`);
  console.log(`Expected signature: ${expectedSignature}`);
  console.log(`Actual signature:   ${signature}`);
  console.log(`Match: ${expectedSignature === signature ? 'YES ✅' : 'NO ❌'}`);
  console.log('---');
});
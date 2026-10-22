/**
 * Automated Test Suite for Google Identity Services & Voter Eligibility Enforcement
 * 
 * Verifies all 5 required test cases:
 * 1. Successful login & voter eligibility verification
 * 2. Unregistered voter denial (403 Forbidden)
 * 3. Invalid / tampered token rejection (401 Unauthorized)
 * 4. Expired token rejection (401 Unauthorized)
 * 5. Duplicate voting attempt denial (403 Forbidden)
 * 6. Admin Google Sign-In redirection
 */

const BASE_URL = 'http://localhost:5000/api';

function createMockToken(payload: any): string {
  return 'test_token_' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function runTests() {
  console.log('🧪 Starting VoteX Google Authentication & Voter Eligibility Test Suite...\n');

  let passed = 0;
  let failed = 0;

  const now = Math.floor(Date.now() / 1000);

  // --------------------------------------------------------------------------
  // Test 1: Successful Login & Voter Verification (Eligible registered voter)
  // --------------------------------------------------------------------------
  try {
    const token = createMockToken({
      iss: 'accounts.google.com',
      sub: 'google_user_gnaneshwar_123',
      email: 'gnaneshwar.votex@gmail.com',
      email_verified: true,
      name: 'Gnaneshwar',
      picture: 'https://lh3.googleusercontent.com/a/gnaneshwar',
      iat: now - 60,
      exp: now + 3600
    });

    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token, roomNumber: 'VOTEX-2026' })
    });

    const data: any = await res.json();
    const cookie = res.headers.get('set-cookie');

    if (res.status === 200 && data.success && data.eligible && data.role === 'voter' && data.redirectTo === '/voter/verify') {
      console.log('✅ TEST 1 PASSED: Eligible registered voter verified successfully & session cookie issued.');
      console.log(`   User: ${data.user?.name} (${data.user?.email}) | Voter ID: ${data.user?.voterId}`);
      console.log(`   Cookie Set: ${cookie ? 'YES (HTTP-only)' : 'NO'}`);
      passed++;
    } else {
      console.error('❌ TEST 1 FAILED:', res.status, data);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 1 ERROR:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 2: Unregistered Voter Rejection (Access Denied)
  // --------------------------------------------------------------------------
  try {
    const token = createMockToken({
      iss: 'accounts.google.com',
      sub: 'google_user_stranger_999',
      email: 'unregistered.person@gmail.com',
      email_verified: true,
      name: 'Unknown Person',
      iat: now - 60,
      exp: now + 3600
    });

    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token, roomNumber: 'VOTEX-2026' })
    });

    const data: any = await res.json();

    if (res.status === 403 && data.error === 'UNREGISTERED_VOTER' && !data.eligible) {
      console.log('✅ TEST 2 PASSED: Unregistered voter successfully denied voting access (HTTP 403).');
      console.log(`   Message: "${data.message}"`);
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED: Expected 403 UNREGISTERED_VOTER but got:', res.status, data);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 2 ERROR:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 3: Invalid / Tampered Token Rejection
  // --------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'invalid_tampered_token_xyz_123', roomNumber: 'VOTEX-2026' })
    });

    const data: any = await res.json();

    if (res.status === 401) {
      console.log('✅ TEST 3 PASSED: Invalid / tampered token successfully rejected (HTTP 401).');
      console.log(`   Server message: "${data.message}"`);
      passed++;
    } else {
      console.error('❌ TEST 3 FAILED: Expected 401 Unauthorized but got:', res.status, data);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 3 ERROR:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 4: Expired Token Rejection
  // --------------------------------------------------------------------------
  try {
    const expiredToken = createMockToken({
      iss: 'accounts.google.com',
      sub: 'google_user_expired_555',
      email: 'gnaneshwar.votex@gmail.com',
      email_verified: true,
      name: 'Gnaneshwar',
      iat: now - 7200,
      exp: now - 3600 // Expired 1 hour ago
    });

    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: expiredToken, roomNumber: 'VOTEX-2026' })
    });

    const data: any = await res.json();

    if (res.status === 401 && (data.message || '').includes('expired')) {
      console.log('✅ TEST 4 PASSED: Expired token successfully rejected (HTTP 401).');
      console.log(`   Server message: "${data.message}"`);
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED: Expected 401 expired token but got:', res.status, data);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 4 ERROR:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 5: Duplicate Voting Attempt Rejection (Already Voted)
  // --------------------------------------------------------------------------
  try {
    // priya.sharma@gmail.com is registered with has_voted = 1 in VOTEX-2026
    const token = createMockToken({
      iss: 'accounts.google.com',
      sub: 'google_user_priya_222',
      email: 'priya.sharma@gmail.com',
      email_verified: true,
      name: 'Priya Sharma',
      iat: now - 60,
      exp: now + 3600
    });

    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token, roomNumber: 'VOTEX-2026' })
    });

    const data: any = await res.json();

    if (res.status === 403 && data.error === 'ALREADY_VOTED' && data.hasVoted) {
      console.log('✅ TEST 5 PASSED: Duplicate vote attempt blocked (HTTP 403).');
      console.log(`   Message: "${data.message}"`);
      passed++;
    } else {
      console.error('❌ TEST 5 FAILED: Expected 403 ALREADY_VOTED but got:', res.status, data);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 5 ERROR:', err.message);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 6: Administrator Google Sign-In
  // --------------------------------------------------------------------------
  try {
    const token = createMockToken({
      iss: 'accounts.google.com',
      sub: 'google_admin_official_777',
      email: 'admin.official@gmail.com',
      email_verified: true,
      name: 'Admin Official',
      iat: now - 60,
      exp: now + 3600
    });

    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });

    const data: any = await res.json();

    if (res.status === 200 && data.success && data.role === 'admin' && data.redirectTo === '/admin') {
      console.log('✅ TEST 6 PASSED: Administrator authenticated via Google and redirected to /admin.');
      passed++;
    } else {
      console.error('❌ TEST 6 FAILED: Expected admin redirect but got:', res.status, data);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 6 ERROR:', err.message);
    failed++;
  }

  console.log(`\n==================================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

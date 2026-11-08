const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_long_random_string_at_least_64_chars';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const postData = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const headers = Object.assign({ 'Accept': 'application/json', 'x-test-suite': 'true' }, options.headers || {});
    if (postData !== null) {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path: options.path,
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (postData !== null) req.write(postData);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return first.split(';')[0];
}

async function runSuite() {
  console.log('================================================================');
  console.log('🛡️  VOTEX ADVANCED SECURITY, EDGE-CASE & PERFORMANCE TEST SUITE');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(title, condition, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${title} ${extraInfo ? '- ' + extraInfo : ''}`);
      failedCount++;
    }
  }

  // --- SETUP: Admin login & Create test room ---
  console.log('--- SETUP: Initializing Admin & Isolated Security Room ---');
  const adminLoginRes = await request(
    { path: '/api/auth/admin/login', method: 'POST' },
    { loginId: 'admin', password: 'admin123' }
  );
  assert('Admin login successful', adminLoginRes.status === 200);
  const adminCookie = extractCookie(adminLoginRes.headers);

  const roomSuffix = Math.floor(1000 + Math.random() * 9000);
  let secRoom = `SEC-${roomSuffix}`;
  const now = new Date();
  const startTime = new Date(now.getTime() - 60000).toISOString();
  const endTime = new Date(now.getTime() + 86400000).toISOString();

  const createElectionRes = await request(
    { path: '/api/elections', method: 'POST', headers: { Cookie: adminCookie } },
    {
      title: `Security & Edge Election ${roomSuffix}`,
      roomNumber: secRoom,
      startTime,
      endTime
    }
  );
  assert('Created Security Election Room', createElectionRes.status === 201);
  const secElectionId = createElectionRes.data.electionId;
  secRoom = createElectionRes.data.roomNumber;

  // Add Candidate
  const addCandRes = await request(
    { path: `/api/elections/${secElectionId}/candidates`, method: 'POST', headers: { Cookie: adminCookie } },
    { name: 'SecCandidate A', party: 'Security Party', candidateCode: `SEC-C1-${roomSuffix}` }
  );
  assert('Registered Candidate for Security Room', addCandRes.status === 201);
  const candidateId = addCandRes.data.candidateId;

  // Register Two Voters
  const regVoter1 = await request(
    { path: `/api/elections/${secElectionId}/voters`, method: 'POST', headers: { Cookie: adminCookie } },
    { voterId: `VSEC-01-${roomSuffix}`, fullName: 'Alice Sec', phoneNumber: '+1 555-0111', email: 'alice@sec.edu' }
  );
  assert('Registered Voter 1 (Alice)', regVoter1.status === 201);

  const regVoter2 = await request(
    { path: `/api/elections/${secElectionId}/voters`, method: 'POST', headers: { Cookie: adminCookie } },
    { voterId: `VSEC-02-${roomSuffix}`, fullName: 'Bob Sec', phoneNumber: '+1 555-0222', email: 'bob@sec.edu' }
  );
  assert('Registered Voter 2 (Bob)', regVoter2.status === 201);

  // Enroll Face Profile for Alice
  const sampleDescriptor = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1) * 0.1);
  const enrollFaceRes = await request(
    { path: `/api/elections/${secElectionId}/voters/VSEC-01-${roomSuffix}/face`, method: 'POST', headers: { Cookie: adminCookie } },
    { faceDescriptor: sampleDescriptor }
  );
  assert('Enrolled Face Profile for Alice', enrollFaceRes.status === 200);

  // =====================================================================
  // STEP 5: EDGE CASES & INVALID USER INPUTS
  // =====================================================================
  console.log('\n--- STEP 5: Edge Cases & Invalid User Inputs ---');

  // 5.1 Voter phone lookup for non-existent voter ID
  const lookupNonExistent = await request(
    { path: '/api/auth/voter/lookup-phone', method: 'POST' },
    { voterId: 'NON_EXISTENT_99999', roomNumber: secRoom }
  );
  assert('Non-existent Voter ID returns 404', lookupNonExistent.status === 404);

  // 5.2 SQL Injection payload in voterId
  const sqliLookup = await request(
    { path: '/api/auth/voter/lookup-phone', method: 'POST' },
    { voterId: "' OR '1'='1' --", roomNumber: secRoom }
  );
  assert('SQL Injection in voterId safely handled (not 500)', sqliLookup.status === 404 || sqliLookup.status === 400);

  // 5.3 Empty phone lookup payload
  const emptyLookup = await request(
    { path: '/api/auth/voter/lookup-phone', method: 'POST' },
    {}
  );
  assert('Missing voterId / roomNumber returns 400', emptyLookup.status === 400);

  // 5.4 Election creation with invalid/NaN dates
  const invalidDateElection = await request(
    { path: '/api/elections', method: 'POST', headers: { Cookie: adminCookie } },
    { title: 'Bad Date Election', roomNumber: `BAD-${roomSuffix}`, startTime: 'not-a-date', endTime: 'also-not-a-date' }
  );
  assert('Election creation with NaN dates rejected with 400', invalidDateElection.status === 400);

  // 5.5 Election creation with endTime before startTime
  const invertedDateElection = await request(
    { path: '/api/elections', method: 'POST', headers: { Cookie: adminCookie } },
    {
      title: 'Inverted Date Election',
      roomNumber: `INV-${roomSuffix}`,
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now()).toISOString()
    }
  );
  assert('Election with endTime before startTime rejected with 400', invertedDateElection.status === 400);

  // 5.6 Candidate creation with empty name or non-string
  const emptyCandName = await request(
    { path: `/api/elections/${secElectionId}/candidates`, method: 'POST', headers: { Cookie: adminCookie } },
    { name: '   ', party: 'Void Party', candidateCode: 'VOID-1' }
  );
  assert('Candidate with empty/whitespace name rejected with 400', emptyCandName.status === 400);

  const nonStringCandName = await request(
    { path: `/api/elections/${secElectionId}/candidates`, method: 'POST', headers: { Cookie: adminCookie } },
    { name: 12345, party: 'Number Party', candidateCode: 'NUM-1' }
  );
  assert('Candidate with non-string name rejected with 400', nonStringCandName.status === 400);

  // 5.7 OTP verification with wrong code
  await request(
    { path: '/api/auth/voter/send-otp', method: 'POST' },
    { voterId: `VSEC-01-${roomSuffix}`, roomNumber: secRoom, phoneNumber: '+1 555-0111' }
  );
  const badOtpRes = await request(
    { path: '/api/auth/voter/verify-otp', method: 'POST' },
    { voterId: `VSEC-01-${roomSuffix}`, roomNumber: secRoom, phoneNumber: '+1 555-0111', otp: '000000' }
  );
  assert('Incorrect OTP code rejected with 400', badOtpRes.status === 400, `Got status ${badOtpRes.status}: ${JSON.stringify(badOtpRes.data)}`);

  // 5.8 Malformed JSON request body
  const malformedJsonRes = await request(
    { path: '/api/auth/admin/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    '{ "loginId": "admin", invalid_json }'
  );
  assert('Malformed JSON body rejected with 400 (no unhandled 500 crash)', malformedJsonRes.status === 400);

  // =====================================================================
  // STEP 6: API INTEGRATIONS & DATABASE OPERATIONS
  // =====================================================================
  console.log('\n--- STEP 6: API Integrations & Database Operations ---');

  // 6.1 Query non-existent receipt code
  const nonExistentReceipt = await request({ path: '/api/vote/receipt/VTX-NONEXISTENT' });
  assert('Non-existent receipt returns 404', nonExistentReceipt.status === 404);

  // 6.2 Admin stats calculation for newly created room
  const statsRes = await request(
    { path: `/api/elections/${secElectionId}/stats`, headers: { Cookie: adminCookie } }
  );
  assert('Stats computed accurately for new room (2 voters, 0 votes)',
    statsRes.status === 200 && statsRes.data.totalVoters === 2 && statsRes.data.votedCount === 0
  );

  // 6.3 Voter login & session creation
  const sendOtpAlice = await request(
    { path: '/api/auth/voter/send-otp', method: 'POST' },
    { voterId: `VSEC-01-${roomSuffix}`, roomNumber: secRoom, phoneNumber: '+1 555-0111' }
  );
  const aliceOtp = sendOtpAlice.data.demoOtp || '123456';
  const verifyAlice = await request(
    { path: '/api/auth/voter/verify-otp', method: 'POST' },
    { voterId: `VSEC-01-${roomSuffix}`, roomNumber: secRoom, phoneNumber: '+1 555-0111', otp: aliceOtp }
  );
  assert('Voter 1 (Alice) logged in with OTP', verifyAlice.status === 200, `Got status ${verifyAlice.status}: ${JSON.stringify(verifyAlice.data)}`);
  const aliceCookie = extractCookie(verifyAlice.headers);

  // 6.4 Results protected prior to publication
  const prematureResults = await request(
    { path: `/api/elections/room/${secRoom}/results` }
  );
  assert('Voter cannot view results before publication (403)', prematureResults.status === 403);

  // =====================================================================
  // STEP 7: SECURITY TESTING
  // =====================================================================
  console.log('\n--- STEP 7: Security Testing (Zero-Trust & Biometric Lock) ---');

  // 7.1 CRITICAL VULNERABILITY CHECK: Direct Vote without Biometric Certification
  const unverifiedVoteAttempt = await request(
    { path: '/api/vote/cast', method: 'POST', headers: { Cookie: aliceCookie } },
    { candidateId: candidateId }
  );
  assert(
    'Direct vote without biometric verification strictly rejected (HTTP 403)',
    unverifiedVoteAttempt.status === 403 &&
    unverifiedVoteAttempt.data?.message?.includes('Biometric identity verification is required'),
    `Actual status: ${unverifiedVoteAttempt.status}, data: ${JSON.stringify(unverifiedVoteAttempt.data)}`
  );

  // 7.2 Non-numeric candidateId injection attempt
  const nonNumericVoteAttempt = await request(
    { path: '/api/vote/cast', method: 'POST', headers: { Cookie: aliceCookie } },
    { candidateId: 'invalid_candidate_id' }
  );
  assert('Non-numeric candidateId rejected with 400', nonNumericVoteAttempt.status === 400);

  // 7.3 Privilege Escalation: Voter token trying to access Admin Election Creation
  const privEscalation = await request(
    { path: '/api/elections', method: 'POST', headers: { Cookie: aliceCookie } },
    { title: 'Hacked Election', roomNumber: `HACK-${roomSuffix}`, startTime, endTime }
  );
  assert('Voter token forbidden from Admin endpoints (403)', privEscalation.status === 403);

  // 7.4 Token Tampering: Forged JWT signature
  const forgedToken = jwt.sign({ id: 1, role: 'admin' }, 'wrong_secret_attacker_key');
  const forgedRes = await request(
    { path: '/api/auth/me', headers: { Cookie: `votex_token=${forgedToken}` } }
  );
  assert('Forged JWT signature rejected with 401', forgedRes.status === 401);

  // 7.5 Legitimate Biometric Verification for Alice
  const bioVerifyAlice = await request(
    { path: '/api/vote/verify', method: 'POST', headers: { Cookie: aliceCookie } },
    {
      liveFaceDescriptor: sampleDescriptor,
      livenessVerified: true,
      authResponse: { id: 'sample_cred', clientDataJSON: 'xyz' }
    }
  );
  assert('Alice biometric identity certified', bioVerifyAlice.status === 200 && bioVerifyAlice.data.verified === true);

  // 7.6 Ballot Casting with Certified Biometrics
  const castVoteAlice = await request(
    { path: '/api/vote/cast', method: 'POST', headers: { Cookie: aliceCookie } },
    { candidateId: candidateId }
  );
  assert('Alice cast vote successfully after biometric certification', castVoteAlice.status === 200);
  const receiptCode = castVoteAlice.data.receiptCode;

  // 7.7 Double-Voting Prevention: Alice tries casting a 2nd vote
  const doubleVoteAlice = await request(
    { path: '/api/vote/cast', method: 'POST', headers: { Cookie: aliceCookie } },
    { candidateId: candidateId }
  );
  assert('Double voting strictly blocked with 403', doubleVoteAlice.status === 403);

  // 7.8 Ballot Privacy Check: Receipt does NOT leak candidate selection
  const receiptData = await request({ path: `/api/vote/receipt/${receiptCode}` });
  assert('Receipt exists and does not contain candidateId or candidate name',
    receiptData.status === 200 &&
    receiptData.data.receiptCode === receiptCode &&
    receiptData.data.candidateId === undefined &&
    receiptData.data.candidateName === undefined
  );

  // =====================================================================
  // STEP 8: PERFORMANCE & CONCURRENCY BENCHMARKING
  // =====================================================================
  console.log('\n--- STEP 8: Performance & Concurrency Testing ---');

  // 8.1 50 Concurrent requests to /api/health
  const concurrencyCount = 50;
  console.log(`  ⚡ Dispatching ${concurrencyCount} parallel requests to /api/health...`);
  const t0 = Date.now();
  const reqPromises = [];
  for (let i = 0; i < concurrencyCount; i++) {
    reqPromises.push(request({ path: '/api/health' }));
  }
  const results = await Promise.all(reqPromises);
  const elapsed = Date.now() - t0;
  const all200 = results.every((r) => r.status === 200);
  const avgLatency = (elapsed / concurrencyCount).toFixed(2);
  assert(`All ${concurrencyCount} concurrent requests succeeded (200 OK)`, all200);
  assert(`Latency under stress is optimal (${elapsed}ms total, ${avgLatency}ms/req)`, elapsed < 3000);

  // 8.2 Voter 2 (Bob) Face Enrollment, Login, Verification, and Vote Cast
  await request(
    { path: `/api/elections/${secElectionId}/voters/VSEC-02-${roomSuffix}/face`, method: 'POST', headers: { Cookie: adminCookie } },
    { faceDescriptor: sampleDescriptor }
  );

  const sendOtpBob = await request(
    { path: '/api/auth/voter/send-otp', method: 'POST' },
    { voterId: `VSEC-02-${roomSuffix}`, roomNumber: secRoom, phoneNumber: '+1 555-0222' }
  );
  const bobOtp = sendOtpBob.data.demoOtp || '123456';
  const verifyBob = await request(
    { path: '/api/auth/voter/verify-otp', method: 'POST' },
    { voterId: `VSEC-02-${roomSuffix}`, roomNumber: secRoom, phoneNumber: '+1 555-0222', otp: bobOtp }
  );
  const bobCookie = extractCookie(verifyBob.headers);

  await request(
    { path: '/api/vote/verify', method: 'POST', headers: { Cookie: bobCookie } },
    {
      liveFaceDescriptor: sampleDescriptor,
      livenessVerified: true,
      authResponse: { id: 'sample_cred_bob', clientDataJSON: 'xyz' }
    }
  );

  const castVoteBob = await request(
    { path: '/api/vote/cast', method: 'POST', headers: { Cookie: bobCookie } },
    { candidateId: candidateId }
  );
  assert('Bob successfully cast ballot under concurrency workflow', castVoteBob.status === 200);

  // 8.3 Publish Results and Verify Full Count Consistency
  await request(
    { path: `/api/elections/${secElectionId}/close`, method: 'POST', headers: { Cookie: adminCookie } }
  );
  await request(
    { path: `/api/elections/${secElectionId}/publish`, method: 'POST', headers: { Cookie: adminCookie } }
  );
  const finalResults = await request(
    { path: `/api/elections/room/${secRoom}/results` }
  );
  assert('Published results reflect exactly 2 total votes',
    finalResults.status === 200 && finalResults.data.totalVotes === 2
  );

  console.log('\n================================================================');
  console.log(`📊 SUITE COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal Suite Execution Error:', err);
  process.exit(1);
});

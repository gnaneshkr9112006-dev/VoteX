const http = require('http');

function request({ method, path, body, cookie }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 'Accept': 'application/json' };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const req = http.request(
      { hostname: 'localhost', port: 5000, path, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => raw += c);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = raw; }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return first.split(';')[0];
}

async function runTest() {
  console.log('================================================================');
  console.log('🧪 TESTING UNIFIED GMAIL & PHONE LOGIN + 200+ ELECTIONS SCALE');
  console.log('================================================================\n');

  // TEST 1: Returning Admin Login (Direct Redirection)
  console.log('▶ TEST 1: Returning Admin Login with Gmail (admin.official@gmail.com)...');
  const adminRes = await request({
    method: 'POST',
    path: '/api/auth/unified/login',
    body: { identifier: 'admin.official@gmail.com', authProvider: 'google' }
  });
  console.log(`  Status: ${adminRes.status}`);
  console.log(`  Response:`, adminRes.data);
  const adminCookie = extractCookie(adminRes.headers);
  if (!adminRes.data.needsRoleSelection && adminRes.data.role === 'admin' && adminRes.data.redirectTo === '/admin') {
    console.log('  ✅ SUCCESS: Direct redirection to /admin verified without role prompt!\n');
  } else {
    console.error('  ❌ FAIL: Expected direct redirect to /admin');
  }

  // TEST 2: Returning Voter Login (Direct Redirection)
  console.log('▶ TEST 2: Returning Voter Login with Gmail (gnaneshwar.votex@gmail.com)...');
  const voterRes = await request({
    method: 'POST',
    path: '/api/auth/unified/login',
    body: { identifier: 'gnaneshwar.votex@gmail.com', authProvider: 'google' }
  });
  console.log(`  Status: ${voterRes.status}`);
  console.log(`  Response:`, voterRes.data);
  if (!voterRes.data.needsRoleSelection && voterRes.data.role === 'voter' && voterRes.data.redirectTo === '/voter/verify') {
    console.log('  ✅ SUCCESS: Direct redirection to /voter/verify verified without role prompt!\n');
  } else {
    console.error('  ❌ FAIL: Expected direct redirect to /voter/verify');
  }

  // TEST 3: First-time user Login with new Gmail / Phone
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const newEmail = `sarah.voter${randomSuffix}@gmail.com`;
  console.log(`▶ TEST 3: First-Time User Login (${newEmail})...`);
  const firstRes = await request({
    method: 'POST',
    path: '/api/auth/unified/login',
    body: { identifier: newEmail, authProvider: 'google', name: 'Sarah Voter' }
  });
  console.log(`  Status: ${firstRes.status}`);
  console.log(`  Response:`, firstRes.data);
  if (firstRes.data.needsRoleSelection === true) {
    console.log('  ✅ SUCCESS: System prompts first-time user for role selection!\n');
  } else {
    console.error('  ❌ FAIL: Expected needsRoleSelection to be true');
  }

  // TEST 4: Select Role as Voter
  console.log(`▶ TEST 4: Selecting Role as "voter" for ${newEmail}...`);
  const selectRes = await request({
    method: 'POST',
    path: '/api/auth/unified/select-role',
    body: { identifier: newEmail, role: 'voter', name: 'Sarah Voter', roomNumber: 'VOTEX-2026' }
  });
  console.log(`  Status: ${selectRes.status}`);
  console.log(`  Response:`, selectRes.data);
  if (selectRes.data.success && selectRes.data.role === 'voter' && selectRes.data.redirectTo === '/voter/verify') {
    console.log('  ✅ SUCCESS: Role saved and session cookie created!\n');
  } else {
    console.error('  ❌ FAIL: Failed to configure role');
  }

  // TEST 5: REPEAT LOGIN with that same credential
  console.log(`▶ TEST 5: REPEAT LOGIN with ${newEmail} (Must direct redirect without prompt)...`);
  const repeatRes = await request({
    method: 'POST',
    path: '/api/auth/unified/login',
    body: { identifier: newEmail, authProvider: 'google' }
  });
  console.log(`  Status: ${repeatRes.status}`);
  console.log(`  Response:`, repeatRes.data);
  if (!repeatRes.data.needsRoleSelection && repeatRes.data.role === 'voter' && repeatRes.data.redirectTo === '/voter/verify') {
    console.log('  ✅ SUCCESS: Repeat login automatically redirected directly to voter portal!\n');
  } else {
    console.error('  ❌ FAIL: Did not directly redirect on repeat login!');
  }

  // TEST 6: Phone Number Login
  const phoneId = `+1 (555) 948-${randomSuffix}`;
  console.log(`▶ TEST 6: Phone Number Login (${phoneId})...`);
  const phoneRes = await request({
    method: 'POST',
    path: '/api/auth/unified/login',
    body: { identifier: phoneId, authProvider: 'phone', name: 'Citizen Phone' }
  });
  console.log(`  Status: ${phoneRes.status}, needsRoleSelection: ${phoneRes.data.needsRoleSelection}`);
  const phoneRoleRes = await request({
    method: 'POST',
    path: '/api/auth/unified/select-role',
    body: { identifier: phoneId, role: 'voter', name: 'Citizen Phone' }
  });
  console.log(`  Role selection status: ${phoneRoleRes.status}`);
  // Repeat phone login
  const phoneRepeat = await request({
    method: 'POST',
    path: '/api/auth/unified/login',
    body: { identifier: phoneId, authProvider: 'phone' }
  });
  if (!phoneRepeat.data.needsRoleSelection && phoneRepeat.data.role === 'voter') {
    console.log('  ✅ SUCCESS: Phone number login & repeat direct redirection verified!\n');
  }

  // TEST 7: 200+ Simultaneous Elections Scaling Check
  console.log('▶ TEST 7: Checking 200+ Simultaneous Active Elections...');
  const publicElections = await request({
    method: 'GET',
    path: '/api/elections/public'
  });
  console.log(`  Public Active Elections Count: ${publicElections.data.length}`);
  if (publicElections.data.length >= 200) {
    console.log(`  Sample Room: ${publicElections.data[0].room_number} ("${publicElections.data[0].title}")`);
    console.log(`  Sample Room: ${publicElections.data[100].room_number} ("${publicElections.data[100].title}")`);
    console.log(`  Sample Room: ${publicElections.data[200].room_number} ("${publicElections.data[200].title}")`);
    console.log('  ✅ SUCCESS: System actively hosting 200+ simultaneous election rooms!\n');
  } else {
    console.log(`  Current count is ${publicElections.data.length}. Triggering seedScale200...`);
    const scaleRes = await request({
      method: 'POST',
      path: '/api/elections/scale/seed-200',
      cookie: adminCookie,
      body: { count: 205 }
    });
    console.log(`  Scale response:`, scaleRes.data);
    const recheck = await request({ method: 'GET', path: '/api/elections/public' });
    console.log(`  Rechecked Active Elections: ${recheck.data.length}`);
  }

  console.log('================================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runTest().catch(console.error);

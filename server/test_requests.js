const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'change_this_to_a_long_random_string_at_least_64_chars';

// Generate JWT tokens
const adminToken = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
const voterToken = jwt.sign({ id: 99, role: 'voter', electionId: 1 }, JWT_SECRET, { expiresIn: '1h' });

function makeRequest({ method, path, body, cookie }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Accept': 'application/json'
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            data: parsed
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (body) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🔗 Connecting to VoteX Backend API Routers (/auth & /elections)');
  console.log('================================================================\n');

  const tests = [
    // 1. Health Endpoint
    {
      name: 'GET /api/health (System status check)',
      req: { method: 'GET', path: '/api/health' }
    },

    // 2. Auth: Admin login validation
    {
      name: 'POST /api/auth/admin/login (Missing fields validation)',
      req: { method: 'POST', path: '/api/auth/admin/login', body: {} }
    },

    // 3. Auth: Voter login validation
    {
      name: 'POST /api/auth/voter/login (Missing fields validation)',
      req: { method: 'POST', path: '/api/auth/voter/login', body: {} }
    },

    // 4. Auth: Get Current User without cookie
    {
      name: 'GET /api/auth/me (Unauthenticated request -> 401)',
      req: { method: 'GET', path: '/api/auth/me' }
    },

    // 5. Auth: Get Current User with Voter Cookie
    {
      name: 'GET /api/auth/me (Authenticated with Voter JWT cookie -> 200)',
      req: { method: 'GET', path: '/api/auth/me', cookie: `votex_token=${voterToken}` }
    },

    // 6. Auth: Get Current User with Admin Cookie
    {
      name: 'GET /api/auth/me (Authenticated with Admin JWT cookie -> 200)',
      req: { method: 'GET', path: '/api/auth/me', cookie: `votex_token=${adminToken}` }
    },

    // 7. Auth: Logout
    {
      name: 'POST /api/auth/logout (Clear session cookie -> 200)',
      req: { method: 'POST', path: '/api/auth/logout' }
    },

    // 8. Elections: Unauthenticated
    {
      name: 'GET /api/elections (Protected: Unauthenticated -> 401)',
      req: { method: 'GET', path: '/api/elections' }
    },

    // 9. Elections: Voter role forbidden (Require Admin)
    {
      name: 'GET /api/elections (Protected: Voter role rejected -> 403 Forbidden)',
      req: { method: 'GET', path: '/api/elections', cookie: `votex_token=${voterToken}` }
    },

    // 10. Elections: Admin role accepted
    {
      name: 'GET /api/elections (Protected: Admin role authorized)',
      req: { method: 'GET', path: '/api/elections', cookie: `votex_token=${adminToken}` }
    },

    // 11. Elections: Specific election stats with Admin role
    {
      name: 'GET /api/elections/1/stats (Protected: Admin stats endpoint)',
      req: { method: 'GET', path: '/api/elections/1/stats', cookie: `votex_token=${adminToken}` }
    },

    // 12. Elections: Close election endpoint with Admin role
    {
      name: 'POST /api/elections/1/close (Protected: Admin close endpoint)',
      req: { method: 'POST', path: '/api/elections/1/close', cookie: `votex_token=${adminToken}` }
    },

    // 13. Elections: Publish results endpoint with Admin role
    {
      name: 'POST /api/elections/1/publish (Protected: Admin publish endpoint)',
      req: { method: 'POST', path: '/api/elections/1/publish', cookie: `votex_token=${adminToken}` }
    }
  ];

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    console.log(`[Test ${i + 1}/${tests.length}] ${t.name}`);
    console.log(`    Request:  ${t.req.method} ${t.req.path}`);
    try {
      const res = await makeRequest(t.req);
      console.log(`    Status:   HTTP ${res.status}`);
      console.log(`    Response:`, typeof res.data === 'object' ? JSON.stringify(res.data) : res.data);
      if (res.headers['set-cookie']) {
        console.log(`    Cookies: `, res.headers['set-cookie']);
      }
      console.log('----------------------------------------------------------------');
    } catch (err) {
      console.error(`    Error:`, err.message);
    }
  }

  console.log('\n🎉 All HTTP requests to backend API routers completed successfully.');
}

runTests().catch(console.error);

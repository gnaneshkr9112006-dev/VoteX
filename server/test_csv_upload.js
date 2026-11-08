const fs = require('fs');
const http = require('http');
const path = require('path');

async function testUploadFile(filePath) {
  const name = path.basename(filePath);
  const csvContent = fs.readFileSync(filePath, 'utf8');
  console.log(`\n=== Testing File: ${name} ===`);

  // Admin login
  const loginRes = await new Promise(resolve => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ cookie: res.headers['set-cookie'][0].split(';')[0], data: JSON.parse(d) }));
    });
    req.write(JSON.stringify({ loginId: 'admin', password: 'admin123' }));
    req.end();
  });

  // Create room
  const roomRes = await new Promise(resolve => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/elections',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': loginRes.cookie }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(JSON.stringify({
      title: `CSV Test Room ${name}`,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 86400000).toISOString()
    }));
    req.end();
  });

  // Upload CSV
  const boundary = '----Boundary' + Math.random().toString(36);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/csv\r\n\r\n`),
    Buffer.from(csvContent),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const upRes = await new Promise(resolve => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/elections/${roomRes.electionId}/voters/import`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Cookie': loginRes.cookie
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.write(body);
    req.end();
  });

  console.log('Upload Result Data:', upRes.data);

  // List voters
  const listRes = await new Promise(resolve => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/elections/${roomRes.electionId}/voters`,
      method: 'GET',
      headers: { 'Cookie': loginRes.cookie }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.end();
  });

  console.log(`Fetched ${listRes.length} voters:`);
  console.log(listRes.map(v => `${v.voter_id} | ${v.full_name} | ${v.phone_number || 'No Phone'} | ${v.email}`));
}

async function main() {
  await testUploadFile(path.resolve(__dirname, '..', 'sample_voters.csv'));
  await testUploadFile(path.resolve(__dirname, '..', 'test_voters.csv'));
  await testUploadFile(path.resolve(__dirname, '..', 'test_voters_digital_voting.csv'));
  await testUploadFile(path.resolve(__dirname, '..', 'voter_records_10_people.csv'));
}

main().catch(console.error);

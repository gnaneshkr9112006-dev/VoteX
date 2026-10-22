import alasql from 'alasql';
import bcrypt from 'bcrypt';
import { config } from '../config';

export class InMemoryDb {
  private initialized = false;

  public async init() {
    if (this.initialized) return;

    alasql(`
      CREATE TABLE IF NOT EXISTS administrators (
        id INT AUTO_INCREMENT PRIMARY KEY,
        login_id STRING,
        password_hash STRING,
        role STRING,
        created_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS election_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_number STRING,
        admin_id INT,
        title STRING,
        start_time DATETIME,
        end_time DATETIME,
        status STRING DEFAULT "active",
        onchain_election_id STRING,
        results_published INT DEFAULT 0,
        created_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS candidates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        election_id INT,
        candidate_code STRING,
        name STRING,
        party STRING,
        bio STRING,
        created_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS voters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voter_id STRING,
        full_name STRING,
        email STRING,
        google_sub STRING,
        face_descriptor STRING,
        face_photo STRING,
        created_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS room_voters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        election_id INT,
        voter_id INT,
        verification_proof_hash STRING,
        has_voted INT,
        voted_at DATETIME,
        webauthn_credential_id STRING,
        created_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS vote_receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        election_id INT,
        receipt_code STRING,
        voter_commitment STRING,
        tx_hash STRING,
        block_number INT,
        created_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS blockchain_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        election_id INT,
        tx_hash STRING,
        block_number INT,
        action_type STRING,
        voter_commitment STRING,
        proof_hash STRING,
        timestamp DATETIME,
        created_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT,
        election_id INT,
        action STRING,
        details STRING,
        ip_address STRING,
        created_at DATETIME
      );
    `);

    // Seed default admin
    const passwordHash = await bcrypt.hash(config.admin.password, 10);
    alasql(
      'INSERT INTO administrators (login_id, password_hash, role, created_at) VALUES (?, ?, ?, NOW())',
      [config.admin.loginId, passwordHash, config.admin.role]
    );

    // Also support ise2028 login
    if (config.admin.loginId !== 'ise2028') {
      const iseHash = await bcrypt.hash('ise2028', 10);
      alasql(
        'INSERT INTO administrators (login_id, password_hash, role, created_at) VALUES (?, ?, ?, NOW())',
        ['ise2028', iseHash, 'super_admin']
      );
    }

    // Seed default active election room for instant testing
    const now = new Date();
    const startTime = new Date(now.getTime() - 3600000).toISOString();
    const endTime = new Date(now.getTime() + 7 * 86400000).toISOString();

    alasql(
      'INSERT INTO election_rooms (id, admin_id, title, room_number, start_time, end_time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [1, 1, 'National General Election 2026', 'VOTEX-2026', startTime, endTime, 'active']
    );

    // Seed candidates
    alasql(
      'INSERT INTO candidates (id, election_id, candidate_code, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [1, 1, 'CAN-01', 'Dr. Sarah Mitchell', 'Progressive Alliance', 'Pioneering clean energy, education reform, and digital transparency.']
    );
    alasql(
      'INSERT INTO candidates (id, election_id, candidate_code, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [2, 1, 'CAN-02', 'Marcus Vance', 'Civic Liberty Union', 'Advocating for economic modernization, personal privacy, and civic infrastructure.']
    );

    // Seed default voters with verified Google identities
    alasql(
      'INSERT INTO voters (id, voter_id, full_name, email, created_at) VALUES (?, ?, ?, ?, NOW())',
      [1, 'VTR-001', 'Alex Rivera', 'alex.rivera@gmail.com']
    );
    alasql(
      'INSERT INTO voters (id, voter_id, full_name, email, created_at) VALUES (?, ?, ?, ?, NOW())',
      [2, 'VTR-002', 'Priya Sharma', 'priya.sharma@gmail.com']
    );
    alasql(
      'INSERT INTO voters (id, voter_id, full_name, email, created_at) VALUES (?, ?, ?, ?, NOW())',
      [3, 'VTR-003', 'Gnaneshwar', 'gnaneshwar.votex@gmail.com']
    );
    alasql(
      'INSERT INTO voters (id, voter_id, full_name, email, created_at) VALUES (?, ?, ?, ?, NOW())',
      [4, 'VTR-004', 'Gnaneshwar Alt', 'gnaneshwar@votex.io']
    );

    // Register voters in the room:
    // VTR-001: Registered, Eligible (not voted)
    // VTR-002: Registered, Already Voted (has_voted = 1, for duplicate vote testing)
    // VTR-003: Registered, Eligible (not voted)
    alasql('INSERT INTO room_voters (id, election_id, voter_id, has_voted, created_at) VALUES (1, 1, 1, 0, NOW())');
    alasql('INSERT INTO room_voters (id, election_id, voter_id, has_voted, voted_at, created_at) VALUES (2, 1, 2, 1, NOW(), NOW())');
    alasql('INSERT INTO room_voters (id, election_id, voter_id, has_voted, created_at) VALUES (3, 1, 3, 0, NOW())');
    alasql('INSERT INTO room_voters (id, election_id, voter_id, has_voted, created_at) VALUES (4, 1, 4, 0, NOW())');

    // Create users table for unified login (Gmail, Phone/Email) with role memory
    alasql(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier STRING,
        auth_provider STRING,
        role STRING,
        name STRING,
        avatar_url STRING,
        linked_admin_id INT,
        linked_voter_id INT,
        last_room_number STRING,
        created_at DATETIME,
        updated_at DATETIME
      );
    `);

    // Seed default users with remembered roles for instant repeat login
    alasql('INSERT INTO users (id, identifier, auth_provider, role, name, linked_admin_id, created_at) VALUES (1, "admin@votex.io", "email", "admin", "System Administrator", 1, NOW())');
    alasql('INSERT INTO users (id, identifier, auth_provider, role, name, linked_admin_id, created_at) VALUES (2, "admin.official@gmail.com", "google", "admin", "Admin Official (Gmail)", 1, NOW())');
    alasql('INSERT INTO users (id, identifier, auth_provider, role, name, linked_voter_id, last_room_number, created_at) VALUES (3, "gnaneshwar.votex@gmail.com", "google", "voter", "Gnaneshwar (Gmail)", 3, "VOTEX-2026", NOW())');
    alasql('INSERT INTO users (id, identifier, auth_provider, role, name, linked_voter_id, last_room_number, created_at) VALUES (4, "voter@votex.io", "email", "voter", "Alex Rivera (Voter)", 1, "VOTEX-2026", NOW())');

    // Seed 205 simultaneous active elections with candidates and voter registrations
    this.seed200Elections(205);

    this.initialized = true;
    console.log(`✅ In-memory database initialized and pre-seeded with 205 simultaneous active elections, candidates, and remembered Gmail/Phone user accounts.`);
  }

  public seed200Elections(targetCount: number = 205) {
    const currentCountRows: any = alasql('SELECT COUNT(*) as cnt FROM election_rooms');
    const currentCount = (currentCountRows && currentCountRows[0] && currentCountRows[0].cnt) || 0;
    if (currentCount >= targetCount) {
      return { count: currentCount, message: `Already initialized with ${currentCount} elections` };
    }

    const now = new Date();
    const startTime = new Date(now.getTime() - 3600000).toISOString();
    const endTime = new Date(now.getTime() + 7 * 86400000).toISOString();

    const categories = [
      'National Assembly District',
      'Metropolitan Council Ward',
      'State Senate District',
      'University Faculty Council',
      'Judicial Oversight District',
      'Cooperative Board of Directors',
      'Regional Health Board',
      'Civic Infrastructure Committee'
    ];

    const candidatePool = [
      { name: 'Dr. Elena Rostova', party: 'Open Governance Alliance', bio: 'Championing digital rights, smart election integrity, and civic accountability.' },
      { name: 'Marcus Vance Jr.', party: 'Civic Liberty Union', bio: 'Advancing sustainable municipal development, privacy, and infrastructure.' },
      { name: 'Dr. Tariq Al-Mansoor', party: 'Progressive Tech Alliance', bio: 'Pioneering clean energy, university reform, and decentralized voting.' },
      { name: 'Sophia Chen', party: 'Public Trust Coalition', bio: 'Focusing on transparent budget allocation, healthcare access, and student representation.' }
    ];

    let candIdCounter = 1000;
    for (let i = currentCount + 1; i <= targetCount; i++) {
      const cat = categories[(i - 1) % categories.length];
      const roomCode = `VOTEX-E${String(i).padStart(3, '0')}`;
      const title = `${cat} #${String(i).padStart(3, '0')}`;

      alasql(
        'INSERT INTO election_rooms (id, admin_id, title, room_number, start_time, end_time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [i, 1, title, roomCode, startTime, endTime, 'active']
      );

      // Register 2 candidates
      const candA = candidatePool[(i * 2) % candidatePool.length];
      const candB = candidatePool[(i * 2 + 1) % candidatePool.length];
      candIdCounter++;
      alasql(
        'INSERT INTO candidates (id, election_id, candidate_code, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [candIdCounter, i, 'CAN-01', candA.name, candA.party, candA.bio]
      );
      candIdCounter++;
      alasql(
        'INSERT INTO candidates (id, election_id, candidate_code, name, party, bio, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [candIdCounter, i, 'CAN-02', candB.name, candB.party, candB.bio]
      );

      // Pre-link voters (1, 2, 3) to each election room
      alasql(`INSERT INTO room_voters (election_id, voter_id, has_voted, created_at) VALUES (${i}, 1, 0, NOW())`);
      alasql(`INSERT INTO room_voters (election_id, voter_id, has_voted, created_at) VALUES (${i}, 2, 0, NOW())`);
      alasql(`INSERT INTO room_voters (election_id, voter_id, has_voted, created_at) VALUES (${i}, 3, 0, NOW())`);
    }

    return { count: targetCount, message: `Successfully initialized ${targetCount} simultaneous active elections.` };
  }

  public async query(sql: string, params: any[] = []): Promise<[any, any]> {
    let cleanSql = sql.trim();

    // Strip MySQL specific clauses that alasql doesn't use
    cleanSql = cleanSql.replace(/\s+FOR\s+UPDATE/gi, '');

    // Ensure integer ID columns handle string parameter coercion in alaSQL
    cleanSql = cleanSql.replace(/\b([a-zA-Z0-9_]+\.)?(id|admin_id|election_id)\s*=\s*\?/gi, '$1$2 = CAST(? AS INT)');

    // Escape alaSQL aggregate keyword 'total'
    cleanSql = cleanSql.replace(/\bas\s+total\b/gi, 'as [total]');

    // Normalize params
    const normalizedParams = params ? params.map(p => p instanceof Date ? p.toISOString() : p) : [];

    try {
      const isInsert = cleanSql.toUpperCase().startsWith('INSERT');
      const isUpdate = cleanSql.toUpperCase().startsWith('UPDATE');
      const isDelete = cleanSql.toUpperCase().startsWith('DELETE');

      const result = alasql(cleanSql, normalizedParams);

      if (isInsert) {
        // Extract table name to get last inserted ID
        const match = cleanSql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
        let insertId = 1;
        if (match && match[1]) {
          const tableName = match[1];
          try {
            const maxRows: any = alasql(`SELECT MAX(id) as maxId FROM ${tableName}`);
            if (maxRows && maxRows.length > 0 && maxRows[0].maxId != null) {
              insertId = maxRows[0].maxId;
            }
          } catch {
            // ignore
          }
        }
        return [{ insertId, affectedRows: 1 }, undefined];
      }

      if (isUpdate || isDelete) {
        return [{ affectedRows: typeof result === 'number' ? result : 1 }, undefined];
      }

      // SELECT
      return [Array.isArray(result) ? result : [result], undefined];
    } catch (err: any) {
      console.error('[InMemoryDb] Query error:', err.message, 'SQL:', cleanSql, 'Params:', params);
      throw err;
    }
  }

  public async getConnection() {
    return {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      query: (sql: string, params: any[] = []) => this.query(sql, params),
      release: () => {}
    };
  }
}

export const inMemoryDb = new InMemoryDb();

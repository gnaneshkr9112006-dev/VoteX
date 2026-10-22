import mysql from 'mysql2/promise';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import { inMemoryDb } from './inMemoryDb';

let isFallback = false;
let realPool: mysql.Pool | null = null;

const createPool = (database?: string): mysql.Pool => {
  return mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
    connectTimeout: 2000
  });
};

export const initDb = async () => {
  try {
    // Attempt connecting to real MySQL
    const tempPool = createPool();
    const tempConn = await tempPool.getConnection();

    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.name}\``);
    await tempConn.query(`USE \`${config.db.name}\``);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await tempConn.query(schema);

    tempConn.release();
    await tempPool.end();

    realPool = createPool(config.db.name);
    isFallback = false;
    console.log(`✅ MySQL database "${config.db.name}" connected and initialized with schema`);
  } catch (error: any) {
    console.warn(`⚠️  MySQL connection could not be established on port ${config.db.port} (${error.code || error.message}).`);
    console.log('🔄 Activating automatic in-memory database fallback for seamless local execution...');
    await inMemoryDb.init();
    isFallback = true;
  }
};

// Proxy pool that routes to realPool if available, or inMemoryDb if fallback
export const pool = {
  query: async (sql: string, params?: any[]): Promise<[any, any]> => {
    if (!isFallback && realPool) {
      try {
        return await realPool.query(sql, params);
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.warn('⚠️  MySQL connection dropped, switching to in-memory fallback');
          isFallback = true;
          await inMemoryDb.init();
          return inMemoryDb.query(sql, params);
        }
        throw err;
      }
    }
    // Fallback mode
    await inMemoryDb.init();
    return inMemoryDb.query(sql, params);
  },
  getConnection: async () => {
    if (!isFallback && realPool) {
      try {
        return await realPool.getConnection();
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.warn('⚠️  MySQL connection dropped, switching to in-memory fallback');
          isFallback = true;
          await inMemoryDb.init();
          return inMemoryDb.getConnection();
        }
        throw err;
      }
    }
    await inMemoryDb.init();
    return inMemoryDb.getConnection();
  }
} as unknown as mysql.Pool;

import bcrypt from 'bcrypt';
import { pool } from './connection';
import { config } from '../config';

export const seedAdmin = async () => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM administrators WHERE login_id = ?', [config.admin.loginId]);
    if (rows.length === 0) {
      const hash = await bcrypt.hash(config.admin.password, 10);
      await pool.query(
        'INSERT INTO administrators (login_id, password_hash, role) VALUES (?, ?, ?)',
        [config.admin.loginId, hash, config.admin.role]
      );
      console.log('Admin user seeded');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
};

import bcrypt from 'bcrypt';
import { pool, initDb } from './connection';
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
      console.log(`Admin user "${config.admin.loginId}" seeded`);
    } else {
      console.log(`Admin user "${config.admin.loginId}" already exists`);
    }

    if (config.admin.loginId !== 'ise2028') {
      const [iseRows]: any = await pool.query('SELECT * FROM administrators WHERE login_id = ?', ['ise2028']);
      if (iseRows.length === 0) {
        const iseHash = await bcrypt.hash('ise2028', 10);
        await pool.query(
          'INSERT INTO administrators (login_id, password_hash, role) VALUES (?, ?, ?)',
          ['ise2028', iseHash, 'super_admin']
        );
        console.log('Super admin user "ise2028" seeded');
      }
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
};

if (require.main === module) {
  (async () => {
    await initDb();
    await seedAdmin();
    process.exit(0);
  })().catch((err) => {
    console.error('Seed admin script failed:', err);
    process.exit(1);
  });
}

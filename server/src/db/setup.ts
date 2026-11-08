import { initDb } from './connection';
import { seedAdmin } from './seedAdmin';

const setup = async () => {
  console.log('[VoteX] Running database setup...');
  await initDb();
  await seedAdmin();
  console.log('[VoteX] Database setup complete.');
};

if (require.main === module) {
  setup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[VoteX] Database setup failed:', err);
      process.exit(1);
    });
}

export default setup;

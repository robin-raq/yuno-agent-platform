import { buildServer } from './server';
import { getDb } from './db/db';
import { seedTemplates } from './db/seed';
import { config, hasGoose, hasTelegram } from './config';

const db = getDb();
seedTemplates(db); // idempotent — ensures the two workflow templates exist on boot
const app = buildServer(db);

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .then((addr) => {
    // eslint-disable-next-line no-console
    console.log(`Yuno Agents listening on ${addr}`);
    console.log(`  goose=${hasGoose()} telegram=${hasTelegram()}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });

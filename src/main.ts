import { buildServer } from './server';
import { config, hasGoose, hasTelegram } from './config';

const app = buildServer();

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

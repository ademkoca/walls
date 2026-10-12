import { createApp } from './app';

const DEFAULT_PORT = 4000;
const port = Number(process.env.API_PORT ?? DEFAULT_PORT);

createApp().listen(port, () => {
  // Replaced by structured logging (pino) in Phase 3.
  console.info(`API listening on port ${port}`);
});

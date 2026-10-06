import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  console.log(`KSS WhatsApp Notifications backend listening on port ${env.port} (mode: ${env.metaMode})`);
});

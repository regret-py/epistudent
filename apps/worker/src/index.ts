import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@studybuddy/db";
import { loadConfig } from "./config.js";
import { startScheduler } from "./scheduler.js";

const config = loadConfig();

const supabase = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stopScheduler = startScheduler([
  {
    name: "purge-room-reports",
    intervalMs: config.ROOM_PURGE_INTERVAL_MS,
    run: async () => {
      const { error } = await supabase.rpc("purge_expired_room_reports");
      if (error) throw new Error(error.message);
    },
  },
  // Intra scraping job (every 2h) lands here once its design is validated.
]);

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(config.PORT, () => {
  console.log(`worker listening on :${config.PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  stopScheduler();
  server.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

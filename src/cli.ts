import fs from "fs";
import { loadConfig } from "./config";
import { buildRegistry } from "./registry";
import { createServer } from "./server";

async function run() {
  const config = loadConfig();

  if (config.mode === "generate") {
    console.log("🚀 Running in generate mode...");
    const data = await buildRegistry({
      sources: config.sources,
      timeoutMs: config.timeoutMs,
      rawUrl: config.rawUrl ?? undefined,
    });
    const file = config.outputFile;
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`✅ Wrote ${file} with ${data.total} entries.`);
    return;
  }

  // server mode
  console.log("🚀 Running in server mode...");
  const server = await createServer({
    port: config.port,
    host: config.host,
    cacheTime: config.cacheSeconds,
    timeout: config.timeoutMs,
    sources: config.sources,
    corsOrigin: config.corsOrigin,
  });

  console.info(`✅ Server running at http://${config.host}:${config.port}`);
  console.info(
    `📄 Registry endpoint: http://${config.host}:${config.port}/index.json`
  );
  console.info(`💊 Health check: http://${config.host}:${config.port}/health`);
  console.info(`📊 Status: http://${config.host}:${config.port}/status`);

  const shutdown = () => {
    console.info("🛑 Shutting down server...");
    server.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (import.meta.main) {
  run().catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
  });
}

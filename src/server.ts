import { buildRegistry } from "./registry";

interface ServerConfig {
  port: number;
  cacheTime: number;
  timeout: number;
  sources: string[];
  host: string;
  corsOrigin: string;
}

// 默认配置
const DEFAULT_CONFIG: ServerConfig = {
  port: 3000,
  cacheTime: 300, // 5分钟
  timeout: 15000,
  sources: [
    "https://koishi-registry.yumetsuki.moe/index.json",
    "https://kp.itzdrli.cc/index.json",
    "https://registry.koishi.t4wefan.pub/index.json",
    "https://cdn.jsdelivr.net/gh/YesWeAreBot/koishi-registry-mirror@pages/index.json",
    "https://gh-proxy.com/https://raw.githubusercontent.com/YesWeAreBot/koishi-registry-mirror/refs/heads/pages/index.json",
  ],
  host: "0.0.0.0",
  corsOrigin: "*",
};

// 创建 HTTP 服务器（带简易内存缓存与并发抑制）
async function createServer(config: ServerConfig) {
  type CacheEntry = { data: any; ts: number } | null;
  let cache: CacheEntry = null;
  let updating: Promise<any> | null = null;

  // 添加 CORS 头的辅助函数
  const withCors = (response: Response): Response => {
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", config.corsOrigin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  // 使用 Bun.serve 创建服务器
  const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    async fetch(request: Request) {
      const url = new URL(request.url);
      const path = url.pathname;

      // 处理 OPTIONS 请求 (CORS 预检)
      if (request.method === "OPTIONS") {
        return withCors(new Response(null, { status: 204 }));
      }

      try {
        // 健康检查端点
        if (path === "/health") {
          const healthy = cache !== null;
          const lastUpdate = cache?.data?.generatedAt || "Never";
          const cacheExpiry = cache
            ? new Date(cache.ts + config.cacheTime * 1000).toISOString()
            : "No cache";
          const total = cache?.data?.total || 0;
          const status = {
            healthy,
            lastUpdate,
            cacheExpiry,
            totalPlugins: total,
            activeSources: config.sources.length,
            errors: updating ? [] : [],
          };
          return withCors(
            Response.json(status, { status: healthy ? 200 : 503 })
          );
        }

        // 状态端点
        if (path === "/status") {
          const mem = process.memoryUsage();
          const status = {
            config,
            memory: {
              rss: Math.round(mem.rss / 1024 / 1024),
              heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
              heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            },
            uptime: process.uptime(),
            isUpdating: Boolean(updating),
            cacheTimeLeft: cache
              ? Math.max(0, cache.ts + config.cacheTime * 1000 - Date.now())
              : 0,
          };
          return withCors(Response.json(status));
        }

        // 主要的镜像端点
        if (path === "/" || path === "/index.json") {
          // 简单缓存策略：有效则直接返回；否则单次刷新（并发复用同一个 Promise）
          const cacheValid =
            cache && Date.now() - cache.ts < config.cacheTime * 1000;
          if (!cacheValid) {
            if (!updating) {
              updating = buildRegistry({
                sources: config.sources,
                timeoutMs: config.timeout,
              })
                .then((data) => {
                  cache = { data, ts: Date.now() };
                  return data;
                })
                .finally(() => {
                  updating = null;
                });
            }
            await updating;
          }
          const data = cache!.data;

          // 设置缓存头
          const headers = new Headers({
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${Math.floor(
              config.cacheTime / 2
            )}`,
            ETag: `"${data.generatedAt}"`,
          });

          // 检查 If-None-Match 头 (ETag 缓存)
          const clientETag = request.headers.get("If-None-Match");
          if (clientETag === `"${data.generatedAt}"`) {
            return withCors(new Response(null, { status: 304, headers }));
          }

          return withCors(new Response(JSON.stringify(data), { headers }));
        }

        // 强制更新端点 (仅在开发环境或特定条件下可用)
        if (path === "/refresh" && request.method === "POST") {
          updating = buildRegistry({
            sources: config.sources,
            timeoutMs: config.timeout,
          })
            .then((data) => {
              cache = { data, ts: Date.now() };
              return data;
            })
            .finally(() => {
              updating = null;
            });
          const data = await updating;
          return withCors(
            Response.json({
              message: "Registry refreshed successfully",
              total: data.total,
              generatedAt: data.generatedAt,
            })
          );
        }

        // 404
        return withCors(new Response("Not Found", { status: 404 }));
      } catch (error) {
        console.error("Server error:", error);
        return withCors(
          Response.json(
            {
              error: "Internal Server Error",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          )
        );
      }
    },
  });

  return server;
}

// 主函数
async function main() {
  const config = { ...DEFAULT_CONFIG };

  console.info("🚀 Starting Koishi Registry Mirror Server...");
  console.info(`📋 Configuration:`);
  console.info(`   Port: ${config.port}`);
  console.info(`   Host: ${config.host}`);
  console.info(`   Cache Time: ${config.cacheTime}s`);
  console.info(`   Timeout: ${config.timeout}ms`);
  console.info(`   Sources: ${config.sources.length} upstream(s)`);
  console.info(`   CORS Origin: ${config.corsOrigin}`);

  try {
    const server = await createServer(config);

    console.info(`✅ Server running at http://${config.host}:${config.port}`);
    console.info(
      `📄 Registry endpoint: http://${config.host}:${config.port}/index.json`
    );
    console.info(
      `💊 Health check: http://${config.host}:${config.port}/health`
    );
    console.info(`📊 Status: http://${config.host}:${config.port}/status`);

    // 优雅关闭处理
    const shutdown = () => {
      console.info("🛑 Shutting down server...");
      server.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// 启动服务器
if (import.meta.main) {
  main().catch((error) => {
    console.error("💥 Unhandled error:", error);
    process.exit(1);
  });
}

export { createServer, type ServerConfig };

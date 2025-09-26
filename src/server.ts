import { buildRegistry, RegistryResult } from "./registry";
import type { Api, Server as ServerTypes } from "./types";

export interface ServerConfig extends ServerTypes.ServerConfig {}

interface CacheEntry {
  data: RegistryResult;
  fetchedAt: number;
  expiresAt: number;
}

type BunServer = ReturnType<typeof Bun.serve>;

interface InternalState {
  cache: CacheEntry | null;
  error: string | null;
  refreshTask: Promise<void> | null;
  refreshTimer: ReturnType<typeof setInterval> | null;
  lastRefreshReason: string | null;
}

const logPrefix = "[registry-mirror]";

export type MirrorServer = ServerTypes.MirrorServer;

export async function createServer(config: ServerConfig): Promise<MirrorServer> {
  const ttlMs = Math.max(1_000, config.cacheTime * 1_000);
  const proactiveThresholdMs = Math.max(1_000, Math.min(ttlMs / 2, 30_000));
  const cadenceMs = Math.max(1_000, Math.min(ttlMs / 2, 60_000));

  const state: InternalState = {
    cache: null,
    error: null,
    refreshTask: null,
    refreshTimer: null,
    lastRefreshReason: null,
  };

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

  const runRefresh = async (reason: string, failHard: boolean): Promise<void> => {
    const started = Date.now();
    state.lastRefreshReason = reason;
    console.info(`${logPrefix} refresh started (${reason}) with ${config.sources.length} source(s)`);
    try {
      const data = await buildRegistry({
        sources: config.sources,
        timeoutMs: config.timeout,
        rawUrl: config.rawUrl ?? undefined,
      });
      const fetchedAt = Date.now();
      state.cache = {
        data,
        fetchedAt,
        expiresAt: fetchedAt + ttlMs,
      };
      state.error = null;
      console.info(`${logPrefix} refresh succeeded in ${Date.now() - started}ms (reason: ${reason}, total: ${data.total})`);
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      console.error(`${logPrefix} refresh failed (${reason}):`, error);
      if (!state.cache || failHard) {
        throw error;
      }
    }
  };

  const triggerRefresh = (reason: string, failHard = false): Promise<void> => {
    if (!state.refreshTask) {
      state.refreshTask = runRefresh(reason, failHard).finally(() => {
        state.refreshTask = null;
      });
      return state.refreshTask;
    }

    const pending = state.refreshTask;
    if (!failHard) {
      return pending;
    }

    return pending.then(() => {
      if (state.error) {
        throw new Error(state.error);
      }
    });
  };

  const scheduleProactiveRefresh = () => {
    if (state.refreshTimer) return;
    state.refreshTimer = setInterval(() => {
      const now = Date.now();
      if (!state.cache) {
        void triggerRefresh("interval-no-cache");
        return;
      }
      const timeToExpiry = state.cache.expiresAt - now;
      if (timeToExpiry <= proactiveThresholdMs) {
        void triggerRefresh("interval-expiring");
      }
    }, cadenceMs);
  };

  const ensureUsableCache = async () => {
    if (!state.cache) {
      await triggerRefresh("request-miss", true);
    }
  };

  const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    async fetch(request: Request) {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === "OPTIONS") {
        return withCors(new Response(null, { status: 204 }));
      }

      try {
        if (path === "/health") {
          const cache = state.cache;
          const healthy = Boolean(cache);
          const payload: Api.HealthResponse = {
            healthy,
            lastUpdate: cache?.data.generatedAt ?? null,
            cacheExpiry: cache ? new Date(cache.expiresAt).toISOString() : null,
            totalPlugins: cache?.data.total ?? 0,
            activeSources: config.sources.length,
            isUpdating: Boolean(state.refreshTask),
            lastError: state.error,
          };
          return withCors(Response.json(payload, { status: healthy ? 200 : 503 }));
        }

        if (path === "/status") {
          const mem = process.memoryUsage();
          const cache = state.cache;
          const payload: Api.StatusResponse = {
            config: {
              port: config.port,
              host: config.host,
              cacheTime: config.cacheTime,
              timeout: config.timeout,
              sources: config.sources,
              corsOrigin: config.corsOrigin,
            },
            cache: cache
              ? {
                  fetchedAt: new Date(cache.fetchedAt).toISOString(),
                  expiresAt: new Date(cache.expiresAt).toISOString(),
                  ageSeconds: Math.max(0, Math.floor((Date.now() - cache.fetchedAt) / 1_000)),
                  remainingSeconds: Math.max(0, Math.floor((cache.expiresAt - Date.now()) / 1_000)),
                  totalPlugins: cache.data.total,
                }
              : null,
            uptime: process.uptime(),
            isUpdating: Boolean(state.refreshTask),
            lastRefreshReason: state.lastRefreshReason,
            lastError: state.error,
            memory: {
              rssMB: Math.round(mem.rss / 1_048_576),
              heapTotalMB: Math.round(mem.heapTotal / 1_048_576),
              heapUsedMB: Math.round(mem.heapUsed / 1_048_576),
            },
          };
          return withCors(Response.json(payload));
        }

        if (path === "/" || path === "/index.json") {
          await ensureUsableCache();

          const cache = state.cache;
          if (!cache) {
            throw new Error("Cache unavailable after refresh");
          }

          const now = Date.now();
          const isFresh = cache.expiresAt > now;
          if (!isFresh) {
            void triggerRefresh("request-stale");
          }

          const data = cache.data;
          const headers = new Headers({
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${Math.floor(config.cacheTime / 2)}`,
            ETag: `"${data.generatedAt}"`,
          });

          const clientETag = request.headers.get("If-None-Match");
          if (clientETag === `"${data.generatedAt}"`) {
            return withCors(new Response(null, { status: 304, headers }));
          }

          return withCors(new Response(JSON.stringify(data), { headers }));
        }

        if (path === "/refresh" && request.method === "POST") {
          await triggerRefresh("manual", true);
          const cache = state.cache;
          if (!cache) {
            return withCors(
              Response.json(
                {
                  error: "Refresh failed",
                  message: state.error ?? "Unknown error",
                },
                { status: 500 }
              )
            );
          }
          return withCors(
            Response.json({
              message: "Registry refreshed successfully",
              total: cache.data.total,
              generatedAt: cache.data.generatedAt,
            })
          );
        }

        return withCors(new Response("Not Found", { status: 404 }));
      } catch (error) {
        console.error(`${logPrefix} server error:`, error);
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

  const originalStop = server.stop.bind(server);
  const stop = () => {
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
      state.refreshTimer = null;
    }
    return originalStop();
  };

  const refresh = async (reason = "manual") => {
    await triggerRefresh(reason, true);
  };

  await triggerRefresh("startup", true);
  scheduleProactiveRefresh();

  return Object.assign(server, { stop, refresh }) as MirrorServer;
}

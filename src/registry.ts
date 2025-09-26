import axios from "axios";
import { Data, Object as PluginObject } from "./schema";

export interface RegistryOptions {
  sources: string[];
  timeoutMs: number;
  rawUrl?: string | null;
}

export interface RegistryResult extends Data {}

/**
 * 从上游拉取、合并、规范化并返回 registry 数据
 */
export async function buildRegistry(
  options: RegistryOptions
): Promise<RegistryResult> {
  const { sources, timeoutMs, rawUrl } = options;
  const generatedAt = new Date().toISOString();

  const results = await Promise.allSettled(
    sources.map((url) => fetchFromSource(url, timeoutMs))
  );

  const plugins: PluginObject[] = [];
  for (const [i, res] of results.entries()) {
    if (res.status === "fulfilled") {
      console.log(
        `✅ Source ${sources[i]} returned ${res.value.length} plugins`
      );
      plugins.push(...res.value);
    } else {
      const reason = (res as PromiseRejectedResult).reason;
      console.error(
        `❌ Source ${sources[i]} failed: ${reason?.message || reason}`
      );
    }
  }

  if (plugins.length === 0) {
    throw new Error("No data retrieved from any source");
  }

  const deduped = mergePlugins(plugins);
  const normalized = deduped.map(normalizePlugin);
  normalized.push(
    createStatusPlugin(normalized.length, generatedAt, rawUrl || undefined)
  );

  const output: Data = {
    info: "Koishi Registry Mirror",
    total: normalized.length,
    time: new Date().toUTCString(),
    version: 1,
    generatedAt,
    rawUrl: rawUrl || "",
    sources,
    objects: normalized,
  };

  // runtime validate
  Data(output);
  return output;
}

async function fetchFromSource(
  url: string,
  timeoutMs: number
): Promise<PluginObject[]> {
  const res = await axios.get(url, {
    timeout: timeoutMs,
    validateStatus: (status) => status < 500,
  });
  if (!res.data || !Array.isArray(res.data.objects)) {
    throw new Error(`Invalid format from source ${url}`);
  }
  return res.data.objects as PluginObject[];
}

/**
 * 按 package.name 或 shortname 去重，保留 updatedAt 最新的
 */
export function mergePlugins(plugins: PluginObject[]): PluginObject[] {
  const map = new Map<string, PluginObject>();
  for (const p of plugins) {
    const key = p.package?.name || p.shortname;
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, p);
    } else {
      const newer =
        new Date(p.updatedAt || 0).getTime() >
        new Date(prev.updatedAt || 0).getTime();
      if (newer) map.set(key, p);
    }
  }
  return [...map.values()];
}

/**
 * 规范化插件对象，确保必需字段存在
 */
export function normalizePlugin(plugin: Partial<PluginObject>): PluginObject {
  const n: any = { ...plugin };
  n.manifest ||= {};
  n.manifest.service ||= { required: [], optional: [], implements: [] };
  n.manifest.service.required ||= [];
  n.manifest.service.optional ||= [];
  n.manifest.service.implements ||= [];
  n.manifest.locales ||= [];
  n.manifest.description ||= plugin.package?.description || "";
  return n as PluginObject;
}

/**
 * 生成一个状态插件，展示镜像状态
 */
export function createStatusPlugin(
  count: number,
  generatedAt: string,
  rawUrl?: string
): PluginObject {
  const rssMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const formatted = new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return {
    _id: "mirror-status",
    category: "other",
    shortname: "mirror-status",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    updated: generatedAt,
    portable: false,
    ignored: false,
    verified: true,
    score: {
      final: 20,
      detail: { quality: 20, popularity: 20, maintenance: 20 },
    },
    rating: 20,
    license: "PRIVATE",
    package: {
      license: "PRIVATE",
      name: "koishi-plugin-mirror-status",
      version: "1.0.0",
      description: `Koishi镜像源状态 | 最后更新: ${formatted} | 插件: ${count} | 内存: ${rssMB}MB`,
      keywords: ["status", "mirror", "information"],
      publisher: {
        name: "YesImBot Team",
        email: "2445691453@qq.com",
        username: "yesimbot",
      },
      maintainers: [
        {
          name: "YesImBot Team",
          email: "2445691453@qq.com",
          username: "yesimbot",
        },
      ],
      date: generatedAt,
      links: { npm: rawUrl || "", homepage: rawUrl || "" },
      contributors: [],
    },
    flags: { insecure: 0 },
    manifest: {
      description: {
        zh: `Koishi镜像源状态 | 最后更新: ${formatted} | 插件: ${count} | 内存: ${rssMB}MB`,
      },
      locales: [],
      service: { required: [], optional: [], implements: [] },
    },
    publishSize: 0,
    insecure: false,
    installSize: 0,
    dependents: 0,
    downloads: { lastMonth: 10000 },
  } as PluginObject;
}

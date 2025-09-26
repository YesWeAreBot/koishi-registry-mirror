import fs from 'fs'
import axios from 'axios'
import { Data, Object } from './schema'

/** 配置 */
const PLUGIN_SOURCES = [
  'https://koishi-registry.yumetsuki.moe/index.json',
  //'https://koi.nyan.zone/registry/index.json',
  'https://kp.itzdrli.cc/index.json',
  'https://registry.koishi.t4wefan.pub/index.json',
]

const OUTPUT_FILE = 'index.json'
const RAW_URL = `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/pages/${OUTPUT_FILE}`
const HTTP_TIMEOUT = 15000

/** 从单个源获取插件数据 */
async function fetchFromSource(url: string): Promise<Object[]> {
  try {
    const res = await axios.get(url, { timeout: HTTP_TIMEOUT })
    if (!res.data || !Array.isArray(res.data.objects)) {
      console.warn(`⚠️  Invalid format from source ${url}`)
      return []
    }
    return res.data.objects as Object[]
  } catch (err: any) {
    console.error(`❌ Error fetching ${url}: ${err.message}`)
    return []
  }
}

/** 获取所有插件源 */
async function fetchSources(): Promise<Object[]> {
  const results = await Promise.allSettled(PLUGIN_SOURCES.map(fetchFromSource))
  const all: Object[] = []
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      console.log(`✅ Source ${PLUGIN_SOURCES[i]} returned ${result.value.length} plugins`)
      all.push(...result.value)
    } else {
      console.error(`❌ Source ${PLUGIN_SOURCES[i]} failed: ${result.reason}`)
    }
  }
  return all
}

/** 数据规范化，确保重要字段存在 */
function normalizePlugin(plugin: Partial<Object>): Object {
  const normalized: any = { ...plugin }

  normalized.manifest ||= {}
  normalized.manifest.service ||= { required: [], optional: [], implements: [] }
  normalized.manifest.service.required ||= []
  normalized.manifest.service.optional ||= []
  normalized.manifest.service.implements ||= []
  normalized.manifest.locales ||= []
  normalized.manifest.description ||= plugin.package?.description || ''

  return normalized as Object
}

/**
 * 按 package.name 或 shortname 作为去重键，
 * 如果有重复，保留 updatedAt 最新的
 */
function mergePlugins(plugins: Object[]): Object[] {
  const map = new Map<string, Object>()
  for (const plugin of plugins) {
    const key = plugin.package?.name || plugin.shortname
    if (!key) continue

    const existing = map.get(key)
    if (!existing) {
      map.set(key, plugin)
    } else {
      const newer =
        new Date(plugin.updatedAt || 0).getTime() >
        new Date(existing.updatedAt || 0).getTime()
      if (newer) map.set(key, plugin)
    }
  }
  return Array.from(map.values())
}

/** 创建状态插件 */
function createStatusPlugin(pluginCount: number, generatedAt: string): Object {
  const rssMB = Math.round(process.memoryUsage().rss / 1024 / 1024)
  const formattedDate = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return {
    _id: 'mirror-status',
    category: 'other',
    shortname: 'mirror-status',
    createdAt: generatedAt,
    updatedAt: generatedAt,
    updated: generatedAt,
    portable: false,
    ignored: false,
    verified: true,
    score: {
      final: 20,
      detail: {
        quality: 20,
        popularity: 20,
        maintenance: 20,
      },
    },
    rating: 20,
    license: 'PRIVATE',
    package: {
      license: 'PRIVATE',
      name: 'koishi-plugin-mirror-status',
      version: '1.0.0',
      description: `Koishi镜像源状态 | 最后更新: ${formattedDate} | 插件: ${pluginCount} | 内存: ${rssMB}MB`,
      keywords: ['status', 'mirror', 'information'],
      publisher: {
        name: 'YesImBot Team',
        email: '2445691453@qq.com',
        username: 'yesimbot', // 填补缺失的 username
      },
      maintainers: [
        {
          name: 'YesImBot Team',
          email: '2445691453@qq.com',
          username: 'yesimbot',
        },
      ],
      date: generatedAt,
      links: {
        npm: RAW_URL,
        homepage: RAW_URL,
      },
      contributors: [],
    },
    flags: { insecure: 0 },
    manifest: {
      description: {
        zh: `Koishi镜像源状态 | 最后更新: ${formattedDate} | 插件: ${pluginCount} | 内存: ${rssMB}MB`,
      },
      locales: [],
      service: {
        required: [],
        optional: [],
        implements: [],
      },
    },
    publishSize: 0,
    insecure: false,
    installSize: 0,
    dependents: 0,
    downloads: { lastMonth: 10000 },
  }
}

/** 主执行函数 */
async function generateRegistry() {
  console.log('🚀 Starting registry generation...')
  const start = Date.now()
  const generatedAt = new Date().toISOString()

  // Step 1: 获取源数据
  const rawPlugins = await fetchSources()
  console.log(`📦 Got ${rawPlugins.length} plugins from ${PLUGIN_SOURCES.length} sources`)

  // Step 2: 去重，取最新版本
  const deduped = mergePlugins(rawPlugins)
  console.log(`🔍 Deduplicated to ${deduped.length} unique plugins`)

  // Step 3: 数据规范化
  const normalized = deduped.map(normalizePlugin)

  // Step 4: 添加状态插件
  normalized.push(createStatusPlugin(normalized.length, generatedAt))

  // Step 5: 组装 RegistryData
  const output: Data = {
    info: 'Hosted by GitHub Pages Mirror',
    total: normalized.length,
    time: new Date().toUTCString(),
    version: 1,
    generatedAt,
    rawUrl: RAW_URL,
    sources: PLUGIN_SOURCES,
    objects: normalized,
  }

  // Step 6: Schema 校验
  try {
    Data(output) // 运行时验证
  } catch (err) {
    console.error('❌ Schema validation failed:', err)
    process.exit(1)
  }

  // Step 7: 写文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2))
  console.log(`✅ Registry generated with ${normalized.length} entries in ${((Date.now() - start) / 1000).toFixed(1)}s`)
  console.log(`📄 Output: ${OUTPUT_FILE}`)
  console.log(`🌐 RAW URL: ${RAW_URL}`)
}

// Run
generateRegistry()

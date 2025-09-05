import Schema from 'schemastery'

export interface Data {
  info: string
  total: number
  time: string
  version: number
  generatedAt: string
  rawUrl: string
  sources: string[]
  objects: Object[]
}

export const Data: Schema<Data> = Schema.object({
  info: Schema.string(),
  total: Schema.number().min(0),
  time: Schema.string(),
  version: Schema.number().min(0),
  generatedAt: Schema.string(),
  rawUrl: Schema.string(),
  sources: Schema.array(Schema.string()),
  objects: Schema.array(Schema.lazy(() => Object)),
})

/** ---------------- 单个插件对象 ---------------- **/
export interface Object {
  _id: string
  package: PackageInfo
  category: string
  createdAt: string
  dependents: number
  downloads: Downloads
  flags: Flags
  ignored: boolean
  insecure: boolean
  installSize: number
  license: string
  manifest: Manifest
  portable: boolean
  publishSize: number
  rating: number
  score: Score
  shortname: string
  updated: string
  updatedAt: string
  verified: boolean
}

export const Object: Schema<Object> = Schema.object({
  _id: Schema.string(),
  package: Schema.lazy(() => PackageInfo),
  category: Schema.string(),
  createdAt: Schema.string(),
  dependents: Schema.number().min(0),
  downloads: Schema.lazy(() => Downloads),
  flags: Schema.lazy(() => Flags),
  ignored: Schema.boolean(),
  insecure: Schema.boolean(),
  installSize: Schema.number().min(0),
  license: Schema.string(),
  manifest: Schema.lazy(() => Manifest),
  portable: Schema.boolean(),
  publishSize: Schema.number().min(0),
  rating: Schema.number(),
  score: Schema.lazy(() => Score),
  shortname: Schema.string(),
  updated: Schema.string(),
  updatedAt: Schema.string(),
  verified: Schema.boolean(),
})

/** ---------------- 包信息 ---------------- **/
export interface PackageInfo {
  name: string
  keywords: string[]
  version: string
  description: string
  publisher: Publisher
  maintainers: Maintainer[]
  license: string
  date: string // ISO8601
  links: Links
  contributors: Contributor[]
}

export const PackageInfo: Schema<PackageInfo> = Schema.object({
  name: Schema.string(),
  keywords: Schema.array(Schema.string()),
  version: Schema.string(),
  description: Schema.string(),
  publisher: Schema.lazy(() => Publisher),
  maintainers: Schema.array(Schema.lazy(() => Maintainer)),
  license: Schema.string(),
  date: Schema.string(),
  links: Schema.lazy(() => Links),
  contributors: Schema.array(Schema.lazy(() => Contributor)),
})

/** ---------------- 发布者/维护者 ---------------- **/
export interface Publisher {
  name: string
  email: string
  username: string
}

export const Publisher: Schema<Publisher> = Schema.object({
  name: Schema.string(),
  email: Schema.string(),
  username: Schema.string(),
})

export interface Maintainer {
  name: string
  email: string
  username: string
}

export const Maintainer: Schema<Maintainer> = Schema.object({
  name: Schema.string(),
  email: Schema.string(),
  username: Schema.string(),
})

/** ---------------- 链接信息 ---------------- **/
export interface Links {
  npm: string
  bugs?: string
  homepage?: string
  repository?: string
}

export const Links: Schema<Links> = Schema.object({
  npm: Schema.string(),
  bugs: Schema.string(),
  homepage: Schema.string(),
  repository: Schema.string(),
})

/** ---------------- 贡献者 ---------------- **/
export interface Contributor {
  name?: string
  email?: string
  username?: string
}

export const Contributor: Schema<Contributor> = Schema.object({
  name: Schema.string(),
  email: Schema.string(),
  username: Schema.string(),
})

/** ---------------- 下载信息 ---------------- **/
export interface Downloads {
  lastMonth: number
}

export const Downloads: Schema<Downloads> = Schema.object({
  lastMonth: Schema.number().min(0),
})

/** ---------------- 安全标志 ---------------- **/
export interface Flags {
  insecure: number
}

export const Flags: Schema<Flags> = Schema.object({
  insecure: Schema.number().min(0),
})

/** ---------------- 多语言描述 ---------------- **/
export interface LocaleString {
  en?: string
  zh?: string
  [lang: string]: string | undefined
}

export const LocaleString: Schema<LocaleString> = Schema.object({
  en: Schema.string(),
  zh: Schema.string(),
})

/** ---------------- Manifest ---------------- **/
export interface Manifest {
  public?: string[]
  category?: string
  description: LocaleString | string
  service?: {
    implements?: string[]
    required?: string[]
    optional?: string[]
  } | string[]
  services?: {
    required?: string[]
  } | string[]
  locales: string[] | Record<string, string>
}

export const Manifest: Schema<Manifest> = Schema.object({
  public: Schema.array(Schema.string()),
  category: Schema.string(),
  description: Schema.union([Schema.lazy(() => LocaleString), Schema.string()]),
  service: Schema.union([
    Schema.object({
      implements: Schema.array(Schema.string()),
      required: Schema.array(Schema.string()),
      optional: Schema.array(Schema.string()),
    }),
    Schema.array(Schema.string()),
  ]),
  services: Schema.union([
    Schema.object({
      required: Schema.array(Schema.string()),
    }),
    Schema.array(Schema.string()),
  ]),
  locales: Schema.union([Schema.array(Schema.string()), Schema.object({})]),
})

/** ---------------- 分数 ---------------- **/
export interface Score {
  final: number
  detail: {
    quality: number
    popularity: number
    maintenance: number
  }
}

export const Score: Schema<Score> = Schema.object({
  final: Schema.number(),
  detail: Schema.object({
    quality: Schema.number(),
    popularity: Schema.number(),
    maintenance: Schema.number(),
  }),
})


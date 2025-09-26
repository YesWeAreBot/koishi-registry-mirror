import Schema from "schemastery";
import type { Plugin, Registry } from "./types";

export type { Plugin, Registry } from "./types";

export const DataSchema: Schema<Registry.Index> = Schema.object({
  info: Schema.string(),
  total: Schema.number().min(0),
  time: Schema.string(),
  version: Schema.number().min(0),
  generatedAt: Schema.string(),
  rawUrl: Schema.string(),
  sources: Schema.array(Schema.string()),
  objects: Schema.array(Schema.lazy(() => ObjectSchema)),
});

/** ---------------- 单个插件对象 ---------------- **/
export const ObjectSchema: Schema<Plugin.Entry> = Schema.object({
  _id: Schema.string(),
  package: Schema.lazy(() => PackageInfoSchema),
  category: Schema.string(),
  createdAt: Schema.string(),
  dependents: Schema.number().min(0),
  downloads: Schema.lazy(() => DownloadsSchema),
  flags: Schema.lazy(() => FlagsSchema),
  ignored: Schema.boolean(),
  insecure: Schema.boolean(),
  installSize: Schema.number().min(0),
  license: Schema.string(),
  manifest: Schema.lazy(() => ManifestSchema),
  portable: Schema.boolean(),
  publishSize: Schema.number().min(0),
  rating: Schema.number(),
  score: Schema.lazy(() => ScoreSchema),
  shortname: Schema.string(),
  updated: Schema.string(),
  updatedAt: Schema.string(),
  verified: Schema.boolean(),
});

/** ---------------- 包信息 ---------------- **/
export const PackageInfoSchema: Schema<Plugin.Package> = Schema.object({
  name: Schema.string(),
  keywords: Schema.array(Schema.string()),
  version: Schema.string(),
  description: Schema.string(),
  publisher: Schema.lazy(() => PublisherSchema),
  maintainers: Schema.array(Schema.lazy(() => MaintainerSchema)),
  license: Schema.string(),
  date: Schema.string(),
  links: Schema.lazy(() => LinksSchema),
  contributors: Schema.array(Schema.lazy(() => ContributorSchema)),
});

/** ---------------- 发布者/维护者 ---------------- **/
export const PublisherSchema: Schema<Plugin.Publisher> = Schema.object({
  name: Schema.string(),
  email: Schema.string(),
  username: Schema.string(),
});

export const MaintainerSchema: Schema<Plugin.Maintainer> = Schema.object({
  name: Schema.string(),
  email: Schema.string(),
  username: Schema.string(),
});

/** ---------------- 链接信息 ---------------- **/
export const LinksSchema: Schema<Plugin.Links> = Schema.object({
  npm: Schema.string(),
  bugs: Schema.string(),
  homepage: Schema.string(),
  repository: Schema.string(),
});

/** ---------------- 贡献者 ---------------- **/
export const ContributorSchema: Schema<Plugin.Contributor> = Schema.object({
  name: Schema.string(),
  email: Schema.string(),
  username: Schema.string(),
});

/** ---------------- 下载信息 ---------------- **/
export const DownloadsSchema: Schema<Plugin.Downloads> = Schema.object({
  lastMonth: Schema.number().min(0),
});

/** ---------------- 安全标志 ---------------- **/
export const FlagsSchema: Schema<Plugin.Flags> = Schema.object({
  insecure: Schema.number().min(0),
});

/** ---------------- 多语言描述 ---------------- **/
export const LocaleStringSchema: Schema<Plugin.LocaleString> = Schema.object({
  en: Schema.string(),
  zh: Schema.string(),
});

/** ---------------- Manifest ---------------- **/
export const ManifestSchema: Schema<Plugin.Manifest> = Schema.object({
  public: Schema.array(Schema.string()),
  category: Schema.string(),
  description: Schema.union([Schema.lazy(() => LocaleStringSchema), Schema.string()]),
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
});

/** ---------------- 分数 ---------------- **/
export const ScoreSchema: Schema<Plugin.Score> = Schema.object({
  final: Schema.number(),
  detail: Schema.object({
    quality: Schema.number(),
    popularity: Schema.number(),
    maintenance: Schema.number(),
  }),
});

// Registry and Plugin domain types (namespaced)
export namespace Registry {
  // Registry index document
  export interface Index {
    info: string;
    total: number;
    time: string; // RFC 1123 string (UTC)
    version: number;
    generatedAt: string; // ISO string
    rawUrl: string;
    sources: string[];
    objects: Plugin.Entry[];
  }
}

export namespace Plugin {
  // Main plugin entry in registry.objects
  export interface Entry {
    _id: string;
    package: Package;
    category: string;
    createdAt: string;
    dependents: number;
    downloads: Downloads;
    flags: Flags;
    ignored: boolean;
    insecure: boolean;
    installSize: number;
    license: string;
    manifest: Manifest;
    portable: boolean;
    publishSize: number;
    rating: number;
    score: Score;
    shortname: string;
    updated: string;
    updatedAt: string;
    verified: boolean;
  }

  export interface Package {
    name: string;
    keywords: string[];
    version: string;
    description: string;
    publisher: Publisher;
    maintainers: Maintainer[];
    license: string;
    date: string; // ISO string
    links: Links;
    contributors: Contributor[];
  }

  export interface Publisher {
    name: string;
    email: string;
    username: string;
  }

  export interface Maintainer {
    name: string;
    email: string;
    username: string;
  }

  export interface Links {
    npm: string;
    bugs?: string;
    homepage?: string;
    repository?: string;
  }

  export interface Contributor {
    name?: string;
    email?: string;
    username?: string;
  }

  export interface Downloads {
    lastMonth: number;
  }

  export interface Flags {
    insecure: number;
  }

  export interface LocaleString {
    en?: string;
    zh?: string;
    [lang: string]: string | undefined;
  }

  export interface Manifest {
    public?: string[];
    category?: string;
    description: LocaleString | string;
    service?:
      | {
          implements?: string[];
          required?: string[];
          optional?: string[];
        }
      | string[];
    services?:
      | {
          required?: string[];
        }
      | string[];
    locales: string[] | Record<string, string>;
  }

  export interface Score {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  }
}

// Server and API response types
export namespace Api {
  export interface HealthResponse {
    healthy: boolean;
    lastUpdate: string | null;
    cacheExpiry: string | null;
    totalPlugins: number;
    activeSources: number;
    isUpdating: boolean;
    lastError: string | null;
  }

  export interface StatusConfig {
    port: number;
    host: string;
    cacheTime: number;
    timeout: number;
    sources: string[];
    corsOrigin: string;
  }

  export interface StatusCacheInfo {
    fetchedAt: string; // ISO string
    expiresAt: string; // ISO string
    ageSeconds: number;
    remainingSeconds: number;
    totalPlugins: number;
  }

  export interface MemoryStats {
    rssMB: number;
    heapTotalMB: number;
    heapUsedMB: number;
  }

  export interface StatusResponse {
    config: StatusConfig;
    cache: StatusCacheInfo | null;
    uptime: number;
    isUpdating: boolean;
    lastRefreshReason: string | null;
    lastError: string | null;
    memory: MemoryStats;
  }
}

export namespace Server {
  export interface ServerConfig {
    port: number;
    cacheTime: number;
    timeout: number;
    sources: string[];
    host: string;
    corsOrigin: string;
    rawUrl?: string | null;
  }

  export type MirrorServer = ReturnType<typeof Bun.serve> & {
    stop(): number;
    refresh(reason?: string): Promise<void>;
  };
}

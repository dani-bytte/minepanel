import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface NormalizedModSearchResult {
  provider: 'curseforge' | 'modrinth';
  projectId: string;
  slug: string;
  name: string;
  summary: string;
  iconUrl?: string;
  downloads?: number;
  lastUpdated?: string;
  supportedVersions: string[];
  supportedLoaders: string[];
}

export interface NormalizedModSearchResponse {
  data: NormalizedModSearchResult[];
  pagination: {
    index: number;
    pageSize: number;
    resultCount: number;
    totalCount: number;
  };
}

interface ModrinthSearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  downloads: number;
  date_modified?: string;
  versions: string[];
  categories: string[];
}

interface ModrinthSearchResponse {
  hits: ModrinthSearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

@Injectable()
export class ModrinthService {
  private readonly apiClient: AxiosInstance;
  private readonly MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
  private readonly MINECRAFT_VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
  private readonly LATEST_VERSION_CACHE_TTL_MS = 60 * 60 * 1000;
  private readonly KNOWN_LOADERS = ['forge', 'neoforge', 'fabric', 'quilt', 'paper', 'purpur', 'spigot', 'velocity', 'bungeecord', 'waterfall', 'bukkit'];
  private latestReleaseCache?: { value: string; fetchedAt: number };

  constructor() {
    this.apiClient = axios.create({
      baseURL: this.MODRINTH_API_BASE,
      timeout: 10000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  async searchMods(query: {
    q?: string;
    limit?: number;
    offset?: number;
    minecraftVersion: string;
    loader?: string;
  }): Promise<NormalizedModSearchResponse> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const offset = Math.max(query.offset ?? 0, 0);
    const normalizedLoader = this.normalizeLoader(query.loader);
    const minecraftVersion = await this.resolveMinecraftVersion(query.minecraftVersion);

    const facets: string[][] = [
      ['project_type:mod'],
      [`versions:${minecraftVersion}`],
    ];

    if (normalizedLoader) {
      facets.push([`categories:${normalizedLoader}`]);
    }

    try {
      const response = await this.apiClient.get<ModrinthSearchResponse>('/search', {
        params: {
          query: query.q,
          limit,
          offset,
          index: 'relevance',
          facets: JSON.stringify(facets),
        },
      });

      const normalized = response.data.hits
        .map((hit) => this.normalizeHit(hit))
        .filter((mod) => this.isCompatibleResult(mod, minecraftVersion, normalizedLoader));

      return {
        data: normalized,
        pagination: {
          index: offset,
          pageSize: limit,
          resultCount: normalized.length,
          totalCount: response.data.total_hits,
        },
      };
    } catch (error) {
      console.error('Error searching Modrinth mods:', error);

      if (axios.isAxiosError(error)) {
        throw new HttpException(
          error.response?.data?.description || 'Error searching mods',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException('Error searching mods', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private normalizeHit(hit: ModrinthSearchHit): NormalizedModSearchResult {
    const supportedLoaders = (hit.categories ?? []).filter((category) =>
      this.KNOWN_LOADERS.includes(category.toLowerCase()),
    );

    return {
      provider: 'modrinth',
      projectId: hit.project_id,
      slug: hit.slug,
      name: hit.title,
      summary: hit.description ?? '',
      iconUrl: hit.icon_url,
      downloads: hit.downloads,
      lastUpdated: hit.date_modified,
      supportedVersions: hit.versions ?? [],
      supportedLoaders,
    };
  }

  private isCompatibleResult(
    mod: NormalizedModSearchResult,
    minecraftVersion: string,
    loader?: string,
  ): boolean {
    const hasVersion = mod.supportedVersions.some((version) => version === minecraftVersion);
    if (!hasVersion) return false;

    if (!loader) return true;
    if (mod.supportedLoaders.length === 0) return true;
    return mod.supportedLoaders.includes(this.normalizeLoader(loader) ?? loader);
  }

  private normalizeLoader(loader?: string): string | undefined {
    if (!loader) return undefined;
    const normalized = loader.toLowerCase().trim();
    const aliases: Record<string, string> = {
      'neo-forge': 'neoforge',
    };
    return aliases[normalized] ?? normalized;
  }

  private async resolveMinecraftVersion(version: string): Promise<string> {
    const normalized = version?.trim();
    if (!normalized) return version;

    const lower = normalized.toLowerCase();
    const shouldResolveLatest =
      lower === 'latest' || lower === 'latest_release' || lower === 'release';

    if (!shouldResolveLatest) {
      return normalized;
    }

    const now = Date.now();
    if (this.latestReleaseCache && now - this.latestReleaseCache.fetchedAt < this.LATEST_VERSION_CACHE_TTL_MS) {
      return this.latestReleaseCache.value;
    }

    try {
      const response = await axios.get<{ latest?: { release?: string } }>(this.MINECRAFT_VERSION_MANIFEST_URL, {
        timeout: 5000,
      });

      const release = response.data?.latest?.release;
      if (release) {
        this.latestReleaseCache = { value: release, fetchedAt: now };
        return release;
      }
    } catch (error) {
      console.warn('Could not resolve latest Minecraft release, using provided version.', error);
    }

    return normalized;
  }
}

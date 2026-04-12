import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface CurseForgeModpack {
  id: number;
  gameId: number;
  name: string;
  slug: string;
  links: {
    websiteUrl: string;
  };
  summary: string;
  status: number;
  downloadCount: number;
  isFeatured: boolean;
  primaryCategoryId: number;
  categories: Array<{
    id: number;
    gameId: number;
    name: string;
    slug: string;
    url: string;
    iconUrl: string;
    dateModified: string;
    isClass: boolean;
    classId: number;
    parentCategoryId: number;
  }>;
  authors: Array<{
    id: number;
    name: string;
    url: string;
  }>;
  logo: {
    id: number;
    modId: number;
    title: string;
    description: string;
    thumbnailUrl: string;
    url: string;
  };
  screenshots: Array<{
    id: number;
    modId: number;
    title: string;
    description: string;
    thumbnailUrl: string;
    url: string;
  }>;
  mainFileId: number;
  latestFiles: Array<{
    id: number;
    gameId: number;
    modId: number;
    isAvailable: boolean;
    displayName: string;
    fileName: string;
    releaseType: number;
    fileStatus: number;
    hashes: Array<{
      value: string;
      algo: number;
    }>;
    fileDate: string;
    fileLength: number;
    downloadCount: number;
    downloadUrl: string;
    gameVersions: string[];
    sortableGameVersions: Array<{
      gameVersionName: string;
      gameVersionPadded: string;
      gameVersion: string;
      gameVersionReleaseDate: string;
      gameVersionTypeId: number;
    }>;
    dependencies: Array<{
      modId: number;
      relationType: number;
    }>;
    alternateFileId: number;
    isServerPack: boolean;
    fileFingerprint: number;
    modules: Array<{
      name: string;
      fingerprint: number;
    }>;
  }>;
  latestFilesIndexes: Array<{
    gameVersion: string;
    fileId: number;
    filename: string;
    releaseType: number;
    gameVersionTypeId: number;
    modLoader: number;
  }>;
  dateCreated: string;
  dateModified: string;
  dateReleased: string;
  allowModDistribution: boolean;
  gamePopularityRank: number;
  isAvailable: boolean;
  thumbsUpCount: number;
}

export interface CurseForgeSearchResponse {
  data: CurseForgeModpack[];
  pagination: {
    index: number;
    pageSize: number;
    resultCount: number;
    totalCount: number;
  };
}

export interface CurseForgeModResponse {
  data: CurseForgeModpack;
}

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

export interface ResolvedCurseforgeDependenciesResponse {
  data: NormalizedModSearchResult[];
}

@Injectable()
export class CurseforgeService {
  private readonly apiClient: AxiosInstance;
  private readonly CURSEFORGE_API_BASE = 'https://api.curseforge.com/v1';
  private readonly MINECRAFT_VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
  private readonly MINECRAFT_GAME_ID = 432;
  private readonly MODS_CLASS_ID = 6;
  private readonly MODPACK_CLASS_ID = 4471;
  private readonly LATEST_VERSION_CACHE_TTL_MS = 60 * 60 * 1000;
  private readonly REQUIRED_DEPENDENCY_RELATION_TYPE = 3;
  private latestReleaseCache?: { value: string; fetchedAt: number };
  private readonly modCache = new Map<number, CurseForgeModpack>();

  constructor() {
    this.apiClient = axios.create({
      baseURL: this.CURSEFORGE_API_BASE,
      timeout: 10000,
    });
  }

  private getApiClient(apiKey: string): AxiosInstance {
    return axios.create({
      baseURL: this.CURSEFORGE_API_BASE,
      timeout: 10000,
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    });
  }

  async searchModpacks(
    apiKey: string,
    searchFilter?: string,
    pageSize: number = 20,
    index: number = 0,
    sortField: number = 2, // 1 = Featured, 2 = Popularity, 3 = LastUpdated, 4 = Name, 5 = Author, 6 = TotalDownloads
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<CurseForgeSearchResponse> {
    if (!apiKey) {
      throw new HttpException(
        'CurseForge API key not configured',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const client = this.getApiClient(apiKey);
      const response = await client.get<CurseForgeSearchResponse>('/mods/search', {
        params: {
          gameId: this.MINECRAFT_GAME_ID,
          classId: this.MODPACK_CLASS_ID,
          searchFilter,
          pageSize,
          index,
          sortField,
          sortOrder,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error searching CurseForge modpacks:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new HttpException(
            'Invalid CurseForge API key',
            HttpStatus.FORBIDDEN,
          );
        }
        throw new HttpException(
          error.response?.data?.message || 'Error searching modpacks',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        'Error searching modpacks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getModpack(apiKey: string, modId: number): Promise<CurseForgeModpack> {
    if (!apiKey) {
      throw new HttpException(
        'CurseForge API key not configured',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const client = this.getApiClient(apiKey);
      const response = await client.get<CurseForgeModResponse>(`/mods/${modId}`);

      return response.data.data;
    } catch (error) {
      console.error('Error fetching CurseForge modpack:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new HttpException(
            'Invalid CurseForge API key',
            HttpStatus.FORBIDDEN,
          );
        }
        if (error.response?.status === 404) {
          throw new HttpException(
            'Modpack not found',
            HttpStatus.NOT_FOUND,
          );
        }
        throw new HttpException(
          error.response?.data?.message || 'Error fetching modpack',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        'Error fetching modpack',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getMod(apiKey: string, modId: number): Promise<CurseForgeModpack> {
    if (!apiKey) {
      throw new HttpException(
        'CurseForge API key not configured',
        HttpStatus.BAD_REQUEST,
      );
    }

    const cached = this.modCache.get(modId);
    if (cached) {
      return cached;
    }

    try {
      const client = this.getApiClient(apiKey);
      const response = await client.get<CurseForgeModResponse>(`/mods/${modId}`);
      const mod = response.data.data;
      this.modCache.set(modId, mod);
      return mod;
    } catch (error) {
      console.error('Error fetching CurseForge mod:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new HttpException(
            'Invalid CurseForge API key',
            HttpStatus.FORBIDDEN,
          );
        }
        if (error.response?.status === 404) {
          throw new HttpException(
            'Mod not found',
            HttpStatus.NOT_FOUND,
          );
        }
        throw new HttpException(
          error.response?.data?.message || 'Error fetching mod',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        'Error fetching mod',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getRequiredDependencies(
    apiKey: string,
    modId: number,
    query?: {
      minecraftVersion?: string;
      loader?: string;
    },
  ): Promise<ResolvedCurseforgeDependenciesResponse> {
    const rootMod = await this.getMod(apiKey, modId);
    const minecraftVersion = query?.minecraftVersion
      ? await this.resolveMinecraftVersion(query.minecraftVersion)
      : undefined;
    const normalizedLoader = this.normalizeLoader(query?.loader);
    const visited = new Set<number>([modId]);
    const resolved: NormalizedModSearchResult[] = [];

    const walk = async (currentModId: number): Promise<void> => {
      if (visited.has(currentModId)) return;
      visited.add(currentModId);

      const dependencyMod = await this.getMod(apiKey, currentModId);
      const nestedRequiredIds = this.extractRequiredDependencyIds(dependencyMod, minecraftVersion);

      for (const nestedId of nestedRequiredIds) {
        await walk(nestedId);
      }

      const normalized = this.normalizeMod(dependencyMod);
      if (!minecraftVersion || this.isCompatibleResult(normalized, minecraftVersion, normalizedLoader)) {
        resolved.push(normalized);
      }
    };

    const requiredIds = this.extractRequiredDependencyIds(rootMod, minecraftVersion);
    for (const requiredId of requiredIds) {
      await walk(requiredId);
    }

    return { data: resolved };
  }

  async getFeaturedModpacks(apiKey: string, limit: number = 10): Promise<CurseForgeSearchResponse> {
    return this.searchModpacks(apiKey, undefined, limit, 0, 1, 'desc');
  }

  async getPopularModpacks(apiKey: string, limit: number = 10): Promise<CurseForgeSearchResponse> {
    return this.searchModpacks(apiKey, undefined, limit, 0, 2, 'desc');
  }

  async searchMods(
    apiKey: string,
    query: {
      q?: string;
      pageSize?: number;
      index?: number;
      minecraftVersion: string;
      loader?: string;
    },
  ): Promise<NormalizedModSearchResponse> {
    if (!apiKey) {
      throw new HttpException(
        'CurseForge API key not configured',
        HttpStatus.BAD_REQUEST,
      );
    }

    const requestedPageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 50);
    const pageSize = requestedPageSize % 2 === 0
      ? requestedPageSize
      : Math.min(requestedPageSize + 1, 50);
    const index = Math.max(query.index ?? 0, 0);
    const normalizedLoader = this.normalizeLoader(query.loader);
    const minecraftVersion = await this.resolveMinecraftVersion(query.minecraftVersion);
    const maxBatches = 8;

    try {
      const client = this.getApiClient(apiKey);
      const normalized: NormalizedModSearchResult[] = [];
      const seen = new Set<string>();
      let totalCount = 0;
      let batchIndex = index;
      let batches = 0;

      while (normalized.length < pageSize && batches < maxBatches) {
        const response = await client.get<CurseForgeSearchResponse>('/mods/search', {
          params: {
            gameId: this.MINECRAFT_GAME_ID,
            classId: this.MODS_CLASS_ID,
            searchFilter: query.q,
            pageSize,
            index: batchIndex,
            sortField: 2,
            sortOrder: 'desc',
            gameVersion: minecraftVersion,
            modLoaderType: this.mapLoaderToCurseforgeType(normalizedLoader),
          },
        });

        totalCount = response.data.pagination.totalCount;
        const compatibleBatch = response.data.data
          .map((mod) => this.normalizeMod(mod))
          .filter((mod) => this.isCompatibleResult(mod, minecraftVersion, normalizedLoader));

        for (const mod of compatibleBatch) {
          if (normalized.length >= pageSize) break;
          if (seen.has(mod.projectId)) continue;
          normalized.push(mod);
          seen.add(mod.projectId);
        }

        batchIndex += pageSize;
        batches += 1;

        if (batchIndex >= totalCount) break;
        if (response.data.data.length === 0) break;
      }

      return {
        data: normalized,
        pagination: {
          index,
          pageSize,
          resultCount: normalized.length,
          totalCount,
        },
      };
    } catch (error) {
      console.error('Error searching CurseForge mods:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new HttpException(
            'Invalid CurseForge API key',
            HttpStatus.FORBIDDEN,
          );
        }
        throw new HttpException(
          error.response?.data?.message || 'Error searching mods',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        'Error searching mods',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private normalizeMod(mod: CurseForgeModpack): NormalizedModSearchResult {
    const versions = new Set<string>();
    const loaders = new Set<string>();

    for (const file of mod.latestFiles ?? []) {
      for (const version of file.gameVersions ?? []) {
        versions.add(version);
        this.extractLoadersFromGameVersion(version).forEach((loader) => loaders.add(loader));
      }
    }

    for (const fileIndex of mod.latestFilesIndexes ?? []) {
      if (fileIndex.gameVersion) {
        versions.add(fileIndex.gameVersion);
      }
      const mappedLoader = this.mapCurseforgeTypeToLoader(fileIndex.modLoader);
      if (mappedLoader) {
        loaders.add(mappedLoader);
      }
    }

    return {
      provider: 'curseforge',
      projectId: mod.id.toString(),
      slug: mod.slug,
      name: mod.name,
      summary: mod.summary ?? '',
      iconUrl: mod.logo?.thumbnailUrl || mod.logo?.url,
      downloads: mod.downloadCount,
      lastUpdated: mod.dateModified,
      supportedVersions: Array.from(versions),
      supportedLoaders: Array.from(loaders),
    };
  }

  private extractRequiredDependencyIds(mod: CurseForgeModpack, minecraftVersion?: string): number[] {
    const dependencyIds = new Set<number>();

    for (const file of mod.latestFiles ?? []) {
      if (minecraftVersion && !(file.gameVersions ?? []).includes(minecraftVersion)) {
        continue;
      }

      for (const dependency of file.dependencies ?? []) {
        if (dependency.relationType === this.REQUIRED_DEPENDENCY_RELATION_TYPE) {
          dependencyIds.add(dependency.modId);
        }
      }
    }

    if (dependencyIds.size === 0) {
      for (const file of mod.latestFiles ?? []) {
        for (const dependency of file.dependencies ?? []) {
          if (dependency.relationType === this.REQUIRED_DEPENDENCY_RELATION_TYPE) {
            dependencyIds.add(dependency.modId);
          }
        }
      }
    }

    return Array.from(dependencyIds);
  }

  private extractLoadersFromGameVersion(version: string): string[] {
    const normalized = version.toLowerCase();
    const loaders: string[] = [];
    if (normalized.includes('neoforge')) loaders.push('neoforge');
    if (normalized.includes('forge') && !normalized.includes('neoforge')) loaders.push('forge');
    if (normalized.includes('fabric')) loaders.push('fabric');
    if (normalized.includes('quilt')) loaders.push('quilt');
    if (normalized.includes('paper')) loaders.push('paper');
    if (normalized.includes('spigot')) loaders.push('spigot');
    if (normalized.includes('purpur')) loaders.push('purpur');
    if (normalized.includes('bukkit')) loaders.push('bukkit');
    return loaders;
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

  private mapLoaderToCurseforgeType(loader?: string): number | undefined {
    if (!loader) return undefined;

    const mapping: Record<string, number> = {
      forge: 1,
      fabric: 4,
      quilt: 5,
      neoforge: 6,
    };

    return mapping[loader];
  }

  private mapCurseforgeTypeToLoader(type?: number): string | undefined {
    if (type === undefined || type === null) return undefined;

    const mapping: Record<number, string> = {
      1: 'forge',
      4: 'fabric',
      5: 'quilt',
      6: 'neoforge',
    };

    return mapping[type];
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

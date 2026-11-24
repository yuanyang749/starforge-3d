export type GraphicsPreset = 'auto' | '720p' | '1080p' | '1440p' | 'native';

export interface ShipRecord {
  bestScore: number;
  bestClearTimeSec: number | null;
  bestEndlessWave: number;
  clears: number;
}

export interface SaveData {
  ships: Record<string, ShipRecord>;
  totalKills: number;
  totalRuns: number;
  muted: boolean;
  bgmVolume: number;
  sfxVolume: number;
  autoFire: boolean;
  showHudLegend: boolean;
  endlessUnlocked: boolean;
  graphicsPreset: GraphicsPreset;
}

const STORAGE_KEY = 'starforge_armada_save_v1';

function clampUnit(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.min(1, raw));
}

function sanitizeGraphicsPreset(raw: unknown): GraphicsPreset {
  if (
    raw === 'auto' ||
    raw === '720p' ||
    raw === '1080p' ||
    raw === '1440p' ||
    raw === 'native'
  ) {
    return raw;
  }
  if (raw === 'perf') return '720p';
  if (raw === 'ultra') return '1440p';
  return 'auto';
}

function emptyRecord(): ShipRecord {
  return {
    bestScore: 0,
    bestClearTimeSec: null,
    bestEndlessWave: 0,
    clears: 0,
  };
}

function defaultSave(): SaveData {
  return {
    ships: {},
    totalKills: 0,
    totalRuns: 0,
    muted: false,
    bgmVolume: 1.0,
    sfxVolume: 1.0,
    autoFire: true,
    showHudLegend: true,
    endlessUnlocked: false,
    graphicsPreset: 'auto',
  };
}

function nonNegInt(val: unknown): number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 ? Math.floor(val) : 0;
}

function sanitizeRecord(raw: unknown): ShipRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyRecord();
  }
  const r = raw as Partial<ShipRecord>;
  return {
    bestScore: nonNegInt(r.bestScore),
    bestClearTimeSec:
      typeof r.bestClearTimeSec === 'number' &&
      Number.isFinite(r.bestClearTimeSec) &&
      r.bestClearTimeSec >= 0
        ? r.bestClearTimeSec
        : null,
    bestEndlessWave: nonNegInt(r.bestEndlessWave),
    clears: nonNegInt(r.clears),
  };
}

export class SaveStore {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return defaultSave();
      }
      const p = parsed as Partial<SaveData>;
      const ships: Record<string, ShipRecord> = {};
      if (p.ships && typeof p.ships === 'object' && !Array.isArray(p.ships)) {
        for (const [shipId, rec] of Object.entries(p.ships)) {
          ships[shipId] = sanitizeRecord(rec);
        }
      }
      const hasLegacyClear = Object.values(ships).some(
        (r) => r.clears > 0 || r.bestEndlessWave > 0
      );
      return {
        ships,
        totalKills: nonNegInt(p.totalKills),
        totalRuns: nonNegInt(p.totalRuns),
        muted: Boolean(p.muted),
        bgmVolume: clampUnit(p.bgmVolume, 1.0),
        sfxVolume: clampUnit(p.sfxVolume, 1.0),
        autoFire: typeof p.autoFire === 'boolean' ? p.autoFire : true,
        showHudLegend: typeof p.showHudLegend === 'boolean' ? p.showHudLegend : true,
        endlessUnlocked: Boolean(p.endlessUnlocked) || hasLegacyClear,
        graphicsPreset: sanitizeGraphicsPreset(p.graphicsPreset),
      };
    } catch {
      return defaultSave();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota or private mode failures gracefully.
    }
  }

  getShipRecord(shipId: string): ShipRecord {
    return this.data.ships[shipId] ? { ...this.data.ships[shipId] } : emptyRecord();
  }

  getAll(): SaveData {
    return this.data;
  }

  isEndlessUnlocked(): boolean {
    return this.data.endlessUnlocked;
  }

  isMuted(): boolean {
    return this.data.muted;
  }

  setMuted(muted: boolean): void {
    this.data.muted = muted;
    this.persist();
  }

  getBgmVolume(): number {
    return this.data.bgmVolume;
  }

  setBgmVolume(vol: number): void {
    this.data.bgmVolume = clampUnit(vol, 1.0);
    this.persist();
  }

  getSfxVolume(): number {
    return this.data.sfxVolume;
  }

  setSfxVolume(vol: number): void {
    this.data.sfxVolume = clampUnit(vol, 1.0);
    this.persist();
  }

  isAutoFire(): boolean {
    return this.data.autoFire;
  }

  setAutoFire(autoFire: boolean): void {
    this.data.autoFire = Boolean(autoFire);
    this.persist();
  }

  isHudLegendVisible(): boolean {
    return this.data.showHudLegend;
  }

  setHudLegendVisible(visible: boolean): void {
    this.data.showHudLegend = Boolean(visible);
    this.persist();
  }

  getGraphicsPreset(): GraphicsPreset {
    return this.data.graphicsPreset;
  }

  setGraphicsPreset(preset: GraphicsPreset): void {
    this.data.graphicsPreset = sanitizeGraphicsPreset(preset);
    this.persist();
  }

  recordRunResult(params: {
    shipId: string;
    score: number;
    kills: number;
    clearTimeSec: number | null;
    endlessWave: number;
    victory: boolean;
  }): { isNewBestScore: boolean; isNewBestTime: boolean } {
    const prev = this.getShipRecord(params.shipId);
    const safeScore = nonNegInt(params.score);
    const safeKills = nonNegInt(params.kills);
    const safeEndlessWave = nonNegInt(params.endlessWave);
    let isNewBestScore = false;
    let isNewBestTime = false;

    if (safeScore > prev.bestScore) {
      prev.bestScore = safeScore;
      isNewBestScore = true;
    }
    if (
      params.victory &&
      params.clearTimeSec !== null &&
      Number.isFinite(params.clearTimeSec) &&
      params.clearTimeSec >= 0
    ) {
      prev.clears += 1;
      if (prev.bestClearTimeSec === null || params.clearTimeSec < prev.bestClearTimeSec) {
        prev.bestClearTimeSec = params.clearTimeSec;
        isNewBestTime = true;
      }
    }
    if (safeEndlessWave > prev.bestEndlessWave) {
      prev.bestEndlessWave = safeEndlessWave;
    }
    if (params.victory || safeEndlessWave > 0) {
      this.data.endlessUnlocked = true;
    }

    this.data.ships[params.shipId] = prev;
    this.data.totalKills += safeKills;
    this.data.totalRuns += 1;
    this.persist();

    return { isNewBestScore, isNewBestTime };
  }
}

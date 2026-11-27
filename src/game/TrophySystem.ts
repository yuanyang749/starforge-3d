export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type TrophyId =
  | 'first_blood'
  | 'barrel_parry'
  | 'overdrive_unleash'
  | 'slipstream_ace'
  | 'chip_architect'
  | 'part_breaker'
  | 'act1_clear'
  | 'act2_clear'
  | 'act3_clear'
  | 'field_medic'
  | 'combo_master'
  | 'parry_virtuoso'
  | 'arsenal_breaker'
  | 'ace_squadron'
  | 'century_hunter'
  | 'act4_victory'
  | 'untouchable_boss'
  | 'score_legend'
  | 'endless_voyager'
  | 'platinum_starforge';

export interface TrophyDef {
  id: TrophyId;
  tier: TrophyTier;
  points: number;
  nameZh: string;
  callsign: string;
  descZh: string;
  icon: string;
  tierIcon: string;
  target: number;
  unitZh: string;
}

export interface TrophyStats {
  totalKills: number;
  totalDeflects: number;
  totalUltimates: number;
  totalBoostRings: number;
  totalPartBreaks: number;
  totalPickups: number;
  bestRunUpgrades: number;
  bestCombo: number;
  bestSingleScore: number;
  bestEndlessWave: number;
  shipsFlown: string[];
  bossActsCleared: number[];
  noHitBossCleared: boolean;
}

export interface TrophyUnlockRecord {
  unlockedAt: number; // epoch ms
}

export interface TrophyStoreData {
  unlocked: Partial<Record<TrophyId, TrophyUnlockRecord>>;
  stats: TrophyStats;
}

export interface TrophySummary {
  total: number;
  unlockedCount: number;
  percent: number;
  points: number;
  maxPoints: number;
  tiers: Record<TrophyTier, { unlocked: number; total: number }>;
}

export interface TrophyProgressInfo {
  current: number;
  target: number;
  pct: number;
  label: string;
}

export const TIER_META: Record<
  TrophyTier,
  { labelZh: string; labelEn: string; points: number; icon: string }
> = {
  platinum: {
    labelZh: '白金奖杯',
    labelEn: 'PLATINUM',
    points: 300,
    icon: './ui/trophies/tier_platinum.webp',
  },
  gold: {
    labelZh: '黄金奖杯',
    labelEn: 'GOLD',
    points: 90,
    icon: './ui/trophies/tier_gold.webp',
  },
  silver: {
    labelZh: '白银奖杯',
    labelEn: 'SILVER',
    points: 30,
    icon: './ui/trophies/tier_silver.webp',
  },
  bronze: {
    labelZh: '青铜奖杯',
    labelEn: 'BRONZE',
    points: 15,
    icon: './ui/trophies/tier_bronze.webp',
  },
};

export const TROPHY_LOCKED_ICON = './ui/trophies/trophy_locked.webp';

export const TROPHY_DEFS: readonly TrophyDef[] = [
  // ==================== PLATINUM (1) ====================
  {
    id: 'platinum_starforge',
    tier: 'platinum',
    points: 300,
    nameZh: '星穹最高统帅',
    callsign: 'STARFORGE SUPREME',
    descZh: '解锁《星穹战翼：破晓远征》其余全部 19 枚荣誉奖杯',
    icon: './ui/trophies/medal_endless_supreme.webp',
    tierIcon: TIER_META.platinum.icon,
    target: 19,
    unitZh: '枚',
  },

  // ==================== GOLD (3) ====================
  {
    id: 'untouchable_boss',
    tier: 'gold',
    points: 90,
    nameZh: '无伤猎手',
    callsign: 'UNTOUCHABLE ACE',
    descZh: '整场首领战期间零护盾损伤并成功击破首领',
    icon: './ui/trophies/medal_eclipse_dreadnought.webp',
    tierIcon: TIER_META.gold.icon,
    target: 1,
    unitZh: '次',
  },
  {
    id: 'score_legend',
    tier: 'gold',
    points: 90,
    nameZh: '星海传奇',
    callsign: 'GALACTIC LEGEND',
    descZh: '单次出击总战绩突破 50,000 分',
    icon: './ui/trophies/medal_eclipse_dreadnought.webp',
    tierIcon: TIER_META.gold.icon,
    target: 50000,
    unitZh: '分',
  },
  {
    id: 'endless_voyager',
    tier: 'gold',
    points: 90,
    nameZh: '无尽深空征服者',
    callsign: 'ENDLESS CONQUEROR',
    descZh: '在无尽深空模式下成功推进至第 5 波次',
    icon: './ui/trophies/medal_endless_supreme.webp',
    tierIcon: TIER_META.gold.icon,
    target: 5,
    unitZh: '波',
  },

  // ==================== SILVER (6) ====================
  {
    id: 'act4_victory',
    tier: 'silver',
    points: 30,
    nameZh: '破晓远征胜利者',
    callsign: 'ECLIPSE VANGUARD',
    descZh: '在第 5 幕龙骨母舰空域击沉「龙骨桁架星际母舰」通关战役',
    icon: './ui/trophies/medal_eclipse_dreadnought.webp',
    tierIcon: TIER_META.silver.icon,
    target: 1,
    unitZh: '次',
  },
  {
    id: 'combo_master',
    tier: 'silver',
    points: 30,
    nameZh: '破晓狂潮',
    callsign: 'CRIMSON OVERDRIVE',
    descZh: '单次战斗将连击倍率拉升至 x5.0 及以上',
    icon: './ui/trophies/medal_overdrive.webp',
    tierIcon: TIER_META.silver.icon,
    target: 5,
    unitZh: '倍',
  },
  {
    id: 'parry_virtuoso',
    tier: 'silver',
    points: 30,
    nameZh: '弹幕克星',
    callsign: 'BULLET REVERSAL',
    descZh: '生涯累计通过战术翻滚弹反 20 发敌方弹幕',
    icon: './ui/trophies/medal_quantum_parry.webp',
    tierIcon: TIER_META.silver.icon,
    target: 20,
    unitZh: '发',
  },
  {
    id: 'arsenal_breaker',
    tier: 'silver',
    points: 30,
    nameZh: '武装瓦解专家',
    callsign: 'DISMANTLER',
    descZh: '生涯累计摧毁 6 个首领外挂可破坏武装部位',
    icon: './ui/trophies/medal_sky_boss.webp',
    tierIcon: TIER_META.silver.icon,
    target: 6,
    unitZh: '处',
  },
  {
    id: 'ace_squadron',
    tier: 'silver',
    points: 30,
    nameZh: '全舰种试飞员',
    callsign: 'FULL WING PILOT',
    descZh: '分别驾驶全部 4 架星际战机（X-01 / C-55 / A-103 / G-08）完成出击',
    icon: './ui/trophies/medal_combat_ace.webp',
    tierIcon: TIER_META.silver.icon,
    target: 4,
    unitZh: '架',
  },
  {
    id: 'century_hunter',
    tier: 'silver',
    points: 30,
    nameZh: '百战王牌',
    callsign: 'CENTURION ACE',
    descZh: '生涯累计击坠 100 架敌方战机与炮塔单位',
    icon: './ui/trophies/medal_combat_ace.webp',
    tierIcon: TIER_META.silver.icon,
    target: 100,
    unitZh: '架',
  },

  // ==================== BRONZE (10) ====================
  {
    id: 'first_blood',
    tier: 'bronze',
    points: 15,
    nameZh: '初露锋芒',
    callsign: 'FIRST CONTACT',
    descZh: '在实战航道中击坠第 1 架敌方单位',
    icon: './ui/trophies/medal_combat_ace.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 1,
    unitZh: '架',
  },
  {
    id: 'barrel_parry',
    tier: 'bronze',
    points: 15,
    nameZh: '量子弹反',
    callsign: 'QUANTUM PARRY',
    descZh: '在战术翻滚无敌帧内成功弹反敌方能量弹幕',
    icon: './ui/trophies/medal_quantum_parry.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 1,
    unitZh: '发',
  },
  {
    id: 'overdrive_unleash',
    tier: 'bronze',
    points: 15,
    nameZh: '过载解放',
    callsign: 'OVERDRIVE UNLEASHED',
    descZh: '蓄满能量并首次释放任意战机的终极过载大招',
    icon: './ui/trophies/medal_overdrive.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 1,
    unitZh: '次',
  },
  {
    id: 'slipstream_ace',
    tier: 'bronze',
    points: 15,
    nameZh: '跃迁穿环手',
    callsign: 'SLIPSTREAM RUNNER',
    descZh: '生涯累计穿越 3 个战场能源加速充能环',
    icon: './ui/trophies/medal_slipstream.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 3,
    unitZh: '环',
  },
  {
    id: 'chip_architect',
    tier: 'bronze',
    points: 15,
    nameZh: '火控构筑师',
    callsign: 'TACTICAL ARCHITECT',
    descZh: '单次出击累计装配 3 枚战术强化芯片协议',
    icon: './ui/trophies/medal_overdrive.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 3,
    unitZh: '枚',
  },
  {
    id: 'part_breaker',
    tier: 'bronze',
    points: 15,
    nameZh: '精准拆解',
    callsign: 'SURGICAL STRIKE',
    descZh: '首次击毁任意首领的外挂可破坏武装部位',
    icon: './ui/trophies/medal_sky_boss.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 1,
    unitZh: '处',
  },
  {
    id: 'act1_clear',
    tier: 'bronze',
    points: 15,
    nameZh: '破云苍穹',
    callsign: 'STRATOSPHERE BREAKER',
    descZh: '在第 1 幕平流层云海空域击坠「云穹折翼指挥舰」',
    icon: './ui/trophies/medal_sky_boss.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 1,
    unitZh: '次',
  },
  {
    id: 'act2_clear',
    tier: 'bronze',
    points: 15,
    nameZh: '铁幕粉碎者',
    callsign: 'IRONCLAD BREAKER',
    descZh: '在第 2 幕轨道城峡谷击毁「铁幕四足重炮机甲」',
    icon: './ui/trophies/medal_iron_abyss.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 1,
    unitZh: '次',
  },
  {
    id: 'act3_clear',
    tier: 'bronze',
    points: 15,
    nameZh: '深渊破钳',
    callsign: 'ABYSSAL VANQUISHER',
    descZh: '在第 3 幕碎星跃迁门廊击毁「深渊巨钳螃蟹机甲」',
    icon: './ui/trophies/medal_iron_abyss.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 1,
    unitZh: '次',
  },
  {
    id: 'field_medic',
    tier: 'bronze',
    points: 15,
    nameZh: '战地整备官',
    callsign: 'NANITE SCAVENGER',
    descZh: '生涯累计拾取 10 个纳米维修包或量子超频核心补给',
    icon: './ui/trophies/medal_slipstream.webp',
    tierIcon: TIER_META.bronze.icon,
    target: 10,
    unitZh: '个',
  },
];

const TROPHY_MAP = new Map<TrophyId, TrophyDef>(TROPHY_DEFS.map((t) => [t.id, t]));
const NON_PLATINUM_IDS: readonly TrophyId[] = TROPHY_DEFS.filter(
  (t) => t.id !== 'platinum_starforge'
).map((t) => t.id);

const STORAGE_KEY = 'starforge_trophies_v1';

function nonNegInt(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function nonNegNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

function defaultStats(): TrophyStats {
  return {
    totalKills: 0,
    totalDeflects: 0,
    totalUltimates: 0,
    totalBoostRings: 0,
    totalPartBreaks: 0,
    totalPickups: 0,
    bestRunUpgrades: 0,
    bestCombo: 1.0,
    bestSingleScore: 0,
    bestEndlessWave: 0,
    shipsFlown: [],
    bossActsCleared: [],
    noHitBossCleared: false,
  };
}

function defaultStore(): TrophyStoreData {
  return {
    unlocked: {},
    stats: defaultStats(),
  };
}

export function formatTrophyTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type TrophyUnlockListener = (trophy: TrophyDef, record: TrophyUnlockRecord) => void;

export class TrophySystem {
  private data: TrophyStoreData;
  private readonly listeners = new Set<TrophyUnlockListener>();
  private runUnlockedIds: TrophyId[] = [];
  private persistDirty = false;
  private lastPersistAt = 0;

  constructor() {
    this.data = this.load();
  }

  private load(): TrophyStoreData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultStore();
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return defaultStore();
      }
      const p = parsed as Partial<TrophyStoreData>;
      const unlocked: Partial<Record<TrophyId, TrophyUnlockRecord>> = {};
      if (p.unlocked && typeof p.unlocked === 'object' && !Array.isArray(p.unlocked)) {
        for (const [k, v] of Object.entries(p.unlocked)) {
          if (!TROPHY_MAP.has(k as TrophyId)) continue;
          const rec = v as Partial<TrophyUnlockRecord> | null;
          if (rec && typeof rec.unlockedAt === 'number' && Number.isFinite(rec.unlockedAt)) {
            unlocked[k as TrophyId] = { unlockedAt: rec.unlockedAt };
          }
        }
      }
      const s = (p.stats && typeof p.stats === 'object' ? p.stats : {}) as Partial<TrophyStats>;
      const shipsFlown = Array.isArray(s.shipsFlown)
        ? Array.from(new Set(s.shipsFlown.filter((x): x is string => typeof x === 'string' && x.length > 0)))
        : [];
      const bossActsCleared = Array.isArray(s.bossActsCleared)
        ? Array.from(
            new Set(
              s.bossActsCleared.filter(
                (x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5
              )
            )
          )
        : [];

      return {
        unlocked,
        stats: {
          totalKills: nonNegInt(s.totalKills),
          totalDeflects: nonNegInt(s.totalDeflects),
          totalUltimates: nonNegInt(s.totalUltimates),
          totalBoostRings: nonNegInt(s.totalBoostRings),
          totalPartBreaks: nonNegInt(s.totalPartBreaks),
          totalPickups: nonNegInt(s.totalPickups),
          bestRunUpgrades: nonNegInt(s.bestRunUpgrades),
          bestCombo: Math.max(1.0, nonNegNum(s.bestCombo)),
          bestSingleScore: nonNegInt(s.bestSingleScore),
          bestEndlessWave: nonNegInt(s.bestEndlessWave),
          shipsFlown,
          bossActsCleared,
          noHitBossCleared: Boolean(s.noHitBossCleared),
        },
      };
    } catch {
      return defaultStore();
    }
  }

  private persistNow(): void {
    this.persistDirty = false;
    this.lastPersistAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage restrictions gracefully
    }
  }

  private markStatsDirty(immediate = false): void {
    this.persistDirty = true;
    const now = Date.now();
    if (immediate || now - this.lastPersistAt >= 1500) {
      this.persistNow();
    }
  }

  flushPersistence(): void {
    if (this.persistDirty) {
      this.persistNow();
    }
  }

  onUnlock(listener: TrophyUnlockListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  beginRunSession(): void {
    this.runUnlockedIds = [];
  }

  getRunUnlockedTrophies(): TrophyDef[] {
    return this.runUnlockedIds
      .map((id) => TROPHY_MAP.get(id))
      .filter((d): d is TrophyDef => Boolean(d));
  }

  getDef(id: TrophyId): TrophyDef | undefined {
    return TROPHY_MAP.get(id);
  }

  getAllDefs(): readonly TrophyDef[] {
    return TROPHY_DEFS;
  }

  isUnlocked(id: TrophyId): boolean {
    return Boolean(this.data.unlocked[id]);
  }

  getUnlockRecord(id: TrophyId): TrophyUnlockRecord | null {
    return this.data.unlocked[id] ?? null;
  }

  getStats(): TrophyStats {
    return {
      ...this.data.stats,
      shipsFlown: [...this.data.stats.shipsFlown],
      bossActsCleared: [...this.data.stats.bossActsCleared],
    };
  }

  getSummary(): TrophySummary {
    const tiers: Record<TrophyTier, { unlocked: number; total: number }> = {
      platinum: { unlocked: 0, total: 0 },
      gold: { unlocked: 0, total: 0 },
      silver: { unlocked: 0, total: 0 },
      bronze: { unlocked: 0, total: 0 },
    };
    let unlockedCount = 0;
    let points = 0;
    let maxPoints = 0;

    for (const def of TROPHY_DEFS) {
      tiers[def.tier].total += 1;
      maxPoints += def.points;
      if (this.data.unlocked[def.id]) {
        tiers[def.tier].unlocked += 1;
        unlockedCount += 1;
        points += def.points;
      }
    }

    const total = TROPHY_DEFS.length;
    return {
      total,
      unlockedCount,
      percent: Math.round((unlockedCount / Math.max(1, total)) * 100),
      points,
      maxPoints,
      tiers,
    };
  }

  getProgressFor(def: TrophyDef): TrophyProgressInfo {
    const s = this.data.stats;
    if (this.data.unlocked[def.id]) {
      const doneVal = def.id === 'combo_master' ? `x${Math.max(def.target, s.bestCombo).toFixed(1)}` : `${def.target.toLocaleString()} / ${def.target.toLocaleString()} ${def.unitZh}`;
      return {
        current: def.target,
        target: def.target,
        pct: 100,
        label: doneVal,
      };
    }

    let current = 0;
    switch (def.id) {
      case 'first_blood':
      case 'century_hunter':
        current = s.totalKills;
        break;
      case 'barrel_parry':
      case 'parry_virtuoso':
        current = s.totalDeflects;
        break;
      case 'overdrive_unleash':
        current = s.totalUltimates;
        break;
      case 'slipstream_ace':
        current = s.totalBoostRings;
        break;
      case 'chip_architect':
        current = s.bestRunUpgrades;
        break;
      case 'part_breaker':
      case 'arsenal_breaker':
        current = s.totalPartBreaks;
        break;
      case 'act1_clear':
        current = s.bossActsCleared.includes(1) ? 1 : 0;
        break;
      case 'act2_clear':
        current = s.bossActsCleared.includes(2) ? 1 : 0;
        break;
      case 'act3_clear':
        current = s.bossActsCleared.includes(3) ? 1 : 0;
        break;
      case 'act4_victory':
        current = s.bossActsCleared.includes(5) ? 1 : 0;
        break;
      case 'field_medic':
        current = s.totalPickups;
        break;
      case 'combo_master':
        current = Math.min(def.target, s.bestCombo);
        break;
      case 'ace_squadron':
        current = s.shipsFlown.length;
        break;
      case 'untouchable_boss':
        current = s.noHitBossCleared ? 1 : 0;
        break;
      case 'score_legend':
        current = s.bestSingleScore;
        break;
      case 'endless_voyager':
        current = s.bestEndlessWave;
        break;
      case 'platinum_starforge':
        current = NON_PLATINUM_IDS.filter((id) => Boolean(this.data.unlocked[id])).length;
        break;
    }

    const clamped = Math.min(def.target, Math.max(0, current));
    const pct = Math.min(100, Math.round((clamped / Math.max(1, def.target)) * 100));
    const label =
      def.id === 'combo_master'
        ? `x${clamped.toFixed(1)} / x${def.target.toFixed(1)}`
        : `${Math.floor(clamped).toLocaleString()} / ${def.target.toLocaleString()} ${def.unitZh}`;

    return { current: clamped, target: def.target, pct, label };
  }

  /**
   * Core unlock method with strict deduplication:
   * Already-unlocked trophies return false and NEVER trigger broadcasts again.
   */
  unlock(id: TrophyId): boolean {
    if (this.data.unlocked[id]) {
      return false;
    }
    const def = TROPHY_MAP.get(id);
    if (!def) return false;

    const record: TrophyUnlockRecord = { unlockedAt: Date.now() };
    this.data.unlocked[id] = record;
    this.runUnlockedIds.push(id);
    this.persistNow();

    for (const listener of this.listeners) {
      listener(def, record);
    }

    // Authentic PS5 Platinum auto-award once all 19 other trophies are unlocked
    if (id !== 'platinum_starforge' && !this.data.unlocked.platinum_starforge) {
      const allEarned = NON_PLATINUM_IDS.every((tid) => Boolean(this.data.unlocked[tid]));
      if (allEarned) {
        this.unlock('platinum_starforge');
      }
    }
    return true;
  }

  // ==================== REAL-TIME GAMEPLAY EVENT HOOKS ====================

  recordShipSortie(shipId: string): void {
    if (!shipId) return;
    if (!this.data.stats.shipsFlown.includes(shipId)) {
      this.data.stats.shipsFlown.push(shipId);
      this.markStatsDirty(true);
    }
    if (this.data.stats.shipsFlown.length >= 4) {
      this.unlock('ace_squadron');
    }
  }

  recordScoreAndCombo(score: number, combo: number): void {
    const safeScore = nonNegInt(score);
    const safeCombo = nonNegNum(combo);
    let dirty = false;
    if (safeScore > this.data.stats.bestSingleScore) {
      this.data.stats.bestSingleScore = safeScore;
      dirty = true;
    }
    if (safeCombo > this.data.stats.bestCombo) {
      this.data.stats.bestCombo = +safeCombo.toFixed(1);
      dirty = true;
    }
    if (dirty) this.markStatsDirty();
    if (safeCombo >= 5.0) {
      this.unlock('combo_master');
    }
    if (safeScore >= 50000) {
      this.unlock('score_legend');
    }
  }

  recordKill(score: number, combo: number): void {
    this.data.stats.totalKills += 1;
    this.markStatsDirty();
    if (this.data.stats.totalKills >= 1) {
      this.unlock('first_blood');
    }
    if (this.data.stats.totalKills >= 100) {
      this.unlock('century_hunter');
    }
    this.recordScoreAndCombo(score, combo);
  }

  recordDeflect(score: number, combo: number): void {
    this.data.stats.totalDeflects += 1;
    this.markStatsDirty();
    if (this.data.stats.totalDeflects >= 1) {
      this.unlock('barrel_parry');
    }
    if (this.data.stats.totalDeflects >= 20) {
      this.unlock('parry_virtuoso');
    }
    this.recordScoreAndCombo(score, combo);
  }

  recordUltimate(): void {
    this.data.stats.totalUltimates += 1;
    this.markStatsDirty(true);
    if (this.data.stats.totalUltimates >= 1) {
      this.unlock('overdrive_unleash');
    }
  }

  recordBoostRing(score: number, combo: number): void {
    this.data.stats.totalBoostRings += 1;
    this.markStatsDirty(true);
    if (this.data.stats.totalBoostRings >= 3) {
      this.unlock('slipstream_ace');
    }
    this.recordScoreAndCombo(score, combo);
  }

  recordUpgradeInRun(runUpgradeCount: number): void {
    const safe = nonNegInt(runUpgradeCount);
    if (safe > this.data.stats.bestRunUpgrades) {
      this.data.stats.bestRunUpgrades = safe;
      this.markStatsDirty(true);
    }
    if (safe >= 3) {
      this.unlock('chip_architect');
    }
  }

  recordPartBreak(score: number, combo: number): void {
    this.data.stats.totalPartBreaks += 1;
    this.markStatsDirty(true);
    if (this.data.stats.totalPartBreaks >= 1) {
      this.unlock('part_breaker');
    }
    if (this.data.stats.totalPartBreaks >= 6) {
      this.unlock('arsenal_breaker');
    }
    this.recordScoreAndCombo(score, combo);
  }

  recordPickup(): void {
    this.data.stats.totalPickups += 1;
    this.markStatsDirty();
    if (this.data.stats.totalPickups >= 10) {
      this.unlock('field_medic');
    }
  }

  recordEndlessWave(wave: number): void {
    const safe = nonNegInt(wave);
    if (safe > this.data.stats.bestEndlessWave) {
      this.data.stats.bestEndlessWave = safe;
      this.markStatsDirty(true);
    }
    if (safe >= 5) {
      this.unlock('endless_voyager');
    }
  }

  recordBossDefeated(params: {
    act: number;
    tookDamageDuringBoss: boolean;
    score: number;
    combo: number;
    isEndless: boolean;
  }): void {
    const act = params.act;
    if (act >= 1 && act <= 5 && !this.data.stats.bossActsCleared.includes(act)) {
      this.data.stats.bossActsCleared.push(act);
    }
    if (!params.tookDamageDuringBoss) {
      this.data.stats.noHitBossCleared = true;
    }
    this.markStatsDirty(true);

    if (act === 1) this.unlock('act1_clear');
    else if (act === 2) this.unlock('act2_clear');
    else if (act === 3) this.unlock('act3_clear');
    else if (act === 5 && !params.isEndless) this.unlock('act4_victory');

    if (!params.tookDamageDuringBoss) {
      this.unlock('untouchable_boss');
    }
    this.recordScoreAndCombo(params.score, params.combo);
  }

  resetAllForDebug(): void {
    this.data = defaultStore();
    this.runUnlockedIds = [];
    this.persistNow();
  }
}

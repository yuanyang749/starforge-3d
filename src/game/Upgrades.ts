import type { ShipId } from '../assets/manifest';

export interface UpgradeCard {
  id: string;
  nameZh: string;
  codeName: string;
  categoryZh: string;
  icon: string;
  accent: 'cyan' | 'amber' | 'violet';
  descZh: string;
  maxStacks: number;
}

export interface UpgradeState {
  wingmanCount: number;
  homingInterval: number; // 0 if disabled, otherwise fire every N shots
  homingSalvoCount: number;
  extraSideShots: number; // 0, 2, 4...
  pierceCount: number;
  deflectDamageMult: number;
  chainLightningChance: number;
  chainJumps: number;
  critChance: number;
  critMultiplier: number;
  maxHpBonus: number;
  shieldRegenPerSec: number;
  fireRateMult: number;
  speedMult: number;
  rollCooldownMult: number;
  rollBurstShots: number;
  ultimateChargeMult: number;
  pickupMagnetRadius: number;
  stacks: Record<string, number>;
}

export const UPGRADE_CARDS: UpgradeCard[] = [
  {
    id: 'wingman',
    nameZh: '双翼护航僚机',
    codeName: 'MOD-01 · 编队协同',
    categoryZh: '编队召唤',
    icon: './ui/icons/icon_wingman.webp',
    accent: 'cyan',
    descZh: '召唤一架无人双翼僚机编队伴飞护航，与主炮同步协同点射前方敌群（最多 2 架）。',
    maxStacks: 2,
  },
  {
    id: 'missile',
    nameZh: '智能追踪导弹舱',
    codeName: 'MOD-02 · 蜂群挂架',
    categoryZh: '重火挂架',
    icon: './ui/icons/icon_missile.webp',
    accent: 'amber',
    descZh: '每隔数次主炮射击自动齐射追踪导弹，优先锁定高威胁敌机与 Boss 可破坏部位。',
    maxStacks: 4,
  },
  {
    id: 'prism',
    nameZh: '分叉散射棱镜',
    codeName: 'MOD-03 · 分束棱镜',
    categoryZh: '火力增幅',
    icon: './ui/icons/icon_prism.webp',
    accent: 'cyan',
    descZh: '主炮左右额外折射出 +2 条斜向等离子光束，大幅拓宽清场弹幕覆盖扇面。',
    maxStacks: 3,
  },
  {
    id: 'pierce',
    nameZh: '穿甲电磁轨道',
    codeName: 'MOD-04 · 电磁穿甲',
    categoryZh: '穿甲动能',
    icon: './ui/icons/icon_pierce.webp',
    accent: 'amber',
    descZh: '主炮弹丸获得电磁穿甲效能，穿透次数 +1 并提升 22% 飞行初速，轻松贯穿纵列编队。',
    maxStacks: 3,
  },
  {
    id: 'deflect',
    nameZh: '偏转能量矩阵',
    codeName: 'MOD-05 · 偏转力场',
    categoryZh: '防反矩阵',
    icon: './ui/icons/icon_deflect.webp',
    accent: 'cyan',
    descZh: '战术翻滚期间将靠近的敌方弹幕折射反弹为高伤追踪友方飞弹，并延长无敌保护窗口。',
    maxStacks: 3,
  },
  {
    id: 'tesla',
    nameZh: '特斯拉电弧链',
    codeName: 'MOD-06 · 高压电弧',
    categoryZh: '连锁电弧',
    icon: './ui/icons/icon_tesla.webp',
    accent: 'violet',
    descZh: '主炮命中敌机有概率引燃高压连锁闪电，在至多 3 个邻近敌机或 Boss 部件间跳跃传导。',
    maxStacks: 4,
  },
  {
    id: 'crit',
    nameZh: '聚变超载核心',
    codeName: 'MOD-07 · 暴击超频',
    categoryZh: '暴击过载',
    icon: './ui/icons/icon_crit.webp',
    accent: 'amber',
    descZh: '火控计算模块超频：暴击率 +18%，暴击伤害倍率额外提升 +35%，高能爆裂直击瞬间瓦解敌阵。',
    maxStacks: 4,
  },
  {
    id: 'shield',
    nameZh: '纳米自愈护盾',
    codeName: 'MOD-08 · 纳米护盾',
    categoryZh: '生存续航',
    icon: './ui/icons/icon_shield.webp',
    accent: 'cyan',
    descZh: '战机护盾上限 +30 并立即等量修复，脱离受击 2.5 秒后自动开启每秒 3.5 点纳米再生。',
    maxStacks: 4,
  },
  {
    id: 'overcharge',
    nameZh: '急速冷却芯片',
    codeName: 'MOD-09 · 极速冷却',
    categoryZh: '射速超频',
    icon: './ui/icons/icon_overcharge.webp',
    accent: 'amber',
    descZh: '主炮冷却循环提速 +20%，同时加速大招过载能量获取效率 +25%。',
    maxStacks: 4,
  },
  {
    id: 'thruster',
    nameZh: '矢量过载喷口',
    codeName: 'MOD-10 · 矢量推进',
    categoryZh: '机动强化',
    icon: './ui/icons/icon_thruster.webp',
    accent: 'cyan',
    descZh: '机身机动平移速度 +16%，战场维修/超频能量掉落球的磁吸吸附半径扩大 +65%。',
    maxStacks: 3,
  },
  {
    id: 'barrel_roll',
    nameZh: '机动翻滚旋风',
    codeName: 'MOD-11 · 旋风机动',
    categoryZh: '战术规避',
    icon: './ui/icons/icon_barrel_roll.webp',
    accent: 'violet',
    descZh: '战术翻滚冷却缩短 24%，且每次触发翻滚时向正前方甩出一轮 6 发扇形散弹齐射！',
    maxStacks: 3,
  },
  {
    id: 'ultimate',
    nameZh: '超频核能共鸣器',
    codeName: 'MOD-12 · 共鸣充能',
    categoryZh: '终极充能',
    icon: './ui/icons/icon_ultimate.webp',
    accent: 'violet',
    descZh: '击杀、穿过加速环与破坏部位获得的终极充能再增幅 +35%，并直接为当前大招充能 +40%！',
    maxStacks: 3,
  },
];

export function createInitialUpgradeState(shipId?: ShipId): UpgradeState {
  return {
    wingmanCount: 0,
    homingInterval: 0,
    homingSalvoCount: 0,
    extraSideShots: 0,
    pierceCount: shipId === 'morph' ? 1 : 0,
    deflectDamageMult: 1.0,
    chainLightningChance: 0,
    chainJumps: 0,
    critChance: shipId === 'aero' ? 0.25 : 0.1,
    critMultiplier: 1.75,
    maxHpBonus: 0,
    shieldRegenPerSec: 0,
    fireRateMult: 1.0,
    speedMult: 1.0,
    rollCooldownMult: 1.0,
    rollBurstShots: 0,
    ultimateChargeMult: 1.0,
    pickupMagnetRadius: 6.5,
    stacks: {},
  };
}

export function applyUpgradeCard(
  state: UpgradeState,
  cardId: string
): { shieldHeal: number; ultBoost: number; newWingmen: number } {
  if (!UPGRADE_CARDS.some((c) => c.id === cardId)) {
    return { shieldHeal: 0, ultBoost: 0, newWingmen: 0 };
  }
  const nextCount = (state.stacks[cardId] ?? 0) + 1;
  state.stacks[cardId] = nextCount;
  let shieldHeal = 0;
  let ultBoost = 0;
  let newWingmen = 0;

  switch (cardId) {
    case 'wingman':
      if (state.wingmanCount < 2) {
        state.wingmanCount += 1;
        newWingmen = 1;
      }
      break;
    case 'missile':
      state.homingSalvoCount += 2;
      state.homingInterval = Math.max(3, 6 - nextCount);
      break;
    case 'prism':
      state.extraSideShots += 2;
      break;
    case 'pierce':
      state.pierceCount += 1;
      break;
    case 'deflect':
      state.deflectDamageMult += 0.65;
      break;
    case 'tesla':
      state.chainLightningChance = Math.min(0.85, state.chainLightningChance + 0.25);
      state.chainJumps = Math.min(5, 2 + nextCount);
      break;
    case 'crit':
      state.critChance = Math.min(0.95, state.critChance + 0.18);
      state.critMultiplier += 0.35;
      break;
    case 'shield':
      state.maxHpBonus += 30;
      shieldHeal = 30;
      state.shieldRegenPerSec += 3.5;
      break;
    case 'overcharge':
      state.fireRateMult *= 1.2;
      state.ultimateChargeMult += 0.25;
      break;
    case 'thruster':
      state.speedMult *= 1.16;
      state.pickupMagnetRadius += 4.2;
      break;
    case 'barrel_roll':
      state.rollCooldownMult *= 0.76;
      state.rollBurstShots += 6;
      break;
    case 'ultimate':
      state.ultimateChargeMult += 0.35;
      ultBoost = 40;
      break;
  }

  return { shieldHeal, ultBoost, newWingmen };
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function pickUpgradeChoices(state: UpgradeState, count = 3): UpgradeCard[] {
  const pool = UPGRADE_CARDS.filter((c) => (state.stacks[c.id] ?? 0) < c.maxStacks);
  if (pool.length >= count) {
    return shuffleInPlace([...pool]).slice(0, count);
  }
  const pickedIds = new Set(pool.map((c) => c.id));
  const fallback = shuffleInPlace(UPGRADE_CARDS.filter((c) => !pickedIds.has(c.id)));
  return [...shuffleInPlace([...pool]), ...fallback].slice(0, count);
}

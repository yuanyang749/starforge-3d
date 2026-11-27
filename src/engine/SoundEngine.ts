export type WeaponVoice = 'astra' | 'opus' | 'morph' | 'aero';
export type BgmTrackId = 'boot' | 'hangar' | 'act1' | 'act2' | 'act3' | 'boss';

export interface AudioTelemetrySnapshot {
  unlocked: boolean;
  muted: boolean;
  activeBgm: BgmTrackId | null;
  muffled: boolean;
  loadedSfxCount: number;
  totalSfxCount: number;
  loadedBgmCount: number;
  totalBgmCount: number;
}

const SFX_KEYS = [
  'shot_astra_1',
  'shot_astra_2',
  'shot_opus_1',
  'shot_opus_2',
  'shot_morph_1',
  'shot_morph_2',
  'shot_aero_1',
  'shot_aero_2',
  'hit_hull_1',
  'hit_hull_2',
  'hit_crit',
  'exp_small_1',
  'exp_small_2',
  'exp_medium',
  'exp_boss',
  'part_break',
  'deflect_parry',
  'roll_whoosh',
  'launch_sortie',
  'shield_hit',
  'pickup_item',
  'upgrade_lock',
  'hud_deploy',
  'ship_select',
  'boss_warning',
  'boss_crescendo',
  'ult_astra_beam',
  'ult_opus_nova',
  'ult_morph_salvo',
  'ult_aero_chrono',
  'door_bay',
  'ui_click',
  'ui_hover',
  'stinger_victory',
  'stinger_defeat',
] as const;

type SfxKey = (typeof SFX_KEYS)[number];

const BGM_TRACKS: readonly BgmTrackId[] = ['boot', 'hangar', 'act1', 'act2', 'act3', 'boss'];
const BGM_TRACK_GAIN: Record<BgmTrackId, number> = {
  boot: 1.04,
  hangar: 0.96,
  act1: 1.08,
  act2: 1.24,
  act3: 1.12,
  boss: 1.16,
};
const MASTER_GAIN_LEVEL = 0.92;
const SFX_BASE_GAIN = 0.68;
const BGM_BASE_GAIN = 0.92;
const AUDIO_ASSET_VER = 'v6.1';

interface ActiveBgmPlayback {
  track: BgmTrackId;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private sfxCompressor: DynamicsCompressorNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmDuckGain: GainNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private bgmVolume = 1.0;
  private sfxVolume = 1.0;
  private muffled = false;
  private desiredBgmTrack: BgmTrackId | null = null;
  private activeBgmPlayback: ActiveBgmPlayback | null = null;
  private duckResetTimer: number | null = null;
  private preloadStarted = false;
  private preloadPromise: Promise<void> | null = null;

  private readonly sfxBuffers = new Map<SfxKey, AudioBuffer>();
  private readonly bgmBuffers = new Map<BgmTrackId, AudioBuffer>();
  private readonly bgmInFlight = new Map<BgmTrackId, Promise<void>>();
  private readonly variantFlip = new Map<string, number>();

  private lastShotAt = -1;
  private lastHitAt = -1;
  private lastHoverAt = -1;

  constructor(initialMuted = false, initialBgmVol = 1.0, initialSfxVol = 1.0) {
    this.muted = initialMuted;
    this.bgmVolume = Math.max(0, Math.min(1, Number.isFinite(initialBgmVol) ? initialBgmVol : 1.0));
    this.sfxVolume = Math.max(0, Math.min(1, Number.isFinite(initialSfxVol) ? initialSfxVol : 1.0));
  }

  private resetAudioGraph(): void {
    this.stopCurrentBgmNode(0);
    this.sfxGain?.disconnect();
    this.sfxCompressor?.disconnect();
    this.bgmFilter?.disconnect();
    this.bgmDuckGain?.disconnect();
    this.bgmGain?.disconnect();
    this.masterLimiter?.disconnect();
    this.masterGain?.disconnect();
    this.ctx = null;
    this.masterGain = null;
    this.masterLimiter = null;
    this.sfxCompressor = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.bgmDuckGain = null;
    this.bgmFilter = null;
    this.noiseBuffer = null;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (this.ctx && this.ctx.state === 'closed') {
      this.resetAudioGraph();
    }

    if (this.ctx) return this.ctx;

    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;

    try {
      const ctx = new AC();
      this.ctx = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = this.muted ? 0 : MASTER_GAIN_LEVEL;
      masterGain.connect(ctx.destination);
      this.masterGain = masterGain;

      const masterLimiter = ctx.createDynamicsCompressor();
      masterLimiter.threshold.value = -2.0;
      masterLimiter.knee.value = 3;
      masterLimiter.ratio.value = 12;
      masterLimiter.attack.value = 0.002;
      masterLimiter.release.value = 0.12;
      masterLimiter.connect(masterGain);
      this.masterLimiter = masterLimiter;

      const sfxCompressor = ctx.createDynamicsCompressor();
      sfxCompressor.threshold.value = -10;
      sfxCompressor.knee.value = 10;
      sfxCompressor.ratio.value = 3.5;
      sfxCompressor.attack.value = 0.003;
      sfxCompressor.release.value = 0.14;
      sfxCompressor.connect(masterLimiter);
      this.sfxCompressor = sfxCompressor;

      const sfxGain = ctx.createGain();
      sfxGain.gain.value = SFX_BASE_GAIN * this.sfxVolume;
      sfxGain.connect(sfxCompressor);
      this.sfxGain = sfxGain;

      const bgmGain = ctx.createGain();
      bgmGain.gain.value = BGM_BASE_GAIN * this.bgmVolume;
      bgmGain.connect(masterLimiter);
      this.bgmGain = bgmGain;

      const bgmDuckGain = ctx.createGain();
      bgmDuckGain.gain.value = 1.0;
      bgmDuckGain.connect(bgmGain);
      this.bgmDuckGain = bgmDuckGain;

      const bgmFilter = ctx.createBiquadFilter();
      bgmFilter.type = 'lowpass';
      bgmFilter.frequency.value = this.muffled ? 1650 : 20000;
      bgmFilter.Q.value = 0.7;
      bgmFilter.connect(bgmDuckGain);
      this.bgmFilter = bgmFilter;

      this.noiseBuffer = this.buildNoiseBuffer(ctx);

      ctx.addEventListener('statechange', () => {
        if (this.ctx === ctx && ctx.state === 'running' && this.desiredBgmTrack) {
          this.syncDesiredBgmPlayback(0.45);
        }
      });

      return ctx;
    } catch {
      this.resetAudioGraph();
      return null;
    }
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const state = ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      try {
        const res = ctx.resume();
        if (res && typeof res.catch === 'function') {
          void res.catch(() => {
            // Restricted or headless audio devices may remain suspended silently.
          });
        }
      } catch {
        // Ignore resume restrictions when no hardware output is attached.
      }
    }

    if (ctx.state === 'running' && this.desiredBgmTrack) {
      this.syncDesiredBgmPlayback(0.45);
    }
  }

  private canPlaySfx(): boolean {
    return Boolean(this.ctx && this.sfxGain && !this.muted && this.ctx.state === 'running');
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx && this.ctx.state !== 'closed') {
      try {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN_LEVEL, now, 0.03);
      } catch {
        try {
          this.masterGain.gain.value = muted ? 0 : MASTER_GAIN_LEVEL;
        } catch {
          // Ignore locked/closed audio context errors.
        }
      }
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  getBgmVolume(): number {
    return this.bgmVolume;
  }

  setBgmVolume(vol: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, Number.isFinite(vol) ? vol : 1.0));
    const target = BGM_BASE_GAIN * this.bgmVolume;
    if (this.bgmGain && this.ctx && this.ctx.state !== 'closed') {
      try {
        const now = this.ctx.currentTime;
        this.bgmGain.gain.cancelScheduledValues(now);
        this.bgmGain.gain.setTargetAtTime(target, now, 0.03);
      } catch {
        try {
          this.bgmGain.gain.value = target;
        } catch {
          // Safe no-op
        }
      }
    }
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, Number.isFinite(vol) ? vol : 1.0));
    const target = SFX_BASE_GAIN * this.sfxVolume;
    if (this.sfxGain && this.ctx && this.ctx.state !== 'closed') {
      try {
        const now = this.ctx.currentTime;
        this.sfxGain.gain.cancelScheduledValues(now);
        this.sfxGain.gain.setTargetAtTime(target, now, 0.03);
      } catch {
        try {
          this.sfxGain.gain.value = target;
        } catch {
          // Safe no-op
        }
      }
    }
  }

  setMuffled(muffled: boolean): void {
    this.muffled = muffled;
    if (!this.bgmFilter || !this.ctx || this.ctx.state === 'closed') return;
    try {
      const now = this.ctx.currentTime;
      this.bgmFilter.frequency.cancelScheduledValues(now);
      this.bgmFilter.frequency.setTargetAtTime(muffled ? 1650 : 20000, now, 0.08);
    } catch {
      // Safe no-op
    }
  }

  getTelemetry(): AudioTelemetrySnapshot {
    return {
      unlocked: Boolean(this.ctx && this.ctx.state === 'running'),
      muted: this.muted,
      activeBgm: this.desiredBgmTrack,
      muffled: this.muffled,
      loadedSfxCount: this.sfxBuffers.size,
      totalSfxCount: SFX_KEYS.length,
      loadedBgmCount: this.bgmBuffers.size,
      totalBgmCount: BGM_TRACKS.length,
    };
  }

  preloadAllAudio(onProgress?: (msg: string) => void): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadStarted = true;

    this.preloadPromise = (async () => {
      const ctx = this.ensureContext();
      if (!ctx) return;

      // Prioritize bootloader score immediately so the opening screen pulse drives cleanly.
      await this.loadBgmBuffer('boot');

      const sfxJobs = SFX_KEYS.map((key) => this.loadSfxBuffer(ctx, key));
      const coreBgmJobs = [this.loadBgmBuffer('hangar'), this.loadBgmBuffer('act1')];
      await Promise.allSettled([...sfxJobs, ...coreBgmJobs]);

      // Stream remaining campaign/boss BGM tracks cleanly in the background.
      for (const track of ['act2', 'act3', 'boss'] as const) {
        void this.loadBgmBuffer(track);
      }

      onProgress?.('[AUDIO] 舰载全向声学雷达与战区战术交响阵列就绪');
    })();

    return this.preloadPromise;
  }

  private async loadSfxBuffer(ctx: AudioContext, key: SfxKey): Promise<void> {
    if (this.sfxBuffers.has(key)) return;
    try {
      const res = await fetch(`./audio/sfx/${key}.mp3?v=${AUDIO_ASSET_VER}`);
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arr);
      this.sfxBuffers.set(key, decoded);
    } catch {
      // Keep fallback synthesis active if fetch or decode fails.
    }
  }

  private async loadBgmBuffer(track: BgmTrackId): Promise<void> {
    if (this.bgmBuffers.has(track)) return;
    const existing = this.bgmInFlight.get(track);
    if (existing) return existing;

    const job = (async () => {
      const ctx = this.ensureContext();
      if (!ctx) return;
      try {
        const res = await fetch(`./audio/bgm/bgm_${track}.mp3?v=${AUDIO_ASSET_VER}`);
        if (!res.ok) return;
        const arr = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr);
        this.bgmBuffers.set(track, decoded);
        if (this.desiredBgmTrack === track && ctx.state === 'running') {
          this.syncDesiredBgmPlayback(0.55);
        }
      } catch {
        // Ignore network/decode error safely.
      } finally {
        this.bgmInFlight.delete(track);
      }
    })();

    this.bgmInFlight.set(track, job);
    return job;
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 1.5));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  setBgmTrack(track: BgmTrackId | null, fadeSec = 0.75): void {
    this.desiredBgmTrack = track;
    if (!this.preloadStarted) {
      void this.preloadAllAudio();
    }
    if (track && !this.bgmBuffers.has(track)) {
      void this.loadBgmBuffer(track);
    }
    this.syncDesiredBgmPlayback(fadeSec);
  }

  startBgm(): void {
    this.unlock();
    this.setBgmTrack('act1', 0.65);
  }

  stopBgm(fadeSec = 0.45): void {
    this.setBgmTrack(null, fadeSec);
  }

  private stopCurrentBgmNode(fadeSec: number): void {
    const prev = this.activeBgmPlayback;
    if (!prev) return;
    this.activeBgmPlayback = null;

    if (!this.ctx || this.ctx.state === 'closed' || fadeSec <= 0.02) {
      try {
        prev.source.stop();
      } catch {
        // Ignore already stopped source
      }
      prev.source.disconnect();
      prev.gain.disconnect();
      return;
    }

    try {
      const now = this.ctx.currentTime;
      prev.gain.gain.cancelScheduledValues(now);
      prev.gain.gain.setValueAtTime(Math.max(0.0001, prev.gain.gain.value), now);
      prev.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
      prev.source.stop(now + fadeSec + 0.04);
      prev.source.onended = () => {
        prev.source.disconnect();
        prev.gain.disconnect();
      };
    } catch {
      try {
        prev.source.stop();
      } catch {
        // Safe cleanup
      }
      prev.source.disconnect();
      prev.gain.disconnect();
    }
  }

  private syncDesiredBgmPlayback(fadeSec: number): void {
    const target = this.desiredBgmTrack;
    if (!target) {
      this.stopCurrentBgmNode(fadeSec);
      return;
    }

    if (this.activeBgmPlayback?.track === target) {
      return;
    }

    if (!this.ctx || !this.bgmFilter || this.ctx.state !== 'running') {
      return;
    }

    const buffer = this.bgmBuffers.get(target);
    if (!buffer) {
      return;
    }

    this.stopCurrentBgmNode(Math.min(fadeSec, 0.85));

    try {
      const now = this.ctx.currentTime;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const trackGain = this.ctx.createGain();
      const targetGain = BGM_TRACK_GAIN[target];
      trackGain.gain.setValueAtTime(0.0001, now);
      trackGain.gain.exponentialRampToValueAtTime(targetGain, now + Math.max(0.06, fadeSec));

      source.connect(trackGain);
      trackGain.connect(this.bgmFilter);
      source.start(now);

      this.activeBgmPlayback = {
        track: target,
        source,
        gain: trackGain,
      };
    } catch {
      // Safe no-op
    }
  }

  private duckBgm(amount = 0.35, holdSec = 1.2): void {
    if (!this.bgmDuckGain || !this.ctx || this.ctx.state !== 'running') return;
    if (this.duckResetTimer !== null) {
      window.clearTimeout(this.duckResetTimer);
      this.duckResetTimer = null;
    }

    try {
      const now = this.ctx.currentTime;
      const minGain = Math.max(0.15, Math.min(0.85, amount));
      this.bgmDuckGain.gain.cancelScheduledValues(now);
      this.bgmDuckGain.gain.setTargetAtTime(minGain, now, 0.04);
      this.duckResetTimer = window.setTimeout(() => {
        this.duckResetTimer = null;
        if (!this.bgmDuckGain || !this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime;
        this.bgmDuckGain.gain.cancelScheduledValues(t);
        this.bgmDuckGain.gain.setTargetAtTime(1.0, t, 0.25);
      }, Math.round(holdSec * 1000));
    } catch {
      // Safe no-op
    }
  }

  private pickAlt<T extends SfxKey>(group: string, keys: readonly [T, T]): T {
    const next = ((this.variantFlip.get(group) ?? 0) + 1) & 1;
    this.variantFlip.set(group, next);
    return keys[next];
  }

  private playBufferSfx(
    key: SfxKey,
    opts?: {
      gain?: number;
      rate?: number;
      pan?: number;
      bypassMuteCheck?: boolean;
    }
  ): boolean {
    if (!this.ctx || !this.sfxGain) return false;
    if (!opts?.bypassMuteCheck && (this.muted || this.ctx.state !== 'running')) return false;
    const buffer = this.sfxBuffers.get(key);
    if (!buffer) return false;

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = Math.max(0.4, Math.min(2.2, opts?.rate ?? 1.0));

      const g = this.ctx.createGain();
      g.gain.value = Math.max(0.01, Math.min(1.8, opts?.gain ?? 1.0));
      src.connect(g);

      const panVal = opts?.pan ?? 0;
      if (Math.abs(panVal) > 0.02 && typeof this.ctx.createStereoPanner === 'function') {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-0.9, Math.min(0.9, panVal));
        g.connect(panner);
        panner.connect(this.sfxGain);
        src.onended = () => {
          src.disconnect();
          g.disconnect();
          panner.disconnect();
        };
      } else {
        g.connect(this.sfxGain);
        src.onended = () => {
          src.disconnect();
          g.disconnect();
        };
      }

      src.start(this.ctx.currentTime);
      return true;
    } catch {
      return false;
    }
  }

  dispose(): void {
    if (this.duckResetTimer !== null) {
      window.clearTimeout(this.duckResetTimer);
      this.duckResetTimer = null;
    }
    this.desiredBgmTrack = null;
    this.stopCurrentBgmNode(0);
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        const res = this.ctx.close();
        if (res && typeof res.catch === 'function') {
          void res.catch(() => {});
        }
      } catch {
        // Ignore close failures
      }
    }
    this.sfxBuffers.clear();
    this.bgmBuffers.clear();
    this.bgmInFlight.clear();
    this.resetAudioGraph();
  }

  playShot(voice: WeaponVoice, pan = 0): void {
    if (!this.canPlaySfx() || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.lastShotAt >= 0 && now - this.lastShotAt < 0.042) return;
    this.lastShotAt = now;

    const rateJitter = 0.96 + Math.random() * 0.09;
    let key: SfxKey;
    let vol = 0.22;
    if (voice === 'astra') {
      key = this.pickAlt('shot_astra', ['shot_astra_1', 'shot_astra_2']);
      vol = 0.22;
    } else if (voice === 'opus') {
      key = this.pickAlt('shot_opus', ['shot_opus_1', 'shot_opus_2']);
      vol = 0.25;
    } else if (voice === 'morph') {
      key = this.pickAlt('shot_morph', ['shot_morph_1', 'shot_morph_2']);
      vol = 0.27;
    } else {
      key = this.pickAlt('shot_aero', ['shot_aero_1', 'shot_aero_2']);
      vol = 0.27;
    }

    if (this.playBufferSfx(key, { gain: vol, rate: rateJitter, pan })) return;

    // Fallback synthesis if audio buffers are still warming up
    this.synthShot(voice);
  }

  playHit(crit = false, pan = 0, combo = 1): void {
    if (!this.canPlaySfx() || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (!crit && this.lastHitAt >= 0 && now - this.lastHitAt < 0.032) return;
    this.lastHitAt = now;

    const comboNorm = Math.max(0, Math.min(1, (combo - 1) / 7));
    const comboRate = 1 + comboNorm * 0.12;
    const key: SfxKey = crit ? 'hit_crit' : this.pickAlt('hit_hull', ['hit_hull_1', 'hit_hull_2']);
    if (
      this.playBufferSfx(key, {
        gain: crit ? 0.42 : 0.19,
        rate: comboRate * (0.97 + Math.random() * 0.06),
        pan,
      })
    ) {
      return;
    }

    this.synthHit(crit);
  }

  playExplosion(scale: 'small' | 'medium' | 'boss' = 'small', pan = 0): void {
    if (!this.canPlaySfx()) return;
    if (scale === 'boss') {
      this.duckBgm(0.62, 1.1);
      if (this.playBufferSfx('exp_boss', { gain: 1.12, rate: 1.0, pan })) return;
    } else if (scale === 'medium') {
      if (this.playBufferSfx('exp_medium', { gain: 0.72, rate: 0.96 + Math.random() * 0.08, pan })) {
        return;
      }
    } else {
      const key = this.pickAlt('exp_small', ['exp_small_1', 'exp_small_2']);
      if (this.playBufferSfx(key, { gain: 0.46, rate: 0.94 + Math.random() * 0.12, pan })) {
        return;
      }
    }

    this.synthExplosion(scale);
  }

  playPartBreak(pan = 0): void {
    if (!this.canPlaySfx()) return;
    this.duckBgm(0.76, 0.38);
    if (this.playBufferSfx('part_break', { gain: 1.08, rate: 1.0, pan })) return;
    this.synthExplosion('medium');
    this.playToneSweep(1100, 190, 0.28, 'sawtooth', 0.18);
  }

  playRoll(deflected = false, pan = 0): void {
    if (!this.canPlaySfx()) return;
    if (deflected) {
      if (this.playBufferSfx('deflect_parry', { gain: 0.82, rate: 0.96 + Math.random() * 0.08, pan })) {
        return;
      }
      this.playToneSweep(880, 1760, 0.12, 'triangle', 0.14);
      return;
    }

    if (this.playBufferSfx('roll_whoosh', { gain: 0.78, rate: 0.97 + Math.random() * 0.06, pan })) {
      return;
    }
    this.synthRoll();
  }

  playShieldHit(): void {
    if (!this.canPlaySfx()) return;
    this.duckBgm(0.74, 0.26);
    if (this.playBufferSfx('shield_hit', { gain: 1.25, rate: 1.0 })) return;
    this.playToneSweep(280, 75, 0.22, 'sawtooth', 0.22);
  }

  playPickup(pan = 0): void {
    if (!this.canPlaySfx()) return;
    if (this.playBufferSfx('pickup_item', { gain: 0.62, rate: 0.96 + Math.random() * 0.1, pan })) {
      return;
    }
    this.playToneSweep(523.25, 1046.5, 0.16, 'triangle', 0.13);
  }

  playUpgrade(): void {
    if (!this.canPlaySfx()) return;
    if (this.playBufferSfx('upgrade_lock', { gain: 0.9, rate: 1.0 })) return;
    this.synthUpgrade();
  }

  playBossWarning(): void {
    if (!this.canPlaySfx()) return;
    this.duckBgm(0.48, 2.6);
    const klaxon = this.playBufferSfx('boss_warning', { gain: 1.02, rate: 1.0 });
    const crescendo = this.playBufferSfx('boss_crescendo', { gain: 0.62, rate: 1.0 });
    if (!klaxon && !crescendo) {
      this.synthBossWarning();
    }
  }

  playUltimate(voice: WeaponVoice = 'astra'): void {
    if (!this.canPlaySfx()) return;
    this.duckBgm(0.68, 0.85);
    const map: Record<WeaponVoice, SfxKey> = {
      astra: 'ult_astra_beam',
      opus: 'ult_opus_nova',
      morph: 'ult_morph_salvo',
      aero: 'ult_aero_chrono',
    };
    if (this.playBufferSfx(map[voice], { gain: 1.08, rate: 1.0 })) return;
    this.playToneSweep(160, 960, 0.45, 'sawtooth', 0.24);
    this.synthExplosion('medium');
  }

  playBootDoorOpen(): void {
    if (!this.canPlaySfx()) return;
    if (this.playBufferSfx('door_bay', { gain: 0.86, rate: 1.0 })) return;
    this.playToneSweep(140, 65, 0.4, 'sawtooth', 0.14);
  }

  playShipSelect(): void {
    if (!this.canPlaySfx()) return;
    if (this.playBufferSfx('ship_select', { gain: 0.82, rate: 1.0 })) return;
    this.playUiClick();
  }

  playHudDeploy(): void {
    if (!this.canPlaySfx()) return;
    if (this.playBufferSfx('hud_deploy', { gain: 0.68, rate: 1.0 })) return;
    this.playToneSweep(640, 1280, 0.09, 'sine', 0.06);
  }

  playLaunchSortie(): void {
    if (!this.canPlaySfx()) return;
    if (this.playBufferSfx('launch_sortie', { gain: 0.96, rate: 1.0 })) return;
    if (this.playBufferSfx('roll_whoosh', { gain: 0.82, rate: 0.82 })) return;
    this.playToneSweep(220, 880, 0.28, 'sawtooth', 0.16);
  }

  playCountdownTick(step: 3 | 2 | 1 | 0): void {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    if (step === 0) {
      this.playLaunchSortie();
      this.playToneSweep(880, 1318.5, 0.22, 'triangle', 0.11);
      return;
    }

    const pitchMap: Record<3 | 2 | 1, number> = {
      3: 523.25,
      2: 659.25,
      1: 783.99,
    };
    const rateMap: Record<3 | 2 | 1, number> = {
      3: 0.92,
      2: 1.04,
      1: 1.18,
    };
    const freq = pitchMap[step];
    this.playBufferSfx('ui_click', { gain: 0.4, rate: rateMap[step] });
    this.playToneSweep(freq, freq * 1.015, 0.16, 'triangle', 0.13);
    this.playToneSweep(freq * 2, freq * 1.98, 0.085, 'sine', 0.055);
  }

  playResultStinger(victory: boolean): void {
    this.stopBgm(0.35);
    if (!this.canPlaySfx()) return;
    const key: SfxKey = victory ? 'stinger_victory' : 'stinger_defeat';
    if (this.playBufferSfx(key, { gain: 0.98, rate: 1.0 })) return;
    if (victory) {
      this.synthUpgrade();
    } else {
      this.playToneSweep(320, 72, 0.65, 'sawtooth', 0.2);
    }
  }

  playUiClick(): void {
    if (!this.canPlaySfx()) return;
    if (this.playBufferSfx('ui_click', { gain: 0.5, rate: 0.98 + Math.random() * 0.04 })) return;
    this.playToneSweep(780, 1120, 0.05, 'sine', 0.08);
  }

  playUiHover(): void {
    if (!this.canPlaySfx() || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.lastHoverAt >= 0 && now - this.lastHoverAt < 0.065) return;
    this.lastHoverAt = now;
    if (this.playBufferSfx('ui_hover', { gain: 0.28, rate: 0.98 + Math.random() * 0.05 })) return;
    this.playToneSweep(1900, 2500, 0.012, 'sine', 0.025);
  }

  // ==================== Fallback Oscillator Synthesis ====================

  private synthShot(voice: WeaponVoice): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      if (voice === 'astra') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
      } else if (voice === 'opus') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.11);
      } else if (voice === 'morph') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1280, now);
        osc.frequency.exponentialRampToValueAtTime(340, now + 0.065);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(760, now);
        osc.frequency.exponentialRampToValueAtTime(290, now + 0.075);
      }
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Safe no-op
    }
  }

  private synthHit(crit: boolean): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = crit ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(crit ? 1560 : 620, now);
      osc.frequency.exponentialRampToValueAtTime(crit ? 2280 : 280, now + (crit ? 0.08 : 0.045));
      gain.gain.setValueAtTime(crit ? 0.12 : 0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (crit ? 0.09 : 0.05));
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Safe no-op
    }
  }

  private synthExplosion(scale: 'small' | 'medium' | 'boss'): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const dur = scale === 'boss' ? 1.15 : scale === 'medium' ? 0.45 : 0.24;
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(scale === 'boss' ? 980 : 720, now);
      filter.frequency.exponentialRampToValueAtTime(75, now + dur);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(scale === 'boss' ? 0.45 : scale === 'medium' ? 0.26 : 0.15, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + dur);

      const sub = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(scale === 'boss' ? 115 : 140, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + dur * 0.8);
      sGain.gain.setValueAtTime(scale === 'boss' ? 0.42 : 0.2, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.85);
      sub.connect(sGain);
      sGain.connect(this.sfxGain);
      sub.start(now);
      sub.stop(now + dur);
    } catch {
      // Safe no-op
    }
  }

  private synthRoll(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(340, now);
      bp.frequency.exponentialRampToValueAtTime(1600, now + 0.18);
      bp.frequency.exponentialRampToValueAtTime(420, now + 0.36);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      noise.connect(bp);
      bp.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.4);
    } catch {
      // Safe no-op
    }
  }

  private synthUpgrade(): void {
    if (!this.ctx || !this.sfxGain) return;
    const notes = [440, 554.37, 659.25, 880];
    const now = this.ctx.currentTime;
    try {
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.11, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.24);
      });
    } catch {
      // Safe no-op
    }
  }

  private synthBossWarning(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    try {
      for (let i = 0; i < 3; i++) {
        const t0 = now + i * 0.42;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, t0);
        osc.frequency.linearRampToValueAtTime(340, t0 + 0.18);
        osc.frequency.linearRampToValueAtTime(160, t0 + 0.34);
        gain.gain.setValueAtTime(0.18, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.36);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t0);
        osc.stop(t0 + 0.38);
      }
    } catch {
      // Safe no-op
    }
  }

  playTrophyUnlock(tier: 'bronze' | 'silver' | 'gold' | 'platinum'): void {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes =
      tier === 'platinum'
        ? [1046.5, 1318.51, 1567.98, 1975.53, 2349.32, 2637.02]
        : tier === 'gold'
          ? [1046.5, 1318.51, 1567.98, 2093.0]
          : tier === 'silver'
            ? [1046.5, 1567.98, 2093.0]
            : [1046.5, 1567.98];
    const spacing = tier === 'platinum' ? 0.085 : 0.075;
    const decay = tier === 'platinum' ? 1.15 : tier === 'gold' ? 0.85 : 0.62;
    const baseVol = tier === 'platinum' ? 0.22 : tier === 'gold' ? 0.19 : 0.16;

    try {
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.sfxGain) return;
        const t0 = now + idx * spacing;

        // Primary crystalline bell fundamental
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(baseVol, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0008, t0 + decay);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t0);
        osc.stop(t0 + decay + 0.03);

        // Shimmering harmonic overtone (octave + slight chorus detune)
        const over = this.ctx.createOscillator();
        const oGain = this.ctx.createGain();
        over.type = 'triangle';
        over.frequency.setValueAtTime(freq * 2, t0);
        over.detune.setValueAtTime(idx % 2 === 0 ? 5 : -5, t0);
        oGain.gain.setValueAtTime(0.0001, t0);
        oGain.gain.linearRampToValueAtTime(baseVol * 0.34, t0 + 0.01);
        oGain.gain.exponentialRampToValueAtTime(0.0005, t0 + decay * 0.72);
        over.connect(oGain);
        oGain.connect(this.sfxGain);
        over.start(t0);
        over.stop(t0 + decay * 0.75 + 0.02);
      });
    } catch {
      // Safe no-op
    }
  }

  private playToneSweep(
    fromHz: number,
    toHz: number,
    dur: number,
    type: OscillatorType,
    vol: number
  ): void {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const safeDur = Math.max(0.01, Number.isFinite(dur) ? dur : 0.05);
    const safeFrom = Math.max(20, Number.isFinite(fromHz) ? fromHz : 440);
    const safeTo = Math.max(20, Number.isFinite(toHz) ? toHz : 440);
    const safeVol = Math.max(0.002, Number.isFinite(vol) ? vol : 0.1);
    const now = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(safeFrom, now);
      osc.frequency.exponentialRampToValueAtTime(safeTo, now + safeDur);
      gain.gain.setValueAtTime(safeVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + safeDur);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + safeDur + 0.02);
    } catch {
      // Safe no-op
    }
  }
}

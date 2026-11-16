export type WeaponVoice = 'astra' | 'opus' | 'morph' | 'aero';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private lastShotAt = -1;
  private lastHitAt = -1;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  private resetContext(): void {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.noiseBuffer = null;
  }

  private canPlay(): boolean {
    return Boolean(this.ctx && this.sfxGain && !this.muted && this.ctx.state === 'running');
  }

  unlock(): void {
    if (typeof window === 'undefined') return;

    if (this.ctx && this.ctx.state === 'closed') {
      this.resetContext();
    }

    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.7;
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.75;
        this.sfxGain.connect(this.masterGain);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.22;
        this.bgmGain.connect(this.masterGain);

        this.noiseBuffer = this.buildNoiseBuffer(this.ctx);
      } catch {
        this.resetContext();
        return;
      }
    }

    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      try {
        const res = this.ctx.resume();
        if (res && typeof res.catch === 'function') {
          void res.catch(() => {
            // Locked AudioContext without user gesture safely stays silent
          });
        }
      } catch {
        // Safe no-op in restricted/headless audio environments
      }
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx && this.ctx.state !== 'closed') {
      try {
        this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.03);
      } catch {
        try {
          this.masterGain.gain.value = muted ? 0 : 0.7;
        } catch {
          // Ignore locked/closed audio context errors
        }
      }
    }
  }

  isMuted(): boolean {
    return this.muted;
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

  startBgm(): void {
    this.unlock();
    if (!this.ctx || !this.bgmGain || this.bgmTimer !== null || this.ctx.state === 'closed') return;
    const bassNotes = [55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42];
    const arpNotes = [220, 277.18, 329.63, 440, 246.94, 329.63, 392, 493.88];
    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || !this.bgmGain || this.muted || this.ctx.state !== 'running') return;
      try {
        const now = this.ctx.currentTime;
        const step = this.bgmStep++ % bassNotes.length;

        // Sub bass pulse
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassNotes[step], now);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(240, now);
        filter.frequency.exponentialRampToValueAtTime(110, now + 0.16);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgmGain);
        osc.start(now);
        osc.stop(now + 0.2);

        // Subtle sci-fi arp on even steps
        if (step % 2 === 0) {
          const arp = this.ctx.createOscillator();
          const ag = this.ctx.createGain();
          arp.type = 'triangle';
          arp.frequency.setValueAtTime(arpNotes[(this.bgmStep >> 1) % arpNotes.length], now);
          ag.gain.setValueAtTime(0.001, now);
          ag.gain.linearRampToValueAtTime(0.055, now + 0.01);
          ag.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          arp.connect(ag);
          ag.connect(this.bgmGain);
          arp.start(now);
          arp.stop(now + 0.24);
        }
      } catch {
        // Safe no-op if audio graph fails
      }
    }, 185);
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  dispose(): void {
    this.stopBgm();
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
    this.resetContext();
  }

  playShot(voice: WeaponVoice): void {
    if (!this.canPlay() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (this.lastShotAt >= 0 && now - this.lastShotAt < 0.045) return;
    this.lastShotAt = now;

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

  playHit(crit = false): void {
    if (!this.canPlay() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (!crit && this.lastHitAt >= 0 && now - this.lastHitAt < 0.035) return;
    this.lastHitAt = now;

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

  playExplosion(scale: 'small' | 'medium' | 'boss' = 'small'): void {
    if (!this.canPlay() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
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

  playRoll(deflected = false): void {
    if (!this.canPlay() || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
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

      if (deflected) {
        this.playToneSweep(880, 1760, 0.12, 'triangle', 0.14);
      }
    } catch {
      // Safe no-op
    }
  }

  playShieldHit(): void {
    this.playToneSweep(280, 75, 0.22, 'sawtooth', 0.22);
  }

  playPickup(): void {
    this.playToneSweep(523.25, 1046.5, 0.16, 'triangle', 0.13);
  }

  playPartBreak(): void {
    this.playExplosion('medium');
    this.playToneSweep(1100, 190, 0.28, 'sawtooth', 0.18);
  }

  playUpgrade(): void {
    if (!this.canPlay() || !this.ctx || !this.sfxGain) return;
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

  playBossWarning(): void {
    if (!this.canPlay() || !this.ctx || !this.sfxGain) return;
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

  playUltimate(): void {
    this.playToneSweep(160, 960, 0.45, 'sawtooth', 0.24);
    this.playExplosion('medium');
  }

  playUiClick(): void {
    this.playToneSweep(780, 1120, 0.05, 'sine', 0.08);
  }

  private playToneSweep(
    fromHz: number,
    toHz: number,
    dur: number,
    type: OscillatorType,
    vol: number
  ): void {
    if (!this.canPlay() || !this.ctx || !this.sfxGain) return;
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

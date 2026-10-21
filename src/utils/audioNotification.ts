/**
 * audioNotification.ts - Institutional Audio Synthesizer for NIFTY Trading Terminal
 * Generates highly distinct procedural Web Audio API sound alerts so traders
 * can effortlessly identify every system event purely by ear:
 * 
 * 1. SNIPER IMMINENT ENTRY: Urgent high-precision radar arpeggio (1046 -> 1318 -> 1567 -> 2093 Hz)
 * 2. WATCHLIST SIGNAL: Warm gentle crystal bell (659 -> 830 Hz)
 * 3. ORDER EXECUTED / FILLED: Heavy mechanical relay snap + authoritative rising brass tone
 * 4. TP1 SCALE-OUT (1.5R): Bright double ascending silver ping (1174 -> 1760 Hz)
 * 5. FULL TAKE PROFIT (3R+): Triumphant 4-note ascending major celebration arpeggio (C5 -> E5 -> G5 -> C6)
 * 6. STOP LOSS / RISK BREACH: Low-frequency double warning buzzer (220 -> 146 Hz)
 * 7. BREAKEVEN MOVED: Crisp double metallic click (2400 -> 3200 Hz)
 * 8. SIGNAL EXPIRED / SHUT DOWN: Gentle falling raindrop tone (880 -> 587 -> 440 Hz)
 */

export type VolumeLevel = 'subtle' | 'gentle' | 'normal';
export type SoundType =
  | 'sniper'
  | 'vip_telegram'
  | 'signal'
  | 'trade'
  | 'tp_partial'
  | 'profit'
  | 'loss'
  | 'breakeven'
  | 'expired'
  | 'countdown_urgent';

class SignalAudioNotifier {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volumeLevel: VolumeLevel = 'gentle';
  private listeners: Set<(direction: string, price: number) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('nifty_sound_enabled');
      this.isMuted = savedMute === 'false';
      const savedVol = localStorage.getItem('nifty_volume_level') as VolumeLevel;
      if (savedVol && ['subtle', 'gentle', 'normal'].includes(savedVol)) {
        this.volumeLevel = savedVol;
      }
    }
  }

  public unlock() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('nifty_sound_enabled', muted ? 'false' : 'true');
    }
  }

  public getVolumeLevel(): VolumeLevel {
    return this.volumeLevel;
  }

  public setVolumeLevel(level: VolumeLevel) {
    this.volumeLevel = level;
    if (typeof window !== 'undefined') {
      localStorage.setItem('nifty_volume_level', level);
    }
  }

  private getGainMultiplier(): number {
    return this.volumeLevel === 'subtle' ? 0.15 : this.volumeLevel === 'normal' ? 0.6 : 0.35;
  }

  public onSignalAlert(callback: (direction: string, price: number) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * 1. SNIPER IMMINENT EXECUTION: Urgent high-precision radar arpeggio
   * Distinct, fast, sharp alert when an A+ setup is within entry range.
   */
  public playSniperImminentAlert(direction: 'BUY' | 'SELL' = 'BUY', price: number = 0) {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 1.25, now);

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(600, now);

      masterGain.connect(highpass);
      highpass.connect(this.ctx.destination);

      // Rapid 4-note ascending radar ping for BUY, descending for SELL
      const notes = direction === 'BUY'
        ? [1046.50, 1318.51, 1567.98, 2093.00] // C6 -> E6 -> G6 -> C7
        : [2093.00, 1567.98, 1318.51, 1046.50]; // C7 -> G6 -> E6 -> C6

      notes.forEach((freq, idx) => {
        const start = now + idx * 0.045;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.85, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 0.19);
      });
    } catch (e) {
      console.warn('[AudioNotifier] Sniper alert failed:', e);
    }
  }

  /**
   * 2. WATCHLIST SIGNAL: Warm gentle crystal bell
   */
  public playSignalAlert(
    direction: 'BUY' | 'SELL' = 'BUY',
    price: number = 4188.5,
    notifyListeners: boolean = true
  ) {
    if (notifyListeners) {
      this.listeners.forEach((cb) => {
        try {
          cb(direction, price);
        } catch (err) {
          console.error('[Signal Alerts] Visual alert listener failed:', err);
        }
      });
    }

    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier(), now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1900, now);
      filter.Q.setValueAtTime(0.7, now);

      masterGain.connect(filter);
      filter.connect(this.ctx.destination);

      const isBuy = direction === 'BUY';
      const rootFreq = isBuy ? 659.25 : 587.33; // E5 for Buy, D5 for Sell
      const secondFreq = isBuy ? 830.61 : 440.0; // G#5 for Buy, A4 for Sell

      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(rootFreq, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(0.75, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.29);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(secondFreq, now + 0.06);
      gain2.gain.setValueAtTime(0.0001, now + 0.06);
      gain2.gain.linearRampToValueAtTime(0.65, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.39);
    } catch (e) {
      console.warn('[AudioNotifier] Signal alert failed:', e);
    }
  }

  /**
   * 3. TRADE EXECUTED / ORDER FILLED: Heavy mechanical relay snap + rising brass tone
   * Totally different physical tactile click feeling!
   */
  public playTradeExecutionAlert(direction: 'BUY' | 'SELL' = 'BUY') {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 1.3, now);
      masterGain.connect(this.ctx.destination);

      // 1. Mechanical transient snap
      const oscClick = this.ctx.createOscillator();
      const gainClick = this.ctx.createGain();
      oscClick.type = 'triangle';
      oscClick.frequency.setValueAtTime(1600, now);
      oscClick.frequency.exponentialRampToValueAtTime(120, now + 0.025);
      gainClick.gain.setValueAtTime(0.9, now);
      gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      oscClick.connect(gainClick);
      gainClick.connect(masterGain);
      oscClick.start(now);
      oscClick.stop(now + 0.03);

      // 2. Heavy authoritative punch tone (low-mid rising brass)
      const oscTone = this.ctx.createOscillator();
      const gainTone = this.ctx.createGain();
      oscTone.type = 'sawtooth';
      const startFreq = direction === 'BUY' ? 261.63 : 329.63; // C4 / E4
      const endFreq = direction === 'BUY' ? 440.00 : 220.00; // A4 / A3
      oscTone.frequency.setValueAtTime(startFreq, now + 0.015);
      oscTone.frequency.exponentialRampToValueAtTime(endFreq, now + 0.16);

      const filterTone = this.ctx.createBiquadFilter();
      filterTone.type = 'lowpass';
      filterTone.frequency.setValueAtTime(800, now + 0.015);
      filterTone.frequency.linearRampToValueAtTime(1400, now + 0.08);

      gainTone.gain.setValueAtTime(0.001, now + 0.015);
      gainTone.gain.linearRampToValueAtTime(0.7, now + 0.035);
      gainTone.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      oscTone.connect(filterTone);
      filterTone.connect(gainTone);
      gainTone.connect(masterGain);
      oscTone.start(now + 0.015);
      oscTone.stop(now + 0.29);
    } catch (e) {
      console.warn('[AudioNotifier] Trade execution sound failed:', e);
    }
  }

  /**
   * 4. TP1 SCALE-OUT (1.5R PARTIAL PROFIT): Bright double ascending silver ping
   */
  public playTpPartialAlert() {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 1.15, now);
      masterGain.connect(this.ctx.destination);

      [1174.66, 1760.00].forEach((freq, idx) => {
        const start = now + idx * 0.07;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.85, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 0.33);
      });
    } catch (e) {
      console.warn('[AudioNotifier] TP partial alert failed:', e);
    }
  }

  /**
   * 5. FULL TAKE PROFIT (3R+): Triumphant 4-note ascending major celebration arpeggio
   */
  public playProfitAlert(profit?: number) {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 1.25, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      masterGain.connect(filter);
      filter.connect(this.ctx.destination);

      // C5 -> E5 -> G5 -> C6
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const noteStart = now + idx * 0.065;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.8, noteStart + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.42);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.43);
      });
    } catch (e) {
      console.warn('[AudioNotifier] Profit alert failed:', e);
    }
  }

  /**
   * 6. STOP LOSS / RISK BREACH: Low-frequency double warning buzzer
   */
  public playLossAlert(loss?: number) {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 0.95, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, now);
      masterGain.connect(filter);
      filter.connect(this.ctx.destination);

      // Two low warning buzzes (220Hz -> 146Hz)
      const notes = [220.00, 146.83];
      notes.forEach((freq, idx) => {
        const noteStart = now + idx * 0.14;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.65, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.28);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.30);
      });
    } catch (e) {
      console.warn('[AudioNotifier] Loss alert failed:', e);
    }
  }

  /**
   * 7. BREAKEVEN MOVED: Crisp double metallic click
   */
  public playBreakEvenAlert() {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 0.9, now);
      masterGain.connect(this.ctx.destination);

      [2400, 3200].forEach((freq, idx) => {
        const noteStart = now + idx * 0.05;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.6, noteStart + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.14);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.15);
      });
    } catch (e) {
      console.warn('[AudioNotifier] Breakeven alert failed:', e);
    }
  }

  /**
   * 8. SIGNAL EXPIRED / SHUT DOWN: Gentle falling raindrop tone
   * Plays when a signal's countdown hits 0 or price moves past invalidation.
   */
  public playSignalExpiredAlert() {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 0.7, now);
      masterGain.connect(this.ctx.destination);

      [880.00, 587.33, 440.00].forEach((freq, idx) => {
        const noteStart = now + idx * 0.08;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.5, noteStart + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.22);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.23);
      });
    } catch (e) {
      console.warn('[AudioNotifier] Signal expired alert failed:', e);
    }
  }

  /**
   * 1B. VIP TELEGRAM 100% CONVICTION ALERT:
   * Prestigious crystal arpeggio + shimmering harmonic bell.
   * Completely distinct from standard watchlist & sniper sounds.
   */
  public playVipTelegramAlert(direction: 'BUY' | 'SELL' = 'BUY') {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 1.35, now);
      masterGain.connect(this.ctx.destination);

      // Shimmering triple harmonic bell (A6 -> C#7 -> E7 -> A7)
      const freqs = direction === 'BUY'
        ? [1760.00, 2217.46, 2637.02, 3520.00]
        : [3520.00, 2637.02, 2217.46, 1760.00];

      freqs.forEach((freq, idx) => {
        const start = now + idx * 0.055;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.85, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 0.46);
      });
    } catch (e) {
      console.warn('[AudioNotifier] VIP Telegram alert failed:', e);
    }
  }

  /**
   * 9. COUNTDOWN URGENT TICK: Subtle high-tech sonar blip
   * Fired when entry window has under 15 seconds remaining.
   */
  public playCountdownUrgentTick() {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 0.45, now);
      masterGain.connect(this.ctx.destination);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.085);
    } catch (e) {
      // Ignore tick error
    }
  }

  /**
   * Test chime preview to easily distinguish every tone by ear
   */
  public playTestChime(type: SoundType = 'sniper') {
    const wasMuted = this.isMuted;
    this.isMuted = false;
    this.unlock();

    if (type === 'sniper') this.playSniperImminentAlert('BUY', 4188.5);
    else if (type === 'vip_telegram') this.playVipTelegramAlert('BUY');
    else if (type === 'signal') this.playSignalAlert('BUY', 4188.5, false);
    else if (type === 'trade') this.playTradeExecutionAlert('BUY');
    else if (type === 'tp_partial') this.playTpPartialAlert();
    else if (type === 'profit') this.playProfitAlert(45.0);
    else if (type === 'loss') this.playLossAlert(-15.0);
    else if (type === 'breakeven') this.playBreakEvenAlert();
    else if (type === 'expired') this.playSignalExpiredAlert();
    else if (type === 'countdown_urgent') this.playCountdownUrgentTick();

    this.isMuted = wasMuted;
  }
}

export const signalAudioNotifier = new SignalAudioNotifier();

if (typeof window !== 'undefined') {
  const unlockOnFirstGesture = () => {
    signalAudioNotifier.unlock();
  };
  window.addEventListener('pointerdown', unlockOnFirstGesture, { passive: true });
  window.addEventListener('click', unlockOnFirstGesture, { passive: true });
  window.addEventListener('keydown', unlockOnFirstGesture, { passive: true });
}

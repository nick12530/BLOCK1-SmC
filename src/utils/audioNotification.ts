/**
 * audioNotification.ts - Institutional Audio Synthesizer for SMC Trading System
 * Features distinct, high-fidelity procedural Web Audio API sound alerts:
 * 1. Signals: Soft harmonic crystal chime (Buy: uplifting E5->B5, Sell: grounding D5->A4)
 * 2. Trades: Crisp mechanical fill click + ascending electronic confirmation blip
 * 3. Profits: Triumphant 4-note ascending major harmonic arpeggio (C5 -> E5 -> G5 -> C6)
 * 4. Losses: Subdued, low-frequency warning tone (D4 -> A3)
 * 5. Break-Even: Dual high-frequency crystal resonance
 */

export type VolumeLevel = 'subtle' | 'gentle' | 'normal';

class SignalAudioNotifier {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volumeLevel: VolumeLevel = 'gentle';
  private listeners: Set<(direction: string, price: number) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('smc_sound_enabled');
      this.isMuted = savedMute === 'false';
      const savedVol = localStorage.getItem('smc_volume_level') as VolumeLevel;
      if (savedVol && ['subtle', 'gentle', 'normal'].includes(savedVol)) {
        this.volumeLevel = savedVol;
      }
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
      this.ctx.resume();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('smc_sound_enabled', muted ? 'false' : 'true');
    }
  }

  public getVolumeLevel(): VolumeLevel {
    return this.volumeLevel;
  }

  public setVolumeLevel(level: VolumeLevel) {
    this.volumeLevel = level;
    if (typeof window !== 'undefined') {
      localStorage.setItem('smc_volume_level', level);
    }
  }

  private getGainMultiplier(): number {
    return this.volumeLevel === 'subtle' ? 0.05 : this.volumeLevel === 'normal' ? 0.15 : 0.09;
  }

  public onSignalAlert(callback: (direction: string, price: number) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * 1. SIGNAL ALERT: Crisp harmonic crystal bell
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
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(0.7, now);

      masterGain.connect(filter);
      filter.connect(this.ctx.destination);

      const isBuy = direction === 'BUY';
      const rootFreq = isBuy ? 659.25 : 587.33; // E5 for Buy, D5 for Sell
      const secondFreq = isBuy ? 987.77 : 440.0; // B5 for Buy, A4 for Sell

      // Note 1
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(rootFreq, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(0.8, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.33);

      // Note 2 (Chime response after 60ms)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(secondFreq, now + 0.06);
      gain2.gain.setValueAtTime(0.0001, now + 0.06);
      gain2.gain.linearRampToValueAtTime(0.7, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.46);
    } catch (e) {
      console.warn('Signal alert failed:', e);
    }
  }

  /**
   * 2. TRADE EXECUTED ALERT: Crisp mechanical order fill click + rising confirmation
   */
  public playTradeExecutionAlert(direction: 'BUY' | 'SELL' = 'BUY') {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 1.1, now);
      masterGain.connect(this.ctx.destination);

      // Mechanical short impulse click
      const oscClick = this.ctx.createOscillator();
      const gainClick = this.ctx.createGain();
      oscClick.type = 'triangle';
      oscClick.frequency.setValueAtTime(1200, now);
      oscClick.frequency.exponentialRampToValueAtTime(200, now + 0.03);
      gainClick.gain.setValueAtTime(0.6, now);
      gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      oscClick.connect(gainClick);
      gainClick.connect(masterGain);
      oscClick.start(now);
      oscClick.stop(now + 0.04);

      // Ascending trade confirmation tone (440Hz -> 660Hz)
      const oscTone = this.ctx.createOscillator();
      const gainTone = this.ctx.createGain();
      oscTone.type = 'sine';
      oscTone.frequency.setValueAtTime(direction === 'BUY' ? 440 : 520, now + 0.02);
      oscTone.frequency.exponentialRampToValueAtTime(direction === 'BUY' ? 660 : 780, now + 0.15);
      gainTone.gain.setValueAtTime(0.001, now + 0.02);
      gainTone.gain.linearRampToValueAtTime(0.7, now + 0.04);
      gainTone.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      oscTone.connect(gainTone);
      gainTone.connect(masterGain);
      oscTone.start(now + 0.02);
      oscTone.stop(now + 0.29);
    } catch (e) {
      console.warn('Trade execution sound failed:', e);
    }
  }

  /**
   * 3. PROFIT ALERT: Triumphant harmonic arpeggio (C5 -> E5 -> G5 -> C6)
   */
  public playProfitAlert(profit?: number) {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 1.2, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      masterGain.connect(filter);
      filter.connect(this.ctx.destination);

      // Major chord arpeggio: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const noteStart = now + idx * 0.07;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.75, noteStart + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.35);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.36);
      });
    } catch (e) {
      console.warn('Profit alert failed:', e);
    }
  }

  /**
   * 4. LOSS ALERT: Subdued double warning descending tone (D4 -> A3)
   */
  public playLossAlert(loss?: number) {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(this.getGainMultiplier() * 0.85, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      masterGain.connect(filter);
      filter.connect(this.ctx.destination);

      // Subdued descending notes: D4 (293.66Hz) -> A3 (220.00Hz)
      const notes = [293.66, 220.00];
      notes.forEach((freq, idx) => {
        const noteStart = now + idx * 0.12;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.5, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.3);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.32);
      });
    } catch (e) {
      console.warn('Loss alert failed:', e);
    }
  }

  /**
   * 5. BREAKEVEN ALERT: Double high-frequency crystal ping
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

      [880, 1174.66].forEach((freq, idx) => {
        const noteStart = now + idx * 0.06;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.6, noteStart + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.22);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.23);
      });
    } catch (e) {
      console.warn('Breakeven alert failed:', e);
    }
  }

  /**
   * Quick test preview of all system sounds
   */
  public playTestChime(type: 'signal' | 'trade' | 'profit' | 'loss' = 'signal') {
    const wasMuted = this.isMuted;
    this.isMuted = false;
    if (type === 'signal') this.playSignalAlert('BUY', 4188.5, false);
    else if (type === 'trade') this.playTradeExecutionAlert('BUY');
    else if (type === 'profit') this.playProfitAlert(25.5);
    else if (type === 'loss') this.playLossAlert(-10.0);
    this.isMuted = wasMuted;
  }
}

export const signalAudioNotifier = new SignalAudioNotifier();

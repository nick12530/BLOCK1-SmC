/**
 * audioNotification.ts - Subtle Institutional Audio Chime for SMC Gold Signals
 * Designed specifically for non-disruptive, crystal-clear situational awareness:
 * - Uses Web Audio API with pure sine waves and low-pass anti-harshness filter
 * - Soft marimba / crystal glass dual-tone harmonic (E5 659Hz -> B5 988Hz)
 * - Gentle attack curve (<15ms) and smooth exponential decay (zero clicking)
 * - Gentle volume capped at ~9-10% gain to remain comfortable on headphones
 * - Integrated event bus for triggering synchronized visual toast alerts
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

  public onSignalAlert(callback: (direction: string, price: number) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Plays a subtle, warm, harmonic institutional chime (E5 -> B5 with soft E4 depth).
   * Volume is gentle and decay is natural, preventing audio fatigue.
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

      // Master gain scaled to chosen subtlety level
      const masterGain = this.ctx.createGain();
      const gainMultiplier =
        this.volumeLevel === 'subtle' ? 0.05 : this.volumeLevel === 'normal' ? 0.14 : 0.09;
      masterGain.gain.setValueAtTime(gainMultiplier, now);

      // Low-pass filter to remove any harsh high-frequency treble or piercing clicks
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.Q.setValueAtTime(0.7, now);

      masterGain.connect(filter);
      filter.connect(this.ctx.destination);

      // 1. Warm base undertone: E4 (329.63 Hz) for rich body
      const oscBase = this.ctx.createOscillator();
      const gainBase = this.ctx.createGain();
      oscBase.type = 'sine';
      oscBase.frequency.setValueAtTime(329.63, now);
      gainBase.gain.setValueAtTime(0.0001, now);
      gainBase.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gainBase.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      oscBase.connect(gainBase);
      gainBase.connect(masterGain);
      oscBase.start(now);
      oscBase.stop(now + 0.36);

      // 2. Primary tone: E5 (659.25 Hz) - gentle, warm attack
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(0.8, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.29);

      // 3. Harmonic glass shimmer: B5 (987.77 Hz) - soft 60ms delay
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.06);
      gain2.gain.setValueAtTime(0.0001, now + 0.06);
      gain2.gain.linearRampToValueAtTime(0.65, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.43);
    } catch (e) {
      console.warn('Audio notification could not play:', e);
    }
  }

  /**
   * Quick test preview of the subtle sound
   */
  public playTestChime() {
    const wasMuted = this.isMuted;
    this.isMuted = false;
    this.playSignalAlert('BUY', 4188.5, false);
    this.isMuted = wasMuted;
  }
}

export const signalAudioNotifier = new SignalAudioNotifier();

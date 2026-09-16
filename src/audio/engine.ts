/**
 * Singleton audio engine: HTMLAudioElement playback + Web Audio analysis.
 * Drives the ambient "UI breathing" via band energies + beat pulses.
 * Falls back to a simulated analyser when AudioContext is unavailable
 * (blocked autoplay policy, missing hardware, etc.).
 */

export interface Levels {
  bass: number      // 0..1 smoothed
  mid: number
  treble: number
  energy: number    // weighted overall
  beat: number      // 1 right after a detected beat, decays each frame
  vol: number       // current output volume 0..1 (0 while muted)
  /** raw analysis, handed straight to anything that wants the detail */
  freq: Uint8Array | null
  wave: Uint8Array | null
}

/**
 * Sensitivity / beat-response knobs shared by everything that reads the
 * analyser. Higher `sensitivity` multiplies the band levels; higher
 * `beatResponse` makes a beat fire sooner and hit harder.
 */
const knobs = { sensitivity: 0.75, beatResponse: 0.7 }

export function setReactivity(next: { sensitivity?: number; beatResponse?: number }) {
  if (next.sensitivity !== undefined) knobs.sensitivity = Math.max(0, Math.min(1, next.sensitivity))
  if (next.beatResponse !== undefined) knobs.beatResponse = Math.max(0, Math.min(1, next.beatResponse))
}

type FrameCb = (levels: Levels, dt: number) => void

class AudioEngine {
  el: HTMLAudioElement
  levels: Levels = { bass: 0, mid: 0, treble: 0, energy: 0, beat: 0, vol: 0.8, freq: null, wave: null }
  simulated = false
  ready = false

  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private freq: Uint8Array | null = null
  private wave: Uint8Array | null = null
  private frameCbs = new Set<FrameCb>()
  private raf = 0
  private lastT = 0
  private bassEma = 0
  private lastBeatAt = 0
  private volRaf = 0
  private volResolve: (() => void) | null = null
  private endedCb: (() => void) | null = null
  private errorCb: ((msg?: string) => void) | null = null

  constructor() {
    const el = new Audio()
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    this.el = el
    el.addEventListener('ended', () => this.endedCb?.())
    el.addEventListener('error', () => {
      if (el.src) this.errorCb?.()
    })
  }

  setCallbacks(ended: () => void, onError: (msg?: string) => void) {
    this.endedCb = ended
    this.errorCb = onError
  }

  /** Create the Web Audio graph. Must be called from a user gesture. */
  attach(): void {
    if (this.ready || this.simulated) return
    try {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext
      if (!Ctx) throw new Error('不支持 Web Audio')
      this.ctx = new Ctx()
      const src = this.ctx.createMediaElementSource(this.el)
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.78
      src.connect(this.analyser)
      this.analyser.connect(this.ctx.destination)
      this.freq = new Uint8Array(this.analyser.frequencyBinCount)
      this.wave = new Uint8Array(this.analyser.fftSize)
      this.levels.freq = this.freq
      this.levels.wave = this.wave
      this.ready = true
    } catch {
      // CORS-tainted media or unsupported → run without live analysis
      this.simulated = true
      this.ctx?.close().catch(() => {})
      this.ctx = null
      this.analyser = null
    }
  }

  async resume(): Promise<void> {
    try { await this.ctx?.resume() } catch { /* ignore */ }
  }

  onFrame(cb: FrameCb): () => void {
    this.frameCbs.add(cb)
    if (!this.raf) {
      this.lastT = performance.now()
      this.raf = requestAnimationFrame(this.loop)
    }
    return () => {
      this.frameCbs.delete(cb)
      if (!this.frameCbs.size && this.raf) {
        cancelAnimationFrame(this.raf)
        this.raf = 0
      }
    }
  }

  private loop = (t: number) => {
    const dt = Math.min(0.1, (t - this.lastT) / 1000) || 0.016
    this.lastT = t
    const L = this.levels

    if (this.ready && this.analyser && this.freq) {
      this.analyser.getByteFrequencyData(this.freq as Uint8Array<ArrayBuffer>)
      if (this.wave) this.analyser.getByteTimeDomainData(this.wave as Uint8Array<ArrayBuffer>)
      const binHz = (this.ctx?.sampleRate ?? 44100) / (this.analyser.fftSize * 2)
      const band = (f0: number, f1: number) => {
        const a = Math.max(1, Math.floor(f0 / binHz))
        const b = Math.min(this.freq!.length - 1, Math.ceil(f1 / binHz))
        let sum = 0
        for (let i = a; i <= b; i++) sum += this.freq![i]
        return sum / (b - a + 1) / 255
      }
      // `sensitivity` scales how hard the analysis pushes the visuals
      const gain = 0.55 + knobs.sensitivity * 0.9
      const bass = band(20, 160) * gain
      const mid = band(160, 2000) * gain
      const tre = band(2000, 9000) * gain
      const k = Math.min(1, dt * 14)
      L.bass += (Math.min(1, bass * 1.15) - L.bass) * k
      L.mid += (Math.min(1, mid) - L.mid) * k
      L.treble += (Math.min(1, tre) - L.treble) * k
      L.energy += (Math.min(1, bass * 0.5 + mid * 0.35 + tre * 0.15) - L.energy) * k

      // beat: bass spike over rolling average with cooldown. `beatResponse`
      // lowers the threshold so beats land more readily.
      this.bassEma = this.bassEma * 0.965 + bass * 0.035
      const now = performance.now()
      const trigger = 1.52 - knobs.beatResponse * 0.32
      if (bass > this.bassEma * trigger + 0.05 && now - this.lastBeatAt > 240 - knobs.beatResponse * 90) {
        this.lastBeatAt = now
        L.beat = 0.7 + knobs.beatResponse * 0.3
      }
    } else if (this.el.paused === false) {
      // simulated: slow synthetic breathing
      const ts = t / 1000
      const w = (Math.sin(ts * 2.1) * 0.5 + 0.5) * 0.55 + (Math.sin(ts * 0.53) * 0.5 + 0.5) * 0.45
      L.bass += (w * 0.8 - L.bass) * Math.min(1, dt * 6)
      L.mid += (w * 0.5 - L.mid) * Math.min(1, dt * 6)
      L.treble += (w * 0.3 - L.treble) * Math.min(1, dt * 6)
      L.energy += (w * 0.55 - L.energy) * Math.min(1, dt * 6)
      const beatPhase = (ts * 2) % 1
      if (beatPhase < dt * 2) L.beat = 1
    } else {
      const k = Math.min(1, dt * 4)
      L.bass += (0 - L.bass) * k
      L.mid += (0 - L.mid) * k
      L.treble += (0 - L.treble) * k
      L.energy += (0 - L.energy) * k
    }
    L.beat *= Math.pow(0.0015, dt) // fast decay (~120ms half-life)
    L.vol = this.el.muted ? 0 : this.el.volume

    for (const cb of this.frameCbs) cb(L, dt)
    this.raf = requestAnimationFrame(this.loop)
  }

  async load(url: string): Promise<void> {
    if (this.el.src !== url) {
      this.el.src = url
      this.el.load()
    }
    if (this.el.readyState < 2) {
      await new Promise<void>((res, rej) => {
        const ok = () => { cleanup(); res() }
        const fail = () => { cleanup(); rej(new Error('媒体加载失败')) }
        const cleanup = () => {
          this.el.removeEventListener('canplay', ok)
          this.el.removeEventListener('loadedmetadata', ok)
          this.el.removeEventListener('error', fail)
        }
        this.el.addEventListener('canplay', ok)
        this.el.addEventListener('loadedmetadata', ok)
        this.el.addEventListener('error', fail)
        setTimeout(() => { cleanup(); res() }, 6000)
      })
    }
  }

  async play(): Promise<void> {
    return this.el.play()
  }
  pause(): void { this.el.pause() }

  /** Clamp to the real duration — a stream with no duration never seeks to 0. */
  seek(sec: number): void {
    const d = this.el.duration
    const max = isFinite(d) && d > 0 ? d : sec
    this.el.currentTime = Math.max(0, Math.min(max, sec))
  }

  get currentTime(): number { return this.el.currentTime }
  get duration(): number { return isFinite(this.el.duration) ? this.el.duration : 0 }

  /**
   * Stop any volume ramp in flight. A cancelled ramp is a *finished* ramp: the
   * crossfade awaits `rampVolume`, so dropping the promise here would leave the
   * track change waiting forever.
   */
  private cancelVolumeRamp(): void {
    cancelAnimationFrame(this.volRaf)
    const waiting = this.volResolve
    this.volResolve = null
    waiting?.()
  }

  /**
   * Ramp the element volume over `seconds`. Used for crossfade and for the
   * smooth volume glide; cancels any volume ramp already in flight.
   */
  rampVolume(target: number, seconds: number): Promise<void> {
    this.cancelVolumeRamp()
    const to = Math.max(0, Math.min(1, target))
    const from = this.el.volume
    if (seconds <= 0 || Math.abs(from - to) < 0.002) {
      this.el.volume = to
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      const t0 = performance.now()
      const dur = seconds * 1000
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur)
        this.el.volume = from + (to - from) * (p * (3 - 2 * p))
        if (p < 1) this.volRaf = requestAnimationFrame(step)
        else { this.volResolve = null; resolve() }
      }
      this.volResolve = resolve
      this.volRaf = requestAnimationFrame(step)
    })
  }

  /** Smoothly glide volume (Web Audio gain when available, element otherwise). */
  setVolume(target: number, smooth = true): void {
    this.cancelVolumeRamp()
    const from = this.el.volume
    const clamped = Math.max(0, Math.min(1, target))
    if (!smooth || Math.abs(from - clamped) < 0.005) {
      this.el.volume = clamped
      return
    }
    const t0 = performance.now()
    const dur = 160
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      this.el.volume = from + (clamped - from) * (p * (3 - 2 * p))
      if (p < 1) this.volRaf = requestAnimationFrame(step)
    }
    this.volRaf = requestAnimationFrame(step)
  }
}

export const audio = new AudioEngine()

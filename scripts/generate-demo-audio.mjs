/**
 * Nocturne demo music synthesizer.
 * Generates real, playable WAV tracks (22050 Hz / 16-bit / mono) entirely
 * procedurally — pads, bass, arpeggios, drums, piano — so the player ships
 * with a live demo library without any external assets.
 *
 * Run: node scripts/generate-demo-audio.mjs   (writes to public/demo/)
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 22050
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/demo')
mkdirSync(OUT, { recursive: true })

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- oscillators ----------
function osc(type, phase) {
  const p = ((phase % 1) + 1) % 1
  switch (type) {
    case 'sine': return Math.sin(2 * Math.PI * p)
    case 'triangle': return 4 * Math.abs(p - 0.5) - 1
    case 'saw': return 2 * p - 1
    case 'square': return p < 0.5 ? 1 : -1
    default: return 0
  }
}
// one-pole lowpass
function onepole(sig, cutoff) {
  const a = Math.exp(-2 * Math.PI * cutoff / SR)
  let z = 0
  const out = new Float32Array(sig.length)
  for (let i = 0; i < sig.length; i++) { z = a * z + (1 - a) * sig[i]; out[i] = z }
  return out
}
function envADSR(n, a, d, s, r, sus) {
  const out = new Float32Array(n)
  const an = Math.max(1, a * SR | 0), dn = Math.max(1, d * SR | 0), rn = Math.max(1, r * SR | 0)
  for (let i = 0; i < n; i++) {
    let v
    if (i < an) v = i / an
    else if (i < an + dn) v = 1 - (1 - s) * ((i - an) / dn)
    else v = s
    const ri = n - i
    if (ri < rn) v *= ri / rn
    out[i] = v
  }
  return out
}

// ---------- render helpers (mix into master buffer) ----------
function mix(buf, start, sig, gain) {
  const s = Math.max(0, start | 0)
  for (let i = 0; i < sig.length; i++) {
    const j = s + i
    if (j >= buf.length) break
    buf[j] += sig[i] * gain
  }
}
function voice(buf, { t, dur, freq, type = 'sine', gain = 0.2, attack = 0.01, release = 0.12, sustain = 0.8, detune = 0, vib = 0, lpf = 0 }) {
  const n = Math.max(1, Math.floor(dur * SR))
  const e = envADSR(n, attack, 0.05, sustain, release, sustain)
  const raw = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const dt = i / SR
    const f = freq * (detune ? 1 + detune * Math.sin(2 * Math.PI * 0.13 * dt) : 1)
    const vv = vib ? 1 + vib * Math.sin(2 * Math.PI * 5 * dt) : 1
    raw[i] = osc(type, f * vv * dt)
  }
  const sig = lpf > 0 ? onepole(raw, lpf) : raw
  for (let i = 0; i < n; i++) sig[i] *= e[i]
  mix(buf, t * SR, sig, gain)
}
function piano(buf, { t, dur, freq, gain = 0.2 }) {
  const n = Math.max(1, Math.floor(dur * SR))
  const sig = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const dt = i / SR
    const dec = Math.exp(-3.2 * dt)
    sig[i] = (Math.sin(2 * Math.PI * freq * dt)
      + 0.55 * Math.sin(2 * Math.PI * freq * 2 * dt) * Math.exp(-6 * dt)
      + 0.22 * Math.sin(2 * Math.PI * freq * 3.01 * dt) * Math.exp(-9 * dt)
      + 0.1 * Math.sin(2 * Math.PI * freq * 4.02 * dt) * Math.exp(-12 * dt)) * dec
  }
  mix(buf, t * SR, sig, gain)
}
function pad(buf, { t, dur, freqs, gain = 0.08, lpf = 2400 }) {
  const n = Math.floor(dur * SR)
  const raw = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const dt = i / SR
    let v = 0
    for (let k = 0; k < freqs.length; k++) {
      const f = freqs[k]
      v += osc('saw', f * dt) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.11 * dt + k * 2.1))
      v += osc('sine', f * 1.002 * dt)
    }
    raw[i] = v / (freqs.length * 1.6)
  }
  const sig = onepole(raw, lpf)
  const a = Math.min(1.2, dur * 0.3), r = Math.min(1.6, dur * 0.35)
  for (let i = 0; i < n; i++) {
    const dt = i / SR
    let e = 1
    if (dt < a) e = dt / a
    if (dur - dt < r) e = Math.min(e, (dur - dt) / r)
    sig[i] *= e
  }
  mix(buf, t * SR, sig, gain)
}
function kick(buf, t, gain = 0.5) {
  const n = Math.floor(0.28 * SR)
  const sig = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const dt = i / SR
    sig[i] = Math.sin(2 * Math.PI * (46 + 130 * Math.exp(-dt * 26)) * dt) * Math.exp(-dt * 11)
  }
  mix(buf, t * SR, sig, gain)
}
function snare(buf, t, gain = 0.28, rnd) {
  const n = Math.floor(0.22 * SR)
  const sig = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const dt = i / SR
    sig[i] = ((rnd() * 2 - 1) * 0.7 + 0.3 * Math.sin(2 * Math.PI * 185 * dt)) * Math.exp(-dt * 22)
  }
  mix(buf, t * SR, sig, gain)
}
function hat(buf, t, gain = 0.12, open = false, rnd) {
  const n = Math.floor((open ? 0.16 : 0.045) * SR)
  const sig = new Float32Array(n)
  let prev = 0
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1
    const hp = w - prev * 0.7 // cheap highpass
    prev = w
    sig[i] = hp * Math.exp(-(i / SR) * (open ? 26 : 65))
  }
  mix(buf, t * SR, sig, gain)
}
function echo(buf, delaySec, fb, mixAmt, maxSec) {
  const d = Math.floor(delaySec * SR)
  const end = Math.min(buf.length, Math.floor(maxSec * SR))
  for (let i = d; i < end; i++) buf[i] += buf[i - d] * fb * mixAmt
}

// ---------- scales & chords ----------
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
function chord(rootMidi, degrees, scale) {
  return degrees.map((d) => rootMidi + scale[d % scale.length] + 12 * Math.floor(d / scale.length))
}

// ---------- track compiler ----------
function renderTrack(spec) {
  const rnd = mulberry(spec.seed)
  const beat = 60 / spec.bpm
  const bar = beat * 4
  const scale = spec.scale === 'major' ? MAJOR : spec.scale === 'dorian' ? DORIAN : MINOR
  const totalBars = spec.bars
  const buf = new Float32Array(Math.ceil((totalBars * bar + 3) * SR))
  const root = spec.rootMidi

  // chord progression (i - VI - III - VII style degrees)
  const progs = spec.prog || [0, 5, 2, 6] // degree indices into scale (triads)
  const sections = {
    intro: 1, build: 2, main: Math.max(4, totalBars - 8), break: 2, outro: 2,
  }
  let barIdx = 0
  const sectionAt = (b) => {
    if (b < sections.intro) return 'intro'
    if (b < sections.intro + sections.build) return 'build'
    if (b < sections.intro + sections.build + sections.main) return 'main'
    if (b < totalBars - sections.outro - (spec.style === 'piano' ? 0 : sections.break)) return 'break'
    return 'outro'
  }

  for (let b = 0; b < totalBars; b++) {
    const t0 = b * bar
    const sec = sectionAt(b)
    const deg = progs[b % progs.length]
    const rootChord = chord(root + 12, [deg, deg + 2, deg + 4, deg + 6], scale) // add 7th
    const bassNote = rootChord[0] - 12

    // pad / harmony
    if (spec.style === 'ambient' || spec.style === 'lofi') {
      pad(buf, { t: t0, dur: bar * 1.05, freqs: rootChord.map(hz).slice(0, 4), gain: spec.style === 'ambient' ? 0.1 : 0.075, lpf: spec.style === 'ambient' ? 1500 : 2100 })
    } else if (spec.style === 'synth') {
      pad(buf, { t: t0, dur: bar * 0.98, freqs: rootChord.map(hz), gain: 0.055, lpf: 3000 })
    } else if (spec.style === 'piano') {
      rootChord.slice(0, 3).forEach((m, i) => piano(buf, { t: t0 + i * 0.012 + (sec === 'intro' ? 0 : beat * (i % 2)), dur: bar * 0.9, freq: hz(m + 12), gain: 0.09 }))
    }

    // bass
    if (sec !== 'intro' && spec.style !== 'piano') {
      const pattern = spec.style === 'synth'
        ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
        : spec.style === 'lofi' ? [0, 1.5, 2, 3.5] : [0, 2, 3]
      for (const p of pattern) {
        if (sec === 'break' && p % 1 !== 0) continue
        voice(buf, {
          t: t0 + p * beat, dur: beat * (spec.style === 'synth' ? 0.42 : 0.85),
          freq: hz(bassNote), type: spec.style === 'synth' ? 'saw' : 'sine',
          gain: spec.style === 'synth' ? 0.16 : 0.2, attack: 0.004, release: 0.08,
          sustain: 0.7, lpf: spec.style === 'synth' ? 700 : 0,
        })
      }
    }

    // drums
    if ((sec === 'main' || sec === 'build' || sec === 'break') && spec.style !== 'piano' && spec.style !== 'ambient') {
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat
        if (q === 0 || q === 2 || (spec.style === 'synth' && q === 3 && b % 4 === 3)) kick(buf, t, 0.5)
        if (q === 1 || q === 3) snare(buf, t, 0.2, rnd)
        hat(buf, t + beat / 2, 0.07, false, rnd)
        if (spec.style === 'synth') hat(buf, t, 0.05, false, rnd)
      }
    } else if (sec === 'main' && spec.style === 'ambient' && b % 2 === 0) {
      kick(buf, t0, 0.22)
    }

    // melody / arp
    const mel = spec.melody || 'arp'
    if (sec !== 'intro' || b % 2 === 1) {
      if (mel === 'arp') {
        const steps = spec.style === 'synth' ? 8 : 4
        for (let s = 0; s < steps; s++) {
          const t = t0 + s * (bar / steps)
          const idx = [0, 2, 4, 6, 4, 2, 5, 3][s % 8] + (b % 3 === 2 ? 1 : 0)
          const note = root + 24 + scale[idx % scale.length] + 12 * Math.floor(idx / scale.length)
          voice(buf, {
            t, dur: bar / steps * 0.9, freq: hz(note),
            type: spec.style === 'synth' ? 'square' : 'triangle',
            gain: sec === 'break' ? 0.05 : 0.075, attack: 0.008, release: 0.1,
            sustain: 0.55, lpf: 3500,
          })
        }
      } else if (mel === 'piano') {
        for (let q = 0; q < 4; q++) {
          if (rnd() < 0.28) continue
          const t = t0 + q * beat + (rnd() < 0.3 ? beat / 2 : 0)
          const idx = [0, 4, 2, 6, 1, 5][Math.floor(rnd() * 6)]
          const note = root + 24 + scale[idx % scale.length]
          piano(buf, { t, dur: beat * 1.8, freq: hz(note), gain: 0.13 })
          if (rnd() < 0.35) piano(buf, { t: t + beat / 2, dur: beat, freq: hz(note + 7), gain: 0.07 })
        }
      }
    }
  }

  // sparkle bells for ambient
  if (spec.style === 'ambient') {
    for (let i = 0; i < totalBars * 1.5; i++) {
      const t = rnd() * totalBars * bar
      const note = root + 36 + Math.floor(rnd() * 12)
      voice(buf, { t, dur: 1.6, freq: hz(note), type: 'sine', gain: 0.045, attack: 0.005, release: 1.4, sustain: 0.3 })
    }
  }

  echo(buf, beat * 0.75, 0.34, 0.35, totalBars * bar + 2)

  // master: normalize + soft clip + fades
  let peak = 1e-6
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]))
  const g = 0.82 / peak
  const fade = 1.2 * SR
  const out = new Int16Array(buf.length)
  for (let i = 0; i < buf.length; i++) {
    let v = Math.tanh(buf[i] * g * 1.25) * 0.92
    if (i < fade) v *= i / fade
    const tail = buf.length - i
    if (tail < fade) v *= tail / fade
    out[i] = Math.round(clamp(v, -1, 1) * 32767)
  }
  return out
}

function writeWav(path, pcm) {
  const dataLen = pcm.length * 2
  const h = new ArrayBuffer(44)
  const dv = new DataView(h)
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); ws(8, 'WAVE')
  ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  ws(36, 'data'); dv.setUint32(40, dataLen, true)
  writeFileSync(path, Buffer.concat([Buffer.from(h), Buffer.from(pcm.buffer)]))
}

// ---------- demo discography ----------
const TRACKS = [
  // Neon Tides — Aqua Lumen (cyan / blue)
  { file: 'neon-01.wav', title: 'Tidal Drift', bpm: 108, rootMidi: 57, scale: 'minor', style: 'synth', bars: 16, seed: 101, dur: null },
  { file: 'neon-02.wav', title: 'Midnight Current', bpm: 80, rootMidi: 55, scale: 'dorian', style: 'ambient', bars: 14, seed: 102 },
  { file: 'neon-03.wav', title: 'Glass Reef', bpm: 118, rootMidi: 52, scale: 'minor', style: 'synth', bars: 18, seed: 103 },
  { file: 'neon-04.wav', title: 'Undertow', bpm: 72, rootMidi: 50, scale: 'minor', style: 'ambient', bars: 12, seed: 104 },
  // Crimson Static — Vermilion Waves (red / orange)
  { file: 'crimson-01.wav', title: 'Ember Line', bpm: 88, rootMidi: 53, scale: 'minor', style: 'lofi', bars: 16, seed: 201 },
  { file: 'crimson-02.wav', title: 'Static Bloom', bpm: 112, rootMidi: 57, scale: 'major', style: 'synth', bars: 16, seed: 202 },
  { file: 'crimson-03.wav', title: 'Scarlet Noise', bpm: 76, rootMidi: 51, scale: 'dorian', style: 'ambient', bars: 14, seed: 203 },
  // Velvet Moon — Luna Sable (purple / pink)
  { file: 'velvet-01.wav', title: 'Velvet Hours', bpm: 82, rootMidi: 56, scale: 'dorian', style: 'lofi', bars: 16, seed: 301 },
  { file: 'velvet-02.wav', title: 'Moonlit Arcade', bpm: 104, rootMidi: 54, scale: 'minor', style: 'synth', bars: 16, seed: 302 },
  { file: 'velvet-03.wav', title: 'Lilac Static', bpm: 70, rootMidi: 49, scale: 'minor', style: 'ambient', bars: 13, seed: 303 },
  { file: 'velvet-04.wav', title: 'Nocturne in Amethyst', bpm: 66, rootMidi: 57, scale: 'minor', style: 'piano', bars: 15, seed: 304 },
  // Monochrome — Glass Atlas (silver / white)
  { file: 'mono-01.wav', title: 'Silver Circuit', bpm: 116, rootMidi: 59, scale: 'major', style: 'synth', bars: 16, seed: 401 },
  { file: 'mono-02.wav', title: 'Porcelain', bpm: 72, rootMidi: 60, scale: 'major', style: 'piano', bars: 14, seed: 402 },
  // Fern Circuit — Moss Signal (green)
  { file: 'fern-01.wav', title: 'Chlorophyll', bpm: 86, rootMidi: 55, scale: 'dorian', style: 'lofi', bars: 16, seed: 501 },
  { file: 'fern-02.wav', title: 'Rainforest Data', bpm: 74, rootMidi: 50, scale: 'minor', style: 'ambient', bars: 14, seed: 502 },
]

let total = 0
for (const t of TRACKS) {
  const pcm = renderTrack(t)
  const path = join(OUT, t.file)
  writeWav(path, pcm)
  const mb = (pcm.length * 2 / 1048576).toFixed(1)
  total += pcm.length * 2
  console.log(`${t.file}  ${(pcm.length / SR).toFixed(1)}s  ${mb} MB  (${t.style} ${t.bpm}bpm)`)
}
console.log(`Total: ${(total / 1048576).toFixed(1)} MB — ${TRACKS.length} tracks`)

import type { Album, Artist, Palette, Song } from '../types/models'
import { hashStr } from '../lib/rand'
import { lyricLines } from '../lib/lrc'
import type { LyricLine } from '../types/models'

interface DemoTrack { file: string; title: string; dur: number; lrc: Array<[number, string]> }
interface DemoAlbum {
  id: string; name: string; artist: string; year: number; genre: string
  cover: string; palette: Palette; tracks: DemoTrack[]
}

// Palettes are pre-computed from the shipped SVG covers; imported artwork
// falls back to runtime extraction (see lib/color.ts).
export const DEMO_ALBUMS: DemoAlbum[] = [
  {
    id: 'al_neon', name: 'Neon Tides', artist: 'Aqua Lumen', year: 2024, genre: 'Synthwave',
    cover: '/covers/neon-tides.svg',
    palette: { primary: '#38c7f0', accent: '#8ef2ff', glow: 'rgba(56,199,240,0.4)', deep: '#020c1e', deep2: '#04213f', soft: '#0a3358' },
    tracks: [
      {
        file: 'neon-01.wav', title: 'Tidal Drift', dur: 38.6,
        lrc: [[3, 'Tides carry the city light'], [8.5, 'Reflections on an endless shore'], [14, 'We drift where the neon glows'], [19.5, 'Currents pulling through the night'], [25, 'Hold on to the silver sound'], [30.5, 'The ocean hums in electric blue']],
      },
      {
        file: 'neon-02.wav', title: 'Midnight Current', dur: 45.0,
        lrc: [[4, 'Midnight moves beneath the waves'], [10, 'A current born of quiet storms'], [16.5, 'Every star becomes a stream'], [23, 'Every heartbeat finds its form'], [30, 'Let the deep blue take me home'], [37, 'Where the silence learns to flow']],
      },
      {
        file: 'neon-03.wav', title: 'Glass Reef', dur: 39.6,
        lrc: [[3, 'Coral built from shattered light'], [8, 'A reef of glass beneath the sky'], [14, 'We swim through emerald beams'], [20, 'Trading shadows for the gleam'], [26, 'Brighter now the waters turn'], [32, 'Even dusk begins to burn']],
      },
      {
        file: 'neon-04.wav', title: 'Undertow', dur: 43.0,
        lrc: [[5, 'Something pulls me under softly'], [12, 'A weight that feels like floating down'], [19, 'The undertow of memory'], [26, 'Wrapped in waves of fading sound'], [33, 'If I sink, I sink in color'], [39, 'Blue on blue on blue']],
      },
    ],
  },
  {
    id: 'al_crimson', name: 'Crimson Static', artist: 'Vermilion Waves', year: 2023, genre: 'Electronica',
    cover: '/covers/crimson-static.svg',
    palette: { primary: '#ff6a3a', accent: '#ffb46b', glow: 'rgba(255,106,58,0.4)', deep: '#1a0308', deep2: '#3c0910', soft: '#571016' },
    tracks: [
      {
        file: 'crimson-01.wav', title: 'Ember Line', dur: 46.6,
        lrc: [[4, 'Draw a line across the dark'], [10, 'Strike a match against the cold'], [17, 'Every ember knows my name'], [24, 'Every spark a story told'], [32, 'Burn the map, we walk by glow'], [40, 'Where the quiet embers go']],
      },
      {
        file: 'crimson-02.wav', title: 'Static Bloom', dur: 37.3,
        lrc: [[3, 'Static blooming on the screen'], [8.5, 'Petals made of broken light'], [14, 'A garden growing out of noise'], [19.5, 'Loud and tender, red and bright'], [25, 'Turn the dial, the flowers sing'], [30.5, 'Everything in its own key']],
      },
      {
        file: 'crimson-03.wav', title: 'Scarlet Noise', dur: 47.2,
        lrc: [[5, 'Scarlet falling like a signal'], [12, 'A wavelength wearing evening red'], [19, 'All the noise becomes a lullaby'], [26, 'All the colors softly spread'], [34, 'Rest here while the signal fades'], [41, 'Scarlet turning into shade']],
      },
    ],
  },
  {
    id: 'al_velvet', name: 'Velvet Moon', artist: 'Luna Sable', year: 2025, genre: 'Dream Pop',
    cover: '/covers/velvet-moon.svg',
    palette: { primary: '#b07aff', accent: '#ff9ad5', glow: 'rgba(176,122,255,0.4)', deep: '#120822', deep2: '#2a1148', soft: '#3b1a60' },
    tracks: [
      {
        file: 'velvet-01.wav', title: 'Velvet Hours', dur: 49.8,
        lrc: [[5, 'These are the velvet hours'], [11, 'Soft hours, slow hours'], [17.5, 'Moonlight on the window ledge'], [24, 'Dreaming on a silver edge'], [31.5, 'Stay until the colors change'], [39, 'Velvet never asks for more'], [45, 'Velvet only wants the night']],
      },
      {
        file: 'velvet-02.wav', title: 'Moonlit Arcade', dur: 39.9,
        lrc: [[3, 'Coin-operated stars above'], [8.5, 'The arcade hums in lavender'], [14, 'We play the night like one more round'], [19.5, 'Chasing jackpots never found'], [25, 'One more game before the dawn'], [30.5, 'High scores glowing, then gone']],
      },
      {
        file: 'velvet-03.wav', title: 'Lilac Static', dur: 47.6,
        lrc: [[5, 'Lilac static on the air'], [12, 'A broadcast from a quieter time'], [19, 'Tune until the noise is kind'], [26, 'Tune until the bells all chime'], [34, 'Somewhere in the purple hum'], [41, 'A voice that sounds like coming home']],
      },
      {
        file: 'velvet-04.wav', title: 'Violet Reverie', dur: 57.5,
        lrc: [[4, 'A melody drawn in amethyst'], [11, 'Notes like ink upon the dark'], [18.5, 'The piano breathes in violet'], [26, 'Every rest a sleeping spark'], [34.5, 'Play me slowly, play me true'], [43, 'Let the last chord linger blue'], [51, 'Let the night remember you']],
      },
    ],
  },
  {
    id: 'al_mono', name: 'Monochrome', artist: 'Glass Atlas', year: 2022, genre: 'Minimal Wave',
    cover: '/covers/monochrome.svg',
    palette: { primary: '#c9ced6', accent: '#f5f7fa', glow: 'rgba(201,206,214,0.35)', deep: '#08090b', deep2: '#17181d', soft: '#26272e' },
    tracks: [
      {
        file: 'mono-01.wav', title: 'Silver Circuit', dur: 36.1,
        lrc: [[3, 'Silver running through the wire'], [8, 'A current dressed in chrome and gray'], [13.5, 'We ride the line between the tones'], [19, 'Black and white and back again'], [24.5, 'Every shade of almost light'], [30, 'Silver circuit, perfect night']],
      },
      {
        file: 'mono-02.wav', title: 'Porcelain', dur: 49.7,
        lrc: [[5, 'Porcelain against the dark'], [12, 'A white that almost makes a sound'], [19, 'Hold it gently, hold it long'], [26, 'Everything that cracks is crowned'], [34.5, 'Quiet as a museum room'], [42, 'Porcelain in afternoon']],
      },
    ],
  },
  {
    id: 'al_fern', name: 'Fern Circuit', artist: 'Moss Signal', year: 2024, genre: 'Chillout',
    cover: '/covers/fern-circuit.svg',
    palette: { primary: '#4ade80', accent: '#a5ffcf', glow: 'rgba(74,222,128,0.4)', deep: '#021009', deep2: '#07301b', soft: '#0c4527' },
    tracks: [
      {
        file: 'fern-01.wav', title: 'Chlorophyll', dur: 47.7,
        lrc: [[4, 'Green is how the forest thinks'], [10.5, 'Leaves converting light to song'], [17.5, 'Signal rising through the stem'], [24.5, 'All the roots reply in turn'], [32, 'Breathe the way the canopy does'], [40, 'Slow and green and infinite']],
      },
      {
        file: 'fern-02.wav', title: 'Rainforest Data', dur: 48.4,
        lrc: [[5, 'Rain becomes a kind of code'], [12, 'Drip by drip the message forms'], [19.5, 'Ferns decoding every drop'], [27, 'Weather singing to the worms'], [35, 'Transmit sweet and low forever'], [42, 'The forest never sleeps']],
      },
    ],
  },
]

export interface DemoLibrary { songs: Song[]; albums: Album[]; artists: Artist[] }

/** Build the full demo library (fresh copy per user). */
export function buildDemoLibrary(): DemoLibrary {
  const songs: Song[] = []
  const albums: Album[] = []
  const artists = new Map<string, Artist>()

  for (const da of DEMO_ALBUMS) {
    const albumId = da.id
    const songIds: string[] = []
    da.tracks.forEach((t, i) => {
      const sid = `song_${da.id}_${i + 1}`
      songIds.push(sid)
      songs.push({
        id: sid,
        title: t.title,
        artist: da.artist,
        albumId,
        albumArtist: da.artist,
        genre: da.genre,
        year: da.year,
        track: i + 1,
        disc: 1,
        duration: t.dur,
        url: `/demo/${t.file}`,
        source: 'demo',
        coverUrl: da.cover,
        playCount: 0,
        addedAt: Date.now() - (DEMO_ALBUMS.length - DEMO_ALBUMS.indexOf(da)) * 86400000,
      })
    })
    const album: Album = {
      id: albumId,
      name: da.name,
      artist: da.artist,
      albumArtist: da.artist,
      year: da.year,
      genre: da.genre,
      coverUrl: da.cover,
      palette: da.palette,
      songIds,
      letter: da.name[0].toUpperCase(),
      source: 'demo',
      addedAt: songs[0]?.addedAt ?? Date.now(),
    }
    albums.push(album)
    const artId = `ar_${hashStr(da.artist).toString(36)}`
    const art = artists.get(artId) ?? { id: artId, name: da.artist, albumIds: [], songIds: [], letter: da.artist[0].toUpperCase() }
    art.albumIds.push(albumId)
    art.songIds.push(...songIds)
    artists.set(artId, art)
  }

  return { songs, albums, artists: [...artists.values()] }
}

/** Demo lyrics lookup by song id. */
const LRC_BY_FILE = new Map<string, LyricLine[]>()
for (const da of DEMO_ALBUMS) for (const t of da.tracks) LRC_BY_FILE.set(`/demo/${t.file}`, lyricLines(t.lrc))

export function demoLyricsFor(url: string): LyricLine[] | undefined {
  return LRC_BY_FILE.get(url)
}

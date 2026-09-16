// ─── MH Music data model ────────────────────────────────────────────────────
// Every persisted entity is namespaced under a userId (multi-user isolation).

export type SourceKind = 'demo' | 'fs' | 'upload'

export interface Palette {
  primary: string   // main accent
  accent: string    // secondary highlight
  glow: string      // rgba glow
  deep: string      // darkest background
  deep2: string     // mid background
  soft: string      // soft surface tint
}

export interface AlbumLayout {
  x: number; y: number; z: number
  rx: number; ry: number; rz: number
  scale: number; shadow: number; depth: number; reflection: number
}

export interface Song {
  id: string
  title: string
  artist: string
  albumId: string
  albumArtist?: string
  genre?: string
  year?: number
  track?: number
  disc?: number
  duration: number
  url: string            // demo: /demo/x.wav · fs: blob: URL (session) · upload: blob:
  source: SourceKind
  folderId?: string
  path?: string          // relative path inside folder (fs)
  coverUrl: string
  playCount: number
  addedAt: number
  lrc?: LyricLine[]     // parsed synced lyrics (demo embeds these; folders provide .lrc)
}

export interface Album {
  id: string             // stable: hash(albumArtist|artist + name)
  name: string
  artist: string
  albumArtist?: string
  year?: number
  genre?: string
  coverUrl: string
  palette: Palette
  songIds: string[]
  letter: string
  source: SourceKind
  addedAt: number
}

export interface Artist {
  id: string
  name: string
  albumIds: string[]
  songIds: string[]
  letter: string
}

export interface Playlist {
  id: string
  name: string
  description?: string
  songIds: string[]
  createdAt: number
  /** artwork the user chose for this playlist; falls back to the first track's */
  coverUrl?: string
}

export interface MusicFolder {
  id: string
  name: string
  kind: 'fsapi' | 'upload'
  fileCount: number
  addedAt: number
}

export interface LyricLine { time: number; text: string; tr?: string }

export interface HistoryEntry { songId: string; at: number }

export interface LyricsSettings {
  size: number        // px
  opacity: number     // 0..1
  lines: number       // visible lines 1..7
  align: 'left' | 'center' | 'right'
  mode: 'floating' | 'centered' | 'bottom'
  side: 'center' | 'left' | 'right'   // where the lyric column sits in the room
  motion: 'fade' | 'slide' | 'blur' | 'scale'   // how a line changes over
  translation: boolean // show the translation under the sung line
  showNext: boolean    // show the line that comes next
  gap: number         // px between lines
  highlight: string   // highlight color
  speed: number       // 0.5..2 animation speed multiplier
  animate: boolean    // karaoke word-by-word fill on the current line
  offset: number      // seconds; positive shows lyrics that much earlier than the file's timestamps
}

export type ThemeMode = 'dynamic' | 'dark' | 'black' | 'midnight' | 'glass' | 'aurora' | 'sunset'
/** Where the visualiser's colours come from. */
export type ParticleColor = 'random' | 'album'
/** The eight visualiser modes. `terrain` is the one the player opens on. */
export type VisualizerMode =
  | 'terrain'      // 3D Terrain — the block landscape
  | 'waveform'     // Classic Waveform
  | 'circular'     // Circular Spectrum
  | 'particles'    // Particles
  | 'vinylWave'    // Vinyl Wave
  | 'galaxy'       // Galaxy
  | 'aurora'       // Aurora
  | 'minimal'      // Minimal
/** How much of the visual budget the device is asked for. */
export type PerfMode = 'high' | 'balanced' | 'performance'
/** Browsing surfaces can be shown as the 3D stage or as a plain list. */
export type ViewMode = 'stage' | 'list'
export type ViewPage = 'albums' | 'artists' | 'songs' | 'favorites'
/** Player background treatments — the eight from the spec. `deep` is the
 *  default: a dark room the music landscape is raised out of. */
export type BgMode =
  | 'deep'         // Standard
  | 'glass'        // Glass
  | 'gradient'     // Gradient
  | 'starry'       // Starry Sky
  | 'sunset'       // Sunset
  | 'spatial'      // 3D Space
  | 'vinyl'        // Vinyl Room
  | 'dynamic'      // Dynamic
/** How finely the music landscape is resolved. */
export type ParticleDensity = 'low' | 'medium' | 'high' | 'ultra'
/** Exactly one playback mode is active at a time. */
export type PlayMode = 'sequential' | 'shuffle' | 'repeat-one' | 'repeat-all'

/** Everything the user can tune about the visuals. */
export interface VisualSettings {
  density: ParticleDensity   // how many particles to ask for
  sensitivity: number        // 0..1 — how hard the analysis drives the visuals
  beatResponse: number       // 0..1 — how eagerly beats are detected
  vinylSize: number          // 0.5..2 — the record's scale in the player
  bgOpacity: number          // 0..1 — how strongly the room shows through
  glassBlur: number          // 0..1 — how strong the liquid-glass blur is
  glow: number               // 0..1 — how much light the interface throws
  darkness: number           // 0..1 — how far the room is pushed down
  depth: number              // 0..1 — the 3D depth of the album stage
  perf: PerfMode             // High quality · Balanced · Performance
}

/** Connection settings for the NetEase Cloud Music adapter. The AppSecret and
 *  the RSA private key must never live here — they belong on the backend that
 *  this endpoint points at. The browser only ever talks to that backend. */
export interface NeteaseConfig {
  appId: string
  /** your own server, for the REST track */
  endpoint: string
  /** the open platform's browser SDK, for the web track */
  sdkUrl: string
  strategy: 'jssdk' | 'backend' | 'none'
  enabled: boolean
}

export interface Settings {
  theme: ThemeMode
  dynamicColors: boolean
  animations: boolean
  ambientStage: boolean      // starfield · molecule network · beat ripples
  streetTexture: boolean     // halftone spray · stencil marks · tape
  skipIntro: boolean
  volume: number
  crossfade: number          // seconds; 0 = off
  smoothVolume: boolean
  lyrics: LyricsSettings
  particleColor: ParticleColor
  visualizerMode: VisualizerMode
  netease: NeteaseConfig
  bgMode: BgMode
  visual: VisualSettings
  /** per-page: 3D stage or plain list, remembered across sessions */
  viewModes: Record<ViewPage, ViewMode>
  layouts: { global: AlbumLayout; perAlbum: Record<string, AlbumLayout> }
}

export type ToastKind = 'info' | 'success' | 'error'
export interface Toast { id: number; kind: ToastKind; message: string }

export type ViewID =
  | 'home' | 'browse' | 'albums' | 'artists' | 'songs' | 'playlists'
  | 'favorites' | 'recent' | 'folders' | 'import' | 'visualizer' | 'settings'
  | 'album' | 'artist' | 'playlist'

export interface ViewParams { albumId?: string; artistId?: string; playlistId?: string }

export interface CtxItem {
  label?: string
  icon?: string
  danger?: boolean
  disabled?: boolean
  sep?: boolean
  action?: () => void
  submenu?: CtxItem[]
}

export interface ScanState { active: boolean; done: number; total: number; current: string; folderName: string }

export interface StoredUser { id: string; name: string; email: string; salt: string; hash: string; createdAt: number }
export interface PublicUser { id: string; name: string; email: string; createdAt: number }
export interface Session { uid: string; token: string }

export interface QueueItem { songId: string; from: string }

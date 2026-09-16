import { useRef, useState } from 'react'
import { useLibraryStore } from '../stores/library'
import { useUiStore } from '../stores/ui'
import { pushPath } from '../app/router'
import { GlassPanel, GlassButton } from '../components/glass/GlassPanel'
import { IconImport, IconCheck, IconFolder } from '../components/icons'
import type { ImportEntry } from '../services/importer'

/**
 * Import — bring a playlist in from another player.
 *
 * Browsers cannot read another app's private database, so this reads the file
 * every player can export: JSON, M3U/M3U8 and CSV. Entries are matched against
 * the local library by title/artist/album; anything unmatched is reported as a
 * missing track and *kept in the report* rather than silently dropped.
 */

const SUPPORTED = [
  { ext: 'JSON', hint: 'Spotify-style or generic dumps: name, artist, album, tracks[]' },
  { ext: 'M3U / M3U8', hint: 'Plain or extended playlists, with #EXTINF metadata' },
  { ext: 'CSV', hint: 'Comma or semicolon separated: title, artist, album' },
]

export function ImportPage() {
  const importPlaylistFile = useLibraryStore((s) => s.importPlaylistFile)
  const playlists = useLibraryStore((s) => s.playlists)
  const navigate = useUiStore((s) => s.navigate)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [report, setReport] = useState<{ name: string; matched: number; unmatched: ImportEntry[] } | null>(null)

  const run = async (file: File) => {
    setBusy(true)
    setReport(null)
    try {
      const name = file.name.replace(/\.[^.]+$/, '')
      const res = await importPlaylistFile(file, name)
      setReport({ name, matched: res.matched, unmatched: res.unmatched })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-6">
      <header className="pl-1">
        <h1 className="mh-display text-[30px] md:text-[36px]">Import a playlist</h1>
        <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
          Export the playlist from the other player, then drop the file here. Tracks that exist in your
          library are matched and added; anything missing is listed so you can see exactly what did not land.
          Nothing leaves this device.
        </p>
      </header>

      <GlassPanel
        tier="soft"
        className="mt-6 rounded-3xl p-6 transition-colors"
        // the drop target is the whole panel, and it says so when a file is over it
        {...{
          onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragging(true) },
          onDragLeave: () => setDragging(false),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault(); setDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f) void run(f)
          },
        }}
      >
        <div
          className="grid place-items-center rounded-2xl border border-dashed px-6 py-10 text-center"
          style={{
            borderColor: dragging ? 'var(--c-accent-2)' : 'var(--mh-hairline)',
            background: dragging ? 'var(--c-tint)' : 'transparent',
          }}
        >
          <IconImport size={26} />
          <p className="mt-3 text-[14px] font-medium">
            {busy ? 'Reading the playlist…' : 'Drop the playlist file here'}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>JSON · M3U · M3U8 · CSV</p>
          <div className="mt-4">
            <GlassButton variant="accent" onClick={() => inputRef.current?.click()} disabled={busy}>
              Choose file
            </GlassButton>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.m3u,.m3u8,.csv,text/plain,application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); e.target.value = '' }}
            aria-label="Playlist file"
          />
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-3">
          {SUPPORTED.map((f) => (
            <li key={f.ext} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="mh-mono text-[11.5px] font-semibold tracking-wide">{f.ext}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>{f.hint}</div>
            </li>
          ))}
        </ul>
      </GlassPanel>

      {report && (
        <GlassPanel tier="glass" className="mt-5 rounded-3xl p-5">
          <div className="flex flex-wrap items-center gap-2">
            <IconCheck size={16} />
            <strong className="text-[14px]">{report.name}</strong>
            <span className="text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
              {report.matched} matched{report.unmatched.length ? ` · ${report.unmatched.length} missing` : ''}
            </span>
            <span className="ml-auto flex gap-2">
              <GlassButton onClick={() => { navigate('playlists'); pushPath('/playlists') }}>
                Open playlists
              </GlassButton>
            </span>
          </div>

          {report.unmatched.length > 0 && (
            <>
              <p className="mt-4 text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>
                Missing tracks — kept in the report, never deleted. Add the files and import again to match them.
              </p>
              <ul className="mt-2 max-h-[240px] space-y-1 overflow-y-auto pr-1">
                {report.unmatched.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{e.title || 'Untitled'}</span>
                    <span className="shrink-0 truncate text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>
                      {[e.artist, e.album].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </GlassPanel>
      )}

      {playlists.length > 0 && (
        <p className="mt-5 pl-1 text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>
          You already have {playlists.length} playlist{playlists.length === 1 ? '' : 's'}.{' '}
          <button className="underline" onClick={() => { navigate('folders'); pushPath('/folders') }}>
            Add a music folder
          </button>{' '}
          to match more of an import.
        </p>
      )}

      <div className="mt-6 flex items-center gap-2 pl-1">
        <IconFolder size={15} />
        <button className="text-[12.5px] underline" onClick={() => { navigate('folders'); pushPath('/folders') }}>
          Manage music folders
        </button>
      </div>
    </div>
  )
}

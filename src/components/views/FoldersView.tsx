import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useLibraryStore } from '../../stores/library'
import { useUiStore, toast } from '../../stores/ui'
import { EmptyState, SectionTitle, GlassButton } from './shared'
import { confirmRemoveFolder } from '../confirmActions'
import { supportsFS } from '../../lib/idb'
import { IconFolder, IconPlus, IconRefresh, IconTrash, IconImport } from '../icons'

export function FoldersView() {
  const lib = useLibraryStore()
  const ui = useUiStore()
  const addFolderFS = useLibraryStore((s) => s.addFolderFS)
  const addFolderUpload = useLibraryStore((s) => s.addFolderUpload)
  const [importOpen, setImportOpen] = useState(false)
  const dirInput = useRef<HTMLInputElement | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const lrcInput = useRef<HTMLInputElement | null>(null)

  return (
    <div className="mx-auto max-w-[900px]">
      <SectionTitle
        title="Music Folders"
        hint="Scan local folders — MP3 · FLAC · WAV · AAC · M4A · OGG"
        action={
          <div className="flex flex-wrap gap-2.5">
            {supportsFS && (
              <GlassButton primary onClick={() => addFolderFS()}>
                <span className="flex items-center gap-2"><IconPlus size={13} /> Add Folder</span>
              </GlassButton>
            )}
            <GlassButton primary={!supportsFS} onClick={() => dirInput.current?.click()}>
              <span className="flex items-center gap-2"><IconFolder size={13} /> Pick Directory</span>
            </GlassButton>
            <GlassButton onClick={() => fileInput.current?.click()}>Add Files</GlassButton>
            <GlassButton onClick={() => setImportOpen((v) => !v)}>
              <span className="flex items-center gap-2"><IconImport size={13} /> Import Playlist</span>
            </GlassButton>
          </div>
        }
      />

      <input
        ref={dirInput}
        type="file"
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && addFolderUpload(e.target.files)}
        aria-hidden="true"
      />
      <input
        ref={fileInput}
        type="file"
        accept=".mp3,.flac,.wav,.aac,.m4a,.ogg,.opus,.oga,audio/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && addFolderUpload(e.target.files)}
        aria-hidden="true"
      />
      <ImportPanel open={importOpen} onClose={() => setImportOpen(false)} />

      {lib.folders.length === 0 ? (
        <EmptyState
          icon={<IconFolder size={30} />}
          title="No folders added."
          hint="Point MH Music at a folder of music. Tags, artwork and durations are read right in your browser — files never leave this device."
        />
      ) : (
        <div className="space-y-3">
          {lib.folders.map((folder) => {
            const songCount = lib.songs.filter((s) => s.folderId === folder.id).length
            return (
              <motion.div
                key={folder.id}
                layout
                className="glass-soft flex items-center gap-4 rounded-2xl p-4"
              >
                <div className="vinyl grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: 'radial-gradient(circle, #16181d, #0a0b0e)' }}>
                  <IconFolder size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{folder.name}</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>
                    {folder.kind === 'fsapi' ? 'Linked folder' : 'Uploaded files'} · {songCount} tracks
                  </div>
                </div>
                {folder.kind === 'fsapi' && (
                  <button className="icon-btn h-9 w-9" onClick={() => lib.rescanFolder(folder.id)} aria-label={`Rescan ${folder.name}`}>
                    <IconRefresh size={16} />
                  </button>
                )}
                <button
                  className="icon-btn h-9 w-9 hover:text-[#ff9a8a]"
                  onClick={() => confirmRemoveFolder(folder, songCount)}
                  aria-label={`Remove ${folder.name}`}
                >
                  <IconTrash size={16} />
                </button>
              </motion.div>
            )
          })}
          <p className="px-2 pt-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
            Folder links are remembered per browser. After a reload, press Rescan to restore playback URLs
            (the browser will ask for permission once). Same-album tracks are merged automatically.
          </p>
        </div>
      )}
      <div className="h-10" />
    </div>
  )
}

function ImportPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importPlaylistFile = useLibraryStore((s) => s.importPlaylistFile)
  const ui = useUiStore()
  const [busy, setBusy] = useState(false)
  const lrcRef = useRef<HTMLInputElement | null>(null)

  return (
    <motion.div
      initial={false}
      animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
      className="glass-soft mb-6 overflow-hidden rounded-2xl"
    >
      <div className="p-4">
        <div className="text-[13.5px] font-medium">Import a playlist from another music app</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
          Supports JSON, M3U / M3U8 and CSV exports. Tracks are matched against your local library
          (fuzzy title + artist). Unmatched entries are listed so you can add them manually.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <input
            ref={lrcRef}
            type="file"
            accept=".json,.m3u,.m3u8,.csv,text/plain"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy(true)
              try {
                const name = file.name.replace(/\.(json|m3u8?|csv)$/i, '')
                const res = await importPlaylistFile(file, name)
                toast('success', `Playlist imported successfully — ${res.matched} matched${res.unmatched.length ? `, ${res.unmatched.length} not found` : ''}.`)
                if (res.unmatched.length) {
                  console.info('Unmatched import entries:', res.unmatched)
                }
                ui.navigate('playlists')
              } catch (ex: any) {
                toast('error', ex.message ?? 'Playlist import failed.')
              } finally {
                setBusy(false)
                if (lrcRef.current) lrcRef.current.value = ''
              }
            }}
            aria-hidden="true"
          />
          <button className="lg-btn px-4 py-2 text-[12.5px]" disabled={busy} onClick={() => lrcRef.current?.click()}>
            {busy ? 'Importing…' : 'Choose file'}
          </button>
          <button className="text-[12px] underline-offset-2 hover:underline" style={{ color: 'var(--c-ink-faint)' }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </motion.div>
  )
}

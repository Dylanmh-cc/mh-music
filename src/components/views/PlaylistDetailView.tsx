import { useMemo, useRef, useState } from 'react'
import { Reorder } from 'framer-motion'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore, toast } from '../../stores/ui'
import { EmptyState, GlassButton } from './shared'
import { SongRow } from './shared'
import { confirmDeletePlaylist, confirmRemoveFromPlaylist } from '../confirmActions'
import { IconList, IconPlay, IconShuffle, IconEdit, IconTrash, IconClose, IconCheck, IconSearch, IconPlus } from '../icons'
import { fmtTime, cn } from '../../lib/format'
import { shuffle } from '../../lib/rand'
import { fileToPlaylistCover } from '../../lib/playlistCover'

export function PlaylistDetailView() {
  const playlistId = useUiStore((s) => s.params.playlistId)
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const ui = useUiStore()
  const libActions = useLibraryStore()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const coverInput = useRef<HTMLInputElement | null>(null)

  const pl = lib.playlists.find((p) => p.id === playlistId)
  const songs = useMemo(
    () => (pl ? pl.songIds.map((id) => lib.getSong(id)!).filter(Boolean) : []),
    [pl, lib],
  )

  // the pickable library: everything not already in this playlist
  const candidates = useMemo(() => {
    if (!pl) return []
    const inList = new Set(pl.songIds)
    const q = query.trim().toLowerCase()
    return lib.songs
      .filter((s) => !inList.has(s.id))
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.albumArtist ?? '').toLowerCase().includes(q))
      .slice(0, 60)
  }, [pl, lib.songs, query])

  if (!pl) return <EmptyState title="Playlist not found." />

  const pickCover = async (file: File | undefined) => {
    if (!file) return
    try {
      libActions.setPlaylistCover(pl.id, await fileToPlaylistCover(file))
      toast('success', 'Playlist cover updated.')
    } catch {
      toast('error', 'That image could not be read.')
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-8 flex flex-wrap items-end gap-6">
        {/* the artwork: the user's own image when they have chosen one,
            otherwise a mosaic of the first four tracks */}
        <div className="group relative h-[150px] w-[150px] shrink-0">
          <button
            className="glass-soft block h-full w-full overflow-hidden rounded-2xl"
            onClick={() => coverInput.current?.click()}
            aria-label="Change playlist cover"
            title="Change playlist cover"
          >
            {pl.coverUrl ? (
              <img src={pl.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
                {songs.slice(0, 4).map((s) => <img key={s.id} src={s.coverUrl} alt="" className="h-full w-full object-cover" />)}
                {songs.length === 0 && <span className="col-span-2 row-span-2 grid place-items-center"><IconList size={26} /></span>}
              </span>
            )}
            <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/55 text-[12px] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Change cover
            </span>
          </button>
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { void pickCover(e.target.files?.[0]); e.target.value = '' }}
            aria-label="Playlist cover image"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-[0.3em]" style={{ color: 'var(--c-ink-faint)' }}>Playlist</div>
          {editing ? (
            <form
              className="mt-1 flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); libActions.renamePlaylist(pl.id, draftName); setEditing(false) }}
            >
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="rounded-xl bg-white/8 px-3 py-1.5 text-[26px] font-bold outline-none"
                aria-label="Playlist name"
              />
              <button type="submit" className="icon-btn h-9 w-9" aria-label="Save name"><IconCheck size={16} /></button>
              <button type="button" className="icon-btn h-9 w-9" onClick={() => setEditing(false)} aria-label="Cancel"><IconClose size={16} /></button>
            </form>
          ) : (
            <h1 className="mt-1 text-[28px] font-bold tracking-tight">{pl.name}</h1>
          )}
          <p className="mt-1 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>
            {songs.length} tracks · {fmtTime(songs.reduce((a, s) => a + s.duration, 0))}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className="lg-btn lg-btn-primary flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold" disabled={!songs.length} onClick={() => player.playSong(pl.songIds[0], pl.songIds, pl.name)}>
              <IconPlay size={13} /> Play
            </button>
            <GlassButton primary={adding} onClick={() => setAdding((v) => !v)}>
              <span className="flex items-center gap-2"><IconPlus size={13} /> Add songs</span>
            </GlassButton>
            <GlassButton disabled={!songs.length} onClick={() => {
              const list = shuffle(songs)
              player.playSong(list[0].id, list.map((s) => s.id), pl.name + ' shuffle')
              if (!player.shuffle) player.toggleShuffle()
            }}>
              <span className="flex items-center gap-2"><IconShuffle size={13} /> Shuffle</span>
            </GlassButton>
            <GlassButton onClick={() => { setDraftName(pl.name); setEditing(true) }}>
              <span className="flex items-center gap-2"><IconEdit size={13} /> Rename</span>
            </GlassButton>
            {pl.coverUrl && (
              <GlassButton onClick={() => { libActions.setPlaylistCover(pl.id, undefined); toast('info', 'Cover reset to the tracks.') }}>
                Reset cover
              </GlassButton>
            )}
            <GlassButton onClick={() => confirmDeletePlaylist(pl, () => ui.navigate('playlists'))}>
              <span className="flex items-center gap-2 text-[#ff9a8a]"><IconTrash size={13} /> Delete</span>
            </GlassButton>
          </div>
        </div>
      </div>

      {/* the picker: any track in the library that is not already in here */}
      {adding && (
        <div className="glass-soft mb-6 rounded-2xl p-4">
          <div className="flex items-center gap-2.5">
            <IconSearch size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your library to add…"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
              aria-label="Search songs to add"
            />
            <button className="icon-btn h-8 w-8" onClick={() => setAdding(false)} aria-label="Close the picker"><IconClose size={15} /></button>
          </div>

          <div className="mh-divider my-3" />

          {candidates.length === 0 ? (
            <p className="py-4 text-center text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>
              {lib.songs.length === 0
                ? 'Your library is empty — add a music folder first.'
                : 'Nothing left to add from the library.'}
            </p>
          ) : (
            <ul className="mh-scroll max-h-[280px] space-y-1 overflow-y-auto pr-1">
              {candidates.map((s) => (
                <li key={s.id}>
                  <button
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors duration-200 hover:bg-white/8"
                    onClick={() => libActions.addToPlaylist(pl.id, [s.id])}
                    aria-label={`Add ${s.title} to ${pl.name}`}
                  >
                    <img src={s.coverUrl} alt="" loading="lazy" className="h-10 w-10 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{s.title}</span>
                      <span className="block truncate text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>{s.artist}</span>
                    </span>
                    <span className="mh-mono shrink-0 text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>{fmtTime(s.duration)}</span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: 'var(--c-tint)', color: 'var(--c-accent-2)' }}>
                      <IconPlus size={14} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {songs.length === 0 ? (
        <EmptyState
          title="This playlist is empty."
          hint={adding ? 'Pick tracks above to fill it.' : 'Use “Add songs” to pick tracks, or right-click any song → Add to Playlist.'}
        />
      ) : (
        <Reorder.Group
          axis="y"
          values={pl.songIds}
          onReorder={(next) => libActions.reorderPlaylist(pl.id, next)}
          className={cn('song-list pb-10')}
        >
          {pl.songIds.map((songId, i) => {
            const song = lib.getSong(songId)
            if (!song) return null
            return (
              <Reorder.Item key={songId} value={songId} className="cursor-grab active:cursor-grabbing" whileDrag={{ scale: 1.01 }}>
                <SongRow
                  song={song}
                  index={i + 1}
                  contextIds={pl.songIds}
                  onRemove={() => confirmRemoveFromPlaylist(song, pl)}
                />
              </Reorder.Item>
            )
          })}
        </Reorder.Group>
      )}
    </div>
  )
}

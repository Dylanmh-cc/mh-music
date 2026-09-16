import { useUiStore, toast } from '../stores/ui'
import { useLibraryStore } from '../stores/library'
import { usePlayerStore } from '../stores/player'
import { confirmDeleteSong } from './confirmActions'
import { decodeLyricBytes } from '../lib/lrc'
import type { CtxItem, Song } from '../types/models'

/** Build the standard song context menu (right-click / More button). */
export function songMenuItems(song: Song): CtxItem[] {
  const ui = useUiStore.getState()
  const lib = useLibraryStore.getState()
  const player = usePlayerStore.getState()
  const fav = lib.favorites.songs.includes(song.id)

  const playContext = song.albumId
    ? lib.getAlbum(song.albumId)?.songIds ?? lib.songs.map((s) => s.id)
    : lib.songs.map((s) => s.id)

  const playlistSub: CtxItem[] = lib.playlists.length
    ? lib.playlists.map((p) => ({
      label: p.name,
      action: () => lib.addToPlaylist(p.id, [song.id]),
    }))
    : [{ label: 'Create a playlist first…', action: () => ui.navigate('playlists') }]

  return [
    { label: 'Play', action: () => player.playSong(song.id, playContext, 'Context') },
    { label: 'Play Next', action: () => player.playNext(song.id) },
    { label: 'Add to Queue', action: () => player.addToQueue(song.id) },
    { label: 'Add to Playlist', submenu: playlistSub },
    { sep: true },
    { label: fav ? 'Remove from Favorites' : 'Add to Favorites', action: () => lib.toggleFavSong(song.id) },
    { label: 'Go to Album', disabled: !song.albumId, action: () => song.albumId && ui.navigate('album', { albumId: song.albumId }) },
    {
      label: 'Go to Artist',
      action: () => {
        const artist = lib.artists.find((a) => a.name === song.artist)
        if (artist) ui.navigate('artist', { artistId: artist.id })
        else toast('info', 'Artist page is only available for library artists.')
      },
    },
    { label: 'Show in Folders', disabled: !song.folderId, action: () => song.folderId && ui.navigate('folders') },
    { sep: true },
    // Flat on purpose: these were nested under one item with a submenu, and the
    // expansion inside the context menu proved unreliable — two direct rows cost
    // one extra line and always respond.
    { label: 'Choose Lyrics File…', action: () => pickLyricsFile(song) },
    { label: 'Paste Lyrics from Clipboard', action: () => void pasteLyrics(song) },
    ...(song.lrc?.length ? [{ label: 'Remove Lyrics', danger: true, action: () => lib.setSongLyrics(song.id) }] : []),
    { sep: true },
    { label: 'Remove from Library', danger: true, action: () => confirmDeleteSong(song) },
  ]
}

/**
 * Lyrics for a track the files left wordless.
 *
 * Both routes end in the same place, and the text is handed over unparsed:
 * `setSongLyrics` works out whether it is a synced LRC or plain prose.
 */
function pickLyricsFile(song: Song) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.lrc,.txt,text/plain'
  input.style.display = 'none'
  // Attached before it is clicked: a detached input normally still fires, but a
  // read that comes back empty cannot be told apart from an empty file, so this
  // removes the doubt.
  document.body.appendChild(input)

  const done = () => input.remove()

  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) { done(); return }
    try {
      const buf = await file.arrayBuffer()
      if (!buf.byteLength) {
        // both numbers matter: file.size 0 means the file really is empty (a
        // cloud placeholder reads this way), while a mismatch would mean we
        // failed to read bytes the browser says are there
        toast('error', `“${file.name}” reads as empty — the file reports ${file.size} bytes.`)
        return
      }
      const text = decodeLyricBytes(buf)
      if (!text.trim()) {
        toast('error', `“${file.name}” has ${buf.byteLength} bytes but no readable text.`)
        return
      }
      useLibraryStore.getState().setSongLyrics(song.id, text)
    } catch {
      toast('error', 'That lyric file could not be read.')
    } finally {
      done()
    }
  }
  input.click()
}

async function pasteLyrics(song: Song) {
  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim()) { toast('info', 'The clipboard is empty.'); return }
    useLibraryStore.getState().setSongLyrics(song.id, text)
  } catch {
    toast('error', 'The clipboard could not be read — allow clipboard access, or choose a .lrc file instead.')
  }
}

import { askConfirm } from '../stores/ui'
import { useLibraryStore } from '../stores/library'
import type { Album, MusicFolder, Playlist, Song } from '../types/models'

/**
 * Central place for every destructive library action. Each one opens the
 * liquid-glass confirmation dialog and only then touches the store, so no
 * delete can happen without an explicit, in-theme confirmation.
 */

const lib = () => useLibraryStore.getState()

export function confirmRemoveSong(song: Song) {
  askConfirm({
    title: `Remove “${song.title}” from your library?`,
    body: 'The track leaves your library, playlists and favorites. Nothing is deleted from your computer.',
    confirmLabel: 'Remove',
    danger: true,
    onConfirm: () => lib().removeSong(song.id),
  })
}

export function confirmDeleteSong(song: Song) {
  const hasFile = lib().hasLocalFile(song.id)
  askConfirm({
    title: `Remove “${song.title}” from your library?`,
    body: hasFile
      ? 'The track leaves your library, playlists and favorites. The file on your computer is left untouched unless you choose otherwise below.'
      : 'The track leaves your library, playlists and favorites. Nothing is deleted from your computer.',
    confirmLabel: 'Remove',
    danger: true,
    extra: hasFile
      ? {
        label: 'Delete Local File',
        hint: 'Permanently erases the audio file from the folder you linked. This cannot be undone.',
        onSelect: () => confirmDeleteLocalFile(song),
      }
      : undefined,
    onConfirm: () => lib().removeSong(song.id),
  })
}

export function confirmDeleteLocalFile(song: Song) {
  askConfirm({
    title: `Permanently delete the file “${song.title}”?`,
    body: 'This erases the audio file from your disk and removes the track from your library. This cannot be undone.',
    confirmLabel: 'Delete File',
    danger: true,
    onConfirm: () => { void lib().deleteLocalFile(song.id) },
  })
}

export function confirmDeleteAlbum(album: Album) {
  askConfirm({
    title: `Delete “${album.name}”?`,
    body: `${album.songIds.length} track${album.songIds.length !== 1 ? 's' : ''} will be removed from your library, along with its playlists and favorites entries.`,
    confirmLabel: 'Delete Album',
    danger: true,
    onConfirm: () => lib().deleteAlbum(album.id),
  })
}

export function confirmRemoveFolder(folder: MusicFolder, songCount: number) {
  askConfirm({
    title: `Remove “${folder.name}”?`,
    body: `${songCount} track${songCount !== 1 ? 's' : ''} from this folder will disappear from your library. Your files stay where they are on disk.`,
    confirmLabel: 'Remove Folder',
    danger: true,
    onConfirm: () => lib().removeFolder(folder.id),
  })
}

export function confirmClearHistory() {
  askConfirm({
    title: 'Clear your listening history?',
    body: 'Recently Played will be emptied. Your library and playlists are not affected.',
    confirmLabel: 'Clear History',
    danger: true,
    onConfirm: () => lib().clearHistory(),
  })
}

export function confirmDeletePlaylist(pl: Playlist, after?: () => void) {
  askConfirm({
    title: `Delete the playlist “${pl.name}”?`,
    body: `${pl.songIds.length} track${pl.songIds.length !== 1 ? 's' : ''} will be removed from this playlist. The songs stay in your library.`,
    confirmLabel: 'Delete Playlist',
    danger: true,
    onConfirm: () => { lib().deletePlaylist(pl.id); after?.() },
  })
}

export function confirmRemoveFromPlaylist(song: Song, pl: Playlist) {
  askConfirm({
    title: `Remove “${song.title}” from “${pl.name}”?`,
    body: 'The song stays in your library — only this playlist loses it.',
    confirmLabel: 'Remove',
    danger: true,
    onConfirm: () => lib().removeFromPlaylist(pl.id, song.id),
  })
}

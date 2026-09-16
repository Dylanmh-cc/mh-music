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
    title: `把「${song.title}」从音乐库中移除?`,
    body: '这首曲目会从音乐库、歌单与收藏中移除。你电脑上的文件不会被删除。',
    confirmLabel: '移除',
    danger: true,
    onConfirm: () => lib().removeSong(song.id),
  })
}

export function confirmDeleteSong(song: Song) {
  const hasFile = lib().hasLocalFile(song.id)
  askConfirm({
    title: `把「${song.title}」从音乐库中移除?`,
    body: hasFile
      ? '这首曲目会从音乐库、歌单与收藏中移除。除非你在下面另行选择,否则电脑上的文件保持原样。'
      : '这首曲目会从音乐库、歌单与收藏中移除。你电脑上的文件不会被删除。',
    confirmLabel: '移除',
    danger: true,
    extra: hasFile
      ? {
        label: '删除本地文件',
        hint: '从你链接的文件夹中永久删除这个音频文件。此操作无法撤销。',
        onSelect: () => confirmDeleteLocalFile(song),
      }
      : undefined,
    onConfirm: () => lib().removeSong(song.id),
  })
}

export function confirmDeleteLocalFile(song: Song) {
  askConfirm({
    title: `永久删除文件「${song.title}」?`,
    body: '这会从磁盘上删除音频文件,并把曲目从音乐库中移除。此操作无法撤销。',
    confirmLabel: '删除文件',
    danger: true,
    onConfirm: () => { void lib().deleteLocalFile(song.id) },
  })
}

export function confirmDeleteAlbum(album: Album) {
  askConfirm({
    title: `删除「${album.name}」?`,
    body: `${album.songIds.length} 首曲目将从音乐库中移除,同时移除它们在各歌单与收藏中的条目。`,
    confirmLabel: '删除专辑',
    danger: true,
    onConfirm: () => lib().deleteAlbum(album.id),
  })
}

export function confirmRemoveFolder(folder: MusicFolder, songCount: number) {
  askConfirm({
    title: `移除「${folder.name}」?`,
    body: `这个文件夹中的 ${songCount} 首曲目将从音乐库中消失。你的文件仍保留在磁盘原来的位置。`,
    confirmLabel: '移除文件夹',
    danger: true,
    onConfirm: () => lib().removeFolder(folder.id),
  })
}

export function confirmClearHistory() {
  askConfirm({
    title: '清除播放历史?',
    body: '「最近播放」将被清空。音乐库与歌单不受影响。',
    confirmLabel: '清除历史',
    danger: true,
    onConfirm: () => lib().clearHistory(),
  })
}

export function confirmDeletePlaylist(pl: Playlist, after?: () => void) {
  askConfirm({
    title: `删除歌单「${pl.name}」?`,
    body: `${pl.songIds.length} 首曲目将从这个歌单中移除。歌曲本身仍留在音乐库中。`,
    confirmLabel: '删除歌单',
    danger: true,
    onConfirm: () => { lib().deletePlaylist(pl.id); after?.() },
  })
}

export function confirmRemoveFromPlaylist(song: Song, pl: Playlist) {
  askConfirm({
    title: `把「${song.title}」从「${pl.name}」中移除?`,
    body: '歌曲仍留在音乐库中 —— 只有这个歌单会失去它。',
    confirmLabel: '移除',
    danger: true,
    onConfirm: () => lib().removeFromPlaylist(pl.id, song.id),
  })
}

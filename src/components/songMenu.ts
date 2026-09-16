import { useUiStore, toast, askConfirm } from '../stores/ui'
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
    : [{ label: '请先创建一个歌单…', action: () => ui.navigate('playlists') }]

  return [
    { label: '播放', action: () => player.playSong(song.id, playContext, '右键菜单') },
    { label: '下一首播放', action: () => player.playNext(song.id) },
    { label: '加入播放队列', action: () => player.addToQueue(song.id) },
    { label: '添加到歌单', submenu: playlistSub },
    { sep: true },
    { label: fav ? '取消收藏' : '加入收藏', action: () => lib.toggleFavSong(song.id) },
    { label: '前往专辑', disabled: !song.albumId, action: () => song.albumId && ui.navigate('album', { albumId: song.albumId }) },
    {
      label: '前往艺术家',
      action: () => {
        const artist = lib.artists.find((a) => a.name === song.artist)
        if (artist) ui.navigate('artist', { artistId: artist.id })
        else toast('info', '只有音乐库中的歌手才有歌手页面。')
      },
    },
    { label: '在文件夹中显示', disabled: !song.folderId, action: () => song.folderId && ui.navigate('folders') },
    { sep: true },
    // Flat on purpose: these were nested under one item with a submenu, and the
    // expansion inside the context menu proved unreliable — two direct rows cost
    // one extra line and always respond.
    { label: '选择歌词文件…', action: () => pickLyricsFile(song) },
    { label: '从剪贴板粘贴歌词', action: () => void pasteLyrics(song) },
    { label: '从网络获取歌词', action: () => void fetchLyrics(song) },
    ...(song.lrc?.length ? [{ label: '清除歌词', danger: true, action: () => confirmClearLyrics(song) }] : []),
    { sep: true },
    { label: '从音乐库移除', danger: true, action: () => confirmDeleteSong(song) },
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
        toast('error', `「${file.name}」读出来是空的 —— 文件大小为 ${file.size} 字节。`)
        return
      }
      const text = decodeLyricBytes(buf)
      if (!text.trim()) {
        toast('error', `「${file.name}」有 ${buf.byteLength} 字节,但读不出任何文本。`)
        return
      }
      useLibraryStore.getState().setSongLyrics(song.id, text)
    } catch {
      toast('error', '无法读取该歌词文件。')
    } finally {
      done()
    }
  }
  input.click()
}

async function pasteLyrics(song: Song) {
  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim()) { toast('info', '剪贴板是空的。'); return }
    useLibraryStore.getState().setSongLyrics(song.id, text)
  } catch {
    toast('error', '无法读取剪贴板 —— 请允许剪贴板权限,或改为选择一个 .lrc 文件。')
  }
}

/** Clearing is destructive like every other delete, so it asks first. */
function confirmClearLyrics(song: Song) {
  askConfirm({
    title: `清除「${song.title}」的歌词?`,
    body: '这首曲目保存的歌词会被移除,曲目本身和其他信息不受影响。可以随时重新选择歌词文件或从剪贴板粘贴。',
    confirmLabel: '清除歌词',
    danger: true,
    onConfirm: () => useLibraryStore.getState().setSongLyrics(song.id),
  })
}

/**
 * Ask the lyric proxy for this one track. An existing lyric is kept unless the
 * user says otherwise — losing words they already had is worse than a stale one.
 */
async function fetchLyrics(song: Song) {
  const run = async () => {
    toast('info', `正在查找「${song.title}」的歌词…`)
    const result = await useLibraryStore.getState().fetchLyricsFor(song.id)
    if (result === 'found') toast('success', `已为「${song.title}」添加歌词。`)
    else toast('error', '没有找到这首歌的歌词;可以手动选择 .lrc 文件或粘贴歌词。')
  }
  if (song.lrc?.length) {
    askConfirm({
      title: `「${song.title}」已经有歌词了`,
      body: '重新获取会用网络上的版本替换当前歌词。想保留现在这份就取消。',
      confirmLabel: '替换歌词',
      onConfirm: () => void run(),
    })
    return
  }
  await run()
}

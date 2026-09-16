import { useMemo } from 'react'
import { useLibraryStore } from '../../stores/library'
import { useUiStore } from '../../stores/ui'
import { usePlayerStore } from '../../stores/player'
import { EmptyState, SongRow, GlassButton } from './shared'
import { AlbumCard } from '../album/AlbumCard'
import { IconArtist, IconPlay, IconShuffle } from '../icons'

export function ArtistDetailView() {
  const artistId = useUiStore((s) => s.params.artistId)
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const artist = lib.artists.find((a) => a.id === artistId)

  const songs = useMemo(
    () => (artist ? artist.songIds.map((id) => lib.getSong(id)!).filter(Boolean) : []),
    [artist, lib],
  )
  if (!artist) return <EmptyState title="找不到这位艺术家。" />

  const fav = lib.favorites.artists.includes(artist.id)

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-8 flex flex-wrap items-end gap-6">
        <div className="h-[132px] w-[132px] overflow-hidden rounded-full shadow-2xl" style={{ boxShadow: '0 22px 60px rgba(0,0,0,0.6), 0 0 60px var(--c-glow-soft)' }}>
          {lib.getAlbum(artist.albumIds[0]) && <img src={lib.getAlbum(artist.albumIds[0])!.coverUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-[0.3em]" style={{ color: 'var(--c-ink-faint)' }}>艺术家</div>
          <h1 className="mt-1 text-[30px] font-bold tracking-tight">{artist.name}</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>
            {artist.albumIds.length} albums · {songs.length} tracks
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className="lg-btn lg-btn-primary flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold" onClick={() => songs[0] && player.playSong(songs[0].id, artist.songIds, artist.name)}>
              <IconPlay size={14} /> 播放
            </button>
            <GlassButton onClick={() => {
              player.playSong(artist.songIds[Math.floor(Math.random() * artist.songIds.length)], artist.songIds, '随机播放')
              if (!player.shuffle) player.toggleShuffle()
            }}>
              <span className="flex items-center gap-2"><IconShuffle size={13} /> 随机播放</span>
            </GlassButton>
            <GlassButton onClick={() => lib.toggleFavArtist(artist.id)}>
              {fav ? '♥ 已收藏' : '♡ 收藏'}
            </GlassButton>
          </div>
        </div>
      </div>

      <h2 className="mb-4 text-[17px] font-semibold">专辑</h2>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {artist.albumIds.map((id) => {
          const album = lib.getAlbum(id)
          return album ? <AlbumCard key={id} album={album} dimmed={false} onHover={() => {}} /> : null
        })}
      </div>

      {songs.length > 0 && (
        <>
          <h2 className="mb-2 mt-10 text-[17px] font-semibold">全部歌曲</h2>
          <div className="song-list">
            {songs.map((song, i) => (
              <SongRow key={song.id} song={song} index={i + 1} contextIds={artist.songIds} />
            ))}
          </div>
        </>
      )}
      <div className="h-10" />
    </div>
  )
}

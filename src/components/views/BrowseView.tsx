import { useMemo } from 'react'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore } from '../../stores/ui'
import { EmptyState, SectionTitle, Shelf } from './shared'
import { fmtTime } from '../../lib/format'
import { IconSparkle, IconAlbum, IconArtist } from '../icons'

/** Browse: the "made for you" mixes plus genres & years from the metadata. */
export function BrowseView() {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const navigate = useUiStore((s) => s.navigate)

  const made = useMemo(() => {
    const top = lib.songs.slice().sort((a, b) => b.playCount - a.playCount).slice(0, 10)
    const favSongs = lib.favorites.songs.map((id) => lib.getSong(id)!).filter(Boolean)
    return [
      { name: '循环热播', songs: top.slice(0, 6), tint: 'var(--c-accent)' },
      { name: '深夜黑胶', songs: lib.songs.filter((s) => s.duration > 40).slice(0, 6), tint: 'var(--c-accent-2)' },
      { name: '收藏混音', songs: (favSongs.length ? favSongs : lib.songs).slice(0, 6), tint: '#b07aff' },
    ].filter((m) => m.songs.length > 0)
  }, [lib.songs, lib.favorites])

  const genres = useMemo(() => {
    const m = new Map<string, { albums: number; songs: number }>()
    for (const s of lib.songs) {
      const g = s.genre || '未知流派'
      const cur = m.get(g) ?? { albums: 0, songs: 0 }
      cur.songs++
      m.set(g, cur)
    }
    for (const a of lib.albums) {
      const g = a.genre || '未知流派'
      const cur = m.get(g) ?? { albums: 0, songs: 0 }
      cur.albums++
      m.set(g, cur)
    }
    return [...m.entries()].sort((x, y) => y[1].songs - x[1].songs)
  }, [lib.songs, lib.albums])

  const years = useMemo(() => {
    const m = new Map<number, number>()
    for (const a of lib.albums) if (a.year) m.set(a.year, (m.get(a.year) ?? 0) + 1)
    return [...m.entries()].sort((x, y) => y[0] - x[0])
  }, [lib.albums])

  if (!lib.songs.length) {
    return <EmptyState icon={<IconSparkle size={30} />} title="暂时没有可浏览的内容。" hint="添加音乐后即可按流派和年份浏览。" />
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <SectionTitle title="浏览" hint="按流派与年代浏览你的音乐库" />

      {made.length > 0 && (
        <>
          <h3 className="mb-3 text-[13px] font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--c-ink-faint)' }}>为你推荐</h3>
          <Shelf>
            {made.map((mix) => (
              <button
                key={mix.name}
                className="group glass-soft relative w-[220px] shrink-0 overflow-hidden rounded-2xl p-4 text-left"
                onClick={() => mix.songs[0] && player.playSong(mix.songs[0].id, mix.songs.map((s) => s.id), mix.name)}
              >
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60" style={{ background: mix.tint }} />
                <IconSparkle size={18} style={{ color: mix.tint }} />
                <div className="mt-3 text-[15px] font-semibold">{mix.name}</div>
                <div className="mt-1 text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>
                  {mix.songs.length} 首 · {fmtTime(mix.songs.reduce((a, s) => a + s.duration, 0))}
                </div>
                <div className="mt-3 flex -space-x-2.5">
                  {mix.songs.slice(0, 4).map((s) => (
                    <img key={s.id} src={s.coverUrl} alt="" className="h-9 w-9 rounded-lg border border-black/30 object-cover" />
                  ))}
                </div>
              </button>
            ))}
          </Shelf>
        </>
      )}

      <h3 className="mb-3 mt-8 text-[13px] font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--c-ink-faint)' }}>流派</h3>
      <div className="grid grid-cols-2 gap-3 pb-2 md:grid-cols-4 xl:grid-cols-5">
        {genres.map(([genre, st], i) => (
          <button
            key={genre}
            className="glass-soft group relative overflow-hidden rounded-2xl p-4 text-left transition-transform duration-500 hover:-translate-y-1"
            onClick={() => navigate('albums')}
            style={{ minHeight: 92 }}
          >
            <div
              className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-25 blur-2xl transition-opacity duration-500 group-hover:opacity-50"
              style={{ background: `hsl(${(i * 67) % 360} 70% 60%)` }}
            />
            <div className="text-[14.5px] font-semibold">{genre}</div>
            <div className="mt-1 text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>
              {st.albums} 张专辑 · {st.songs} 首
            </div>
          </button>
        ))}
      </div>

      {years.length > 0 && (
        <>
          <h3 className="mb-3 mt-8 text-[13px] font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--c-ink-faint)' }}>年份</h3>
          <div className="flex flex-wrap gap-2.5">
            {years.map(([year, count]) => (
              <button key={year} className="glass-soft rounded-full px-4 py-2 text-[12.5px] transition-transform duration-300 hover:scale-105" onClick={() => navigate('albums')}>
                {year} <span style={{ color: 'var(--c-ink-faint)' }}>· {count}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <h3 className="mb-3 mt-8 text-[13px] font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--c-ink-faint)' }}>合集</h3>
      <div className="grid gap-3 pb-4 sm:grid-cols-2">
        <button className="glass-soft flex items-center gap-4 rounded-2xl p-4 text-left transition-transform duration-500 hover:-translate-y-0.5" onClick={() => navigate('albums')}>
          <IconAlbum size={22} />
          <div>
            <div className="text-[14px] font-medium">全部专辑</div>
            <div className="text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>完整的黑胶墙</div>
          </div>
        </button>
        <button className="glass-soft flex items-center gap-4 rounded-2xl p-4 text-left transition-transform duration-500 hover:-translate-y-0.5" onClick={() => navigate('artists')}>
          <IconArtist size={22} />
          <div>
            <div className="text-[14px] font-medium">全部歌手</div>
            <div className="text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>所有在播的歌手</div>
          </div>
        </button>
      </div>
    </div>
  )
}

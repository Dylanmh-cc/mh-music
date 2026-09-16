import { useMemo } from 'react'
import { useLibraryStore } from '../../stores/library'
import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'
import { greeting } from '../../lib/format'
import { SectionTitle, GlassButton, EmptyState } from './shared'
import { AlbumGrid, AlbumSections, LetterIndex, groupByLetter } from './AlbumBrowser'
import { IconNote } from '../icons'

/**
 * Home — the library wall from the reference layout: Recently Added on top,
 * then the A→Z album sections with a jump bar floating above the transport.
 */
export function HomeView() {
  const user = useAuthStore((s) => s.user)
  const lib = useLibraryStore()
  const navigate = useUiStore((s) => s.navigate)

  // albums, newest first (a song's addedAt dates its album)
  const recentlyAdded = useMemo(() => {
    const seen = new Map<string, number>()
    for (const s of lib.songs) seen.set(s.albumId, Math.max(seen.get(s.albumId) ?? 0, s.addedAt))
    return lib.albums
      .slice()
      .sort((a, b) => (seen.get(b.id) ?? 0) - (seen.get(a.id) ?? 0))
      .slice(0, 10)
  }, [lib.songs, lib.albums])

  const groups = useMemo(() => groupByLetter(lib.albums), [lib.albums])
  const present = useMemo(() => new Set(groups.map(([letter]) => letter)), [groups])

  if (!lib.songs.length) {
    return (
      <EmptyState
        icon={<IconNote size={30} />}
        title="音乐库还是空的。"
        hint="添加一个音乐文件夹即可开始,也可以先浏览上面的示例专辑。"
        action={<GlassButton primary onClick={() => navigate('folders')}>添加音乐文件夹</GlassButton>}
      />
    )
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <p className="sr-only">{greeting(user?.name)}</p>

      {recentlyAdded.length > 0 && (
        <>
          <SectionTitle
            title="最近添加"
            hint="刚刚归档到音乐库"
            action={<SeeAll onClick={() => navigate('albums')} />}
          />
          <AlbumGrid albums={recentlyAdded} />
        </>
      )}

      <SectionTitle title="全部专辑" hint={`${lib.albums.length} 张专辑 · A–Z`} />
      <LetterIndex present={present} />
      <AlbumSections groups={groups} />

      <div className="h-6" />
    </div>
  )
}

function SeeAll({ onClick }: { onClick: () => void }) {
  return (
    <button className="text-[12px] underline-offset-4 transition hover:underline" style={{ color: 'var(--c-ink-dim)' }} onClick={onClick}>
      查看全部
    </button>
  )
}

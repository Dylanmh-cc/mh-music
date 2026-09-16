import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore } from '../../stores/ui'
import { EmptyState, SectionTitle } from './shared'
import { Stage3D, StageCardBody } from '../stage/Stage3D'
import { ViewModeToggle, useViewMode, ArtistRow } from './viewMode'
import { IconArtist, IconHeart, IconHeartFill, IconMore, IconPlay } from '../icons'
import { cn } from '../../lib/format'

/**
 * Artists on the same 3D stage as everything else — the centred card carries
 * the artist's artwork and a record-label medallion, the rest recede.
 */
export function ArtistsView() {
  const artists = useLibraryStore((s) => s.artists)
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const ui = useUiStore()

  if (!artists.length) {
    return <EmptyState icon={<IconArtist size={30} />} title="No artists yet." hint="They appear once your library grows." />
  }

  const sorted = artists.slice().sort((a, b) => a.name.localeCompare(b.name))
  const mode = useViewMode('artists')

  const play = (artist: (typeof artists)[number]) => {
    const top = artist.songIds
      .map((id) => lib.getSong(id))
      .filter(Boolean)
      .sort((a, b) => (b!.playCount ?? 0) - (a!.playCount ?? 0))[0]
    if (top) player.playSong(top.id, artist.songIds, artist.name)
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <SectionTitle
        title="Artists"
        hint={`${artists.length} artists`}
        action={<ViewModeToggle page="artists" />}
      />

      {mode === 'list' ? (
        <div className="song-list mx-auto max-w-[980px]">
          {sorted.map((artist, i) => {
            const top = artist.songIds
              .map((id) => lib.getSong(id))
              .filter(Boolean)
              .sort((a, b) => (b!.playCount ?? 0) - (a!.playCount ?? 0))[0]
            return (
              <ArtistRow
                key={artist.id}
                artist={artist}
                index={i}
                cover={lib.getAlbum(artist.albumIds[0])?.coverUrl}
                count={artist.songIds.length}
                top={top?.title}
                onOpen={() => ui.navigate('artist', { artistId: artist.id })}
                onPlay={() => play(artist)}
                onMore={(el) => {
                  const r = el.getBoundingClientRect()
                  ui.openCtx(r.left - 210, r.bottom + 6, [
                    { label: 'Open Artist', action: () => ui.navigate('artist', { artistId: artist.id }) },
                    { label: 'Play Artist', action: () => play(artist) },
                  ])
                }}
              />
            )
          })}
        </div>
      ) : (
        <Stage3D
        items={sorted}
        keyOf={(a) => a.id}
        label="Artist stage"
        thumbnailOf={(a) => lib.getAlbum(a.albumIds[0])?.coverUrl}
        cardWidth={312}
        stageHeight={560}
        onActivate={(artist) => ui.navigate('artist', { artistId: artist.id })}
        renderCard={(artist) => {
          const cover = lib.getAlbum(artist.albumIds[0])?.coverUrl
          const palette = lib.getAlbum(artist.albumIds[0])?.palette
          const fav = lib.favorites.artists.includes(artist.id)
          const top = artist.songIds
            .map((id) => lib.getSong(id))
            .filter(Boolean)
            .sort((a, b) => (b!.playCount ?? 0) - (a!.playCount ?? 0))[0]
          const play = () => top && player.playSong(top.id, artist.songIds, artist.name)
          return (
            <StageCardBody
              artLabel={`Open artist ${artist.name}`}
              art={
                <>
                  {cover
                    ? <img src={cover} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                    : <span className="block h-full w-full" style={{ background: 'linear-gradient(140deg, #1a1d26, #0d0f15)' }} />}
                  <span
                    className="pointer-events-none absolute left-1/2 top-[50%] grid h-[54%] w-[54%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[40px] font-bold"
                    style={{
                      background: `radial-gradient(circle at 38% 30%, ${palette?.accent ?? '#9ee8ff'}e6, ${palette?.primary ?? '#6f8cff'}d9 62%, rgba(0,0,0,0.55))`,
                      boxShadow: 'inset 0 0 0 3px rgba(0,0,0,0.32), 0 14px 34px rgba(0,0,0,0.6)',
                      color: 'rgba(255,255,255,0.94)',
                    }}
                  >
                    {(artist.name[0] ?? '?').toUpperCase()}
                  </span>
                </>
              }
              title={artist.name}
              subtitle={`${artist.albumIds.length} album${artist.albumIds.length !== 1 ? 's' : ''} · ${artist.songIds.length} song${artist.songIds.length !== 1 ? 's' : ''}`}
              sub2={top ? `Top: ${top.title}` : undefined}
              onActivate={() => ui.navigate('artist', { artistId: artist.id })}
              actions={
                <>
                  <span
                    onClick={play}
                    className="lg-btn lg-btn-primary grid h-10 w-10 cursor-pointer place-items-center"
                    role="button"
                    aria-label={`Play ${artist.name}`}
                  >
                    <IconPlay size={16} />
                  </span>
                  <button
                    className={cn('icon-btn h-9 w-9', fav && 'active')}
                    style={{ color: fav ? 'var(--c-accent-2)' : undefined }}
                    onClick={(e) => { e.stopPropagation(); lib.toggleFavArtist(artist.id) }}
                    aria-label={fav ? 'Remove artist from favorites' : 'Add artist to favorites'}
                  >
                    {fav ? <IconHeartFill size={16} /> : <IconHeart size={16} />}
                  </button>
                  <button
                    className="icon-btn h-9 w-9"
                    onClick={(e) => {
                      e.stopPropagation()
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      ui.openCtx(r.left - 210, r.bottom + 6, [
                        { label: 'Open Artist', action: () => ui.navigate('artist', { artistId: artist.id }) },
                        { label: 'Play Artist', action: play },
                        { sep: true },
                        { label: fav ? 'Remove from Favorites' : 'Add to Favorites', action: () => lib.toggleFavArtist(artist.id) },
                      ])
                    }}
                    aria-label={`More options for ${artist.name}`}
                  >
                    <IconMore size={15} />
                  </button>
                </>
              }
            />
          )
        }}
        />
      )}
    </div>
  )
}

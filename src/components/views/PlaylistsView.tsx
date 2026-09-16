import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore, toast } from '../../stores/ui'
import { EmptyState, SectionTitle, GlassButton } from './shared'
import { Stage3D, StageCardBody } from '../stage/Stage3D'
import { confirmDeletePlaylist } from '../confirmActions'
import { IconList, IconMore, IconPlay, IconPlus, IconImport, IconTrash, IconEdit, IconCheck, IconClose } from '../icons'
import { cn } from '../../lib/format'
import { fileToPlaylistCover } from '../../lib/playlistCover'

/** Playlists on the 3D stage, with inline create / rename / delete. A playlist
 *  can carry its own artwork: chosen while creating it, or replaced later from
 *  the card's menu. Without one it shows a mosaic of its first four tracks. */
export function PlaylistsView() {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const ui = useUiStore()
  const createPlaylist = useLibraryStore((s) => s.createPlaylist)
  const setPlaylistCover = useLibraryStore((s) => s.setPlaylistCover)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [coverDraft, setCoverDraft] = useState<string | undefined>(undefined)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const newCoverInput = useRef<HTMLInputElement | null>(null)
  // 一个 input 服务所有卡片的「更换封面」:记住目标卡片 id
  const changeInput = useRef<HTMLInputElement | null>(null)
  const [coverTarget, setCoverTarget] = useState<string | null>(null)

  const readCover = async (file: File | undefined): Promise<string | undefined> => {
    if (!file) return undefined
    try {
      return await fileToPlaylistCover(file)
    } catch {
      toast('error', '无法读取该图片。')
      return undefined
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <SectionTitle
        title="歌单"
        hint={`${lib.playlists.length} 个歌单`}
        action={<GlassButton primary onClick={() => setCreating((v) => !v)}><span className="flex items-center gap-2"><IconPlus size={14} /> 新建歌单</span></GlassButton>}
      />

      {creating && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-soft mb-6 flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (createPlaylist(name, [], coverDraft)) { setName(''); setCoverDraft(undefined); setCreating(false) }
          }}
        >
          {/* the cover is optional here and can be changed at any time later */}
          <button
            type="button"
            className="glass-soft grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-xl"
            onClick={() => newCoverInput.current?.click()}
            aria-label="选择歌单封面"
            title="选择封面(可选)"
          >
            {coverDraft
              ? <img src={coverDraft} alt="" className="h-full w-full object-cover" />
              : <span className="flex flex-col items-center gap-0.5" style={{ color: 'var(--c-ink-faint)' }}><IconPlus size={13} /><span className="text-[9px]">封面</span></span>}
          </button>
          <input
            ref={newCoverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => { setCoverDraft(await readCover(e.target.files?.[0])); e.target.value = '' }}
            aria-label="歌单封面图片"
          />

          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="歌单名称…"
            className="min-w-[200px] flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-[13.5px] outline-none placeholder:text-white/25"
            aria-label="歌单名称"
          />
          <button type="submit" className="lg-btn lg-btn-primary px-5 py-2.5 text-[13px] font-semibold">创建</button>
        </motion.form>
      )}

      <input
        ref={changeInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const url = await readCover(e.target.files?.[0])
          if (url && coverTarget) { setPlaylistCover(coverTarget, url); toast('success', '歌单封面已更新。') }
          e.target.value = ''
          setCoverTarget(null)
        }}
        aria-label="更换歌单封面"
      />

      {lib.playlists.length === 0 ? (
        <EmptyState
          icon={<IconList size={28} />}
          title="创建你的第一个歌单。"
          hint="歌单把夜晚串在一起。创建一个,或从其他音乐软件导入(M3U / JSON / CSV)。"
          action={
            <div className="flex gap-2.5">
              <GlassButton primary onClick={() => setCreating(true)}>新建歌单</GlassButton>
              <GlassButton onClick={() => ui.navigate('folders')}><span className="flex items-center gap-2"><IconImport size={14} /> 导入</span></GlassButton>
            </div>
          }
        />
      ) : (
        <Stage3D
          items={lib.playlists}
          keyOf={(p) => p.id}
          label="歌单舞台"
          thumbnailOf={(p) => p.coverUrl ?? lib.getSong(p.songIds[0])?.coverUrl}
          cardWidth={312}
          stageHeight={560}
          onActivate={(pl) => ui.navigate('playlist', { playlistId: pl.id })}
          renderCard={(pl) => {
            const covers = pl.songIds.slice(0, 4).map((id) => lib.getSong(id)?.coverUrl).filter(Boolean) as string[]
            const play = () => { if (pl.songIds.length) player.playSong(pl.songIds[0], pl.songIds, pl.name) }
            const editing = editingId === pl.id
            return (
              <StageCardBody
                artLabel={`打开歌单 ${pl.name}`}
                art={
                  pl.coverUrl ? (
                    <img src={pl.coverUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
                  ) : covers.length ? (
                    <span className={cn('absolute inset-0 grid gap-[2px]', covers.length > 1 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1 grid-rows-1')}>
                      {covers.map((c, i) => <img key={i} src={c} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />)}
                    </span>
                  ) : (
                    <span className="grid h-full w-full place-items-center" style={{ background: 'linear-gradient(140deg, #1a1d26, #0d0f15)' }}>
                      <IconList size={28} />
                    </span>
                  )
                }
                title={pl.name}
                subtitle={`${pl.songIds.length} 首`}
                onActivate={() => ui.navigate('playlist', { playlistId: pl.id })}
                actions={
                  editing ? (
                    <form
                      className="flex w-full items-center gap-1.5"
                      onSubmit={(e) => { e.preventDefault(); lib.renamePlaylist(pl.id, draft); setEditingId(null) }}
                    >
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="min-w-0 flex-1 rounded-xl bg-white/8 px-3 py-1.5 text-[13px] outline-none"
                        aria-label="歌单名称"
                      />
                      <button type="submit" className="icon-btn h-9 w-9" aria-label="保存名称"><IconCheck size={16} /></button>
                      <button type="button" className="icon-btn h-9 w-9" onClick={() => setEditingId(null)} aria-label="取消"><IconClose size={16} /></button>
                    </form>
                  ) : (
                    <>
                      <span
                        onClick={play}
                        className="lg-btn lg-btn-primary grid h-10 w-10 cursor-pointer place-items-center"
                        role="button"
                        aria-label={`播放 ${pl.name}`}
                      >
                        <IconPlay size={16} />
                      </span>
                      <button
                        className="icon-btn h-9 w-9"
                        onClick={(e) => { e.stopPropagation(); setDraft(pl.name); setEditingId(pl.id) }}
                        aria-label={`重命名 ${pl.name}`}
                      >
                        <IconEdit size={16} />
                      </button>
                      <button
                        className="icon-btn h-9 w-9 hover:text-[#ff9a8a]"
                        onClick={(e) => { e.stopPropagation(); confirmDeletePlaylist(pl) }}
                        aria-label={`删除歌单 ${pl.name}`}
                      >
                        <IconTrash size={16} />
                      </button>
                      <button
                        className="icon-btn ml-auto h-9 w-9"
                        onClick={(e) => {
                          e.stopPropagation()
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          ui.openCtx(r.left - 210, r.bottom + 6, [
                            { label: '播放', action: play },
                            { label: '打开歌单', action: () => ui.navigate('playlist', { playlistId: pl.id }) },
                            { label: '添加歌曲', action: () => ui.navigate('playlist', { playlistId: pl.id }) },
                            {
                              label: pl.coverUrl ? '更换封面' : '设置封面…',
                              action: () => { setCoverTarget(pl.id); changeInput.current?.click() },
                            },
                            ...(pl.coverUrl ? [{ label: '恢复默认封面', action: () => setPlaylistCover(pl.id, undefined) }] : []),
                            { label: '重命名', action: () => { setDraft(pl.name); setEditingId(pl.id) } },
                            { sep: true },
                            { label: '删除歌单', danger: true, action: () => confirmDeletePlaylist(pl) },
                          ])
                        }}
                        aria-label={`${pl.name} 的更多选项`}
                      >
                        <IconMore size={15} />
                      </button>
                    </>
                  )
                }
              />
            )
          }}
        />
      )}
    </div>
  )
}

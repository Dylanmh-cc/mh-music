import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useLibraryStore } from '../../stores/library'
import { useUiStore, toast } from '../../stores/ui'
import { EmptyState, SectionTitle, GlassButton } from './shared'
import { confirmRemoveFolder } from '../confirmActions'
import { supportsFS } from '../../lib/idb'
import { IconFolder, IconPlus, IconRefresh, IconTrash, IconImport } from '../icons'

export function FoldersView() {
  const lib = useLibraryStore()
  const ui = useUiStore()
  const addFolderFS = useLibraryStore((s) => s.addFolderFS)
  const addFolderUpload = useLibraryStore((s) => s.addFolderUpload)
  const [importOpen, setImportOpen] = useState(false)
  const dirInput = useRef<HTMLInputElement | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const lrcInput = useRef<HTMLInputElement | null>(null)

  return (
    <div className="mx-auto max-w-[900px]">
      <SectionTitle
        title="音乐文件夹"
        hint="扫描本地文件夹 — MP3 · FLAC · WAV · AAC · M4A · OGG"
        action={
          <div className="flex flex-wrap gap-2.5">
            {supportsFS && (
              <GlassButton primary onClick={() => addFolderFS()}>
                <span className="flex items-center gap-2"><IconPlus size={13} /> 添加文件夹</span>
              </GlassButton>
            )}
            <GlassButton primary={!supportsFS} onClick={() => dirInput.current?.click()}>
              <span className="flex items-center gap-2"><IconFolder size={13} /> 选择文件夹</span>
            </GlassButton>
            <GlassButton onClick={() => fileInput.current?.click()}>添加文件</GlassButton>
            <GlassButton onClick={() => setImportOpen((v) => !v)}>
              <span className="flex items-center gap-2"><IconImport size={13} /> 导入歌单</span>
            </GlassButton>
          </div>
        }
      />

      <input
        ref={dirInput}
        type="file"
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && addFolderUpload(e.target.files)}
        aria-hidden="true"
      />
      <input
        ref={fileInput}
        type="file"
        accept=".mp3,.flac,.wav,.aac,.m4a,.ogg,.opus,.oga,audio/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && addFolderUpload(e.target.files)}
        aria-hidden="true"
      />
      <ImportPanel open={importOpen} onClose={() => setImportOpen(false)} />

      {lib.folders.length === 0 ? (
        <EmptyState
          icon={<IconFolder size={30} />}
          title="还没有添加文件夹。"
          hint="把 MH Music 指向你的音乐文件夹。标签、封面和时长都在浏览器本地读取 —— 文件不会离开这台设备。"
        />
      ) : (
        <div className="space-y-3">
          {lib.folders.map((folder) => {
            const songCount = lib.songs.filter((s) => s.folderId === folder.id).length
            return (
              <motion.div
                key={folder.id}
                layout
                className="glass-soft flex items-center gap-4 rounded-2xl p-4"
              >
                <div className="vinyl grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: 'radial-gradient(circle, #16181d, #0a0b0e)' }}>
                  <IconFolder size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{folder.name}</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>
                    {folder.kind === 'fsapi' ? '已链接的文件夹' : '已上传的文件'} · {songCount} 首
                  </div>
                </div>
                {folder.kind === 'fsapi' && (
                  <button className="icon-btn h-9 w-9" onClick={() => lib.rescanFolder(folder.id)} aria-label={`重新扫描 ${folder.name}`}>
                    <IconRefresh size={16} />
                  </button>
                )}
                <button
                  className="icon-btn h-9 w-9 hover:text-[#ff9a8a]"
                  onClick={() => confirmRemoveFolder(folder, songCount)}
                  aria-label={`移除 ${folder.name}`}
                >
                  <IconTrash size={16} />
                </button>
              </motion.div>
            )
          })}
          <p className="px-2 pt-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
            文件夹链接按浏览器记忆。页面重新加载后,点击「重新扫描」即可恢复播放地址
            (浏览器会询问一次权限)。同一张专辑的曲目会自动合并。
          </p>
        </div>
      )}
      <div className="h-10" />
    </div>
  )
}

function ImportPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importPlaylistFile = useLibraryStore((s) => s.importPlaylistFile)
  const ui = useUiStore()
  const [busy, setBusy] = useState(false)
  const lrcRef = useRef<HTMLInputElement | null>(null)

  return (
    <motion.div
      initial={false}
      animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
      className="glass-soft mb-6 overflow-hidden rounded-2xl"
    >
      <div className="p-4">
        <div className="text-[13.5px] font-medium">从其他音乐软件导入歌单</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
          支持 JSON、M3U / M3U8 与 CSV 导出文件。曲目会与你的本地音乐库匹配
          (标题 + 歌手的模糊匹配)。未匹配的条目会列出来,方便你手动补充。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <input
            ref={lrcRef}
            type="file"
            accept=".json,.m3u,.m3u8,.csv,text/plain"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy(true)
              try {
                const name = file.name.replace(/\.(json|m3u8?|csv)$/i, '')
                const res = await importPlaylistFile(file, name)
                toast('success', `歌单导入完成 —— 匹配 ${res.matched} 首${res.unmatched.length ? `,未找到 ${res.unmatched.length} 首` : ''}。`)
                if (res.unmatched.length) {
                  console.info('未匹配的导入条目:', res.unmatched)
                }
                ui.navigate('playlists')
              } catch (ex: any) {
                toast('error', ex.message ?? '歌单导入失败。')
              } finally {
                setBusy(false)
                if (lrcRef.current) lrcRef.current.value = ''
              }
            }}
            aria-hidden="true"
          />
          <button className="lg-btn px-4 py-2 text-[12.5px]" disabled={busy} onClick={() => lrcRef.current?.click()}>
            {busy ? '导入中…' : '选择文件'}
          </button>
          <button className="text-[12px] underline-offset-2 hover:underline" style={{ color: 'var(--c-ink-faint)' }} onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </motion.div>
  )
}

import { useRef, useState } from 'react'
import { useLibraryStore } from '../stores/library'
import { useUiStore } from '../stores/ui'
import { pushPath } from '../app/router'
import { GlassPanel, GlassButton } from '../components/glass/GlassPanel'
import { IconImport, IconCheck, IconFolder } from '../components/icons'
import type { ImportEntry } from '../services/importer'

/**
 * Import — bring a playlist in from another player.
 *
 * Browsers cannot read another app's private database, so this reads the file
 * every player can export: JSON, M3U/M3U8 and CSV. Entries are matched against
 * the local library by title/artist/album; anything unmatched is reported as a
 * missing track and *kept in the report* rather than silently dropped.
 */

const SUPPORTED = [
  { ext: 'JSON', hint: 'Spotify 风格或通用导出:name、artist、album、tracks[]' },
  { ext: 'M3U / M3U8', hint: '普通或扩展歌单,带 #EXTINF 元数据' },
  { ext: 'CSV', hint: '逗号或分号分隔:title、artist、album' },
]

export function ImportPage() {
  const importPlaylistFile = useLibraryStore((s) => s.importPlaylistFile)
  const playlists = useLibraryStore((s) => s.playlists)
  const navigate = useUiStore((s) => s.navigate)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [report, setReport] = useState<{ name: string; matched: number; unmatched: ImportEntry[] } | null>(null)

  const run = async (file: File) => {
    setBusy(true)
    setReport(null)
    try {
      const name = file.name.replace(/\.[^.]+$/, '')
      const res = await importPlaylistFile(file, name)
      setReport({ name, matched: res.matched, unmatched: res.unmatched })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-6">
      <header className="pl-1">
        <h1 className="mh-display text-[30px] md:text-[36px]">导入歌单</h1>
        <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
          先在原来的播放器里导出歌单,再把文件拖到这里。音乐库中已有的曲目会被匹配并加入;
          缺失的会列出来,让你清楚看到哪些没有导入成功。所有处理都不离开这台设备。
        </p>
      </header>

      <GlassPanel
        tier="soft"
        className="mt-6 rounded-3xl p-6 transition-colors"
        // the drop target is the whole panel, and it says so when a file is over it
        {...{
          onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragging(true) },
          onDragLeave: () => setDragging(false),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault(); setDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f) void run(f)
          },
        }}
      >
        <div
          className="grid place-items-center rounded-2xl border border-dashed px-6 py-10 text-center"
          style={{
            borderColor: dragging ? 'var(--c-accent-2)' : 'var(--mh-hairline)',
            background: dragging ? 'var(--c-tint)' : 'transparent',
          }}
        >
          <IconImport size={26} />
          <p className="mt-3 text-[14px] font-medium">
            {busy ? '正在读取歌单…' : '把歌单文件拖到这里'}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>JSON · M3U · M3U8 · CSV</p>
          <div className="mt-4">
            <GlassButton variant="accent" onClick={() => inputRef.current?.click()} disabled={busy}>
              选择文件
            </GlassButton>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.m3u,.m3u8,.csv,text/plain,application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); e.target.value = '' }}
            aria-label="歌单文件"
          />
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-3">
          {SUPPORTED.map((f) => (
            <li key={f.ext} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="mh-mono text-[11.5px] font-semibold tracking-wide">{f.ext}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>{f.hint}</div>
            </li>
          ))}
        </ul>
      </GlassPanel>

      {report && (
        <GlassPanel tier="glass" className="mt-5 rounded-3xl p-5">
          <div className="flex flex-wrap items-center gap-2">
            <IconCheck size={16} />
            <strong className="text-[14px]">{report.name}</strong>
            <span className="text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
              匹配 {report.matched} 首{report.unmatched.length ? ` · 缺失 ${report.unmatched.length} 首` : ''}
            </span>
            <span className="ml-auto flex gap-2">
              <GlassButton onClick={() => { navigate('playlists'); pushPath('/playlists') }}>
                打开歌单
              </GlassButton>
            </span>
          </div>

          {report.unmatched.length > 0 && (
            <>
              <p className="mt-4 text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>
                缺失的曲目 —— 会保留在报告里,绝不删除。补齐文件后再次导入即可匹配。
              </p>
              <ul className="mt-2 max-h-[240px] space-y-1 overflow-y-auto pr-1">
                {report.unmatched.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{e.title || '未命名'}</span>
                    <span className="shrink-0 truncate text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>
                      {[e.artist, e.album].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </GlassPanel>
      )}

      {playlists.length > 0 && (
        <p className="mt-5 pl-1 text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>
          你已经有 {playlists.length} 个歌单。{' '}
          <button className="underline" onClick={() => { navigate('folders'); pushPath('/folders') }}>
            添加音乐文件夹
          </button>{' '}
          匹配到更多导入内容。
        </p>
      )}

      <div className="mt-6 flex items-center gap-2 pl-1">
        <IconFolder size={15} />
        <button className="text-[12.5px] underline" onClick={() => { navigate('folders'); pushPath('/folders') }}>
          管理音乐文件夹
        </button>
      </div>
    </div>
  )
}

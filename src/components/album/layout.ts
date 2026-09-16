import { useSettingsStore } from '../../stores/settings'
import type { AlbumLayout } from '../../types/models'

/** Compose a CSS transform from the per-album / global layout settings. */
export function layoutTransform(l: AlbumLayout): string {
  return `translate3d(${l.x}px, ${l.y}px, ${l.z}px) rotateX(${l.rx}deg) rotateY(${l.ry}deg) rotateZ(${l.rz}deg) scale(${l.scale})`
}

export function useAlbumLayout(albumId?: string): { layout: AlbumLayout; isCustom: boolean } {
  const layouts = useSettingsStore((s) => s.settings.layouts)
  const per = albumId ? layouts.perAlbum[albumId] : undefined
  const layout = per ?? layouts.global
  const isCustom = !!per || JSON.stringify(layouts.global) !== JSON.stringify({
    x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, shadow: 0.5, depth: 40, reflection: 0.35,
  })
  return { layout, isCustom }
}

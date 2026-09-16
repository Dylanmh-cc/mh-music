/**
 * Playlist artwork.
 *
 * A chosen image is redrawn to a square JPEG before it is stored: the playlist
 * record lives in the user's namespaced storage, and a raw photo of a few
 * megabytes would blow that budget after two or three playlists. 512px is
 * enough for the largest place a playlist cover appears.
 */
export async function fileToPlaylistCover(file: File, size = 512): Promise<string> {
  const bitmap = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) throw new Error('no 2d context')

  // centre-crop to a square, so nothing is squashed
  const side = Math.min(bitmap.width, bitmap.height)
  g.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  )
  return canvas.toDataURL('image/jpeg', 0.84)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取该图片')) }
    img.src = url
  })
}

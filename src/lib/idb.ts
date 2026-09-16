// Minimal IndexedDB promise wrapper.
// · handles — FileSystemDirectoryHandle persistence for linked folders
// · files   — uploaded audio blobs, so uploaded tracks survive a reload
const DB = 'nocturne-fs'
const VERSION = 2
const STORES = ['handles', 'files'] as const
type StoreName = (typeof STORES)[number]

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open()
  return new Promise<T>((res, rej) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    req.onsuccess = () => res(req.result as T)
    req.onerror = () => rej(req.error)
    t.oncomplete = () => db.close()
    t.onabort = () => db.close()
  })
}

// ── directory handles ───────────────────────────────────────────────────────
export const idbGet = <T,>(key: string) => run<T | undefined>('handles', 'readonly', (s) => s.get(key))
export const idbSet = (key: string, val: unknown) => run('handles', 'readwrite', (s) => s.put(val, key))
export const idbDel = (key: string) => run('handles', 'readwrite', (s) => s.delete(key))
export const idbKeys = () => run<IDBValidKey[]>('handles', 'readonly', (s) => s.getAllKeys())

// ── uploaded audio blobs ────────────────────────────────────────────────────
export const putFileBlob = (songId: string, file: Blob) => run('files', 'readwrite', (s) => s.put(file, songId))
export const getFileBlob = (songId: string) => run<Blob | undefined>('files', 'readonly', (s) => s.get(songId))
export const deleteFileBlobs = (songIds: string[]) =>
  run('files', 'readwrite', (s) => { songIds.forEach((id) => s.delete(id)); return s.count() })
export const fileBlobCount = () => run<number>('files', 'readonly', (s) => s.count())
export const clearFileBlobs = () => run('files', 'readwrite', (s) => s.clear())

export const supportsFS = typeof (window as any).showDirectoryPicker === 'function'

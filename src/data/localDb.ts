/**
 * On-device copy of the learner's data (IndexedDB), one database per account.
 * It makes the app start instantly, keeps the Word Bank readable offline and
 * holds reviews that have not reached the server yet.
 */

export type StoreName = 'words' | 'cards' | 'outbox'

export interface LocalDb {
  getAll<T>(store: StoreName): Promise<T[]>
  putMany<T extends { id: string }>(store: StoreName, rows: readonly T[]): Promise<void>
  remove(store: StoreName, id: string): Promise<void>
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
  /** Deletes everything stored for this account on this device. */
  destroy(): Promise<void>
}

const STORES: StoreName[] = ['words', 'cards', 'outbox']
const META = 'meta'
const DB_VERSION = 1

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })

const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })

class IndexedLocalDb implements LocalDb {
  constructor(
    private readonly name: string,
    private db: IDBDatabase,
  ) {}

  async getAll<T>(store: StoreName): Promise<T[]> {
    return done(this.db.transaction(store).objectStore(store).getAll() as IDBRequest<T[]>)
  }

  async putMany<T extends { id: string }>(store: StoreName, rows: readonly T[]): Promise<void> {
    if (rows.length === 0) return
    const tx = this.db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    for (const row of rows) os.put(row)
    await finished(tx)
  }

  async remove(store: StoreName, id: string): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(id)
    await finished(tx)
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const row = await done(this.db.transaction(META).objectStore(META).get(key) as IDBRequest<{ value: T } | undefined>)
    return row?.value
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    const tx = this.db.transaction(META, 'readwrite')
    tx.objectStore(META).put({ key, value })
    await finished(tx)
  }

  async destroy(): Promise<void> {
    this.db.close()
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(this.name)
      request.onsuccess = request.onerror = request.onblocked = () => resolve()
    })
  }
}

/** Used in tests and as a fallback when the browser refuses IndexedDB (some private modes). */
export class MemoryLocalDb implements LocalDb {
  private stores = new Map<StoreName, Map<string, unknown>>(STORES.map((s) => [s, new Map()]))
  private meta = new Map<string, unknown>()

  async getAll<T>(store: StoreName): Promise<T[]> {
    const rows = [...this.stores.get(store)!.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return rows.map(([, value]) => structuredClone(value) as T)
  }
  async putMany<T extends { id: string }>(store: StoreName, rows: readonly T[]): Promise<void> {
    for (const row of rows) this.stores.get(store)!.set(row.id, structuredClone(row))
  }
  async remove(store: StoreName, id: string): Promise<void> {
    this.stores.get(store)!.delete(id)
  }
  async getMeta<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.meta.get(key)) as T | undefined
  }
  async setMeta(key: string, value: unknown): Promise<void> {
    this.meta.set(key, structuredClone(value))
  }
  async destroy(): Promise<void> {
    for (const store of this.stores.values()) store.clear()
    this.meta.clear()
  }
}

export async function openLocalDb(userId: string): Promise<LocalDb> {
  if (typeof indexedDB === 'undefined') return new MemoryLocalDb()
  const name = `hodhod-${userId}`
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, DB_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        for (const store of STORES) {
          if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains(META)) database.createObjectStore(META, { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'))
      request.onblocked = () => reject(new Error('IndexedDB blocked'))
    })
    // Another tab upgrading the schema must not be blocked by this one.
    db.onversionchange = () => db.close()
    return new IndexedLocalDb(name, db)
  } catch {
    return new MemoryLocalDb()
  }
}

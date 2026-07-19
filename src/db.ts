import type { BackupFile, WorkoutSession } from './types'

const DATABASE_NAME = 'trainings-app-db'
const STORE_NAME = 'sessions'
const DATABASE_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('completedAt', 'completedAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, mode)
    const request = work(tx.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => database.close()
    tx.onerror = () => reject(tx.error)
  })
}

export const saveSession = (session: WorkoutSession) => transaction('readwrite', (store) => store.put(session))

export const getAllSessions = async (): Promise<WorkoutSession[]> => {
  const sessions = await transaction<WorkoutSession[]>('readonly', (store) => store.getAll())
  return sessions.sort((left, right) => right.startedAt.localeCompare(left.startedAt))
}

export const deleteSession = (id: string) => transaction('readwrite', (store) => store.delete(id))

export const clearSessions = () => transaction('readwrite', (store) => store.clear())

export async function importBackup(backup: BackupFile): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.clear()
    backup.sessions.forEach((session) => store.put(session))
    tx.oncomplete = () => {
      database.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export function isValidBackup(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BackupFile>
  return candidate.app === 'trainings-app' && candidate.version === 1 && Array.isArray(candidate.sessions) && candidate.sessions.every((session) =>
    Boolean(session && typeof session.id === 'string' && typeof session.unitId === 'string' && Array.isArray(session.exercises)),
  )
}

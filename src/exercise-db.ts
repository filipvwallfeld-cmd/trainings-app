import type { CustomExerciseInput, Exercise } from './types'

const DATABASE_NAME = 'trainings-app-custom-exercises-db'
const STORE_NAME = 'exercises'
const DATABASE_VERSION = 1
const missing = 'Für eigene Übungen nicht angegeben.'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
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

function createId() {
  return `custom-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`
}

export function createCustomExercise(input: CustomExerciseInput): Exercise {
  const name = input.name.trim()
  return {
    id: createId(),
    name,
    category: input.category,
    goal: 'Eigene Übung',
    execution: missing,
    mistakes: missing,
    easier: missing,
    harder: missing,
    substitute: missing,
    primaryMuscle: input.primaryMuscle?.trim() || input.category,
    equipment: input.equipment?.trim() || 'Nicht angegeben',
    laterality: input.laterality ?? 'bilateral',
    trackingMode: input.trackingMode,
    custom: true,
  }
}

export const saveCustomExercise = (exercise: Exercise) => transaction('readwrite', (store) => store.put(exercise))

export async function getCustomExercises(): Promise<Exercise[]> {
  const items = await transaction<Exercise[]>('readonly', (store) => store.getAll())
  return items
    .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
    .map((item) => ({
      ...item,
      primaryMuscle: item.primaryMuscle || item.category,
      equipment: item.equipment || 'Nicht angegeben',
      laterality: item.laterality || 'bilateral',
      trackingMode: item.trackingMode || 'weight_reps',
      custom: true,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'de'))
}

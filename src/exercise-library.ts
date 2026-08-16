import { isSetCompleted } from './session'
import type { Exercise, WorkoutSession } from './types'

export type ExerciseFilter = 'all' | 'recent' | 'chest' | 'back' | 'legs' | 'posterior' | 'shoulders' | 'biceps' | 'triceps' | 'calves' | 'core' | 'mobility'

export const exerciseFilters: Array<{ id: ExerciseFilter; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'recent', label: 'Zuletzt' },
  { id: 'chest', label: 'Brust' },
  { id: 'back', label: 'Rücken' },
  { id: 'legs', label: 'Beine' },
  { id: 'posterior', label: 'Gesäß / hintere Kette' },
  { id: 'shoulders', label: 'Schultern' },
  { id: 'biceps', label: 'Bizeps' },
  { id: 'triceps', label: 'Trizeps' },
  { id: 'calves', label: 'Waden' },
  { id: 'core', label: 'Core' },
  { id: 'mobility', label: 'Mobility' },
]

function searchText(exercise: Exercise) {
  return [exercise.name, exercise.category, exercise.primaryMuscle, ...(exercise.secondaryMuscles ?? []), exercise.equipment].join(' ').toLocaleLowerCase('de')
}

export function matchesExerciseQuery(exercise: Exercise, query: string) {
  return searchText(exercise).includes(query.trim().toLocaleLowerCase('de'))
}

export function matchesExerciseFilter(exercise: Exercise, filter: ExerciseFilter, recentIds: string[]) {
  const muscle = exercise.primaryMuscle.toLocaleLowerCase('de')
  const name = exercise.name.toLocaleLowerCase('de')
  if (filter === 'all') return true
  if (filter === 'recent') return recentIds.includes(exercise.id)
  if (filter === 'chest') return exercise.category === 'Brust' || muscle.includes('brust')
  if (filter === 'back') return exercise.category === 'Rücken' || muscle === 'rücken'
  if (filter === 'legs') return exercise.category === 'Beine' || exercise.category === 'Knie'
  if (filter === 'posterior') return muscle.includes('hintere') || muscle.includes('gesäß') || name.includes('hip thrust') || name.includes('glute') || name.includes('beinbeuger')
  if (filter === 'shoulders') return exercise.category === 'Schultern' || muscle.includes('schulter')
  if (filter === 'biceps') return muscle.includes('bizeps')
  if (filter === 'triceps') return muscle.includes('trizeps')
  if (filter === 'calves') return muscle.includes('wade') || name.includes('waden')
  if (filter === 'core') return exercise.category === 'Core' || muscle.includes('core')
  return exercise.category === 'Mobility' || exercise.category === 'Nacken/HWS'
}

export function recentExerciseIds(sessions: WorkoutSession[]) {
  const ids: string[] = []
  const seen = new Set<string>()
  const completed = [...sessions]
    .filter((session) => session.status === 'completed')
    .sort((left, right) => (right.completedAt ?? right.startedAt).localeCompare(left.completedAt ?? left.startedAt))

  for (const session of completed) {
    for (const exercise of [...session.exercises].sort((left, right) => left.order - right.order)) {
      if (exercise.removed || exercise.skipped || !exercise.sets.some((set) => isSetCompleted(set)) || seen.has(exercise.exerciseId)) continue
      seen.add(exercise.exerciseId)
      ids.push(exercise.exerciseId)
    }
  }
  return ids
}

export function filterExercises(exercises: Exercise[], query: string, filter: ExerciseFilter, recentIds: string[]) {
  const recentOrder = new Map(recentIds.map((id, index) => [id, index]))
  return exercises
    .filter((exercise) => matchesExerciseQuery(exercise, query) && matchesExerciseFilter(exercise, filter, recentIds))
    .sort((left, right) => filter === 'recent'
      ? (recentOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (recentOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      : left.name.localeCompare(right.name, 'de'))
}

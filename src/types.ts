export type Category =
  | 'Brust'
  | 'Rücken'
  | 'Schultern'
  | 'Arme'
  | 'Beine'
  | 'Core'
  | 'Mobility'
  | 'Knie'
  | 'Nacken/HWS'

export type Exercise = {
  id: string
  name: string
  category: Category
  goal: string
  execution: string
  mistakes: string
  easier: string
  harder: string
  substitute: string
}

export type RoutineStep = {
  exerciseId: string
  prescription: string
  note: string
  targetSets?: number
}

export type PlanUnit = {
  id: string
  name: string
  shortName: string
  kind: 'strength' | 'routine'
  description: string
  frequency: string
  steps: RoutineStep[]
}

export type SetEntry = {
  id: string
  weight: string
  reps: string
  rir: string
  done: boolean
}

export type WorkoutExercise = RoutineStep & {
  sets: SetEntry[]
  userNote: string
  skipped: boolean
}

export type PainValues = {
  neck: number
  lowerBack: number
  hip: number
  leftKnee: number
}

export type WorkoutSession = {
  id: string
  unitId: string
  unitName: string
  kind: 'strength' | 'routine'
  status: 'active' | 'completed'
  startedAt: string
  completedAt?: string
  exercises: WorkoutExercise[]
  durationMinutes: number
  effort: number
  pain: PainValues
  note: string
  isPaused: boolean
  pauseStartedAt?: string
  pausedMs: number
  restEndsAt?: string
}

export type BackupFile = {
  app: 'trainings-app'
  version: 1
  exportedAt: string
  sessions: WorkoutSession[]
}

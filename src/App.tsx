import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { exerciseById, exercises, freeWorkoutTemplate, medicalNotice, neckWarning, painRules, planUnits, strengthExerciseIds, unitById } from './data'
import { clearSessions, deleteSession, getAllSessions, importBackup, isValidBackup, saveSession } from './db'
import { calculateExerciseStatistics, createSessionExercise, createSet, createWorkoutSession, DEFAULT_REST_SECONDS } from './session'
import type { BackupFile, Category, Exercise, SessionExercise, WorkoutExercise, WorkoutSection, WorkoutSession } from './types'

type Tab = 'today' | 'train' | 'plan' | 'exercises' | 'history' | 'settings'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Heute', icon: '●' },
  { id: 'train', label: 'Trainieren', icon: '▶' },
  { id: 'plan', label: 'Plan', icon: '▤' },
  { id: 'exercises', label: 'Übungen', icon: '◇' },
  { id: 'history', label: 'Verlauf', icon: '↻' },
  { id: 'settings', label: 'Einstellungen', icon: '⚙' },
]

const categories: Array<'Alle' | Category> = ['Alle', 'Brust', 'Rücken', 'Schultern', 'Arme', 'Beine', 'Core', 'Mobility', 'Knie', 'Nacken/HWS']

const sectionLabels: Record<WorkoutSection, string> = {
  warmup: 'Warm-up & Mobility',
  strength: 'Krafttraining',
  core: 'Core / Prehab',
  cooldown: 'Cool-down / Mobility',
  routine: 'Routine',
}

function formatDate(value?: string) {
  if (!value) return '–'
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatShortDate(value?: string) {
  if (!value) return '–'
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(value))
}

function sessionMinutes(session: WorkoutSession) {
  const end = session.completedAt ? new Date(session.completedAt).getTime() : Date.now()
  const currentPause = session.isPaused && session.pauseStartedAt ? end - new Date(session.pauseStartedAt).getTime() : 0
  return Math.max(0, Math.round((end - new Date(session.startedAt).getTime() - session.pausedMs - currentPause) / 60000))
}

function App() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [active, setActive] = useState<WorkoutSession | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const refresh = async () => {
    const all = await getAllSessions()
    setSessions(all)
    setActive(all.find((session) => session.status === 'active') ?? null)
    setLoading(false)
  }

  useEffect(() => {
    refresh().catch(() => {
      setLoading(false)
      setToast('Lokale Daten konnten nicht geladen werden.')
    })
  }, [])

  useEffect(() => {
    const readHash = () => {
      const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
      const nextTab = tabs.some((item) => item.id === parts[0]) ? (parts[0] as Tab) : 'today'
      setTab(nextTab)
      setDetailId(nextTab === 'history' ? parts[1] ?? null : null)
      setPlanId(nextTab === 'plan' ? parts[1] ?? null : null)
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const navigate = (nextTab: Tab, id?: string) => {
    window.location.hash = `/${nextTab}${id ? `/${id}` : ''}`
  }

  const begin = async (unitId: string) => {
    if (active) {
      setToast('Dein unfertiges Training wurde wieder geöffnet.')
      navigate('train')
      return
    }
    const unit = unitById.get(unitId)
    if (!unit) throw new Error('Trainingseinheit nicht gefunden')
    const session = createWorkoutSession(unit)
    await saveSession(session)
    setActive(session)
    setSessions((current) => [session, ...current])
    navigate('train')
  }

  const complete = async (session: WorkoutSession) => {
    await saveSession(session)
    setActive(null)
    await refresh()
    navigate('history', session.id)
    setToast('Training gespeichert.')
  }

  const completed = sessions.filter((session) => session.status === 'completed')
  const latest = completed[0]

  if (loading) return <div className="splash"><div className="brand-mark">M</div><p>Dein Training wird geladen …</p></div>

  let content: ReactNode
  if (tab === 'today') content = <Today latest={latest} active={active} onBegin={begin} onOpenHistory={(id) => navigate('history', id)} />
  else if (tab === 'train') content = active
    ? <ActiveWorkout session={active} history={completed} onChange={setActive} onComplete={complete} onToast={setToast} />
    : <Train onBegin={begin} />
  else if (tab === 'plan') content = <Plan selectedId={planId} onSelect={(id) => navigate('plan', id)} onBegin={begin} />
  else if (tab === 'exercises') content = <Exercises sessions={completed} />
  else if (tab === 'history') content = <History sessions={completed} detailId={detailId} onOpen={(id) => navigate('history', id)} onBack={() => navigate('history')} onDelete={async (id) => { await deleteSession(id); await refresh(); navigate('history'); setToast('Eintrag gelöscht.') }} />
  else content = <Settings sessions={sessions} onRefresh={refresh} onToast={setToast} />

  return (
    <div className="app-shell">
      <main className="content">{content}</main>
      <nav className="bottom-nav" aria-label="Hauptnavigation">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.id)}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function PageHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return <header className="page-header"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{text && <p>{text}</p>}</header>
}

function Today({ latest, active, onBegin, onOpenHistory }: { latest?: WorkoutSession; active: WorkoutSession | null; onBegin: (id: string) => void; onOpenHistory: (id: string) => void }) {
  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend'
  return (
    <>
      <PageHeader eyebrow={new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())} title={`${greeting}, Filip`} text="Was tut dir heute gut?" />
      {active && <button className="resume-card" onClick={() => onBegin(active.unitId)}><span><small>Unfertiges Training</small><strong>{active.unitName}</strong></span><b>Fortsetzen →</b></button>}
      <section className="hero-card">
        <div><span className="tag">Krafttraining</span><h2>Ganzkörper A</h2><p>Brust, Rücken und Kniekontrolle</p></div>
        <button className="round-action" onClick={() => onBegin('training-a')} aria-label="Training A starten">▶</button>
      </section>
      <div className="section-heading"><h2>Heute auswählen</h2><span>Dein Plan</span></div>
      <div className="unit-grid">
        {planUnits.filter((unit) => unit.id !== 'training-a').map((unit) => <UnitCard key={unit.id} unitId={unit.id} onBegin={onBegin} />)}
      </div>
      <div className="section-heading"><h2>Zuletzt</h2></div>
      {latest ? (
        <button className="history-preview" onClick={() => onOpenHistory(latest.id)}>
          <span className="history-date">{formatShortDate(latest.completedAt)}</span>
          <span><strong>{latest.unitName}</strong><small>{latest.durationMinutes} Min · Anstrengung {latest.effort}/10</small></span><b>›</b>
        </button>
      ) : <div className="empty-card"><strong>Noch kein Training gespeichert</strong><p>Dein erstes abgeschlossenes Training erscheint hier.</p></div>}
    </>
  )
}

function UnitCard({ unitId, onBegin }: { unitId: string; onBegin: (id: string) => void }) {
  const unit = unitById.get(unitId)!
  const icon = unit.kind === 'strength' ? '↗' : unit.id === 'mobility' ? '≈' : unit.id === 'knee' ? '⌁' : unit.id === 'neck' ? '◉' : unit.id === 'cardio' ? '⌁' : '◇'
  return <button className={`unit-card accent-${unit.id}`} onClick={() => onBegin(unit.id)}><span className="unit-icon">{icon}</span><span><strong>{unit.shortName}</strong><small>{unit.frequency}</small></span><b>›</b></button>
}

function Train({ onBegin }: { onBegin: (id: string) => void }) {
  return <><PageHeader eyebrow="Bereit, wenn du es bist" title="Trainieren" text="Wähle eine Einheit. Deine Eingaben bleiben automatisch auf diesem Gerät gespeichert." />
    <div className="stack">
      {planUnits.slice(0, 2).map((unit, index) => <article className="training-choice" key={unit.id}><div className="choice-number">0{index + 1}</div><span className="tag">{unit.frequency}</span><h2>{unit.name}</h2><p>{unit.description}</p><div className="choice-meta"><span>{unit.steps.filter((step) => step.section === 'strength').length} Kraftübungen</span><span>ca. 60–75 Min</span></div><button className="primary wide" onClick={() => onBegin(unit.id)}>Training starten <span>→</span></button></article>)}
    </div>
    <button className="free-workout-button" onClick={() => onBegin(freeWorkoutTemplate.id)}><span><strong>Freie Einheit</strong><small>Übungen für heute selbst zusammenstellen</small></span><b>+</b></button>
    <div className="section-heading"><h2>Kurze Routinen</h2></div>
    <div className="unit-grid">{planUnits.slice(2).map((unit) => <UnitCard key={unit.id} unitId={unit.id} onBegin={onBegin} />)}</div>
  </>
}

function Plan({ selectedId, onSelect, onBegin }: { selectedId: string | null; onSelect: (id: string) => void; onBegin: (id: string) => void }) {
  if (selectedId) {
    const unit = unitById.get(selectedId)
    if (unit) return <><button className="back-button" onClick={() => window.location.hash = '/plan'}>← Plan</button><PageHeader eyebrow={unit.frequency} title={unit.name} text={unit.description} />
      {(unit.kind === 'strength' ? (['warmup', 'strength', 'core', 'cooldown'] as WorkoutSection[]) : ['routine'] as WorkoutSection[]).map((section) => {
        const sectionSteps = unit.steps.filter((step) => (step.section ?? 'routine') === section)
        if (!sectionSteps.length) return null
        return <section className={section === 'strength' ? 'plan-section strength' : 'plan-section'} key={section}><div className="plan-section-title"><span>{sectionLabels[section]}</span><small>{sectionSteps.length} Übungen</small></div><div className="plan-list">{sectionSteps.map((item, index) => { const exercise = exerciseById.get(item.exerciseId); return <article className="plan-step" key={item.templateExerciseId ?? `${item.exerciseId}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{exercise?.name}</h3><strong>{item.prescription}</strong><p>{item.note}</p></div></article> })}</div></section>
      })}
      <button className="primary wide sticky-action" onClick={() => onBegin(unit.id)}>Einheit starten</button>
    </>
  }
  return <><PageHeader eyebrow="Trainingsplan Version 6" title="Dein Plan" text="2–3 realistische Trainingstage mit Kraft, Mobility und Prävention." />
    <div className="week-card"><span>Minimalwoche</span><strong>Training A + Training B</strong><small>Gute Woche: zusätzlich lockeres Bike oder Walk/Jog</small></div>
    <div className="stack">{planUnits.map((unit) => <button className="plan-unit" key={unit.id} onClick={() => onSelect(unit.id)}><div><span className="tag">{unit.frequency}</span><h2>{unit.name}</h2><p>{unit.description}</p></div><b>›</b></button>)}</div>
    <section className="notice warning"><strong>Schmerzampel</strong>{painRules.map(([level, rule]) => <div className="rule" key={level}><span>{level}</span><p>{rule}</p></div>)}</section>
    <section className="notice danger"><strong>Nacken/HWS</strong><p>{neckWarning}</p></section>
  </>
}

function Exercises({ sessions }: { sessions: WorkoutSession[] }) {
  const [category, setCategory] = useState<'Alle' | Category>('Alle')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const filtered = exercises.filter((item) => (category === 'Alle' || item.category === category) && item.name.toLowerCase().includes(query.toLowerCase()))
  return <><PageHeader eyebrow={`${exercises.length} Übungen aus deinem Plan`} title="Übungen" text="Hinweise werden nur so angezeigt, wie sie im Trainingsplan stehen." />
    <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Übung suchen" /></label>
    <div className="filter-row">{categories.map((item) => <button key={item} className={category === item ? 'chip active' : 'chip'} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="exercise-list">{filtered.map((item) => <article className={openId === item.id ? 'exercise-library-card open' : 'exercise-library-card'} key={item.id}>
      <button className="exercise-summary" onClick={() => setOpenId(openId === item.id ? null : item.id)}><ExerciseArt category={item.category} /><span><small>{item.category}</small><strong>{item.name}</strong><em>{item.goal}</em></span><b>{openId === item.id ? '−' : '+'}</b></button>
      {openId === item.id && <div className="exercise-details"><Info label="Ausführung" value={item.execution} /><Info label="Häufige Fehler" value={item.mistakes} /><Info label="Leichter" value={item.easier} /><Info label="Schwieriger" value={item.harder} /><Info label="Ersatz" value={item.substitute} />{strengthExerciseIds.has(item.id) && <ExerciseProgress exercise={item} sessions={sessions} />}</div>}
    </article>)}</div>
  </>
}

function ExerciseProgress({ exercise, sessions }: { exercise: Exercise; sessions: WorkoutSession[] }) {
  const statistics = useMemo(() => calculateExerciseStatistics(sessions, exercise.id), [sessions, exercise.id])
  const maxVolume = Math.max(1, ...statistics.points.map((point) => point.volume))
  if (!statistics.points.length) return <div className="progress-empty"><strong>Kraftstatistik</strong><p>Noch keine abgeschlossenen Arbeitssätze für diese Übung.</p></div>
  return <section className="exercise-progress"><div className="progress-title"><strong>Kraftstatistik</strong><small>{statistics.points.length} Einheiten</small></div><div className="progress-stats"><div><strong>{formatNumber(statistics.highestWeight)} kg</strong><small>Gewichtsrekord</small></div><div><strong>{formatNumber(statistics.volumeRecord)} kg</strong><small>Volumenrekord</small></div><div><strong>{statistics.totalWorkSets}</strong><small>Arbeitssätze</small></div><div><strong>{formatNumber(statistics.estimatedOneRepMax)} kg</strong><small>geschätztes 1RM</small></div></div><div className="volume-chart" aria-label="Volumenverlauf">{statistics.points.slice(-8).map((point) => <div key={point.sessionId}><span style={{ height: `${Math.max(8, (point.volume / maxVolume) * 100)}%` }} /><small>{new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(point.date))}</small></div>)}</div><p className="progress-summary">Gesamtvolumen {formatNumber(statistics.totalVolume)} kg · Höchste Wiederholungszahl {statistics.highestReps}</p></section>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)
}

function completedVolume(exercises: SessionExercise[]) {
  return exercises.filter((exercise) => !exercise.removed && !exercise.skipped).flatMap((exercise) => exercise.sets).filter((set) => set.done).reduce((sum, set) => {
    const weight = Number(set.weight.replace(',', '.')) || 0
    const reps = Number(set.reps) || 0
    return sum + weight * reps
  }, 0)
}

function ExerciseArt({ category }: { category: Category }) {
  const marks: Record<Category, string> = { Brust: '↔', Rücken: '⌁', Schultern: '╱╲', Arme: '⌒', Beine: '╱', Core: '◎', Mobility: '≈', Knie: '⌞', 'Nacken/HWS': '◉' }
  return <span className="exercise-art" aria-hidden="true"><i>{marks[category]}</i></span>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="info-row"><strong>{label}</strong><p className={value.startsWith('Im Trainingsplan') ? 'muted' : ''}>{value}</p></div>
}

function ActiveWorkout({ session, history, onChange, onComplete, onToast }: { session: WorkoutSession; history: WorkoutSession[]; onChange: (session: WorkoutSession) => void; onComplete: (session: WorkoutSession) => void; onToast: (message: string) => void }) {
  const [finishOpen, setFinishOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const [picker, setPicker] = useState<{ mode: 'add' | 'replace'; exerciseIndex?: number } | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveSession(session).catch(() => onToast('Automatisches Speichern fehlgeschlagen.')), 350)
    return () => window.clearTimeout(saveTimer.current)
  }, [session, onToast])

  const updateExercise = (index: number, update: (exercise: WorkoutExercise) => WorkoutExercise) => {
    onChange({ ...session, exercises: session.exercises.map((exercise, exerciseIndex) => exerciseIndex === index ? update(exercise) : exercise) })
  }

  const toggleSet = (exerciseIndex: number, setId: string) => {
    const exercise = session.exercises[exerciseIndex]
    const set = exercise.sets.find((entry) => entry.id === setId)
    if (!set) return
    const done = !set.done
    onChange({
      ...session,
      exercises: session.exercises.map((item, index) => index === exerciseIndex ? {
        ...item,
        sets: item.sets.map((entry) => entry.id === setId ? { ...entry, done, restSeconds: done ? item.restSeconds : entry.restSeconds } : entry),
      } : item),
      restEndsAt: done && exercise.section === 'strength' ? new Date(Date.now() + exercise.restSeconds * 1000).toISOString() : session.restEndsAt,
      restExerciseId: done && exercise.section === 'strength' ? exercise.id : session.restExerciseId,
    })
  }

  const chooseExercise = (selected: Exercise) => {
    if (!picker) return
    if (picker.mode === 'replace' && picker.exerciseIndex !== undefined) {
      const current = session.exercises[picker.exerciseIndex]
      const replacement = createSessionExercise(selected, current.order, 'replacement', {
        templateExerciseId: current.templateExerciseId,
        replacedExerciseId: current.exerciseId,
        section: current.section,
        targetSets: current.sets.length || current.targetSets || 3,
        restSeconds: current.restSeconds,
        prescription: current.prescription,
        note: `Für diese Session statt ${current.exerciseName}`,
      })
      onChange({ ...session, exercises: session.exercises.map((item, index) => index === picker.exerciseIndex ? replacement : item) })
    } else {
      const insertionIndex = session.exercises.reduce((last, item, index) => item.section === 'strength' ? index + 1 : last, 0)
      const added = createSessionExercise(selected, insertionIndex, 'added', { section: 'strength', targetSets: 3, restSeconds: DEFAULT_REST_SECONDS })
      const next = [...session.exercises]
      next.splice(insertionIndex, 0, added)
      onChange({ ...session, exercises: next.map((item, index) => ({ ...item, order: index })) })
    }
    setPicker(null)
  }

  const togglePause = () => {
    if (session.isPaused && session.pauseStartedAt) {
      onChange({ ...session, isPaused: false, pausedMs: session.pausedMs + Date.now() - new Date(session.pauseStartedAt).getTime(), pauseStartedAt: undefined })
    } else onChange({ ...session, isPaused: true, pauseStartedAt: new Date().toISOString() })
  }

  const requiredExercises = session.kind === 'strength' ? session.exercises.filter((item) => item.section === 'strength' && !item.removed && !item.skipped) : session.exercises.filter((item) => !item.removed && !item.skipped)
  const doneSets = requiredExercises.flatMap((item) => item.sets).filter((set) => set.done).length
  const totalSets = requiredExercises.flatMap((item) => item.sets).length
  const progress = totalSets ? Math.round((doneSets / totalSets) * 100) : 0
  const elapsed = sessionMinutes(session)

  const renderCompactSection = (section: WorkoutSection, summary: string) => {
    const sectionItems = session.exercises.map((item, index) => ({ item, index })).filter(({ item }) => item.section === section && !item.removed)
    if (!sectionItems.length) return null
    return <details className="compact-workout-section"><summary><span><strong>{sectionLabels[section]}</strong><small>{sectionItems.length} Übungen · {summary}</small></span><b>›</b></summary><div className="compact-exercise-list">{sectionItems.map(({ item, index }) => <div className={item.skipped ? 'compact-exercise skipped' : 'compact-exercise'} key={item.id}><button className={item.sets[0]?.done ? 'compact-check done' : 'compact-check'} onClick={() => item.sets[0] && toggleSet(index, item.sets[0].id)}>{item.sets[0]?.done ? '✓' : ''}</button><span><strong>{item.exerciseName}</strong><small>{item.prescription}</small></span><div className="compact-actions"><button onClick={() => setPicker({ mode: 'replace', exerciseIndex: index })}>Ersetzen</button><button onClick={() => updateExercise(index, (exercise) => ({ ...exercise, removed: true }))}>Entfernen</button></div></div>)}</div></details>
  }

  const renderStrengthExercise = (item: SessionExercise, exerciseIndex: number) => {
    const detail = exerciseById.get(item.exerciseId)
    const previous = history.find((past) => past.exercises.some((exercise) => exercise.exerciseId === item.exerciseId && !exercise.removed))?.exercises.find((exercise) => exercise.exerciseId === item.exerciseId && !exercise.removed)
    return <article className={item.skipped ? 'workout-exercise skipped' : 'workout-exercise'} key={item.id} data-exercise-id={item.exerciseId}>
      <div className="exercise-head"><span className="exercise-index">{String(session.exercises.filter((exercise) => exercise.section === 'strength' && !exercise.removed).findIndex((exercise) => exercise.id === item.id) + 1).padStart(2, '0')}</span><div><h2>{item.exerciseName}</h2><p>{item.prescription} · {item.note}</p>{item.source !== 'template' && <span className={`source-badge ${item.source}`}>{item.source === 'added' ? 'Heute hinzugefügt' : `Heute ersetzt: ${exerciseById.get(item.replacedExerciseId ?? '')?.name ?? item.replacedExerciseId}`}</span>}</div></div>
      <div className="session-exercise-actions"><button onClick={() => setPicker({ mode: 'replace', exerciseIndex })}>Für heute ersetzen</button><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, removed: true }))}>Für heute entfernen</button><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, skipped: !exercise.skipped }))}>{item.skipped ? 'Übung fortsetzen' : 'Überspringen'}</button></div>
      {detail && <details className="instructions"><summary>Ausführung & Ersatz</summary><p>{detail.execution}</p><small>Ersatz: {detail.substitute}</small></details>}
      {previous && <div className="previous-values"><span>Letztes Mal</span><strong>{previous.sets.map((set) => `${set.weight ? `${set.weight} kg × ` : ''}${set.reps || '–'}`).join(' · ')}</strong></div>}
      {!item.skipped && <>
        <div className="exercise-rest-setting"><span>Pause <strong>{formatSeconds(item.restSeconds)}</strong></span><div><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, restSeconds: Math.max(30, exercise.restSeconds - 30) }))}>−30</button><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, restSeconds: Math.min(600, exercise.restSeconds + 30) }))}>+30</button></div></div>
        <div className="set-labels"><span>Satz</span><span>kg</span><span>Wdh.</span><span>RIR</span><span>Fertig</span></div>
        <div className="sets">{item.sets.map((set, setIndex) => <div className={set.done ? 'set-row done' : 'set-row'} key={set.id}>
          <span className="set-number">{setIndex + 1}</span>
          <input aria-label={`${item.exerciseName} Gewicht Satz ${setIndex + 1}`} inputMode="decimal" placeholder={previous?.sets[setIndex]?.weight || '–'} value={set.weight} onChange={(event) => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: exercise.sets.map((current) => current.id === set.id ? { ...current, weight: event.target.value.replace('.', ',') } : current) }))} />
          <input aria-label={`${item.exerciseName} Wiederholungen Satz ${setIndex + 1}`} inputMode="numeric" placeholder={previous?.sets[setIndex]?.reps || '–'} value={set.reps} onChange={(event) => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: exercise.sets.map((current) => current.id === set.id ? { ...current, reps: event.target.value } : current) }))} />
          <input aria-label={`${item.exerciseName} RIR Satz ${setIndex + 1}`} inputMode="numeric" placeholder="–" value={set.rir} onChange={(event) => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: exercise.sets.map((current) => current.id === set.id ? { ...current, rir: event.target.value } : current) }))} />
          <button aria-label={`${item.exerciseName} Satz ${setIndex + 1} abhaken`} className="check-button" onClick={() => toggleSet(exerciseIndex, set.id)}>{set.done ? '✓' : ''}</button>
        </div>)}</div>
        <div className="set-actions"><button onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: [...exercise.sets, createSet()] }))}>+ Satz</button><button disabled={item.sets.length <= 1} onClick={() => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, sets: exercise.sets.slice(0, -1) }))}>− Satz</button></div>
        <textarea className="exercise-note" placeholder="Notiz zu dieser Übung …" value={item.userNote} onChange={(event) => updateExercise(exerciseIndex, (exercise) => ({ ...exercise, userNote: event.target.value }))} />
      </>}
    </article>
  }

  return <div className="active-workout">
    <header className="workout-header"><div><span className="live-dot">● LIVE</span><h1>{session.unitName}</h1><small>{elapsed} Min · {doneSets}/{totalSets} Sätze</small></div><button className="icon-button" onClick={togglePause}>{session.isPaused ? '▶' : 'Ⅱ'}</button></header>
    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    {session.isPaused && <div className="paused-banner"><strong>Training pausiert</strong><button onClick={togglePause}>Fortsetzen</button></div>}
    {session.kind === 'strength' && <RestTimer session={session} tick={tick} onChange={onChange} />}
    {session.kind === 'strength' ? <>
      {renderCompactSection('warmup', 'ca. 7 Minuten')}
      <div className="workout-section-heading"><span>Krafttraining</span><small>{session.exercises.filter((item) => item.section === 'strength' && !item.removed).length} Übungen</small></div>
      <div className="active-exercises">{session.exercises.map((item, exerciseIndex) => item.section === 'strength' && !item.removed ? renderStrengthExercise(item, exerciseIndex) : null)}</div>
      <button className="add-exercise-button" onClick={() => setPicker({ mode: 'add' })}>+ Übung hinzufügen</button>
      {renderCompactSection('core', 'optional')}
      {renderCompactSection('cooldown', 'ca. 3–5 Minuten')}
    </> : <div className="routine-session-list">{session.exercises.map((item, index) => !item.removed && <div className="compact-exercise" key={item.id}><button className={item.sets[0]?.done ? 'compact-check done' : 'compact-check'} onClick={() => item.sets[0] && toggleSet(index, item.sets[0].id)}>{item.sets[0]?.done ? '✓' : ''}</button><span><strong>{item.exerciseName}</strong><small>{item.prescription}</small></span></div>)}</div>}
    {session.exercises.some((item) => item.removed) && <details className="removed-exercises"><summary>Für heute entfernt ({session.exercises.filter((item) => item.removed).length})</summary>{session.exercises.map((item, index) => item.removed && <button key={item.id} onClick={() => updateExercise(index, (exercise) => ({ ...exercise, removed: false }))}>{item.exerciseName} wiederherstellen</button>)}</details>}
    <button className="finish-button" onClick={() => setFinishOpen(true)}>Training beenden</button>
    {finishOpen && <FinishSheet session={{ ...session, durationMinutes: session.durationMinutes || elapsed }} onClose={() => setFinishOpen(false)} onComplete={onComplete} />}
    {picker && <ExercisePicker mode={picker.mode} currentExerciseId={picker.exerciseIndex === undefined ? undefined : session.exercises[picker.exerciseIndex]?.exerciseId} onSelect={chooseExercise} onClose={() => setPicker(null)} />}
  </div>
}

function RestTimer({ session, tick, onChange }: { session: WorkoutSession; tick: number; onChange: (session: WorkoutSession) => void }) {
  const remaining = session.restEndsAt ? Math.max(0, Math.ceil((new Date(session.restEndsAt).getTime() - Date.now()) / 1000)) : 0
  const activeExercise = session.exercises.find((item) => item.id === session.restExerciseId)
  const adjust = (seconds: number) => onChange({ ...session, restEndsAt: new Date(Math.max(Date.now(), new Date(session.restEndsAt ?? Date.now()).getTime() + seconds * 1000)).toISOString() })
  const stop = () => onChange({ ...session, restEndsAt: undefined, restExerciseId: undefined })
  return <div className={session.restEndsAt ? 'rest-timer running' : 'rest-timer'} data-tick={tick}><div><small>{activeExercise ? `Pause nach ${activeExercise.exerciseName}` : 'Pausentimer · Standard'}</small><strong>{session.restEndsAt ? formatSeconds(remaining) : formatSeconds(DEFAULT_REST_SECONDS)}</strong></div>{session.restEndsAt ? <><button onClick={() => adjust(-30)}>−30</button><button onClick={() => adjust(30)}>+30</button><button className="ghost" onClick={stop}>{remaining ? 'Überspringen' : 'Beenden'}</button></> : <button onClick={() => onChange({ ...session, restEndsAt: new Date(Date.now() + DEFAULT_REST_SECONDS * 1000).toISOString() })}>Start</button>}</div>
}

function formatSeconds(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function ExercisePicker({ mode, currentExerciseId, onSelect, onClose }: { mode: 'add' | 'replace'; currentExerciseId?: string; onSelect: (exercise: Exercise) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const candidates = exercises.filter((exercise) => exercise.id !== currentExerciseId && (mode === 'replace' || strengthExerciseIds.has(exercise.id)) && exercise.name.toLowerCase().includes(query.toLowerCase()))
  return <div className="sheet-backdrop"><section className="exercise-picker" role="dialog" aria-modal="true"><div className="sheet-handle" /><div className="sheet-title"><div><span className="eyebrow">Nur diese Session</span><h2>{mode === 'add' ? 'Übung hinzufügen' : 'Übung ersetzen'}</h2></div><button className="icon-button" onClick={onClose}>×</button></div><label className="search"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Übung suchen" /></label><div className="picker-list">{candidates.map((exercise) => <button key={exercise.id} onClick={() => onSelect(exercise)}><ExerciseArt category={exercise.category} /><span><strong>{exercise.name}</strong><small>{exercise.category}</small></span><b>+</b></button>)}</div></section></div>
}

function FinishSheet({ session, onClose, onComplete }: { session: WorkoutSession; onClose: () => void; onComplete: (session: WorkoutSession) => void }) {
  const [draft, setDraft] = useState(session)
  const painFields: Array<[keyof WorkoutSession['pain'], string]> = [['neck', 'Nacken'], ['lowerBack', 'Unterer Rücken'], ['hip', 'Hüfte'], ['leftKnee', 'Linkes Knie']]
  return <div className="sheet-backdrop"><section className="finish-sheet" role="dialog" aria-modal="true"><div className="sheet-handle" /><div className="sheet-title"><div><span className="eyebrow">Fast geschafft</span><h2>Training abschließen</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
    <label className="field"><span>Trainingsdauer</span><div className="input-suffix"><input inputMode="numeric" value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} /><b>Min</b></div></label>
    <RangeField label="Anstrengung" value={draft.effort} min={1} onChange={(value) => setDraft({ ...draft, effort: value })} />
    <h3 className="subheading">Beschwerden nach dem Training</h3>
    {painFields.map(([key, label]) => <RangeField key={key} label={label} value={draft.pain[key]} min={0} onChange={(value) => setDraft({ ...draft, pain: { ...draft.pain, [key]: value } })} />)}
    <label className="field"><span>Allgemeine Notiz</span><textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Wie lief das Training?" /></label>
    <button className="primary wide" onClick={() => onComplete({ ...draft, status: 'completed', completedAt: new Date().toISOString(), isPaused: false, pauseStartedAt: undefined })}>Vollständig speichern</button>
  </section></div>
}

function RangeField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}<strong>{value}/10</strong></span><input type="range" min={min} max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function History({ sessions, detailId, onOpen, onBack, onDelete }: { sessions: WorkoutSession[]; detailId: string | null; onOpen: (id: string) => void; onBack: () => void; onDelete: (id: string) => void }) {
  const detail = sessions.find((session) => session.id === detailId)
  if (detail) return <HistoryDetail session={detail} onBack={onBack} onDelete={onDelete} />
  return <><PageHeader eyebrow="Lokal auf diesem Gerät" title="Verlauf" text={`${sessions.length} abgeschlossene ${sessions.length === 1 ? 'Einheit' : 'Einheiten'}`} />
    {sessions.length === 0 ? <div className="empty-state"><span>↻</span><h2>Noch kein Verlauf</h2><p>Schließe ein Training ab. Danach findest du hier alle Sätze, Werte und Notizen.</p></div> : <div className="timeline">{sessions.map((session) => <button className="timeline-item" key={session.id} onClick={() => onOpen(session.id)}><span className="timeline-dot" /><div><small>{formatDate(session.completedAt)}</small><strong>{session.unitName}</strong><p>{session.durationMinutes} Min · Anstrengung {session.effort}/10</p></div><b>›</b></button>)}</div>}
  </>
}

function HistoryDetail({ session, onBack, onDelete }: { session: WorkoutSession; onBack: () => void; onDelete: (id: string) => void }) {
  return <><button className="back-button" onClick={onBack}>← Verlauf</button><PageHeader eyebrow={formatDate(session.completedAt)} title={session.unitName} />
    <div className="stat-grid history-overview"><div><strong>{session.durationMinutes}</strong><small>Minuten</small></div><div><strong>{session.effort}/10</strong><small>Anstrengung</small></div><div><strong>{session.exercises.filter((exercise) => !exercise.skipped && !exercise.removed).length}</strong><small>Übungen</small></div><div><strong>{formatNumber(completedVolume(session.exercises))}</strong><small>Volumen kg</small></div></div>
    <div className="pain-summary"><strong>Beschwerden</strong><div><span>Nacken <b>{session.pain.neck}/10</b></span><span>Unterer Rücken <b>{session.pain.lowerBack}/10</b></span><span>Hüfte <b>{session.pain.hip}/10</b></span><span>Linkes Knie <b>{session.pain.leftKnee}/10</b></span></div></div>
    <div className="history-exercises">{session.exercises.map((item, index) => <article className={item.removed ? 'removed' : ''} key={item.id}><div><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.exerciseName}</h3>{item.source === 'added' && <small className="history-source added">Hinzugefügt</small>}{item.source === 'replacement' && <small className="history-source replacement">Ersetzt {exerciseById.get(item.replacedExerciseId ?? '')?.name ?? item.replacedExerciseId}</small>}{item.removed && <small className="history-source removed">Für diese Session entfernt</small>}{item.skipped && !item.removed && <small>Übersprungen</small>}</div>{!item.skipped && !item.removed && <><div className="history-rest">Pause {formatSeconds(item.restSeconds)}</div><div className="history-sets">{item.sets.map((set, setIndex) => <p key={set.id}><span>Satz {setIndex + 1}</span><strong>{set.weight ? `${set.weight} kg` : 'ohne Gewicht'} · {set.reps || '–'} Wdh.{set.rir ? ` · RIR ${set.rir}` : ''}{set.restSeconds ? ` · Pause ${formatSeconds(set.restSeconds)}` : ''}</strong><b>{set.done ? '✓' : '–'}</b></p>)}</div></>}{item.userNote && <blockquote>{item.userNote}</blockquote>}</article>)}</div>
    {session.note && <div className="session-note"><strong>Notiz</strong><p>{session.note}</p></div>}
    <button className="danger-button" onClick={() => { if (window.confirm('Dieses Training wirklich löschen?')) onDelete(session.id) }}>Training löschen</button>
  </>
}

function Settings({ sessions, onRefresh, onToast }: { sessions: WorkoutSession[]; onRefresh: () => Promise<void>; onToast: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const exportData = () => {
    const backup: BackupFile = { app: 'trainings-app', version: 1, exportedAt: new Date().toISOString(), sessions }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `trainings-app-sicherung-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const value: unknown = JSON.parse(await file.text())
      if (!isValidBackup(value)) throw new Error('invalid')
      if (!window.confirm(`Die Sicherung enthält ${value.sessions.length} Einträge. Alle aktuellen lokalen Daten überschreiben?`)) return
      await importBackup(value)
      await onRefresh()
      onToast('Sicherung erfolgreich importiert.')
    } catch {
      onToast('Diese Datei ist keine gültige Trainings-App-Sicherung.')
    }
  }
  const wipe = async () => {
    if (!window.confirm('Wirklich alle lokalen Trainingsdaten löschen? Das kann nicht rückgängig gemacht werden.')) return
    await clearSessions()
    await onRefresh()
    onToast('Alle lokalen Daten wurden gelöscht.')
  }
  return <><PageHeader eyebrow="Privat & offline" title="Einstellungen" text="Deine Trainingsdaten verlassen dieses Gerät nicht." />
    <section className="settings-section"><div className="settings-title"><span>⇩</span><div><h2>Datensicherung</h2><p>{sessions.length} lokale Einträge</p></div></div><button className="setting-row" onClick={exportData}><span><strong>Daten exportieren</strong><small>Als JSON-Datei sichern</small></span><b>›</b></button><button className="setting-row" onClick={() => inputRef.current?.click()}><span><strong>Sicherung importieren</strong><small>Vorhandene Daten überschreiben</small></span><b>›</b></button><input ref={inputRef} className="hidden" type="file" accept="application/json,.json" onChange={importData} /></section>
    <section className="settings-section"><div className="settings-title"><span>⌂</span><div><h2>Offline-App</h2><p>Bereit für den iPhone-Homescreen</p></div></div><div className="offline-steps"><p><b>1</b>In Safari auf „Teilen“ tippen.</p><p><b>2</b>„Zum Home-Bildschirm“ wählen.</p><p><b>3</b>Die App einmal vollständig online öffnen.</p></div></section>
    <section className="notice danger"><strong>Medizinischer Hinweis</strong><p>{medicalNotice}</p></section>
    <button className="danger-button" onClick={wipe}>Alle lokalen Daten löschen</button>
    <p className="version">Trainingsplan Version 6 · App Version 1.0</p>
  </>
}

export default App

import { useState } from 'react'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { nextUpOf, PHASE_MINUTES, useStageView } from '../../lib/stage'
import { store } from '../../lib/store'

const PITCH = PHASE_MINUTES.pitch * 60
const QA = PHASE_MINUTES.qa * 60

/** The stage functions are missing until database update 005 is run in Supabase. */
const needsUpdate = (e: unknown) => /update 005/.test((e as Error)?.message ?? '')

/**
 * Running the stage (admin1). Everything goes through the shared stage row, so the projector
 * (admin2's display login, on any device) and investors' phones follow straight away.
 */
export function useStageControls() {
  const { startups, stage, reload, canEdit } = useOrganiser()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const view = useStageView(stage)
  const pitching = startups.find((s) => s.status === 'pitching') ?? null
  const nextUp = nextUpOf(startups)

  const run = async (fn: () => Promise<void>, failTitle: string) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast({ kind: 'error', title: failTitle, body: (e as Error).message })
    } finally {
      await Promise.all([reload('startups'), reload('stage')])
      setBusy(false)
    }
  }

  /** Puts a startup on stage (the previous one becomes "pitched"): 5 min pitch, then 5 min Q&A, then investor interest. */
  const startPitch = (id: string) =>
    run(async () => {
      try {
        await store.orgStartPitch(id, PITCH, QA)
      } catch (e) {
        if (!needsUpdate(e)) throw e
        // still move the queue on (investors' "Now pitching") even before the projector is set up
        await store.orgSetPitching(id)
        toast({ kind: 'info', title: 'Pitch started (projector timers off)', body: (e as Error).message })
      }
    }, 'Could not start the pitch')

  /** Nobody on stage; the projector goes back to the schedule. */
  const endPitch = () =>
    run(async () => {
      await store.orgSetPitching(null)
      await store.orgSetStage('idle', null, 0, 0).catch((e) => {
        if (!needsUpdate(e)) throw e
      })
    }, 'Could not end the pitch')

  /** Restart the current startup's pitch timer, jump to Q&A, or open the investor-interest screen now. */
  const setPhase = (phase: 'pitch' | 'qa' | 'interest') =>
    pitching &&
    run(
      () => store.orgSetStage('running', pitching.id, phase === 'pitch' ? PITCH : 0, phase === 'interest' ? 0 : QA),
      'Could not change the stage',
    )

  /** Skip the investors' countdown and show the VC-interest results now (they stay until the next pitch). */
  const showResults = () =>
    pitching && run(() => store.orgStageShowResults(pitching.id, PHASE_MINUTES.interest * 60), 'Could not change the stage')
  const showSchedule = () => run(() => store.orgSetStage('idle', null, 0, 0), 'Could not change the stage')
  const toggleBreak = () => run(() => store.orgSetStage(view.phase === 'break' ? 'idle' : 'break', null, 0, 0), 'Could not change the stage')
  const addMinute = () => run(() => store.orgStageAddTime(60), 'Could not add time')
  const slide = (delta: 1 | -1) =>
    void store.orgStageSlide(Math.max(1, (stage?.stage.deckPage ?? 1) + delta)).then(() => reload('stage'), () => {})

  return { stage, view, pitching, nextUp, busy, canEdit, startPitch, endPitch, setPhase, showResults, showSchedule, toggleBreak, addMinute, slide }
}

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Keeps a lyric list glued to the line being sung, while letting the listener
 * take over at any moment: scrolling by hand suspends the follow (so the view
 * stays where they put it) and it quietly resumes a few seconds later, or
 * immediately via `resume()`.
 */
export function useLyricFollow(active: number, opts: { resumeAfter?: number } = {}) {
  const resumeAfter = opts.resumeAfter ?? 6000
  const boxRef = useRef<HTMLDivElement | null>(null)
  const lineRefs = useRef<Array<HTMLElement | null>>([])
  const [following, setFollowing] = useState(true)
  const idleTimer = useRef(0)

  // follow the sung line
  useEffect(() => {
    if (!following || active < 0) return
    const box = boxRef.current
    const line = lineRefs.current[active]
    if (!box || !line) return
    const target = line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [active, following])

  const hold = useCallback(() => {
    setFollowing(false)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setFollowing(true), resumeAfter)
  }, [resumeAfter])

  const resume = useCallback(() => {
    window.clearTimeout(idleTimer.current)
    setFollowing(true)
  }, [])

  useEffect(() => () => window.clearTimeout(idleTimer.current), [])

  /** attach to the scrolling container */
  const bind = {
    ref: boxRef,
    // only real user gestures suspend the follow — the scroll event also fires
    // for our own smooth scrolling
    onWheel: hold,
    onTouchMove: hold,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) hold()
    },
  }

  const setLine = useCallback((i: number) => (el: HTMLElement | null) => { lineRefs.current[i] = el }, [])

  return { bind, setLine, following, hold, resume }
}

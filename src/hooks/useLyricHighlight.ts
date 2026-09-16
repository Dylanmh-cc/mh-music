import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio/engine'

/**
 * The index of the line being sung, sampled from the audio clock rather than
 * from React state, so a re-render is only paid when the line actually changes.
 */
export function useLyricHighlight(lyrics: Array<{ time: number; text: string }>) {
  const [active, setActive] = useState(-1)
  const raf = useRef(0)
  useEffect(() => {
    const tick = () => {
      const t = audio.currentTime + 0.05
      let idx = -1
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= t) idx = i
        else break
      }
      setActive((prev) => (prev !== idx ? idx : prev))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [lyrics])
  return active
}

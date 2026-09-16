import { usePlayerStore } from '../../stores/player'
import { IconList, IconShuffle, IconRepeat, IconRepeatOne } from '../icons'
import { cn } from '../../lib/format'
import type { PlayMode } from '../../types/models'

const MODES: Array<{ id: PlayMode; label: string; Icon: (p: { size?: number }) => JSX.Element }> = [
  { id: 'sequential', label: 'Play in order', Icon: IconList },
  { id: 'repeat-all', label: 'Repeat all', Icon: IconRepeat },
  { id: 'repeat-one', label: 'Repeat one', Icon: IconRepeatOne },
  { id: 'shuffle', label: 'Shuffle', Icon: IconShuffle },
]

/**
 * Playback mode picker — order, repeat-all, repeat-one and shuffle are mutually
 * exclusive, so exactly one of the four is ever lit.
 */
export function PlayModeButtons({ size = 34, className }: { size?: number; className?: string }) {
  const playMode = usePlayerStore((s) => s.playMode)
  const setPlayMode = usePlayerStore((s) => s.setPlayMode)

  return (
    <div
      className={cn('glass-soft flex items-center gap-0.5 rounded-full p-0.5', className)}
      role="radiogroup"
      aria-label="Playback mode"
    >
      {MODES.map(({ id, label, Icon }) => {
        const on = playMode === id
        return (
          <button
            key={id}
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => setPlayMode(id)}
            className="grid place-items-center rounded-full transition-colors duration-300 hover:text-white"
            style={{
              width: size,
              height: size,
              background: on ? 'var(--c-tint)' : undefined,
              color: on ? 'var(--c-accent-2)' : 'var(--c-ink-faint)',
              boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,0.14)' : undefined,
            }}
          >
            <Icon size={Math.round(size * 0.46)} />
          </button>
        )
      })}
    </div>
  )
}

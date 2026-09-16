import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 18, ...rest }: P, children: React.ReactNode, filled = false) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconPlay = (p: P) => base(p, <path d="M7.5 4.8v14.4c0 .9 1 1.5 1.8 1L20.4 13a1.2 1.2 0 0 0 0-2L9.3 3.8c-.8-.5-1.8.1-1.8 1Z" />, true)
export const IconPause = (p: P) => base(p, <><rect x="6" y="4" width="4.2" height="16" rx="1.4" /><rect x="13.8" y="4" width="4.2" height="16" rx="1.4" /></>, true)
export const IconNext = (p: P) => base(p, <><path d="M5.5 5.5v13l9-6.5-9-6.5Z" /><rect x="16.5" y="5" width="2.6" height="14" rx="1.2" /></>, true)
export const IconPrev = (p: P) => base(p, <><path d="M18.5 5.5v13l-9-6.5 9-6.5Z" /><rect x="4.9" y="5" width="2.6" height="14" rx="1.2" /></>, true)
export const IconShuffle = (p: P) => base(p, <><path d="M16 4h4v4" /><path d="M4 20 20 4" /><path d="M16 20h4v-4" /><path d="M13.5 13.5 20 20" /><path d="M4 4l5.5 5.5" /></>)
export const IconRepeat = (p: P) => base(p, <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>)
export const IconRepeatOne = (p: P) => base(p, <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /><path d="M11.5 10.5 13 9.6V15" /></>)
export const IconVolume = (p: P) => base(p, <><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z" fill="currentColor" stroke="none" /><path d="M15.5 8.8a4.4 4.4 0 0 1 0 6.4" /><path d="M18 6.2a8 8 0 0 1 0 11.6" /></>)
export const IconVolumeMute = (p: P) => base(p, <><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z" fill="currentColor" stroke="none" /><path d="m16 9.5 5 5" /><path d="m21 9.5-5 5" /></>)
export const IconHeart = (p: P) => base(p, <path d="M12 20.3 4.9 13a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.5 0l.6.7.6-.7a4.5 4.5 0 0 1 6.5 0 4.7 4.7 0 0 1 0 6.6L12 20.3Z" />)
export const IconHeartFill = (p: P) => base(p, <path d="M12 20.3 4.9 13a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.5 0l.6.7.6-.7a4.5 4.5 0 0 1 6.5 0 4.7 4.7 0 0 1 0 6.6L12 20.3Z" />, true)
export const IconSearch = (p: P) => base(p, <><circle cx="11" cy="11" r="6.5" /><path d="m20.5 20.5-4.8-4.8" /></>)
export const IconHome = (p: P) => base(p, <><path d="m3.5 10.5 8.5-7 8.5 7" /><path d="M5.5 9v10.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9" /></>)
export const IconAlbum = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.2" /></>)
export const IconArtist = (p: P) => base(p, <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" /></>)
export const IconNote = (p: P) => base(p, <><path d="M9 18.5V5.8l10-2.3v12.7" /><circle cx="6.5" cy="18.5" r="2.5" /><circle cx="16.5" cy="16.2" r="2.5" /></>)
export const IconMusic = IconNote
export const IconList = (p: P) => base(p, <><path d="M4 6.5h11" /><path d="M4 12h11" /><path d="M4 17.5h7" /><circle cx="18.5" cy="16.5" r="2.8" /><path d="M21.3 16.5V9" /></>)
export const IconQueue = (p: P) => base(p, <><path d="M4 6.5h12" /><path d="M4 11h12" /><path d="M4 15.5h7" /><path d="m17 12.5 4.5 2.7-4.5 2.7v-5.4Z" fill="currentColor" stroke="none" /></>)
export const IconClock = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.4" /></>)
export const IconFolder = (p: P) => base(p, <path d="M3.5 7.2c0-1 .8-1.7 1.7-1.7h4l2 2.4h7.5c1 0 1.8.8 1.8 1.7v8.2c0 1-.8 1.7-1.8 1.7H5.2c-1 0-1.7-.8-1.7-1.7V7.2Z" />)
export const IconSettings = (p: P) => base(p, <><circle cx="12" cy="12" r="3.2" /><path d="M19.2 14.8a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" /></>)
export const IconMore = (p: P) => base(p, <><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></>)
export const IconClose = (p: P) => base(p, <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>)
export const IconPlus = (p: P) => base(p, <><path d="M12 5v14" /><path d="M5 12h14" /></>)
export const IconTrash = (p: P) => base(p, <><path d="M4.5 6.5h15" /><path d="M9 6V4.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3V6.5" /><path d="M6.5 6.5 7.4 19a1.8 1.8 0 0 0 1.8 1.7h5.6a1.8 1.8 0 0 0 1.8-1.7l.9-12.5" /></>)
export const IconEdit = (p: P) => base(p, <><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20Z" /><path d="m14.5 6 3 3" /></>)
export const IconImport = (p: P) => base(p, <><path d="M12 15V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" /></>)
export const IconRefresh = (p: P) => base(p, <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 3.5V8h-4.5" /></>)
export const IconBack = (p: P) => base(p, <><path d="m14.5 5.5-6.5 6.5 6.5 6.5" /></>)
export const IconForward = (p: P) => base(p, <><path d="m9.5 5.5 6.5 6.5-6.5 6.5" /></>)
export const IconChevronDown = (p: P) => base(p, <path d="m6 9.5 6 6 6-6" />)
export const IconChevronRight = (p: P) => base(p, <path d="m9.5 6 6 6-6 6" />)
export const IconChevronLeft = (p: P) => base(p, <path d="m14.5 6-6 6 6 6" />)
export const IconSparkle = (p: P) => base(p, <path d="M12 3.5c.7 3.8 2.7 5.8 6.5 6.5-3.8.7-5.8 2.7-6.5 6.5-.7-3.8-2.7-5.8-6.5-6.5 3.8-.7 5.8-2.7 6.5-6.5Z" />, true)
export const IconDisc = IconAlbum
export const IconVinyl = (p: P) => base(p, <><circle cx="12" cy="12" r="8.8" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /><path d="M12 5.6a6.4 6.4 0 0 1 6.4 6.4" opacity="0.6" /></>)
export const IconUser = (p: P) => base(p, <><circle cx="12" cy="8.2" r="3.4" /><path d="M5 20a7.2 7.2 0 0 1 14 0" /></>)
export const IconLogout = (p: P) => base(p, <><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M9 8l-4 4 4 4" /><path d="M5 12h10" /></>)
export const IconLyrics = (p: P) => base(p, <><path d="M4.5 6h10" /><path d="M4.5 10h15" /><path d="M4.5 14h11" /><path d="M4.5 18h7" /></>)
export const IconWave = (p: P) => base(p, <><path d="M3 12h2" /><path d="M7.5 8v8" /><path d="M12 5v14" /><path d="M16.5 8.5v7" /><path d="M21 11h-2" /></>)
export const IconSkip = (p: P) => base(p, <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M10 9.2v5.6l4.6-2.8L10 9.2Z" fill="currentColor" stroke="none" /></>)
export const IconCheck = (p: P) => base(p, <path d="m5 12.5 4.5 4.5L19 7.5" />)
export const IconInfo = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.2" /><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" /></>)
export const IconAlert = (p: P) => base(p, <><path d="M12 4 2.8 20h18.4L12 4Z" /><path d="M12 10v4.4" /><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" /></>)
export const IconPlusCircle = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 8.5v7" /><path d="M8.5 12h7" /></>)
export const IconExpand = (p: P) => base(p, <><path d="M8 4H4v4" /><path d="M16 4h4v4" /><path d="M8 20H4v-4" /><path d="M16 20h4v-4" /></>)
export const IconCollapse = (p: P) => base(p, <><path d="M4 9V4h5" /><path d="M20 9V4h-5" /><path d="M4 15v5h5" /><path d="M20 15v5h-5" /></>)

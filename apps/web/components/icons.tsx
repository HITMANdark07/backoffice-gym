// One stroke family for the whole site: 16px grid, 1.75 stroke, round caps.
type IconProps = { className?: string };

const stroke = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...stroke} className={className}>
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

export const CrossIcon = ({ className }: IconProps) => (
  <svg {...stroke} className={className}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </svg>
);

export const ArrowRightIcon = ({ className }: IconProps) => (
  <svg {...stroke} className={className}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export const PlayIcon = ({ className }: IconProps) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
    <path d="M5.5 3.4v9.2a.6.6 0 0 0 .9.5l7.3-4.6a.6.6 0 0 0 0-1L6.4 2.9a.6.6 0 0 0-.9.5z" />
  </svg>
);

export const PauseIcon = ({ className }: IconProps) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
    <rect x="4" y="3" width="3" height="10" rx="0.9" />
    <rect x="9" y="3" width="3" height="10" rx="0.9" />
  </svg>
);

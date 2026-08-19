/**
 * The icon set from the Vitals design system — stroked 24×24 line icons that
 * replaced the unicode glyphs the app used to render in the nav and stat tiles.
 *
 * Every icon inherits `currentColor` and sizes off the `.ic` class, so callers
 * style them through the surrounding element rather than passing props.
 */

type IconProps = { className?: string };

function Svg({ className = 'ic', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/* --- brand ---------------------------------------------------------------- */

export function IconHeart(props: IconProps) {
  return (
    <Svg className={props.className ?? 'ic fill'}>
      <path d="M12 21c-1-.7-8-5.4-8-11a4.5 4.5 0 0 1 8-2.9A4.5 4.5 0 0 1 20 10c0 5.6-7 10.3-8 11z" />
    </Svg>
  );
}

/* --- navigation ----------------------------------------------------------- */

export function IconToday(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z" />
    </Svg>
  );
}

export function IconTrainer(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 7v10M4 9v6M18 7v10M20 9v6M6 12h12" />
    </Svg>
  );
}

/** A figure mid-stretch — reaching, not lifting, so it reads apart from the Trainer. */
export function IconMobility(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 6.5v6M12 8.5l5-2M12 8.5l-5 2M12 12.5l3.5 7M12 12.5l-3.5 7" />
    </Svg>
  );
}

export function IconBody(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19V5M4 15l4-4 3 3 5-6 4 4M4 19h16" />
    </Svg>
  );
}

export function IconFood(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3v6a2 2 0 0 0 4 0V3M9 11v10M17 3c-1.7 0-3 2-3 5s1 4 3 4v9" />
    </Svg>
  );
}

export function IconMovement(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </Svg>
  );
}

export function IconHabits(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 13H4.4a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5.7 6.1L5.6 6a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11 4.6V4.4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9Z" />
    </Svg>
  );
}

/* --- metrics -------------------------------------------------------------- */

export function IconScale(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4Z" />
      <path d="M5 7h14l1.5 11a2 2 0 0 1-2 2.3H5.5A2 2 0 0 1 3.5 18Z" />
    </Svg>
  );
}

export function IconFlame(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3s5 3.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 10 10 10c.5-3 2-7 2-7Z" />
    </Svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10Z" />
    </Svg>
  );
}

export function IconDroplet(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10Z" />
    </Svg>
  );
}

/* --- indicators ----------------------------------------------------------- */

export function IconArrowDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M7 14l5 5 5-5" />
    </Svg>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19V5M7 10l5-5 5 5" />
    </Svg>
  );
}

export function IconMinus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 13 4 4L19 7" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconFlag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 21V4M4 4h13l-2.5 4L17 12H4" />
    </Svg>
  );
}

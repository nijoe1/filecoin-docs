export type HintStyle = 'info' | 'warning' | 'danger' | 'success';

export const HINT_ICONS: Record<HintStyle, string> = {
  info: '&#9432;', // ⓘ info circle
  warning: '&#9888;', // ⚠ warning triangle
  danger: '&#9888;', // ⚠ warning triangle (red)
  success: '&#10003;', // ✓ checkmark
};

export const HINT_TITLES: Record<HintStyle, string> = {
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
  success: 'Success',
};

export function getHintIcon(style: string): string {
  return HINT_ICONS[style as HintStyle] || HINT_ICONS.info;
}

export function getHintTitle(style: string): string {
  return HINT_TITLES[style as HintStyle] || HINT_TITLES.info;
}

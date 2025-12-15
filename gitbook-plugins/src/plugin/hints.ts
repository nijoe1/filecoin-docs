export type HintStyle = 'info' | 'warning' | 'danger' | 'success';

export const HINT_ICONS: Record<HintStyle, string> = {
  info: 'ℹ️', // info
  warning: '⚠️', // warning
  danger: '🚨', // danger/error
  success: '✅', // success
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

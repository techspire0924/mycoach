export const MAX_APP_TRANSPARENCY = 90;
export const TRANSPARENCY_STEP = 5;

const STORAGE_KEY = "mycoach-transparency";

function normalizeTransparency(value: number) {
  if (!Number.isFinite(value)) return 0;
  const stepped = Math.round(value / TRANSPARENCY_STEP) * TRANSPARENCY_STEP;
  return Math.min(MAX_APP_TRANSPARENCY, Math.max(0, stepped));
}

export function getSavedTransparency() {
  return normalizeTransparency(Number(localStorage.getItem(STORAGE_KEY) ?? 0));
}

export function applyTransparency(value: number) {
  const transparency = normalizeTransparency(value);
  const opacity = 1 - transparency / 100;

  document.documentElement.style.setProperty("--app-background-opacity", opacity.toString());
  localStorage.setItem(STORAGE_KEY, transparency.toString());

  return transparency;
}

const STORAGE_KEY = "geoglows-recent-apps";
const MAX_RECENT = 5;

export function recordAppVisit(appId) {
  const recent = getRecentApps();
  const filtered = recent.filter((r) => r.id !== appId);
  filtered.unshift({ id: appId, ts: Date.now() });
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(filtered.slice(0, MAX_RECENT)),
  );
}

export function getRecentApps() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

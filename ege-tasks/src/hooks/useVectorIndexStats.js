import { useEffect, useState } from 'react';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';
const TTL_MS = 5 * 60 * 1000;

// Модульный кэш: состояние индекса меняется только после ручного прогона
// индексатора, а спрашивают его сразу несколько экранов.
let cache = null; // { at, data }
let inflight = null;

async function fetchStats() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = fetch(`${PDF_SERVICE_URL}/vec-stats`, { signal: AbortSignal.timeout(10000) })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && !data.error) cache = { at: Date.now(), data };
      return cache?.data || null;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * Состояние семантического индекса: { indexed, tasks_total, missing, indexed_at }.
 * null, пока грузится или если сервис недоступен (тогда UI просто молчит).
 */
export function useVectorIndexStats() {
  const [stats, setStats] = useState(cache?.data || null);

  useEffect(() => {
    let alive = true;
    fetchStats().then((data) => { if (alive && data) setStats(data); });
    return () => { alive = false; };
  }, []);

  return stats;
}

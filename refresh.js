// One background run: fetch the sources, merge into the store, drop jobs not seen for 45 days.
import { fetchJobs } from "./sources.js";
import { readStore, writeStore } from "./store.js";

const KEEP_DAYS = 45;

export async function refresh({ slot } = {}) {
  const store = await readStore();
  const now = Date.now();
  const result = await fetchJobs({ slot });
  for (const j of result.jobs) {
    const prev = store.jobs[j.id];
    store.jobs[j.id] = { ...j, firstSeen: prev?.firstSeen || now, lastSeen: now };
  }
  for (const [id, j] of Object.entries(store.jobs)) {
    if (now - j.lastSeen > KEEP_DAYS * 864e5) delete store.jobs[id];
  }
  store.updatedAt = now;
  store.lastRun = { at: now, slot: result.slot, sources: result.sources, errors: result.errors, dropped: result.dropped, added: result.jobs.length };
  store.runs = [store.lastRun, ...(store.runs || [])].slice(0, 14);
  await writeStore(store);
  return store;
}

// Shape the store into what the page shows: newest-seen first within score order, stale flag for jobs missing from recent runs.
export function present(store) {
  const now = Date.now();
  const jobs = Object.values(store.jobs)
    .map((j) => ({ ...j, stale: now - j.lastSeen > 3 * 864e5 }))
    .sort((a, b) => b.score - a.score || b.lastSeen - a.lastSeen);
  return { jobs, updatedAt: store.updatedAt, lastRun: store.lastRun, runs: store.runs || [] };
}

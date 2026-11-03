import { readStore } from "../store.js";
import { refresh, present } from "../refresh.js";

// Serves the stored list. Only runs the searches itself if the store is empty (first visit after setup).
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    let store = await readStore();
    if (!store.updatedAt) store = await refresh();
    res.status(200).json({ ...present(store), storage: process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "none" });
  } catch (e) {
    res.status(200).json({ jobs: [], updatedAt: 0, lastRun: null, runs: [], error: String(e.message || e) });
  }
}

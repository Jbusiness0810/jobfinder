import { loadJobs } from "../sources.js";

export default async function handler(req, res) {
  let data;
  try {
    data = await loadJobs();
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ jobs: [], errors: [String(e.message || e)], fetchedAt: 0, sources: {} });
  }
  const { jobs, errors, at, sources, dropped } = data;
  // One real fetch a day at most; stale copies are served while a new one is prepared.
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).json({ jobs, errors, fetchedAt: at, sources, dropped });
}

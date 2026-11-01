import { loadJobs } from "../sources.js";

export default async function handler(req, res) {
  const { jobs, errors, at } = await loadJobs();
  // One real fetch a day at most; stale copies are served while a new one is prepared.
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).json({ jobs, errors, fetchedAt: at });
}

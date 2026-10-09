import { loadJobs } from "../sources.js";

export default async function handler(req, res) {
  const refresh = new URL(req.url, "http://localhost").searchParams.get("refresh") === "1";
  const { jobs, errors, at } = await loadJobs(refresh);
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).json({ jobs, errors, fetchedAt: at });
}

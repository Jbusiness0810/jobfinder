import { readStore } from "../store.js";
import { refresh } from "../refresh.js";

// Called by Vercel Cron once a day. Also runnable by hand at /api/refresh?slot=all.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "unauthorized" });
  const url = new URL(req.url, "http://localhost");
  const slot = url.searchParams.get("slot") || undefined;
  const store = await readStore();
  // Guard the JSearch quota: without the secret, at most one manual run every 6 hours.
  if (!secret && Date.now() - store.updatedAt < 6 * 3600e3 && !url.searchParams.get("force")) {
    return res.status(200).json({ skipped: true, updatedAt: store.updatedAt });
  }
  try {
    const out = await refresh({ slot });
    res.status(200).json({ ok: true, lastRun: out.lastRun, total: Object.keys(out.jobs).length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

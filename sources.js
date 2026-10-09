import { scoreJob, strip } from "./scoring.js";

const UA = { "User-Agent": "Mozilla/5.0 (jobfinder)" };
const QUERIES = ["vat", "indirect tax", "sales tax", "tax manager", "tax counsel", "tax legal", "tax"];

async function getJson(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function remotive() {
  const lists = await Promise.all(
    QUERIES.map((q) => getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}`).then((d) => d.jobs || []))
  );
  return lists.flat().map((j) => ({
    id: `remotive-${j.id}`, source: "Remotive", title: j.title, company: j.company_name,
    location: j.candidate_required_location || "Remote", remote: true,
    url: j.url, posted: j.publication_date, salary: j.salary || "", description: j.description || "",
  }));
}

async function arbeitnow() {
  const pages = await Promise.all(
    [1, 2, 3, 4, 5].map((p) => getJson(`https://www.arbeitnow.com/api/job-board-api?page=${p}`).then((d) => d.data || []).catch(() => []))
  );
  return pages.flat().map((j) => ({
    id: `arbeitnow-${j.slug}`, source: "Arbeitnow", title: j.title, company: j.company_name,
    location: j.location || "", remote: !!j.remote, url: j.url,
    posted: j.created_at ? new Date(j.created_at * 1000).toISOString() : "", salary: "", description: j.description || "",
  }));
}

async function remoteok() {
  const data = await getJson("https://remoteok.com/api");
  return data.filter((j) => j.id).map((j) => ({
    id: `remoteok-${j.id}`, source: "RemoteOK", title: j.position, company: j.company,
    location: j.location || "Remote", remote: true, url: j.url || j.apply_url,
    posted: j.date, salary: j.salary_min > 0 ? `$${j.salary_min} - $${j.salary_max}` : "", description: j.description || "",
  }));
}

let cache = { at: 0, jobs: [], errors: [] };
const TTL = 30 * 60 * 1000;

export async function loadJobs(force = false) {
  if (!force && Date.now() - cache.at < TTL && cache.jobs.length) return cache;
  const results = await Promise.allSettled([remotive(), arbeitnow(), remoteok()]);
  const errors = results.filter((r) => r.status === "rejected").map((r) => String(r.reason?.message || r.reason));
  const seen = new Set();
  const jobs = [];
  for (const j of results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value)) {
    const key = `${j.title}|${j.company}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const s = scoreJob(j);
    if (s.score < 20) continue;
    jobs.push({
      id: j.id, source: j.source, title: j.title, company: j.company, location: j.location, remote: j.remote,
      url: j.url, posted: j.posted, salary: j.salary, score: s.score, why: s.why, tags: s.tags,
      inHouse: s.inHouse, tech: s.tech, snippet: strip(j.description).slice(0, 400),
    });
  }
  jobs.sort((a, b) => b.score - a.score);
  cache = { at: Date.now(), jobs, errors };
  return cache;
}

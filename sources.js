import { scoreJob, strip } from "./scoring.js";
import { atsJobs } from "./ats.js";

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

// JSearch (OpenWeb Ninja) aggregates LinkedIn, Indeed, Glassdoor etc. The free tier is small, so results are cached for 48h.
// US employers say "indirect tax" or "sales and use tax" more than "VAT", so the queries cover both.
const JSEARCH_QUERIES = ["indirect tax VAT manager software", "tax counsel technology company", "sales and use tax manager SaaS"];
// Target markets: Irvine, CA (onsite or hybrid) and US-wide remote.
const JSEARCH_SEARCHES = [
  (q) => `query=${encodeURIComponent(`${q} in Irvine, California`)}&country=us&radius=50`,
  (q) => `query=${encodeURIComponent(`${q} remote`)}&country=us&work_from_home=true`,
];
const US_LOCATION = /irvine|california|\bca\b|usa|united states|\bus\b|u\.s\.|americas|north america|worldwide|anywhere|^remote$/i;
let jsearchCache = { at: 0, jobs: [] };
const JSEARCH_TTL = 48 * 60 * 60 * 1000;

async function jsearch() {
  const key = (process.env.JSEARCH_API_KEY || "").trim();
  if (!key) throw new Error("JSEARCH_API_KEY is not set in this deployment's environment");
  if (Date.now() - jsearchCache.at < JSEARCH_TTL) return jsearchCache.jobs;
  const calls = JSEARCH_QUERIES.flatMap((q) => JSEARCH_SEARCHES.map((build) => build(q)));
  // Sequential with a short pause: RapidAPI free plans often rate-limit bursts (429).
  const lists = [];
  const failures = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const params of calls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`https://api.openwebninja.com/jsearch/search?${params}&page=1&num_pages=1&date_posted=month`, {
          headers: { "x-api-key": key },
          signal: AbortSignal.timeout(15000),
        });
        if (res.status === 429 && attempt < 2) { await sleep(3000 * (attempt + 1)); continue; }
        if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
        lists.push((await res.json()).data || []);
      } catch (e) {
        failures.push(e.message);
      }
      break;
    }
    await sleep(2000);
  }
  if (!lists.length) throw new Error(`JSearch failed: ${failures[0]}`);
  const jobs = lists.flat().map((j) => ({
    id: `jsearch-${j.job_id}`, source: j.job_publisher || "JSearch", title: j.job_title, company: j.employer_name,
    location: [j.job_city, j.job_country].filter(Boolean).join(", ") || "n/a", remote: !!j.job_is_remote,
    url: j.job_apply_link, posted: j.job_posted_at_datetime_utc,
    salary: j.job_min_salary ? `${j.job_salary_currency || ""} ${j.job_min_salary} - ${j.job_max_salary}`.trim() : "",
    description: j.job_description || "",
  }));
  if (!failures.length) jsearchCache = { at: Date.now(), jobs };
  return jobs;
}

let cache = { at: 0, jobs: [], errors: [] };
const TTL = 30 * 60 * 1000;

export async function loadJobs(force = false) {
  if (!force && Date.now() - cache.at < TTL && cache.jobs.length) return cache;
  const results = await Promise.allSettled([remotive(), remoteok(), jsearch(), atsJobs()]);
  const errors = results.filter((r) => r.status === "rejected").map((r) => String(r.reason?.message || r.reason));
  const seen = new Set();
  const jobs = [];
  for (const j of results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value)) {
    const key = `${j.title}|${j.company}`.toLowerCase();
    if (!US_LOCATION.test(j.location || "")) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = scoreJob(j);
    if (s.score < 20) continue;
    jobs.push({
      id: j.id, source: j.source, title: j.title, company: j.company, location: j.location, remote: j.remote,
      url: j.url, posted: j.posted, salary: j.salary, score: s.score, why: s.why, tags: s.tags,
      inHouse: s.inHouse, tech: s.tech || !!j.techEmployer, snippet: strip(j.description).slice(0, 400),
    });
  }
  jobs.sort((a, b) => b.score - a.score);
  cache = { at: Date.now(), jobs, errors };
  return cache;
}

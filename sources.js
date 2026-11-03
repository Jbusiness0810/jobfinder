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

// JSearch (OpenWeb Ninja) aggregates LinkedIn, Indeed, Glassdoor, law firm and company sites.
// Free plan is 200 requests/month: 8 calls per fetch, cached 48h in memory and 24h at the CDN.
// Plain phrases only: Google's job search treats OR loosely and returns unrelated roles.
const JSEARCH_QUERIES = [
  "indirect tax manager",
  "sales and use tax manager",
  "tax manager",
  "tax counsel",
];
// Target markets: Irvine, CA (onsite or hybrid) and US-wide remote.
const JSEARCH_SEARCHES = [
  (q) => `query=${encodeURIComponent(`${q} in Irvine, California`)}&country=us&radius=50`,
  (q) => `query=${encodeURIComponent(`${q} remote`)}&country=us&work_from_home=true`,
];
const US_LOCATION = /irvine|orange county|california|\bca\b|usa|united states|\bus\b|u\.s\.|americas|north america|worldwide|anywhere|^remote$/i;
let jsearchErrors = "";

// slot "irvine" or "remote" runs 4 searches; "all" runs 8. The daily job alternates slots, so ~120 calls/month.
async function jsearch(slot = "all") {
  jsearchErrors = "";
  const key = (process.env.JSEARCH_API_KEY || "").trim();
  if (!key) throw new Error("JSEARCH_API_KEY is not set in this deployment's environment");
  const builders = slot === "irvine" ? [JSEARCH_SEARCHES[0]] : slot === "remote" ? [JSEARCH_SEARCHES[1]] : JSEARCH_SEARCHES;
  const calls = JSEARCH_QUERIES.flatMap((q) => builders.map((build) => build(q)));
  const lists = [];
  const failures = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Two lanes in parallel, hard budget so the serverless function always answers before Vercel's limit.
  const deadline = Date.now() + 45000;
  let skipped = 0;
  const lane = async (mine) => {
    for (const params of mine) {
      if (Date.now() > deadline) { skipped++; continue; }
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(`https://api.openwebninja.com/jsearch/search?${params}&page=1&num_pages=1&date_posted=month`, {
            headers: { "x-api-key": key },
            signal: AbortSignal.timeout(Math.max(3000, Math.min(20000, deadline - Date.now()))),
          });
          if (res.status === 429 && attempt === 0) { await sleep(2500); continue; }
          if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
          lists.push((await res.json()).data || []);
        } catch (e) {
          failures.push(e.message);
        }
        break;
      }
      await sleep(500);
    }
  };
  await Promise.all([lane(calls.filter((_, i) => i % 2 === 0)), lane(calls.filter((_, i) => i % 2 === 1))]);
  if (!lists.length) throw new Error(`JSearch failed: ${failures[0]}`);
  if (failures.length) jsearchErrors = `${failures.length} of ${calls.length} JSearch searches failed: ${failures[0]}`;
  if (skipped) jsearchErrors = `${skipped} JSearch searches skipped (time budget)`;
  const jobs = lists.flat().map((j) => ({
    id: `jsearch-${j.job_id}`, source: j.job_publisher || "JSearch", title: j.job_title, company: j.employer_name,
    location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || "n/a", remote: !!j.job_is_remote,
    url: j.job_apply_link, posted: j.job_posted_at_datetime_utc,
    salary: j.job_min_salary ? `${j.job_salary_currency || ""} ${j.job_min_salary} - ${j.job_max_salary}`.trim() : "",
    description: j.job_description || "",
  }));
  return jobs;
}

export async function fetchJobs({ slot } = {}) {
  slot = slot || (new Date().getUTCDate() % 2 === 0 ? "irvine" : "remote");
  const names = ["Remotive", "RemoteOK", "JSearch", "Career pages"];
  const results = await Promise.allSettled([remotive(), remoteok(), jsearch(slot), atsJobs()]);
  const errors = results.filter((r) => r.status === "rejected").map((r) => String(r.reason?.message || r.reason));
  if (jsearchErrors) errors.push(jsearchErrors);
  const sources = {};
  results.forEach((r, i) => { sources[names[i]] = r.status === "fulfilled" ? r.value.length : "failed"; });
  const seen = new Set();
  const jobs = [];
  const dropped = { location: 0, duplicate: 0, lowMatch: 0, samples: [] };
  for (const j of results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value)) {
    const key = `${j.title}|${j.company}`.toLowerCase();
    if (!US_LOCATION.test(j.location || "")) { dropped.location++; continue; }
    if (seen.has(key)) { dropped.duplicate++; continue; }
    seen.add(key);
    const s = scoreJob(j);
    if (s.score < 20) {
      dropped.lowMatch++;
      if (dropped.samples.length < 25) dropped.samples.push(`${j.title} @ ${j.company} (${s.score})`);
      continue;
    }
    jobs.push({
      id: j.id, source: j.source, title: j.title, company: j.company, location: j.location, remote: j.remote,
      url: j.url, posted: j.posted, salary: j.salary, score: s.score, why: s.why, tags: s.tags, category: s.category,
      inHouse: s.inHouse, tech: s.tech || !!j.techEmployer, snippet: strip(j.description).slice(0, 400),
    });
  }
  jobs.sort((a, b) => b.score - a.score);
  return { jobs, errors, sources, dropped, slot };
}

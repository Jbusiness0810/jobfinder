// Public career-page feeds (Greenhouse, Lever, Ashby) for tech employers. No API key or quota needed.
const GREENHOUSE = ["stripe", "datadog", "okta", "twilio", "airbnb", "dropbox", "cloudflare", "gitlab", "elastic", "coinbase", "figma", "asana", "databricks", "mongodb", "samsara", "toast", "brex", "anthropic", "zoominfo", "lyft", "pinterest", "reddit", "robinhood", "instacart", "roblox", "discord", "squarespace", "mixpanel", "fivetran", "gusto", "carta", "checkr", "affirm", "sofi", "chime", "vercel", "webflow", "zscaler", "intercom", "rubrik"];
const LEVER = ["palantir", "spotify", "wealthfront", "anchorage"];
const ASHBY = ["openai", "ramp", "notion", "linear", "deel", "supabase", "vanta"];

const TAX_TITLE = /\b(tax|vat|gst)\b/i;
// Irvine, or remote in the US. Other locations are skipped.
const WANTED_LOCATION = /irvine|remote.*(\bus\b|usa|united states|americas|north america)|(\bus\b|usa|united states|north america).*remote|^remote$|anywhere/i;

const get = (url) => fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (jobfinder)" }, signal: AbortSignal.timeout(15000) })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null);

const pretty = (slug) => slug.charAt(0).toUpperCase() + slug.slice(1);

function keep(job) {
  return TAX_TITLE.test(job.title) && WANTED_LOCATION.test(job.location || "");
}

async function greenhouse(slug) {
  const d = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  return (d?.jobs || []).map((j) => ({
    id: `gh-${slug}-${j.id}`, source: "Company careers", title: j.title, company: j.company_name || pretty(slug),
    location: j.location?.name || "", url: j.absolute_url, posted: j.updated_at || j.first_published || "",
  }));
}

async function lever(slug) {
  const d = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  return (Array.isArray(d) ? d : []).map((j) => ({
    id: `lever-${slug}-${j.id}`, source: "Company careers", title: j.text, company: pretty(slug),
    location: j.categories?.location || "", url: j.hostedUrl, posted: j.createdAt ? new Date(j.createdAt).toISOString() : "",
    description: j.descriptionPlain || "",
  }));
}

async function ashby(slug) {
  const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  return (d?.jobs || []).map((j) => ({
    id: `ashby-${slug}-${j.id}`, source: "Company careers", title: j.title, company: pretty(slug),
    location: j.location || "", url: j.jobUrl, posted: j.publishedAt || "", description: j.descriptionPlain || "",
  }));
}

export async function atsJobs() {
  const lists = await Promise.all([
    ...GREENHOUSE.map(greenhouse), ...LEVER.map(lever), ...ASHBY.map(ashby),
  ]);
  return lists.flat().filter(keep).map((j) => ({
    ...j, remote: /remote/i.test(j.location), description: j.description || "", techEmployer: true,
  }));
}

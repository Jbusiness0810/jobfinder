const $ = (id) => document.getElementById(id);
let jobs = [];
let saved = new Set();
try { saved = new Set(JSON.parse(localStorage.getItem("saved") || "[]")); } catch {}
const persist = () => { try { localStorage.setItem("saved", JSON.stringify([...saved])); } catch {} };

const esc = (s = "") => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : "#");

function ago(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 864e5);
  if (isNaN(d)) return "";
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

function render() {
  const q = $("q").value.toLowerCase().trim();
  const min = +$("min").value;
  $("minOut").textContent = min;
  const list = jobs.filter((j) =>
    j.score >= min &&
    (!$("inhouse").checked || j.inHouse) &&
    (!$("tech").checked || j.tech) &&
    (!$("remote").checked || j.remote) &&
    (!$("saved").checked || saved.has(j.id)) &&
    (!q || `${j.title} ${j.company} ${j.location} ${j.snippet}`.toLowerCase().includes(q)));
  $("results").innerHTML = list.map((j) => `
    <li class="job">
      <div class="score ${j.score >= 60 ? "" : j.score >= 40 ? "mid" : "low"}" title="Match score">${j.score}</div>
      <div>
        <h3><a href="${safeUrl(j.url)}" target="_blank" rel="noopener noreferrer">${esc(j.title)}</a></h3>
        <div class="meta">${esc(j.company)} · ${esc(j.location || "n/a")}${j.remote ? " · Remote" : ""}${j.posted ? " · " + ago(j.posted) : ""} · ${esc(j.source)}${j.salary ? " · " + esc(j.salary) : ""}</div>
        <div class="chips">${[...j.tags.map((t) => `<span class="chip ${t === "Likely in-house" ? "good" : ""}">${esc(t)}</span>`), ...j.why.map((w) => `<span class="chip">${esc(w)}</span>`)].join("")}</div>
        <p class="snip">${esc(j.snippet)}...</p>
        <div class="actions">
          <a class="btn" href="${safeUrl(j.url)}" target="_blank" rel="noopener noreferrer">View job</a>
          <button class="ghost" data-id="${esc(j.id)}">${saved.has(j.id) ? "Saved" : "Save"}</button>
        </div>
      </div>
    </li>`).join("");
  $("status").textContent = `${list.length} of ${jobs.length} matching roles`;
  if (!list.length && jobs.length) $("status").textContent += ". Try lowering the minimum match or unticking filters.";
}

async function load(refresh) {
  $("status").textContent = "Loading jobs...";
  try {
    const r = await fetch("/api/jobs" + (refresh ? "?refresh=1" : ""));
    const d = await r.json();
    jobs = d.jobs;
    render();
    if (d.errors.length) $("status").textContent += ` (source error: ${d.errors.join("; ")})`;
  } catch {
    $("status").textContent = "Could not load jobs. Is the server running?";
  }
}

function boardLinks() {
  const loc = encodeURIComponent($("loc").value.trim());
  const enc = encodeURIComponent;
  const kw = '("VAT" OR "indirect tax") manager';
  const items = [
    ["LinkedIn: VAT Manager", `https://www.linkedin.com/jobs/search/?keywords=${enc("VAT manager SaaS")}&location=${loc}&f_TPR=r604800`],
    ["LinkedIn: Indirect Tax Manager", `https://www.linkedin.com/jobs/search/?keywords=${enc("indirect tax manager software")}&location=${loc}&f_TPR=r604800`],
    ["LinkedIn: Tax Counsel (tech)", `https://www.linkedin.com/jobs/search/?keywords=${enc("tax counsel software")}&location=${loc}`],
    ["Indeed: VAT Manager", `https://www.indeed.com/jobs?q=${enc("VAT manager software")}&l=${loc}`],
    ["Google Jobs", `https://www.google.com/search?q=${enc("indirect tax manager SaaS jobs " + $("loc").value)}&ibp=htl;jobs`],
    ["Glassdoor", `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${enc("indirect tax manager")}`],
    ["Welcome to the Jungle", `https://www.welcometothejungle.com/en/jobs?query=${enc("indirect tax")}`],
    ["Tax-focused: Taxjobs / Tax Executives Institute", `https://www.google.com/search?q=${enc("site:greenhouse.io OR site:lever.co OR site:ashbyhq.com " + kw)}`],
    ["Company ATS search (Greenhouse, Lever, Ashby)", `https://www.google.com/search?q=${enc('(site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com) ("VAT" OR "indirect tax")')}`],
  ];
  $("links").innerHTML = items.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`).join("");
}

$("results").addEventListener("click", (e) => {
  const id = e.target.dataset?.id;
  if (!id) return;
  saved.has(id) ? saved.delete(id) : saved.add(id);
  persist(); render();
});
["q", "min", "inhouse", "tech", "remote", "saved"].forEach((id) => $(id).addEventListener("input", render));
$("refresh").addEventListener("click", () => load(true));
$("loc").addEventListener("input", boardLinks);
boardLinks();
load(false);

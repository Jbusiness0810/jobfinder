const $ = (id) => document.getElementById(id);
const GROUPS = ["In-house", "Law firm", "Accounting / advisory"];
let saved = new Set();
try { saved = new Set(JSON.parse(localStorage.getItem("saved") || "[]")); } catch {}
const persist = () => { try { localStorage.setItem("saved", JSON.stringify([...saved])); } catch {} };

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, "-");

function ago(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 864e5);
  if (isNaN(d)) return "";
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

function card(j) {
  return `
    <li class="job">
      <div class="score ${j.score >= 60 ? "" : j.score >= 40 ? "mid" : "low"}" title="Match score">${j.score}</div>
      <div>
        <h3><a href="${safeUrl(j.url)}" target="_blank" rel="noopener noreferrer">${esc(j.title)}</a></h3>
        <div class="meta">${esc(j.company)} · ${esc(j.location || "n/a")}${j.remote ? " · Remote" : ""}${j.posted ? " · " + ago(j.posted) : ""} · ${esc(j.source)}${j.salary ? " · " + esc(j.salary) : ""}</div>
        <div class="chips"><span class="chip cat">${esc(j.category)}</span>${j.why.map((w) => `<span class="chip">${esc(w)}</span>`).join("")}${j.stale ? `<span class="chip stale">Not in latest results</span>` : ""}</div>
        ${j.snippet ? `<p class="snip">${esc(j.snippet)}...</p>` : ""}
        <div class="actions">
          <a class="btn" href="${safeUrl(j.url)}" target="_blank" rel="noopener noreferrer">View job</a>
          <button class="ghost" data-id="${esc(j.id)}">${saved.has(j.id) ? "Saved" : "Save"}</button>
        </div>
      </div>
    </li>`;
}

// Remember every job shown for 30 days so a failed or partial fetch does not wipe the list.
const KEEP_DAYS = 30;
function loadMemory() {
  try { return JSON.parse(localStorage.getItem("seenJobs") || "{}"); } catch { return {}; }
}
function merge(fresh) {
  const mem = loadMemory();
  const now = Date.now();
  for (const j of fresh) mem[j.id] = { ...j, firstSeen: mem[j.id]?.firstSeen || now, lastSeen: now };
  const freshIds = new Set(fresh.map((j) => j.id));
  const out = [];
  for (const [id, j] of Object.entries(mem)) {
    if (now - j.lastSeen > KEEP_DAYS * 864e5) { delete mem[id]; continue; }
    out.push({ ...j, stale: !freshIds.has(id) });
  }
  try { localStorage.setItem("seenJobs", JSON.stringify(mem)); } catch {}
  return out.sort((a, b) => b.score - a.score);
}

let jobs = [];
function render() {
  const savedJobs = jobs.filter((j) => saved.has(j.id));
  const sections = [["Saved", savedJobs], ...GROUPS.map((g) => [g, jobs.filter((j) => j.category === g)])]
    .filter(([, list]) => list.length);
  $("groups").innerHTML = sections.map(([g, list]) => `<a href="#${slug(g)}">${esc(g)} (${list.length})</a>`).join("");
  $("results").innerHTML = sections.map(([g, list]) => `<li class="head" id="${slug(g)}"><h2>${esc(g)}</h2></li>${list.map(card).join("")}`).join("");
  $("status").textContent = `${jobs.length} roles found, posted in the last month`;
}

async function load() {
  try {
    const r = await fetch("/api/jobs");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    jobs = merge(d.jobs);
    render();
    const fresh = d.jobs.length;
    if (fresh !== jobs.length) $("status").textContent += ` (${fresh} in the latest fetch, the rest remembered from earlier visits)`;
    const raw = Object.entries(d.sources || {}).map(([k, v]) => `${k} ${v}`).join(", ");
    if (raw) $("status").textContent += `. Raw listings before matching: ${raw}`;
    if (d.errors.length) $("status").textContent += `. Source error: ${d.errors.join("; ")}`;
  } catch (e) {
    $("status").textContent = `Could not load jobs (${e.message}). Please try again in a minute.`;
  }
}

$("results").addEventListener("click", (e) => {
  const id = e.target.dataset?.id;
  if (!id) return;
  saved.has(id) ? saved.delete(id) : saved.add(id);
  persist(); render();
});
load();

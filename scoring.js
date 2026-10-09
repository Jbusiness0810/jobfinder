// Relevance scoring tuned for: VAT manager, legal background, software industry, in-house tech employer.

const strip = (html = "") =>
  html
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const TITLE_CORE = [
  [/\bvat\b|\bgst\b|value[- ]added tax/i, 40],
  [/indirect tax|transaction tax|sales (and|&) use tax|sales tax|consumption tax/i, 38],
  [/tax (counsel|attorney|lawyer|legal)|legal.*\btax\b|\btax\b.*legal/i, 28],
  [/\btax\b/i, 18],
  [/e-?invoic|digital reporting|tax compliance|tax technology|tax technolog/i, 15],
];
const SENIORITY = [
  [/\b(head|director|vp|vice president)\b/i, 12],
  [/\b(senior manager|manager|lead|principal)\b/i, 15],
  [/\b(senior|sr\.?)\b/i, 6],
  [/\b(intern|trainee|junior|assistant|werkstudent|apprentice|clerk)\b/i, -30],
];
const BODY_SIGNALS = [
  [/\bvat\b|value[- ]added tax|\bgst\b/i, 8],
  [/indirect tax/i, 8],
  [/oss\b|one[- ]stop[- ]shop|e-?invoicing|digital services tax|place of supply|reverse charge/i, 6],
  [/legal (background|degree)|law degree|\bjd\b|llb|qualified (lawyer|solicitor|attorney)|legal counsel/i, 6],
  [/policy|advis(e|ory)|regulat|legislat/i, 2],
];
const TECH = /\b(saas|software|cloud|platform|fintech|ai\b|artificial intelligence|b2b|digital|technology|tech company|app|marketplace|subscription|api|payments?|e-?commerce|startup|scale-?up)\b/i;
const FIRM = /\b(advisory|deloitte|pwc|pricewaterhouse|kpmg|ernst|ey\b|bdo|grant thornton|rsm|mazars|baker tilly|crowe|forvis|big ?4|law firm|solicitors|accounting firm|advisory firm|tax consult|consulting firm|kanzlei|steuerberat|wirtschaftspr)/i;
const NOT_RELEVANT = /\b(bookkeeper|payroll|tax preparer|tax return preparer|personal tax|accounts (payable|receivable)|cashier)\b/i;

export function scoreJob(job) {
  const title = job.title || "";
  const body = strip(job.description || "").slice(0, 6000);
  const company = job.company || "";
  let score = 0;
  const why = [];

  const core = TITLE_CORE.find(([re]) => re.test(title));
  if (core) { score += core[1]; why.push("Title matches tax focus"); }
  else if (/\b(finance|financial|legal|counsel|compliance|controller|accounting)\b/i.test(title) && /\bvat\b|indirect tax|sales tax|\bgst\b/i.test(body)) { score += 10; why.push("Finance / legal role mentioning VAT"); }
  else return { score: 0, why: [], tags: [] };

  for (const [re, pts] of SENIORITY) if (re.test(title)) { score += pts; if (pts > 0) why.push("Seniority fit"); break; }

  let bodyPts = 0;
  for (const [re, pts] of BODY_SIGNALS) if (re.test(body)) bodyPts += pts;
  if (bodyPts) { score += Math.min(bodyPts, 24); }
  if (/legal/i.test(title + " " + body) && /legal (background|degree)|law degree|\bjd\b|llb|lawyer|attorney|solicitor|legal counsel/i.test(body)) why.push("Legal background valued");

  const techHit = TECH.test(company + " " + title + " " + body.slice(0, 2500));
  if (techHit) { score += 12; why.push("Tech / software employer"); }

  const tags = [];
  const firm = FIRM.test(company) || FIRM.test(body.slice(0, 1200));
  if (firm) { score -= 25; tags.push("Firm / advisory"); }
  else { score += 10; tags.push("Likely in-house"); }
  if (NOT_RELEVANT.test(title)) score -= 40;

  return { score: Math.max(0, Math.min(100, score)), why: [...new Set(why)], tags, inHouse: !firm, tech: techHit };
}

export { strip };

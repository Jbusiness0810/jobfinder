// Relevance scoring for: VAT / indirect tax manager, legal background, software industry.
// Good fits, in order: in-house at a tech company, in-house elsewhere, law firm tax practice, accounting / advisory firm.

const strip = (html = "") =>
  html
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const TITLE_CORE = [
  [/\bvat\b|\bgst\b|value[- ]added tax/i, 40],
  [/indirect tax|transaction tax|sales (and|&) use tax|sales tax|\bsalt\b|consumption tax/i, 38],
  [/tax (counsel|attorney|lawyer|associate|legal)|legal.*\btax\b|\btax\b.*legal/i, 24],
  [/\btax\b/i, 18],
  [/e-?invoic|digital reporting|tax compliance|tax technology/i, 15],
];
// Best fit is manager / senior manager. Senior counsel, director and above are a stretch.
const SENIORITY = [
  [/\b(senior|sr\.?|lead|principal|chief|deputy general) (tax )?(counsel|attorney|lawyer)\b|\bgeneral counsel\b/i, -15],
  [/\b(head|director|vp|vice president|partner)\b/i, -5],
  [/\b(senior manager|manager|lead|principal)\b/i, 15],
  [/\b(counsel|attorney|lawyer)\b/i, 4],
  [/\b(senior|sr\.?|associate)\b/i, 6],
  [/\b(intern|trainee|junior|assistant|apprentice|clerk|paralegal|law clerk|summer)\b/i, -30],
];
const BODY_SIGNALS = [
  [/\bvat\b|value[- ]added tax|\bgst\b/i, 8],
  [/indirect tax|sales (and|&) use tax/i, 8],
  [/oss\b|one[- ]stop[- ]shop|e-?invoicing|digital services tax|place of supply|reverse charge|nexus|wayfair/i, 6],
  [/legal (background|degree)|law degree|\bjd\b|\bllm\b|llb|bar admission|qualified (lawyer|solicitor|attorney)|legal counsel/i, 6],
  [/policy|advis(e|ory)|regulat|legislat/i, 2],
];
const TECH = /\b(saas|software|cloud|platform|fintech|ai\b|artificial intelligence|b2b|digital|technology|tech company|app|marketplace|subscription|api|payments?|e-?commerce|startup|scale-?up)\b/i;
const LAW_FIRM = /\b(law firm|law group|law offices?|attorneys at law|legal practice|\bllp\b.*law|law\b.*\bllp\b|barristers|solicitors)\b/i;
const LAW_FIRM_NAMES = /baker mckenzie|latham|gibson dunn|kirkland|skadden|sidley|jones day|dla piper|o'melveny|morgan lewis|paul hastings|greenberg traurig|sheppard mullin|snell & wilmer|holland & knight|mayer brown|white & case|cooley|fenwick|wilson sonsini|orrick|perkins coie|reed smith|k&l gates|mcdermott|hogan lovells|norton rose|allen & overy|freshfields|clifford chance|linklaters|eversheds|dentons|akin|ropes & gray|weil|davis polk|sullivan & cromwell|cleary|simpson thacher|debevoise|covington|wilmerhale|arnold & porter|crowell|venable|polsinelli|buchalter|rutan|stradling|knobbe/i;
const ADVISORY = /\b(deloitte|pwc|pricewaterhouse|kpmg|ernst|\bey\b|bdo|grant thornton|\brsm\b|mazars|baker tilly|crowe|forvis|moss adams|cohnreznick|marcum|eide bailly|cbiz|plante|withum|andersen|ryan,? llc|big ?4|accounting firm|advisory firm|tax consult|consulting firm|cpa firm)\b/i;
const ADVISORY_NAMES = /^(ryan|andersen|cohnreznick|marcum|eide bailly|cbiz|moss adams|plante|withum|kpmg|deloitte|pwc|ey|bdo|rsm|crowe|forvis|grant thornton|alvarez|fti consulting|vertex|avalara|sovos)\b/i;
const NOT_RELEVANT = /\b(recruitment|staffing|bookkeeper|payroll|tax preparer|tax return preparer|personal tax|accounts (payable|receivable)|cashier|account executive|sales development|customer success|customer care|customer support|product owner|engineer|developer|recruit)\b/i;

export function scoreJob(job) {
  const title = job.title || "";
  const body = strip(job.description || "").slice(0, 6000);
  const company = job.company || "";
  let score = 0;
  const why = [];

  const core = TITLE_CORE.find(([re]) => re.test(title));
  if (core) { score += core[1]; why.push("Title matches tax focus"); }
  else if (/\b(finance|financial|legal|counsel|compliance|controller|accounting)\b/i.test(title) && /\bvat\b|indirect tax|sales tax|\bgst\b/i.test(body)) { score += 10; why.push("Finance / legal role mentioning VAT"); }
  else return { score: 0, why: [], tags: [], category: "" };

  for (const [re, pts] of SENIORITY) if (re.test(title)) { score += pts; if (pts > 0) why.push("Seniority fit"); break; }

  let bodyPts = 0;
  for (const [re, pts] of BODY_SIGNALS) if (re.test(body)) bodyPts += pts;
  score += Math.min(bodyPts, 24);
  if (/legal (background|degree)|law degree|\bjd\b|\bllm\b|llb|lawyer|attorney|solicitor|legal counsel|bar admission/i.test(title + " " + body)) why.push("Legal background valued");

  const head = body.slice(0, 1500);
  const lawFirm = LAW_FIRM_NAMES.test(company) || LAW_FIRM.test(company) || LAW_FIRM.test(head) || (/\b(attorney|associate|of counsel|partner)\b/i.test(title) && !/in-?house/i.test(head));
  const advisory = !lawFirm && (ADVISORY_NAMES.test(company) || ADVISORY.test(company) || ADVISORY.test(head) || /consult|advisory/i.test(title));

  let category;
  const techHit = TECH.test(company + " " + title + " " + body.slice(0, 2500));
  if (lawFirm) { category = "Law firm"; score += 8; why.push("Legal practice fit"); }
  else if (advisory) { category = "Accounting / advisory"; score -= 10; }
  else { category = "In-house"; score += 10; if (techHit) { score += 12; why.push("Tech / software employer"); } }

  if (/bar (admission|membership|license)|admitted to (the )?(bar|practice)|licensed (to practice|attorney)|active (bar|law license)|member of the .{0,20}bar|must be (an? )?(licensed|admitted)/i.test(body)) { score -= 12; why.push("Requires bar admission"); }

  if (NOT_RELEVANT.test(title) || /recruit|staffing|talent/i.test(company)) score -= 40;

  return { score: Math.max(0, Math.min(100, score)), why: [...new Set(why)], tags: [category], category, inHouse: category === "In-house", tech: techHit && !lawFirm && !advisory };
}

export { strip };

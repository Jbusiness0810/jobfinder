# VAT Job Finder

Searches free job feeds (Remotive, Arbeitnow, RemoteOK) and ranks roles for an in-house VAT / indirect tax manager with a legal background at software companies. Also builds tuned search links for LinkedIn, Indeed, Google Jobs and company ATS pages.

Optional: set `JSEARCH_API_KEY` (OpenWeb Ninja) to add LinkedIn, Indeed and Glassdoor results via JSearch. Searches target Irvine, CA and US remote.

Run: `npm start` then open http://localhost:3000. Tests: `npm test`. No dependencies, Node 20+.

Scoring lives in `scoring.js` (title match, seniority, VAT/legal signals, tech employer, in-house vs advisory firm).

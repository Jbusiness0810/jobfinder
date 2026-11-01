# Tax Job Finder

Pulls indirect tax, VAT and tax legal roles in Irvine, CA and US remote, and ranks them for an indirect tax manager with a legal background who wants to move in-house at a tech company. Law firm and advisory roles are included and grouped separately. Nothing to configure on the page: it loads everything on its own.

Sources: JSearch (LinkedIn, Indeed, Glassdoor, law firm and company sites), the public career pages of ~50 tech companies (Greenhouse, Lever, Ashby; edit the lists in `ats.js`), Remotive and RemoteOK.

Set `JSEARCH_API_KEY` (OpenWeb Ninja) in the environment. Each fetch makes 8 JSearch calls and results are cached for a day, so the free 200/month plan is enough.

Run: `npm start` then open http://localhost:3000. Tests: `npm test`. No dependencies, Node 20+.

Scoring lives in `scoring.js` (title match, seniority, VAT/legal signals, employer type).

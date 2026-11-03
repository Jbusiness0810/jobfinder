# Tax Job Finder

Pulls indirect tax, VAT and tax legal roles in Irvine, CA and US remote, and ranks them for an indirect tax manager with a legal background who wants to move in-house at a tech company. Law firm and Big 4 / advisory roles are included and grouped separately. Nothing to configure on the page.

How it works: a scheduled job (`/api/refresh`, daily via Vercel Cron) runs the searches and merges the results into a stored list (Vercel Blob). The page reads the stored list, so it loads instantly and jobs are kept for 45 days after they were last seen. Each daily run alternates between the Irvine and US-remote searches to stay inside JSearch's free 200 requests/month.

Sources: JSearch (LinkedIn, Indeed, Glassdoor, law firm and company sites), the public career pages of ~50 tech companies (Greenhouse, Lever, Ashby; edit the lists in `ats.js`), Remotive and RemoteOK.

## Vercel setup

1. Environment variable `JSEARCH_API_KEY` (OpenWeb Ninja).
2. Storage tab: create a **Blob** store and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` automatically.
3. Optional: `CRON_SECRET` to lock `/api/refresh` to the cron job.
4. Redeploy. The first page visit fills the store; after that the cron keeps it fresh. `/api/refresh?slot=all` runs every search by hand.

## Local

`npm install`, then `npm run refresh` to fill `data/store.json`, then `npm start` and open http://localhost:3000. Tests: `npm test`.

Scoring lives in `scoring.js` (title match, seniority, VAT/legal signals, employer type).

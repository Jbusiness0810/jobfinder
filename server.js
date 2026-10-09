import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadJobs } from "./sources.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/jobs") {
      const { jobs, errors, at } = await loadJobs(url.searchParams.get("refresh") === "1");
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ jobs, errors, fetchedAt: at }));
    }
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    const full = path.join(root, path.normalize(file));
    if (!full.startsWith(root)) { res.writeHead(403); return res.end(); }
    const data = await readFile(full);
    res.writeHead(200, { "Content-Type": types[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    res.writeHead(e.code === "ENOENT" ? 404 : 500);
    res.end(e.code === "ENOENT" ? "Not found" : "Server error");
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Job finder running at http://localhost:${port}`));

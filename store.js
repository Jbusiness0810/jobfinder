// Persistent job memory. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set, else a local JSON file.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEY = "jobfinder/store.json";
const LOCAL = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "store.json");
const EMPTY = { jobs: {}, updatedAt: 0, lastRun: null, runs: [] };

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function readStore() {
  try {
    if (useBlob()) {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: KEY, limit: 1 });
      if (!blobs.length) return { ...EMPTY };
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      return res.ok ? { ...EMPTY, ...(await res.json()) } : { ...EMPTY };
    }
    return { ...EMPTY, ...JSON.parse(await readFile(LOCAL, "utf8")) };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeStore(store) {
  const body = JSON.stringify(store);
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    await put(KEY, body, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    return;
  }
  await mkdir(path.dirname(LOCAL), { recursive: true });
  await writeFile(LOCAL, body);
}

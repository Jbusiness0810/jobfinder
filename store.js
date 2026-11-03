// Persistent job memory. Uses a private Vercel Blob store when BLOB_READ_WRITE_TOKEN is set, else a local JSON file.
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
      const { get } = await import("@vercel/blob");
      const res = await get(KEY, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return { ...EMPTY };
      const text = await new Response(res.stream).text();
      return { ...EMPTY, ...JSON.parse(text) };
    }
    return { ...EMPTY, ...JSON.parse(await readFile(LOCAL, "utf8")) };
  } catch (e) {
    if (useBlob()) console.error("readStore failed:", e.message);
    return { ...EMPTY };
  }
}

export async function writeStore(store) {
  const body = JSON.stringify(store);
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    await put(KEY, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    return;
  }
  await mkdir(path.dirname(LOCAL), { recursive: true });
  await writeFile(LOCAL, body);
}

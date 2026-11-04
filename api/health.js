export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    node: process.version,
    hasJsearchKey: !!process.env.JSEARCH_API_KEY,
    hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    region: process.env.VERCEL_REGION || null,
  });
}

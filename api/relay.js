// api/relay.js
// Forwards a chunk to Google Drive's resumable upload URL to avoid browser CORS.
//
// Browser must POST to /api/relay with headers:
//   x-upload-url: <resumable URL returned by /api/init>
//   x-start:      <byte start>
//   x-end:        <byte end EXCLUSIVE>
//   x-total:      <total file size>
// Body: raw bytes of the chunk.

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",
    "Content-Type, x-upload-url, x-start, x-end, x-total");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  try {
    const uploadUrl = req.headers["x-upload-url"];
    const start     = Number(req.headers["x-start"]);
    const endExcl   = Number(req.headers["x-end"]);
    const total     = Number(req.headers["x-total"]);
    if (!uploadUrl || !Number.isFinite(start) || !Number.isFinite(endExcl) || !Number.isFinite(total)) {
      return res.status(400).json({ ok: false, error: "Missing x-upload-url/x-start/x-end/x-total" });
    }

    // Collect raw request body (binary)
    const bufs = [];
    for await (const c of req) bufs.push(c);
    const body = Buffer.concat(bufs);

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(body.length),
        "Content-Range": `bytes ${start}-${endExcl - 1}/${total}`
      },
      body
    });

    // Bubble up Range (useful when Drive replies 308)
    const range = put.headers.get("Range");
    if (range) res.setHeader("Range", range);

    const text = await put.text().catch(() => "");
    res.status(put.status).send(text || "");
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}

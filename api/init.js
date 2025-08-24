// Creates a Google Drive resumable upload session and returns its upload URL.
// Browser will upload file chunks directly to Google (no proxying through Vercel).

import { GoogleAuth } from "google-auth-library";
import { fetch } from "undici";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"]; // SA can create files it owns

// Env vars (you'll add these in Vercel later)
const FOLDER_ID = process.env.DRIVE_FOLDER_ID;          // target Drive folder ID
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT || "{}";

// CORS
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Upload-Token");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { name, mimeType, size } = req.body || {};
    if (!name || !mimeType || typeof size !== "number") {
      return res.status(400).json({ ok: false, error: "Missing name, mimeType, or size" });
    }
    if (!FOLDER_ID) return res.status(500).json({ ok: false, error: "Missing DRIVE_FOLDER_ID" });

    // (Optional) server-side guard
    const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB example; adjust
    if (size > MAX_SIZE) return res.status(413).json({ ok: false, error: "File too large" });

    // Service Account auth
    const credentials = JSON.parse(SA_JSON);
    const auth = new GoogleAuth({ credentials, scopes: SCOPES });
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    // Start resumable session
    const metadata = { name, parents: [FOLDER_ID], mimeType };
    const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(size)
      },
      body: JSON.stringify(metadata)
    });

    if (!start.ok) {
      const details = await start.text().catch(() => "");
      return res.status(start.status).json({ ok: false, error: "Failed to init", details });
    }

    const uploadUrl = start.headers.get("location");
    return res.status(200).json({ ok: true, uploadUrl });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

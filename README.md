# Drive Direct Upload (Resumable)

- Vercel serverless function at `api/init.js` creates a Google Drive **resumable upload** session.
- Browser uploads chunks directly to Drive.

## Env vars (set in Vercel)
- `GOOGLE_SERVICE_ACCOUNT` — paste entire service-account JSON
- `DRIVE_FOLDER_ID` — Drive folder ID (share the folder with the SA as **Editor**)
- `ALLOWED_ORIGIN` — your site origin (e.g., https://your-wix-site or https://<username>.github.io)

Deploy on Vercel, then call `/api/init` with JSON:
```json
{ "name": "myfile.jpg", "mimeType": "image/jpeg", "size": 1234567 }

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
It returns { ok: true, "uploadUrl": "..." }. PUT file chunks to that URL.

Commit each file.

---

# Step 2) Make sure your Drive side is ready

- In Google Cloud Console: enable **Drive API**, create a **Service Account**, download its **JSON key**.
- In Google Drive: create your target folder → **Share** with the service account’s email (`…@…iam.gserviceaccount.com`) as **Editor**.
- Copy the **folder ID** (the long string in the URL after `/folders/`).

---

# Step 3) (Optional) Add the frontend file to this repo too

If you want to keep your test client alongside the backend, add an `example-frontend.html` with this minimal content:

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Direct to Drive</title></head>
<body style="font-family:sans-serif;margin:24px">
  <h2>Upload</h2>
  <input id="f" type="file"><button id="go">Upload</button>
  <div id="msg"></div><progress id="bar" max="100" value="0" style="display:none"></progress>
<script>
const INIT_ENDPOINT = "https://<your-vercel-project>.vercel.app/api/init"; // set after deploy
const CHUNK = 8 * 1024 * 1024; const $=id=>document.getElementById(id);
$('go').onclick = async () => {
  const file = $('f').files?.[0]; if(!file){$('msg').textContent='Pick a file.';return;}
  $('msg').textContent='Starting session…'; $('bar').style.display='block'; $('bar').value=0;
  const r = await fetch(INIT_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,mimeType:file.type||'application/octet-stream',size:file.size})});
  const j = await r.json(); if(!r.ok||!j.ok) { $('msg').textContent='Init failed: '+(j.error||r.status); return; }
  const url = j.uploadUrl; let off=0;
  while(off<file.size){
    const end = Math.min(off+CHUNK,file.size), chunk = file.slice(off,end);
    const res = await fetch(url,{method:'PUT',headers:{'Content-Length':String(end-off),'Content-Range':`bytes ${off}-${end-1}/${file.size}`},body:chunk});
    if(res.status===308){ const rng=res.headers.get('Range'); off = rng? (parseInt(rng.split('-').pop(),10)+1): end; }
    else if(res.ok){ off=file.size; $('msg').textContent='✅ Upload complete'; }
    else { $('msg').textContent=`Error: ${res.status} ${res.statusText}`; return; }
    $('bar').value = Math.round((off/file.size)*100);
  }
};
</script>
</body></html>

# 🚀 Deployment Guide — Gate Access Portal

## Isi Folder Ini

```
vercel-deploy/
├── Code.gs               ← Google Apps Script backend (deploy ke GAS)
├── index.html            ← Landing page (Gate Access Portal)
├── post7-entry.html      ← Post 7 Vehicle Entry form
├── post1-exit.html       ← Post 1 Vehicle Exit interface
├── dashboard.html        ← Real-time dashboard
├── dashboard.js          ← Dashboard logic
├── manifest.json         ← PWA manifest
├── sw.js                 ← Service Worker (offline support)
├── vercel.json           ← Vercel deployment config
├── DEPLOY.md             ← Guide ini
└── services/
    └── sheetsService.js  ← Dashboard data service
```

---

## LANGKAH 1 — Deploy Google Apps Script Backend (`Code.gs`)

> ⚠️ **Backend HARUS di-deploy duluan** sebelum frontend Vercel, karena frontend membutuhkan URL backend.

### 1.1 — Buat Google Sheet

1. Buka [sheets.google.com](https://sheets.google.com) → **Blank Spreadsheet**
2. Beri nama: `Gate Monitoring Data`
3. **Salin Sheet ID** dari URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_DISINI/edit
                                           ^^^^^^^^^^^^^^^^
   ```

### 1.2 — Buat Apps Script Project

1. Di Google Sheet tadi, klik **Extensions** → **Apps Script**
2. Hapus semua kode default di editor
3. **Copy-paste seluruh isi file `Code.gs`** dari folder ini
4. Di baris ke-9, ganti `SHEET_ID` dengan Sheet ID Anda:
   ```javascript
   var SHEET_ID = 'PASTE_SHEET_ID_ANDA_DISINI';
   ```
5. Klik **💾 Save** (Ctrl+S)

### 1.3 — Deploy sebagai Web App

1. Klik **Deploy** → **New Deployment**
2. Klik ⚙️ gear icon → pilih **Web app**
3. Isi:
   - **Description:** `Gate System API v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Klik **Deploy**
5. Klik **Authorize access** → pilih akun Google Anda → **Allow**
6. **Salin URL Web App** yang muncul:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

### 1.4 — Update URL di Frontend (Jika Berbeda)

Jika URL Web App Anda **berbeda** dari yang sudah ada di kode, update di 3 file:

| File | Baris | Variable |
|------|-------|----------|
| `post7-entry.html` | ~1259 | `const SHEET_URL = '...'` |
| `post1-exit.html` | ~1630 | `const SHEET_URL = '...'` |
| `services/sheetsService.js` | 1 | `const SHEET_URL = '...'` |

### 1.5 — Test Backend

Buka URL Web App di browser, seharusnya muncul:
```json
{"status":"ok","message":"Gate System API is running."}
```

---

## LANGKAH 2 — Deploy Frontend ke Vercel

### Opsi A — Via Vercel Dashboard (Drag & Drop)

1. Buka [vercel.com](https://vercel.com) dan login
2. Klik **"Add New..."** → **"Project"**
3. Pilih **"Import Third-Party Git Repository"** atau scroll ke bawah dan pilih:
   > **"Deploy without a Git repository"** → **Browse** → pilih folder `vercel-deploy` ini
4. Vercel akan otomatis mendeteksi sebagai static site
5. Klik **"Deploy"**
6. Tunggu ~30 detik, situs aktif di URL `.vercel.app`

### Opsi B — Via Vercel CLI (Terminal)

```bash
# 1. Install Vercel CLI (sekali saja)
npm install -g vercel

# 2. Masuk ke folder deploy
cd vercel-deploy

# 3. Login (pertama kali saja)
vercel login

# 4. Deploy
vercel --prod
```

Ikuti prompt yang muncul:
- **Set up and deploy?** → `Y`
- **Which scope?** → Pilih akun Anda
- **Link to existing project?** → `N` (pertama kali) atau `Y` (update)
- **Project name?** → `gate-access-portal` (atau sesuai keinginan)
- **Directory?** → `./`
- **Override settings?** → `N`

Deploy selesai dalam ~30 detik. URL akan ditampilkan di terminal.

---

## Setelah Deploy

### ✅ Test checklist:
1. Buka URL Vercel → Halaman landing muncul
2. Klik **POST 7 (Entry)** → Form entry berfungsi
3. Klik **POST 1 (Exit)** → Search & exit berfungsi
4. Klik **DASHBOARD** → Data ter-load dari Google Sheets
5. Cek di mobile → PWA installable

### ⚠️ Penting: Update Google Apps Script

Setelah deploy, **URL Vercel Anda harus di-whitelist** di Google Apps Script jika ada CORS issue.  
Biasanya tidak perlu karena GAS web app yang di-deploy dengan **"Anyone"** access sudah menerima semua origin.

### 🔄 Update Deployment

Untuk update di kemudian hari:
```bash
cd vercel-deploy
vercel --prod
```

Atau upload ulang folder via Vercel Dashboard.

---

## Custom Domain (Opsional)

1. Di Vercel Dashboard → Project → **Settings** → **Domains**
2. Tambahkan domain Anda (mis. `gate.yourcompany.com`)
3. Update DNS sesuai instruksi Vercel:
   - **CNAME** `gate` → `cname.vercel-dns.com`
   - Atau **A record** → `76.76.21.21`
4. SSL otomatis aktif

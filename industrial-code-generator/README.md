# Industrial Code & Label Generator PRO

Enterprise-grade industrial labeling and commercial press gang-sheet generation suite. Built with high-precision **100% Pure Vector PDF engines**, an integrated **Zero-Waste Roll Calculator & Batch Planner**, and protected by **Firebase Authentication with Strict Email Whitelisting**.

---

## 🌟 Key Features

### 1. High-Performance Pure Vector Engine
- **Zero Browser Memory Leaks:** Bypasses DOM/Canvas rasterization by writing native PDF vector primitives directly (`rect`, `line`, native font text).
- **Infinite Scalability:** Razor-sharp barcode and text resolution at any press scale (tested up to 20,000+ labels without browser tab crashes).
- **Multi-Code Standards:** Supports **2D Data Matrix**, **QR Code**, and **1D Industrial Barcodes** (Code 128, GS1-128, etc.).

### 2. Roll Gang-Sheet Calculator & Batch Planner
- **Zero Material Wastage:** Automatically calculates exact column fit on commercial rolls (4ft, 3ft, 2ft, 1000mm, or custom roll widths) and snaps batches to complete rows.
- **PDF 200" MediaBox Limit Guard:** Automatically enforces ISO 32000 page limits (~200 inches / 16.6 ft max per page) so commercial RIPs and PDF viewers never clip content.
- **Dedicated Single-Part & Master Batch Export:** Export individual roll parts on-demand or trigger sequential automated batch downloads with non-blocking pauses.

### 3. Enterprise Security & Access Control
- **Dual Authentication:** 1-Click **Google Sign-In** and **Email & Password** authentication via Google Firebase.
- **Strict Email Whitelisting:** Access is strictly gated; only pre-approved administrator emails can enter the production terminal.
- **Auto-Purge on Denial:** Any unauthorized Google account attempting to sign in is rejected and immediately purged from the Firebase database (`user.delete()`).
- **Brute-Force Rate Limiting:** Automatically freezes the terminal for 15 minutes with a live countdown timer after 5 consecutive failed attempts.

---

## 📁 Project Architecture

```text
industrial-code-generator/
├── index.html            # Main application UI (Studio + Calculator views)
├── netlify.toml          # Netlify cloud deployment & security headers
├── package.json          # Project manifest & build scripts
├── build-env.js          # Zero-dependency environment variable builder
├── .env                  # Local secrets & credentials (git-ignored)
├── .env.example          # Safe template for environment variables
├── .gitignore            # Excludes secrets (.env, js/env.js)
├── css/
│   ├── style.css         # Complete design system, layouts & auth modal
│   └── print.css         # Clean print stylesheets
└── js/
    ├── env.js            # Auto-generated client config (git-ignored)
    ├── auth.js           # Firebase Auth, Whitelist guard & Rate limiter
    ├── state.js          # Application reactive state store
    ├── data-input.js     # Sequence generator, list parser & CSV importer
    ├── preview.js        # Live 1:1 Inspector & batch grid visualizer
    ├── calculator.js     # Commercial roll calculator & gang-sheet scheduler
    ├── exporter.js       # Master vector PDF press exporter & ZIP archiver
    └── renderers/
        └── code-engine.js # Pure vector barcode & typography renderer
```

---

## 🚀 Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- A modern web browser (Chrome, Edge, Firefox)

### Step 1: Configure Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```

Open `.env` and fill in your Firebase Project credentials and approved administrator emails:
```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
FIREBASE_PROJECT_ID=your-app
FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...

# Comma-separated list of authorized email addresses
WHITELISTED_EMAILS=admin@example.com,operator@company.com
```

### Step 2: Build the Client Environment File
Run the environment builder to generate `js/env.js`:
```bash
node build-env.js
# Or using npm
npm run build
```

### Step 3: Run Locally
Open `index.html` using a local HTTP server (required for Google OAuth security):
- Using VS Code: Right-click `index.html` → **Open with Live Server**
- Or using terminal:
  ```bash
  npx serve .
  ```
Visit `http://localhost:5500` (or the port shown in your terminal).

---

## ☁️ Netlify Cloud Deployment

This project is configured for continuous zero-build deployment on **Netlify**.

### 1. Connect Repository
1. Push your repository to GitHub (ensure `.env` and `js/env.js` remain git-ignored).
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → **GitHub**.
3. Select your repository.

### 2. Configure Netlify Environment Variables
In Netlify Dashboard → **Site configuration** → **Environment variables**, add the following keys:

| Variable Name | Description | Example |
| :--- | :--- | :--- |
| `FIREBASE_API_KEY` | Firebase Web API Key | `AIzaSy...` |
| `FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `app.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | `app-id` |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | `app.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging Sender ID | `820107060067` |
| `FIREBASE_APP_ID` | Firebase Web App ID | `1:820107060067:web:...` |
| `WHITELISTED_EMAILS` | Comma-separated allowed emails | `admin@company.com` |

### 3. Deploy
Click **Deploy site**. Netlify automatically runs `node build-env.js` during deployment and publishes the site live in seconds.

### 4. Authorize Domain in Firebase
In [Firebase Console](https://console.firebase.google.com):
1. Navigate to **Authentication** → **Settings** tab.
2. Scroll to **Authorized domains** → Click **Add domain**.
3. Add your live Netlify domain (e.g. `your-app-name.netlify.app`).

---

## 👥 Managing Authorized Operators

### Adding a New User via Google Sign-In (Recommended)
1. In Netlify Dashboard → **Site configuration** → **Environment variables**.
2. Edit `WHITELISTED_EMAILS` and add the operator's Google email (comma-separated):
   ```text
   admin@company.com, newoperator@gmail.com
   ```
3. Save and trigger a new deploy (**Deploys** → **Trigger deploy**).
4. The user can now visit the URL and click **Sign In with Google**.

### Adding a New User via Email & Password
1. Add the email to `WHITELISTED_EMAILS` in Netlify settings and deploy.
2. Go to [Firebase Console](https://console.firebase.google.com) → **Authentication** → **Users** tab.
3. Click **Add user**, enter the operator's email and a secure password.
4. Provide the operator with their login credentials to sign in directly on the terminal.

### Revoking Access
Simply remove the email address from `WHITELISTED_EMAILS` and redeploy. The operator will be blocked immediately with `⛔ Access Denied`.

---

## 🧮 Commercial Press Production Guide

1. **Calculate Optimal Layout:**
   - Go to the **🧮 Roll Gang-Sheet Calculator & Batch Planner** tab.
   - Enter your **Total Order Quantity** (e.g., 20,000 labels).
   - Enter your individual **Label Dimensions** (e.g., 3.0" &times; 3.5").
   - Select your physical **Roll Preset** (e.g., 48" / 4ft roll).
2. **Review Zero-Waste Schedule:**
   - The system calculates column fit (e.g., 16 columns = 100% width utilization).
   - The batch scheduler calculates exact row counts under the 200" limit (e.g., 56 rows = 896 labels per roll part).
3. **Execute Print Production:**
   - **Single File:** Click `⚡ Export PDF` on any specific schedule row to download only that single part.
   - **Full Order:** Click `🏭 One-Click Export Entire Order in Zero-Waste Parts` to generate all parts sequentially.

---

## 📄 License & Ownership
Proprietary industrial software engineered for high-volume commercial printing. Private and restricted enterprise access only.

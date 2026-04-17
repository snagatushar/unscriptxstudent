# 🚀 UNSCRIPTX 2026

**UNSCRIPTX 2026** is a high-energy, production-ready platform designed for the modern college cultural fest experience. Built with a focus on raw performance, sophisticated animations, and rock-solid security, it handles everything from student registrations and event management to multi-round video submissions and administrative judging workflows.

![UNSCRIPTX Banner](https://www.unscriptx.com/logo.png)

## ✨ Core Features

### 🎨 Premium UI/UX
- **Immersive Visuals**: High-performance mesh gradients and particle systems optimized for GPU acceleration.
- **Cinematic Transitions**: Seamless cross-fades and slide-preloading for a flicker-free landing page experience.
- **Micro-interactions**: Powered by `motion` (Framer Motion) for that premium "app-like" feel.

### 🛡️ Secure & Scalable Architecture
- **Role-Based Access Control (RBAC)**: Dedicated dashboards for **Admins**, **Payment Reviewers**, **Content Judges**, and **Participants**.
- **Hardened Security**: Pre-configured security headers (CSP, HSTS, XSS protection) via `vercel.json`.
- **Relational Data**: High-performance Postgres database hosted on Vercel/External.

### ⚡ Performance-First
- **Smart Code Splitting**: Manual chunking of vendor libraries (React, Motion, ExcelJS) for better caching.
- **Lazy Loading**: Route-level lazy loading significantly reduces the main JS bundle size.
- **Global Data Caching**: In-memory caching for static fest data (rules, committee, events) eliminates redundant network traffic.
- **Optimized Assets**: Image pre-loading and data-URI noise textures for instant render times.

### 📁 Advanced Event Workflows
- **Dynamic Registrations**: Support for external links (Google Forms) or internal native forms.
- **Video Submission System**: Seamless 800MB video uploads via Google Drive with validation.
- **Excel Export**: Generate on-demand participant reports with `exceljs`.

---

## 🛠️ Technology Stack

- **Frontend**: [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/)
- **Logic**: [TypeScript](https://www.typescriptlang.org/)
- **Backend/Auth/DB**: Postgres + Vercel Serverless Functions
- **Styling**: Vanilla CSS (Modern Design System)
- **Animations**: [Motion](https://motion.dev/)
- **Reports**: [ExcelJS](https://github.com/exceljs/exceljs)

---

## 🚀 Getting Started

### 1. Prerequisite
Ensure you have [Node.js](https://nodejs.org/) installed on your system.

### 2. Clone the repository
```bash
git clone https://github.com/your-username/unscriptx-2026.git
cd unscripted/unscripted
```

### 3. Install dependencies
```bash
npm install
```

### 4. Set up Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL=your_postgres_db_url
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GDRIVE_EVENT_FOLDER_MAP_JSON={"Event 1":"folderId1"}
GDRIVE_ROOT_FOLDER_ID=your_events_root_folder_id
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
```

### 5. Start the development server
```bash
npm run dev
```
The site will be available at `http://localhost:5173`.

---

## 🚢 Deployment (Vercel)

1. Connect your GitHub repository to [Vercel](https://vercel.com/).
2. Add your environment variables in the Vercel Dashboard.
3. **Crucial**: Update your **Supabase Authentication Settings**:
   - **Site URL**: `https://www.unscriptx.com`
   - **Redirect URLs**: `https://www.unscriptx.com/**`

---

## 🔥 Performance Score Card
- **First Contentful Paint**: < 1s
- **Time to Interactive**: < 2s
- **Initial Bundle Size**: < 200KB (Gzipped)
- **Vulnerabilities**: 0 (Audit cleared)

---

Made with ❤️ by S.Naga Tushar for **UNSCRIPTX 2026**.

---

## Google Drive Storage Setup

Video submissions are stored in Google Drive via backend API routes:

- `GET /api/auth/google` (connect your Google account via OAuth)
- `GET /api/auth/google/callback` (OAuth callback)
- `POST /api/drive-upload` (upload to event folder; auto-creates event folder under root if missing)
- `GET /api/drive-view?fileId=...` (private proxy stream)
- `GET /api/drive-files?userId=...` (optional metadata list by user)

### 1) Google Cloud

- Enable **Google Drive API**
- Create **OAuth 2.0 Client ID** credentials
- Set authorized redirect URI to match `GOOGLE_REDIRECT_URI`
- Use scope `https://www.googleapis.com/auth/drive.file`

### 2) Create Event Folders Automatically

Use the helper script:

```bash
npm run drive:setup-folders
```

Required env vars:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_REFRESH_TOKEN` (script only)
- `GDRIVE_EVENTS_PARENT_FOLDER_ID`
- `DRIVE_EVENT_TITLES_JSON` (JSON array of event titles)

This generates:

- `drive-config/event-folder-map.json`

Then copy that JSON into:

- `GDRIVE_EVENT_FOLDER_MAP_JSON`

### 3) Runtime Env Vars

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `DATABASE_URL`
- `GDRIVE_ROOT_FOLDER_ID` (recommended)
- `GDRIVE_EVENT_FOLDER_MAP_JSON` (optional override map)

### 4) Connect Drive Owner Account

Open this once after deploy/local backend start:

- `/api/auth/google`

After consent, tokens are stored in the database table `google_oauth_tokens`.

Create the table (once):

```sql
create table if not exists google_oauth_tokens (
  id text primary key,
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expiry_date bigint,
  updated_at timestamptz default now()
);
```

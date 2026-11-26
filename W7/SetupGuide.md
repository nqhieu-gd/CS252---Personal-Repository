# CS252 Lab 07 — WanderLingo Setup, Testing & Demo Guide

- **Course:** CS252 — Programming Systems (Week 7)
- **Student:** Nguyễn Quang Hiếu (`25125043` / `nqhieu-gd`)
- **Project:** WanderLingo — Multilingual Travel Companion Website (`py-googletrans` Integration)

---

## 1. Deliverables Index (`W7/`)

| Assignment Requirement (`Lab07-Google Translate API-Firebase API.pdf`) | Deliverable Path in `W7/` |
| :--- | :--- |
| **1. Explanation / Project Report** | [report.md](./report.md) |
| **2. AI Usage Declaration** | [README.md](./README.md) |
| **3. Source Code** | [WanderLingo/](./WanderLingo/) (`backend/`, `frontend/`, `start.ps1`) |
| **4. Setup & Running Guide** | [SetupGuide.md](./SetupGuide.md) *(this file)* |
| **5. Git Commit History** | [Git_Commit_History.md](./Git_Commit_History.md) |
| **Development Plan** | [Development_Plan.md](./Development_Plan.md) |

---

## 2. Quick Start — How to Run WanderLingo Locally

### Option A: Single-Command Launcher (Recommended for Grading & Demo)
From PowerShell, run:
```powershell
powershell -ExecutionPolicy Bypass -File "F:\Git\nqhieu-gd-local\CS252---Personal-Repository\W7\WanderLingo\start.ps1"
```
- **Automatic Browser Launch:** As soon as the FastAPI server passes its `/api/health` check, `start.ps1` **automatically opens `http://127.0.0.1:8000` in your default web browser** (pass `-NoBrowser` if you want to suppress auto-opening, or `-Rebuild` if you want to force a fresh frontend build).
- **Manual URLs (if needed):**
  - **WanderLingo Web Application:** `http://127.0.0.1:8000`
  - **FastAPI Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`

### Option B: Two-Terminal Development Mode (Hot Reload)
1. **Terminal 1 (FastAPI Backend on port 8000):**
   ```powershell
   cd "F:\Git\nqhieu-gd-local\CS252---Personal-Repository\W7\WanderLingo\backend"
   $env:PYTHONIOENCODING="utf-8"
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
   ```
2. **Terminal 2 (React + Vite Dev Server on port 5173):**
   ```powershell
   cd "F:\Git\nqhieu-gd-local\CS252---Personal-Repository\W7\WanderLingo\frontend"
   npm.cmd run dev
   ```
   *(Vite is configured with `server.open: true` in `vite.config.ts`, so `http://localhost:5173` also opens automatically in your default browser.)*

---

## 3. Running Automated Tests

- **Backend Unit & API Contract Tests (`18 passed`):**
  ```powershell
  cd "F:\Git\nqhieu-gd-local\CS252---Personal-Repository\W7\WanderLingo\backend"
  $env:PYTHONPATH="."
  .\.venv\Scripts\pytest.exe tests -v
  ```
- **Live `py-googletrans` Smoke Verification Script:**
  ```powershell
  cd "F:\Git\nqhieu-gd-local\CS252---Personal-Repository\W7\WanderLingo\backend"
  $env:PYTHONIOENCODING="utf-8"
  .\.venv\Scripts\python.exe scripts\smoke_googletrans.py
  ```
- **Frontend TypeScript, Vitest & Production Build (`3 passed`):**
  ```powershell
  cd "F:\Git\nqhieu-gd-local\CS252---Personal-Repository\W7\WanderLingo\frontend"
  npx.cmd tsc --noEmit
  npm.cmd test
  npm.cmd run build
  ```

---

## 4. Video Demonstration Walkthrough Script (3–4 Minutes)

1. **Startup & Architecture Proof (0:00–0:30):**
   - Run `start.ps1` and let it automatically open `http://127.0.0.1:8000` (and optionally show `http://127.0.0.1:8000/docs`).
   - Point out the top bar showing **Engine Ready**, the **Engine** settings modal (`py-googletrans v4.0.2`, Cache Hits, Endpoint Routing Preset selector: `Standard`, `Direct API`, `Multi-Region Failover`), **EN / VI** toggle, and **Light Theme / Dark Theme** toggle.
2. **Tab 1 — Translator & Common English Travel Phrasebook (0:30–1:25):**
   - Translate `"Hpw do I reverve a room?"` into Vietnamese (`From = Auto-Detect`) to show automatic source-language reporting (`Translated from: English`) and the **Spelling & Grammar Fixing Recommendation (`"Did you mean: How do I reserve a room?"`)**, then click **Apply & Translate**.
   - Show **Verify Meaning**, **Show Card** (the high-contrast Show-to-Local Conversation Card dialog), **Common English Travel Phrasebook** (clicking a `...` fill-in template automatically selects `...` for quick customization), and **Saved Phrases** (single-item delete + **Export Phrase Sheet (`.txt`)**).
3. **Tab 2 — Destinations / Popular Destinations (1:25–2:05):**
   - Browse the **8 curated Vietnam destinations** (*Hanoi, Ho Chi Minh City, Da Nang & Hoi An, Hue, Da Lat, Phu Quoc, Vung Tau, Quy Nhon*).
   - Switch **Language** from **English** to **Vietnamese** or **Japanese**: show how all descriptive fields inside **About this place** automatically translate and replace in-place while numeric planning fields (`Estimated Daily Budget (USD)`, `Recommended Stay Days`) remain preserved.
4. **Tab 3 — Guest Reviews / Tutorial Example 1 (2:05–2:45):**
   - Click **Translate All Reviews** (or choose a **Language**) to localize the entire international guest review wall at once, skipping reviews already written in your language (`Already in Target Language`).
   - Post a custom review with your own **Name**, **Hotel / Place**, and **Star Rating** (`Ctrl + Enter` adds to the board; only your own posted reviews can be deleted).
5. **Tab 4 — Concierge Desk / Tutorial Example 2 (2:45–3:30):**
   - Select any guest thread in the **Split-Pane 2-Way Messaging Inbox** (`Alex Carter` vs. `Yuki Tanaka`) to see on-demand single-thread translation (`Same Language` vs. `Translated`).
   - Click **Fill Template** (or type a reply) at the bottom of `Yuki Tanaka`'s thread and press **Send Translated Reply** to append a reverse-translated Japanese reply bubble (with Romaji pronunciation and audio playback) right into the chat stream.

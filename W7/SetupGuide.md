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
*(Pass `-Rebuild` if you edit any frontend files and want `start.ps1` to re-run `npm.cmd run build` before starting FastAPI.)*

Then open:
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
   Open `http://localhost:5173`.

---

## 3. Running Automated Tests

- **Backend Unit & API Contract Tests (`15 passed`):**
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
   - Run `start.ps1` and open `http://127.0.0.1:8000` and `http://127.0.0.1:8000/docs`.
   - Point out the top bar showing **`googletrans 4.0.2`**, **API Online**, **Cache Hits**, the **Endpoint Preset** selector (`Default`, `Direct API`, `Failover`), **EN / VI** toggle, and **Light / Dark** theme toggle.
2. **Tab 1 — Live Translator & Phrasebook (0:30–1:15):**
   - Translate `"Hello, how are you?"` into Vietnamese (`"Xin chào bạn khoẻ không?"`) and Japanese (`"どうもありがとうございます。"` with phonetic pronunciation `"Dōmo arigatōgozaimasu."`).
   - Click **"Detect Language Only"** on `"¿Dónde está el hotel?"` to show `Spanish (es)` with `100%` confidence.
   - Click a phrasebook chip and show local translation history updating below.
3. **Tab 2 — Destination Guides / Tutorial Example 3 (1:15–2:00):**
   - Select **Hanoi (Tutorial Example 3)** and translate into **Vietnamese** or **Japanese**.
   - Highlight how all 6 string fields are tagged **`Translated String`** while numeric fields (`Avg Daily Budget Usd: 45`, `Visitor Rating: 4.8`, `Unesco Heritage Sites: 1`) are tagged **`Preserved Non-String`**.
   - Briefly toggle **Custom Destination Fields (JSON)** to show custom dictionary support.
4. **Tab 3 — Hotel Reviews Bulk Translator / Tutorial Example 1 (2:00–2:45):**
   - Click **"Translate All Reviews (8)"** with Target Language = **English**.
   - Point out the 3 tutorial Vietnamese reviews translated to English, the English review marked **`Skipped — Already in Target Language`**, and the **Detected Language Breakdown** bar (`Vietnamese: 3`, `English: 1`, `Japanese: 1`, `French: 1`, `Spanish: 1`, `Korean: 1`).
5. **Tab 4 — Travel Inquiry Desk / Tutorial Example 2 (2:45–3:30):**
   - Click **"Process All Queued Inquiries (6)"**.
   - Show how Vietnamese, Spanish, and Japanese inquiries display **`Translation Applied`** (`needs_translation: true`), while the English inquiry displays **`No Translation Needed (Same Language)`** (`needs_translation: false`).
   - In the **Two-Way Concierge Reply Composer** on the Japanese inquiry, click **"Translate Reply to Guest Language"** to show the staff reply reverse-translated into Japanese with Romaji pronunciation.

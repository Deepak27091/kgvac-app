# KG Vac Service - Job Manager

A comprehensive Job Management and Scheduling system built with a **FastAPI (Python) + MongoDB** backend and an **Expo React Native (Web + Mobile)** frontend.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed on your machine:

1. **Node.js** (v18.x or v20.x+)
   - Check with: `node -v`
   - Download from [nodejs.org](https://nodejs.org/) if needed.
2. **Python** (v3.10 or higher)
   - Check with: `python --version` (or `py -3 --version`)
   - If not installed on Windows, install via `winget install Python.Python.3.12` or from [python.org](https://www.python.org/). *Ensure you check "Add python.exe to PATH" during installation.*
3. **MongoDB**
   - You need a running MongoDB database. You can choose one of these options:
     - **Option A (Docker)**: `docker run -d -p 27017:27017 --name kgvac-mongo mongo:latest`
     - **Option B (Local Community Server)**: Install MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community).
     - **Option C (Cloud / MongoDB Atlas)**: Create a free sandbox cluster on [MongoDB Atlas](https://www.mongodb.com/atlas) and get your connection string (`mongodb+srv://...`).

---

## 🚀 Quick Setup Guide

### 1. Backend Setup (FastAPI + MongoDB)

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **On Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
     *(If script execution is blocked on PowerShell, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first, or use Command Prompt: `.\venv\Scripts\activate.bat`)*
   - **On macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install backend dependencies:
   ```bash
   pip install -r requirements-local.txt
   ```

4. Configure the environment variables:
   A `.env` file has been provided in `backend/.env`. If you need to customize it:
   ```ini
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=kgvac_db
   JWT_SECRET=supersecret_dev_jwt_key_change_in_production_123456
   JWT_ISSUER=kgvac-jobmanager
   RESEED_PASSWORDS=false
   SEED_ADMIN_EMAIL=admin@kgvac.com
   SEED_ADMIN_PASSWORD=Admin@2026
   SEED_STAFF1_EMAIL=staff1@kgvac.com
   SEED_STAFF1_PASSWORD=Staff1@2026
   SEED_STAFF2_EMAIL=staff2@kgvac.com
   SEED_STAFF2_PASSWORD=Staff2@2026
   ```

5. Start the backend API server:
   ```bash
   uvicorn server:app --reload --port 8000
   ```
   - API Root: [http://localhost:8000/api](http://localhost:8000/api)
   - Interactive Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

> **Note on Initial Data Seed:** When the server launches for the first time, it automatically creates service categories and default user accounts in your MongoDB database.

#### Pre-seeded Default Credentials:
- **Admin**: `admin@kgvac.com` / `Admin@2026`
- **Staff 1**: `staff1@kgvac.com` / `Staff1@2026`
- **Staff 2**: `staff2@kgvac.com` / `Staff2@2026`

---

### 2. Frontend Setup (Expo React Native / Web)

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Configure frontend environment variables:
   A `.env` file is prepared at `frontend/.env`:
   ```ini
   EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
   ```
   *(If you want to test on a physical phone using Expo Go, replace `localhost` with your computer's local Wi-Fi IP address, e.g. `http://192.168.1.50:8000`)*

3. Install frontend dependencies:
   ```bash
   npx yarn install
   ```
   *(Or using npm: `npm install --legacy-peer-deps`)*

4. Run the application:
   - **To run in your Web Browser (Recommended for quick testing)**:
     ```bash
     npx expo start --web
     ```
     This opens the web app directly at [http://localhost:8081](http://localhost:8081).
   
   - **To run in Expo Go (Mobile)**:
     ```bash
     npx expo start
     ```
     Scan the QR code using the **Expo Go** app on iOS or Android.

---

## 🧪 Testing Backend Endpoints

To run backend automated tests:
```bash
cd backend
pytest tests/test_kgvac_backend.py -n 0
```
*(Make sure the backend server is running first, or set `EXPO_PUBLIC_BACKEND_URL=http://localhost:8000` in your test environment).*

---

## 🔍 Troubleshooting

- **Python command not found on Windows**:
  Run `winget install Python.Python.3.12` or download it from [python.org](https://www.python.org/). Ensure you enable the option **"Add python.exe to PATH"**.
- **MongoDB connection refused**:
  Verify your MongoDB service or container is running on `localhost:27017`, or use a free MongoDB Atlas connection string in `backend/.env`.
- **CORS / Network issues on mobile**:
  When testing on physical mobile devices, `localhost` refers to the mobile device itself. Update `EXPO_PUBLIC_BACKEND_URL` in `frontend/.env` to your PC's LAN IP (e.g. `http://192.168.x.x:8000`) and ensure both PC and phone are on the same Wi-Fi network.

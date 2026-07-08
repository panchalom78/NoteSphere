---
description: How to deploy this Notes Management application (Next.js + Python stdio MCP server)
---

# Deploying the Notes Management MCP Workspace

The application is structured into two parts:
1. **Next.js Client:** The frontend web interface.
2. **Python MCP Server:** Managed internally via stdio child processes writing to SQLite (`notes.db`).

---

## Option 1: Docker Container Deployment (Recommended for VPS/Cloud)

Using the root `Dockerfile` is the easiest way to deploy to platforms like **Render**, **Railway**, **Fly.io**, or your own virtual private server (e.g. AWS Lightsail, DigitalOcean).

### 1. Build and Run Locally with Docker
To test the production container configuration:

```bash
# Build the Docker image
docker build -t notes-sphere .

# Create a directory to persist your database on the host machine
mkdir -p ./data

# Run the container with a volume mount for the database
docker run -p 3000:3000 -v $(pwd)/data:/app/server/data -e GEMINI_API_KEY="your-gemini-key" notes-sphere
```

### 2. Cloud Hosting Setup (Railway / Render / Fly.io)
When pushing this repo to GitHub and deploying to a platform:
- **Port:** Configure to `3000`.
- **Persistent Disk (Volume):** Since SQLite is serverless and writes to `/app/server/notes.db` by default, mount a persistent volume at `/app/server` (or modify `server.py` database path to look at a mounted directory like `/data/notes.db`) to ensure database records persist across container restarts.
- **Environment Variables:**
  - `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key to enable the LLM agent capabilities.

---

## Option 2: PM2 / Process Manager Deployment (On VPS/Linux server)

If you are deploying on a VM directly without Docker:

### 1. Install Global Process Manager
```bash
sudo npm install -g pm2
```

### 2. Setup Server Database & Environment
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -c "import server" # Seed database
```

### 3. Build & Run Client
```bash
cd ../client
npm install
npm run build
pm2 start npm --name "notes-sphere" -- start
```
Use `pm2 startup` and `pm2 save` to keep it running through system reboots.

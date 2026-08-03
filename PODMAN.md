# Backend Containerization Guide (Podman & Docker)

This repository provides containerization for the **Backend System only** (Rust Actix-web API + Node.js Baileys WhatsApp Engine). The Next.js frontend remains separate.

---

## 🚀 Quick Start with Podman

### Option A: Using Podman CLI (Recommended)

1. **Build the container image**:
   ```bash
   podman build -t velurix-backend -f Dockerfile.backend .
   ```

2. **Run the container with persistent storage**:
   ```bash
   podman run -d \
     --name velurix-backend \
     -p 8080:8080 \
     -v velurix-data:/app/data \
     velurix-backend
   ```

3. **Check container logs**:
   ```bash
   podman logs -f velurix-backend
   ```

4. **Stop or restart**:
   ```bash
   podman stop velurix-backend
   podman start velurix-backend
   ```

---

### Option B: Using Podman Compose / Docker Compose

If you have `podman compose` or `podman-compose` installed:

```bash
# Build and launch backend in background
podman compose up -d --build

# View real-time logs
podman compose logs -f

# Stop backend
podman compose down
```

---

## ⚙️ Environment & Persistence Details

- **Port**: `8080` (mapped to host `8080`)
- **API URL**: `http://localhost:8080/api/v1`
- **WebSocket URL**: `ws://localhost:8080/ws`
- **Data Persistence**:
  - SQLite Database: `/app/data/velurix.db`
  - WhatsApp Session Auth Keys: `/app/data/sessions/`
  - Volume Name: `velurix-data` (ensures your WhatsApp sessions & campaign data persist across container restarts)

---

## 🔗 Connecting Frontend (Next.js)

Your Next.js frontend running locally on host machine connects seamlessly to the Podman backend container via:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

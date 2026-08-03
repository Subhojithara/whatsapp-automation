# Development Guide

## Prerequisites

- **Rust**: 1.80+ (`cargo`, `rustc`)
- **Node.js**: 20+ (`node`, `npm`)
- **SQLite**: Local SQLite driver / library

## Workspace Setup

### 1. Engine setup (`apps/whatsapp-engine`)
```bash
cd apps/whatsapp-engine
npm install
npm run build
```

### 2. Dashboard setup (`apps/web`)
```bash
cd apps/web
npm install
```

### 3. API setup (`apps/api`)
```bash
cd apps/api
cargo build
```

## Running Dev Environment

From the repository root:

```powershell
# Run API (Terminal 1)
cd apps/api
cargo run

# Run Next.js Dashboard (Terminal 2)
cd apps/web
npm run dev
```

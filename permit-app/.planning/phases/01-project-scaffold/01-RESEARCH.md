# Phase 1 Research: Project Scaffold

**Date:** 2026-03-17
**Phase:** 1 — Project Scaffold
**Requirements:** UI-01, UI-02, UI-03, AUTO-14

---

## Stack Versions (Exact)

| Package | Version | Role |
|---------|---------|------|
| `react` | ^19.0.0 | UI library |
| `react-dom` | ^19.0.0 | DOM renderer |
| `react-router-dom` | ^7.0.0 | Client-side routing |
| `@tanstack/react-query` | ^5.0.0 | Server state / data fetching |
| `tailwindcss` | ^4.0.0 | Utility CSS |
| `@tailwindcss/vite` | ^4.0.0 | Tailwind v4 Vite plugin (replaces PostCSS) |
| `vite` | ^6.0.0 | Frontend build tool |
| `@vitejs/plugin-react` | ^4.3.0 | Vite React plugin |
| `lucide-react` | ^latest | Icon library |
| `express` | ^5.0.0 | HTTP server |
| `helmet` | ^8.0.0 | Security headers |
| `cors` | ^2.8.5 | CORS middleware |
| `express-rate-limit` | ^7.0.0 | Rate limiting |
| `morgan` | ^1.10.0 | Request logging |
| `dotenv` | ^16.4.0 | Environment variables |
| `nodemon` | ^3.1.0 | Dev server auto-restart |
| `concurrently` | ^9.0.0 | Multi-process orchestration |
| `cloudflared` | ^0.3.0 | Cloudflare Tunnel npm wrapper |

---

## Tailwind CSS v4 Setup

**Major change from v3:** No `tailwind.config.js`. Uses CSS-first config with `@tailwindcss/vite` plugin.

### client/vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
```

### client/src/index.css
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

Key points:
- `@import "tailwindcss"` replaces old PostCSS setup entirely
- `@custom-variant dark` enables class-based dark mode without config file
- No `content` array needed — v4 auto-detects content paths

---

## Dark Mode Strategy

Force dark mode by adding `dark` class to `<html>` in `client/index.html`:

```html
<!DOCTYPE html>
<html class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Permit Manager</title>
  </head>
  <body class="bg-slate-950">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Since `dark` class is **always on `<html>`**, only dark variants ever apply. Light mode variants are dead code. Use `dark:` prefix on all color classes — e.g., `bg-slate-950`, `text-white`.

---

## Concurrently Setup

### Root package.json scripts
```json
{
  "name": "permit-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:server": "nodemon server/index.js",
    "dev:client": "vite --config client/vite.config.js",
    "dev:tunnel": "cloudflared tunnel --url http://localhost:3001",
    "start": "concurrently --names \"SERVER,CLIENT,TUNNEL\" --prefix-colors \"cyan,green,yellow\" --kill-others \"npm run dev:server\" \"npm run dev:client\" \"npm run dev:tunnel\""
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

Flags:
- `--names` — comma-separated names shown as prefix
- `--prefix-colors` — chalk colors per process
- `--kill-others` (`-k`) — stops all when any one exits or crashes

---

## cloudflared npm Package

Package: `cloudflared` (npm wrapper that auto-installs the binary on first run)

Quick tunnel script (dev):
```bash
cloudflared tunnel --url http://localhost:3001
```

Prints a random `*.trycloudflare.com` URL on startup. URL changes per restart (acceptable in Phase 1). Phase 10 sets up a named persistent tunnel.

---

## React Router v7 Setup

### client/src/App.jsx
```jsx
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Layers, BarChart3, MapPin } from 'lucide-react'
import Pipeline from './pages/Pipeline'
import Analytics from './pages/Analytics'
import Jurisdictions from './pages/Jurisdictions'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-slate-950 text-white">
        <div className="flex-1 overflow-y-auto pb-20">
          <Routes>
            <Route path="/" element={<Pipeline />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/jurisdictions" element={<Jurisdictions />} />
          </Routes>
        </div>
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex">
          {[
            { to: '/', icon: <Layers size={22} />, label: 'Pipeline' },
            { to: '/analytics', icon: <BarChart3 size={22} />, label: 'Analytics' },
            { to: '/jurisdictions', icon: <MapPin size={22} />, label: 'Jurisdictions' },
          ].map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-3 text-xs gap-1 transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-200'
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </BrowserRouter>
  )
}
```

Key: `end` prop on NavLink prevents `/` from matching `/analytics`.

---

## React Query v5 Setup

### client/src/main.jsx
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
```

---

## Express 5 Skeleton

### server/index.js
```javascript
import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet())
app.use(morgan('dev'))
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handler — must be last
app.use((err, req, res, next) => {
  console.error(err.message)
  res.status(err.status || 500).json({ error: err.message })
})

app.listen(PORT, () => console.log(`[SERVER] http://localhost:${PORT}`))
```

Middleware order: helmet → morgan → cors → json → rateLimit → routes → error handler.

Express 5 auto-catches async errors in route handlers (no try/catch needed).

---

## Recommended Directory Layout

```
permit-app/
├── package.json              (root: concurrently scripts, devDeps)
├── .env                      (gitignored)
├── .env.example              (committed)
├── .gitignore
├── server/
│   ├── package.json          (Express + server deps)
│   ├── index.js              (entry point)
│   └── routes/               (empty dirs for Phase 2+)
├── client/
│   ├── package.json          (React + client deps)
│   ├── vite.config.js
│   ├── index.html            (dark class on <html>)
│   └── src/
│       ├── main.jsx          (QueryClient setup)
│       ├── App.jsx           (Router + Tab Bar)
│       ├── index.css         (@tailwindcss import + dark variant)
│       └── pages/
│           ├── Pipeline.jsx  (stub)
│           ├── Analytics.jsx (stub)
│           └── Jurisdictions.jsx (stub)
└── .planning/
```

---

## Key Risks

1. **Tailwind v4 PostCSS trap** — Do NOT install tailwindcss as PostCSS plugin. Use `@tailwindcss/vite` ONLY.
2. **Dark mode requires both** — `dark` class on `<html>` AND `@custom-variant dark` in CSS. Either alone won't work.
3. **CORS** — Vite proxy (`/api → localhost:3001`) handles dev CORS. Express CORS must allow `localhost:5173`.
4. **cloudflared random URL** — Fine for Phase 1. Phase 10 switches to named tunnel.
5. **Concurrently orphans** — `--kill-others` is critical. Without it, crashed processes leave dangling ports.
6. **NavLink exact match** — `end` prop on `/` NavLink prevents it from always matching.
7. **server/ ESM** — Use `"type": "module"` in server/package.json for `import` syntax. Use `.js` extensions on all imports.
8. **nodemon + ESM** — Nodemon v3 supports ESM. No special config needed.

---

## RESEARCH COMPLETE

# Stack Research

_Researched: 2025-03-17. Targets Node.js 22 LTS, local-first, no cloud dependencies, single `npm start` entry point._

---

## Frontend

### React 19 + Vite 6

**Libraries:**
- `react` ^19.0.0
- `react-dom` ^19.0.0
- `vite` ^6.0.0
- `@vitejs/plugin-react` ^4.3.0

**Rationale:**
Vite 6 is now the unambiguous standard for React SPA development. Create React App is officially deprecated. Vite uses native ES modules during development (sub-1-second cold start), hot module replacement that updates only the changed module, and Rollup under the hood for optimized production builds. React 19 adds concurrent rendering improvements and the new `use()` hook for async data.

For this app (local-first, single-user, no SSR needed), a plain Vite SPA is the right call. Next.js and Remix add server complexity that is pointless when there is no public internet deployment.

Node.js requirement: 20.19+ or 22.12+ (use 22 LTS).

### Routing

**Library:** `react-router-dom` ^7.0.0

**Rationale:**
React Router v7 in "Declarative Mode" (plain `<BrowserRouter>`) is the right choice here. TanStack Router's main advantage is end-to-end TypeScript type safety — worth it on a large TypeScript app with many routes, but overkill for an internal tool running plain JS. React Router v7 has ~20KB bundle vs TanStack Router's ~45KB, a far larger community, and every question is answered on Stack Overflow. TanStack Router is 2.25x larger for features (full type inference, built-in caching) that don't matter in a local tool.

**What NOT to use:**
- `react-router-dom` v5 or v6 — React Router v7 ships breaking API changes; start on v7.
- TanStack Router — correct for large TypeScript SPAs, oversized for this use case.
- Next.js / Remix — SSR frameworks that add a server layer and deployment complexity with zero benefit when there is no public traffic.

### State Management

**Library:** React built-ins (`useState`, `useContext`, `useReducer`) — no external library needed at project start.

If global state becomes complex: `zustand` ^5.0.0 (2KB, no boilerplate, no Provider).

**What NOT to use:**
- Redux / Redux Toolkit — correct for teams and large apps, but the Provider + slice boilerplate is overhead for a solo local tool.
- MobX — brings its own decorator complexity.

### Data Fetching

**Library:** `@tanstack/react-query` ^5.0.0 (TanStack Query)

**Rationale:**
Even in a local app hitting your own Express API, React Query eliminates manual loading/error/stale state management. It caches responses, deduplicates in-flight requests, and makes refetching on focus trivial. The `useQuery` / `useMutation` hooks cut ~40% of typical fetch-related boilerplate.

**What NOT to use:**
- Raw `fetch` in `useEffect` — no deduplication, no cache, no retry, stale-state bugs are common.
- SWR — React Query has better mutation support and devtools; they are equivalent in API design but React Query's ecosystem is larger.

---

## Backend / Server

### Node.js 22 LTS + Express 5

**Libraries:**
- `express` ^5.0.0
- `helmet` ^8.0.0
- `cors` ^2.8.5
- `express-rate-limit` ^7.0.0
- `morgan` ^1.10.0

**Rationale:**
Express 5 (released October 2024) is now stable and the recommended version. It fixes the long-standing async error propagation bug in Express 4 — unhandled promise rejections in route handlers now automatically call `next(err)`. This removes the need for try/catch wrappers on every async route. The API is nearly identical to Express 4, so migration is minimal.

**Security middleware rationale:**
- `helmet` — sets 15 HTTP security headers (CSP, HSTS, X-Content-Type-Options, etc.) with one line. Always register it first, before other middleware.
- `cors` — restrict `Access-Control-Allow-Origin` to `http://localhost:5173` (Vite dev server) so the webhook endpoint is not callable from arbitrary origins.
- `express-rate-limit` — prevents hammering the webhook endpoint or the API from a runaway Zapier Zap. 50 req/min per IP is a safe starting point.
- `morgan` — request logging in `dev` format gives you a timestamped record of every webhook hit in the terminal.
- `express.json()` is built into Express 4.16+ and Express 5 — do NOT install `body-parser` as a separate package; it is redundant.

**What NOT to use:**
- Express 4 — use 5; async error handling alone justifies it.
- Fastify — better performance on high-concurrency servers, but Express 5 is more than adequate for a local tool receiving Zapier webhooks. Fastify's plugin/schema system adds learning overhead with no measurable benefit here.
- Koa / Hapi — smaller ecosystems, less documentation, no advantage for this scope.
- `body-parser` (standalone) — redundant since Express 4.16; importing it separately adds a dead dependency.

### Development Server Restart

**Library:** `nodemon` ^3.1.0

**Rationale:**
For a plain JavaScript Express server (not TypeScript), `nodemon` is the right tool. It watches files and restarts the process on change, with zero configuration needed. The alternative `tsx watch` is optimized for TypeScript — it uses esbuild to strip types before running. Since this stack uses plain JS (no type-stripping step needed), nodemon is simpler and has fewer moving parts.

Node.js 22 native `--watch` flag is a viable zero-dependency option as well and is worth knowing about. It is production-quality in Node 22 and does not require any npm package.

**What NOT to use:**
- `ts-node` + `nodemon` combo — only needed if you add TypeScript. For plain JS it is pure overhead.
- `tsx` — excellent for TypeScript, unnecessary for plain JS.

---

## Storage

### better-sqlite3 ^11.10.0

**Library:** `better-sqlite3` ^11.10.0

**Rationale:**
`better-sqlite3` is the correct choice for any local app that needs more than a config file. Key advantages over alternatives:

1. **Synchronous API that is still fast** — it outperforms async SQLite wrappers (including the older `node-sqlite3`) because synchronous calls avoid V8 event-loop overhead for I/O that is already memory-mapped. Benchmarks show 2,000+ queries/second on complex 5-way joins.
2. **Full SQL** — permits, contacts, jobs, and audit logs have relational structure. SQL queries (WHERE, JOIN, ORDER BY, indexes) are cleaner than JavaScript array `.filter()` chains.
3. **ACID transactions** — a single `db.transaction()` call wraps a webhook insert + a permit status update atomically. With plain JSON files this is impossible; a crash mid-write corrupts data.
4. **Single file on disk** — the database is one `.db` file, easy to back up, inspect with DB Browser for SQLite, and version-control (for seeds/migrations).
5. **Node.js 22 LTS** — prebuilt binaries are available; `npm install` does not require a build step on standard macOS/Linux.

**Node.js 24 warning:** better-sqlite3 v12.x has known build failures on Node 24 due to deprecated V8 APIs. Stick to Node 22 LTS.

**What NOT to use:**
- Plain JSON files (`fs.readFileSync` / `writeFileSync`) — no atomicity, race conditions on concurrent writes, no querying, full-file rewrites on every change. Fine for config, wrong for transactional data.
- `lowdb` — a JSON file wrapper with a lodash-style query API. Its own README warns against production use. No transactions, no indexing, performance degrades linearly with file size. ~913K weekly downloads are largely from prototypes.
- `node-json-db` — same category as lowdb, smaller community.
- PostgreSQL / MySQL — cloud/network databases that require a running server daemon, connection pooling, and credentials. Nothing in this stack requires network-scale storage.
- `@prisma/client` — Prisma is an ORM that adds a schema DSL, a migration engine, and a code generation step. The abstraction is valuable on a team project; it is unnecessary complexity for a local tool where you control the schema directly.
- Node.js built-in `node:sqlite` (added in Node 22.5) — too new, API is still experimental/unstable, no prebuilt binaries, and better-sqlite3's performance has a longer track record.

---

## Webhook / Tunnel

### Tunnel

**Primary approach:** `cloudflared` CLI (installed via Homebrew or direct binary) — invoked as a child process from an npm script.

**npm package for programmatic use:** `cloudflared` ^0.3.0 (the npm wrapper that auto-installs the `cloudflared` binary)

**Rationale:**
Cloudflare Tunnel is the best option for this use case for three reasons:

1. **Free, no credit card, no account for quick tunnels** — `cloudflared tunnel --url http://localhost:3001` gives you a public HTTPS URL immediately.
2. **Persistent named tunnels are free** — unlike ngrok which charges $10/month per custom domain, Cloudflare's named tunnels (tied to your own domain) are permanently free. You set the webhook URL once in Zapier and it never changes across restarts.
3. **Security model** — `cloudflared` uses outbound-only connections to Cloudflare's edge. No inbound ports need to be opened on your router or firewall.

**Two modes:**

_Quick tunnel (no account, random URL — use for initial development):_
```bash
cloudflared tunnel --url http://localhost:3001
```
URL changes on each restart. Sufficient while building.

_Named persistent tunnel (use when Zapier webhook URL must be stable):_
Requires a Cloudflare account and a domain managed by Cloudflare. Create once (`cloudflared tunnel create permit-app`), add a DNS CNAME, write a `~/.cloudflared/config.yml`. Then the URL `https://hooks.yourdomain.com` never changes across restarts or machine reboots.

**Integrating into `npm start`:**
Add a `"tunnel"` script to `package.json` and include it in the `concurrently` command:
```json
"tunnel": "cloudflared tunnel --url http://localhost:3001"
```

**What NOT to use:**
- `ngrok` — functionally equivalent, but the free tier gives random URLs (same limitation as Cloudflare quick tunnels), and stable custom domain URLs cost $10/month. Cloudflare does it free.
- `localtunnel` — no authentication, no stable URLs, reliability issues, project maintenance is inconsistent.
- `tunnelmole` — open-source and self-hostable, technically fine for quick testing, but smaller community and less documentation than Cloudflare.
- Deploying to Render/Railway/Heroku just to receive webhooks — defeats the "local-first" requirement.

### Webhook Security

Add a shared-secret header check in Express middleware:

```js
app.use('/webhook', (req, res, next) => {
  if (req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
```

Configure the matching custom header in Zapier's webhook action. Store `WEBHOOK_SECRET` in a `.env` file (never commit it). Use `dotenv` ^16.0.0 to load it.

---

## Build & Dev

### Single `npm start` Command

**Library:** `concurrently` ^9.0.0

**Rationale:**
`concurrently` runs multiple npm scripts in parallel from a single terminal window, with named and color-coded output per process. It is the standard solution for monorepo-style "frontend + backend + tunnel" dev workflows.

Root `package.json` scripts:
```json
{
  "scripts": {
    "dev:server":   "nodemon server/index.js",
    "dev:client":   "vite",
    "dev:tunnel":   "cloudflared tunnel --url http://localhost:3001",
    "start": "concurrently --names \"SERVER,CLIENT,TUNNEL\" -c \"cyan,green,yellow\" \"npm run dev:server\" \"npm run dev:client\" \"npm run dev:tunnel\""
  }
}
```

`--kill-others` flag is recommended — if the server crashes, the whole group stops rather than leaving orphan processes.

**What NOT to use:**
- `npm-run-all --parallel` — valid alternative, but `concurrently` has better output formatting (named prefixes, colors) and wider adoption for frontend+backend setups.
- Shell `&` operator — breaks on Windows (not relevant here, but bad habit), gives no named output, and leaves zombie processes if one crashes.
- Shell `&&` operator — sequential, not parallel. Wrong tool.
- Makefile — works, but adds a non-npm dependency that is inconsistent with a Node.js project.

### Environment Variables

**Library:** `dotenv` ^16.4.0

Single `.env` file at project root. Load once at the top of `server/index.js`:
```js
import 'dotenv/config';
```
`.env` is gitignored. Provide a `.env.example` with placeholder values.

### Code Quality (optional but recommended at project start)

- `eslint` ^9.0.0 with `eslint-config-react-app` or `@eslint/js` — catch errors before runtime.
- `prettier` ^3.0.0 — consistent formatting, prevents style debates.

Set up both at project init; they are trivially hard to add later but annoying to retrofit across hundreds of files.

---

## What NOT to use

| Technology | Why to avoid |
|---|---|
| **Create React App** | Officially deprecated as of 2025. Uses Webpack under the hood, slow builds, no longer maintained. |
| **Next.js / Remix** | SSR frameworks. Add server complexity and deployment assumptions (Vercel, serverless functions) with zero benefit for a local-only tool. |
| **Webpack** | 5-30 second cold starts vs Vite's sub-1-second. No reason to choose it for new projects in 2025. |
| **body-parser** (npm package) | Redundant. `express.json()` and `express.urlencoded()` have been built into Express since 4.16 (2017). |
| **node-sqlite3** | The async SQLite wrapper. `better-sqlite3` is faster and synchronous; the async wrapper adds complexity without performance benefit for a local app. |
| **MongoDB / Mongoose** | Requires a running `mongod` daemon, adds a network hop, and schema-less documents are wrong for structured permit data. Nothing in this project benefits from a document store. |
| **Firebase / Supabase** | Cloud databases. Violates the "local, no cloud" requirement. Also adds auth complexity and billing risk. |
| **Prisma** | Excellent ORM for team projects. Adds a schema DSL, a migration engine, and a `prisma generate` step. Unnecessary abstraction when you control the schema directly with better-sqlite3. |
| **Redux / Redux Toolkit** | Correct for large multi-team apps. For a local single-user tool, React built-ins + Zustand (if needed) cover every use case with far less boilerplate. |
| **ngrok** (paid tier) | Cloudflare Tunnel gives equivalent persistent URLs for free. |
| **TypeScript** (initially) | Not listed as a requirement. Plain JS with JSDoc annotations and ESLint gives most of the safety benefit without the `tsc` compilation step, build configuration overhead, and type errors during rapid prototyping. Add TypeScript in a future pass once the domain model is stable. |
| **Tailwind CSS v3** | Tailwind v4 (released Jan 2025) is the current version. It uses a Vite plugin (`@tailwindcss/vite`) instead of PostCSS, drops the `tailwind.config.js` file in favor of CSS-first configuration, and requires `@custom-variant dark (...)` in `index.css` for class-based dark mode. Starting on v3 means migrating later. |

---

## Version Summary

| Package | Version | Role |
|---|---|---|
| `react` | ^19.0.0 | UI library |
| `react-dom` | ^19.0.0 | DOM renderer |
| `react-router-dom` | ^7.0.0 | Client-side routing |
| `@tanstack/react-query` | ^5.0.0 | Server state / data fetching |
| `zustand` | ^5.0.0 | Global state (if needed) |
| `tailwindcss` | ^4.0.0 | Utility CSS |
| `@tailwindcss/vite` | ^4.0.0 | Tailwind v4 Vite plugin |
| `vite` | ^6.0.0 | Frontend build tool |
| `@vitejs/plugin-react` | ^4.3.0 | Vite React plugin |
| `express` | ^5.0.0 | HTTP server |
| `helmet` | ^8.0.0 | Security headers |
| `cors` | ^2.8.5 | CORS middleware |
| `express-rate-limit` | ^7.0.0 | Rate limiting |
| `morgan` | ^1.10.0 | Request logging |
| `better-sqlite3` | ^11.10.0 | Local SQLite database |
| `dotenv` | ^16.4.0 | Environment variable loading |
| `nodemon` | ^3.1.0 | Dev server auto-restart |
| `concurrently` | ^9.0.0 | Single `npm start` orchestration |
| `cloudflared` | ^0.3.0 | Cloudflare Tunnel npm wrapper |

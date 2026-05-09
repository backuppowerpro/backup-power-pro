// crm-data.js — Live data layer.
// Initializes window.CRM with empty arrays, then asynchronously fetches
// from Supabase and dispatches 'crm-data-ready' so crm-app.jsx can re-render.
//
// Schema translation: v2 Supabase schema (numeric stages, no jurisdiction
// column, status='Archived') → v3 visual contract (string stages,
// jurisdiction inferred from address, archived boolean).

const SUPABASE_URL = 'https://reowtzedjflwmlptupbk.supabase.co';
// Same publishable key as proposal.html / invoice.html / crm/v2 — RLS-scoped.
const SUPABASE_ANON_KEY = 'sb_publishable_4tYd9eFAYCTjnoKl1hbBBg_yyO9-vMB';

const __db = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Expose the Supabase client globally so widgets like TodosButton (in
// crm-todos.jsx) can read/write their own tables without re-instantiating
// the client. Same publishable-key, same RLS scope. Safe.
window.db = __db;

// Edge-function invoker. Forces the publishable anon key as Authorization
// because the user's session JWT (ES256) is rejected by edge functions
// configured for the legacy HS256 anon key. Same pattern as crm/v2/app.jsx.
function __invokeFn(name, opts = {}) {
  if (!__db) return Promise.resolve({ error: { message: 'supabase-js not loaded' } });
  // v10.1.30 fix: do NOT force Authorization: Bearer with the publishable
  // key. After Key disabled legacy JWT API keys (2026-04-23), Supabase's
  // gateway rejects any Authorization header that isn't a real JWT, with
  // UNAUTHORIZED_INVALID_JWT_FORMAT. The publishable key must travel via
  // the apikey header only — supabase-js sets that automatically when we
  // call functions.invoke. We were stomping on the working setup.
  return __db.functions.invoke(name, opts);
}

// ── Stage mapping (v2 numeric ↔ v3 string) ───────────────────────────────
const STAGE_NUM_TO_STR = {
  1: 'new',
  2: 'quoted',
  3: 'booked',
  4: 'permit_submit',
  5: 'permit_waiting',
  6: 'permit_approved',
  7: 'install',
  8: 'install',
  9: 'done',
};
const STAGE_STR_TO_NUM = { new:1, quoted:2, booked:3, permit_submit:4, permit_waiting:5, permit_approved:6, install:7, done:9 };

const STAGE_ORDER = ['new','quoted','booked','permit_submit','permit_waiting','permit_approved','install','done'];
const STAGE_LABELS = {
  new:'New', quoted:'Quoted', booked:'Booked',
  permit_submit:'Permit submit', permit_waiting:'Permit waiting', permit_approved:'Permit approved',
  install:'Install', done:'Done',
};

// Spartanburg/Greenville/Pickens county → city mapping. Used both to
// classify a contact's permit jurisdiction AND to display only the city
// on the address line (no state, no zip) per design spec.
const SPARTANBURG_CITIES = /spartanburg|inman|boiling springs|woodruff|moore|wellford|chesnee|cowpens|landrum|duncan/i;
const GREENVILLE_CITIES = /greenville|greer|mauldin|simpsonville|fountain inn|travelers rest|taylors|piedmont/i;
const PICKENS_CITIES = /pickens|easley|liberty|six mile|central|clemson|sunset|dacusville/i;

function jurisdictionFromAddress(addr) {
  if (!addr) return null;
  if (SPARTANBURG_CITIES.test(addr)) return 'Spartanburg';
  if (GREENVILLE_CITIES.test(addr)) return 'Greenville';
  if (PICKENS_CITIES.test(addr)) return 'Pickens';
  return null;
}

// Pull the first city-looking token from "{street}, {city}, {state} {zip}".
function cityFromAddress(addr) {
  if (!addr) return null;
  const parts = addr.split(',').map(s => s.trim());
  // [street, city, "state zip"] or [street, "city state zip"] etc.
  if (parts.length >= 2) return parts[1].replace(/\b(SC|South Carolina)\b\s*\d*$/i, '').trim() || null;
  return null;
}

function avatarFromName(name) {
  // Trim — a name of `'   '` was truthy and produced an empty initials
  // string, leaving the avatar circle blank.
  const n = (name || '').trim();
  if (!n) return null;
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}

// "{street}, {city}, SC {zip}" → "{street}, {city}". Drops state/zip everywhere.
// shortAddress is for DISPLAY only — never persist its output back to
// the DB. Strips state/zip so the row reads clean. The full address is
// kept on contact.address; the display helper runs at render time.
function shortAddress(addr) {
  if (!addr) return '';
  const parts = addr.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1].replace(/\b(SC|South Carolina)\b\s*\d*$/i, '').trim()}`;
  }
  return addr;
}

// ── Supabase row → v3 shape transformers ─────────────────────────────────
function mapContact(r) {
  const jurisdiction = jurisdictionFromAddress(r.address) || cityFromAddress(r.address) || null;
  return {
    id: r.id,
    name: r.name || null,
    phone: r.phone || '',
    email: r.email || '',
    // Keep the FULL address on the in-memory contact so the edit form
    // round-trips losslessly. Display sites that want a clean street+city
    // view should call shortAddress(contact.address) at render time.
    // Previously this stored the truncated form and saving the edit form
    // wrote that back, silently destroying state/zip on every edit.
    address: r.address || '',
    address_short: shortAddress(r.address),
    jurisdiction,
    pricing_tier: r.pricing_tier || 'standard',
    stage: STAGE_NUM_TO_STR[r.stage] || 'new',
    do_not_contact: !!r.do_not_contact,
    // Read both `archived` (column added 2026-05-09) and the legacy
    // `status='Archived'` signal so old rows stay correct during the
    // migration window. Once every row has been touched, drop the OR.
    archived: !!r.archived || r.status === 'Archived',
    // contacts.pinned column (migration 20260509140000). Replaces the
    // localStorage-only pin set so stars sync between desktop and
    // mobile via realtime. Falls back to false if the SELECT didn't
    // pull the column (defensive — usePinned uses this as source of
    // truth so missing it would silently de-star everyone).
    pinned: !!r.pinned,
    // contacts.tags column (migration 20260509150000). Replaces the
    // localStorage tag map so labels sync between desktop and mobile.
    // Default to empty array if missing.
    tags: Array.isArray(r.tags) ? r.tags : [],
    // Pass through if the DB has them — UI components fall back gracefully
    // when null. Hardcoding null silently dropped real values.
    generator_model: r.generator_model || null,
    panel_amps: r.panel_amps != null ? Number(r.panel_amps) : null,
    notes: r.notes || '',
    avatar: avatarFromName(r.name),
    // Always derive a short ref_id from the UUID so any view/log line that
    // wants a human-readable handle has one even for named contacts.
    ref_id: (r.id || '').slice(0, 4).toUpperCase() || null,
    // Pass through created_at — buildContactSignals uses it as a fallback
    // for daysInStage when stage_history has no transitions for the
    // contact (i.e., still in their initial 'new' stage).
    created_at: r.created_at || null,
  };
}

function mapEvent(r) {
  // Real DB column is `event_type`, not `kind`. `status` column added
  // 2026-05-09 (migration 20260509120000) to support cancel-event flow.
  return {
    id: r.id,
    contact_id: r.contact_id,
    kind: r.kind || r.event_type || 'follow_up',
    start_at: r.start_at,
    end_at: r.end_at || null,
    title: r.title || 'Event',
    status: r.status || 'scheduled',
  };
}

// Three tables added 2026-05-09 (migration 20260509130000). Mappers
// preserve the in-memory shape the UI was already using so the
// component code reads identically to before this migration.

function mapPermit(r) {
  return {
    id: r.id,
    contact_id: r.contact_id,
    jurisdiction_id: r.jurisdiction_id || null,
    // Denormalized name for the UI (matches the prior in-memory shape
    // where `permit.jurisdiction` was a plain string).
    jurisdiction: r.jurisdiction_name || '',
    jurisdiction_name: r.jurisdiction_name || '',
    permit_number: r.permit_number || 'PENDING',
    status: r.status || 'not_started',
    submitted_at: r.submitted_at || null,
    approved_at: r.approved_at || null,
    cost_cents: r.cost_cents || 0,
    blocker_note: r.blocker_note || null,
    created_at: r.created_at || null,
    updated_at: r.updated_at || null,
  };
}

function mapMaterial(r) {
  return {
    id: r.id,
    contact_id: r.contact_id,
    kind: r.kind,
    status: r.status || 'not_ordered',
    ordered_at: r.ordered_at || null,
    received_at: r.received_at || null,
    installed_at: r.installed_at || null,
    notes: r.notes || null,
    created_at: r.created_at || null,
    updated_at: r.updated_at || null,
  };
}

function mapCall(r) {
  // Direction normalize: Twilio writes 'inbound'/'outbound'; UI uses
  // 'in'/'out'/'missed'. Same convention as mapMessage.
  const dirRaw = r.direction || 'in';
  const dir = dirRaw === 'outbound' ? 'out' : dirRaw === 'inbound' ? 'in' : dirRaw;
  return {
    id: r.id,
    contact_id: r.contact_id,
    direction: dir,
    started_at: r.started_at,
    ended_at: r.ended_at || null,
    duration_sec: r.duration_sec ?? null,
    voicemail_url: r.voicemail_url || null,
    voicemail_duration: r.voicemail_duration || null,
    voicemail_transcript: r.voicemail_transcript || null,
    listened_at: r.listened_at || null,
    twilio_call_sid: r.twilio_call_sid || null,
    from_phone: r.from_phone || null,
    to_phone: r.to_phone || null,
    status: r.status || null,
    notes: r.notes || null,
    created_at: r.created_at || null,
  };
}

// BPP proposals schema uses dollars (total), pricing_tier, amp_type ('30'/'50'),
// copied_at as send timestamp, signed_at as approval timestamp. Status is
// title-case ('Copied'/'Signed'/'Viewed'/'Expired'/'Declined') so we lowercase
// and remap to the v3 visual contract ('sent'/'approved'/'viewed'/'expired'/'declined').
// Schema-tolerant amount reader. The DB has shifted: legacy rows store `total`
// in dollars; current rows store `amount` in cents. Read whichever is present
// and normalize to cents so the rest of the app sees a single shape.
// `| 0` truncates anything > 2^31 - 1 cents (~$21.4M) to garbage. Use Number()
// so a single ridiculously-large invoice doesn't silently corrupt. We keep
// floor semantics since cents are integral.
function readCents(r) {
  if (r.amount_cents != null) return Math.floor(Number(r.amount_cents) || 0);
  if (r.amount != null) return Math.floor(Number(r.amount) || 0);
  return Math.round((Number(r.total) || 0) * 100);
}
function readDollars(r) {
  if (r.amount_cents != null) return (Number(r.amount_cents) || 0) / 100;
  if (r.amount != null) return (Number(r.amount) || 0) / 100;
  return Number(r.total) || 0;
}

function mapProposal(r) {
  const rawStatus = (r.status || 'sent').toLowerCase();
  const status =
    rawStatus === 'copied' || rawStatus === 'sent' ? 'sent' :
    rawStatus === 'signed' || rawStatus === 'approved' ? 'approved' :
    rawStatus === 'created' ? 'draft' :
    rawStatus;
  const dollars = readDollars(r);
  return {
    id: r.id,
    token: r.token || null,
    contact_id: r.contact_id,
    tier: r.pricing_tier || (dollars >= 1497 ? 'premium_plus' : dollars >= 1297 ? 'premium' : 'standard'),
    amount_cents: readCents(r),
    // Normalize: trim + reject empty/whitespace strings so we never render
    // "undefinedA" or " A" when amp_type is the empty string.
    amp_spec: (() => {
      const a = (r.amp_type || r.selected_amp || '').toString().trim();
      return a ? a + 'A' : null;
    })(),
    status,
    sent_at: r.copied_at || r.created_at,
    viewed_at: r.viewed_at || null,
    approved_at: r.signed_at || null,
    label: r.amp_type ? `Generator inlet, ${r.amp_type}A` : 'Generator inlet',
    // V3 fields — exposed so the editor can rehydrate without a refetch.
    creator_version: r.creator_version || 'v2',
    length_ft:       r.length_ft != null ? Number(r.length_ft) : null,
    include_cord:    r.include_cord    !== false,
    include_inlet:   r.include_inlet   !== false,
    include_permit:  r.include_permit  !== false,
    pom_offered:     !!r.pom_offered,
    pom_accepted:    !!r.pom_accepted,
    require_deposit: !!r.require_deposit,
    extra_line_items: Array.isArray(r.extra_line_items) ? r.extra_line_items : [],
    discount_type:   r.discount_type   || null,
    discount_value:  r.discount_value != null ? Number(r.discount_value) : null,
    notes:           r.notes || '',
    amp_type:        r.amp_type || null,
  };
}

function mapInvoice(r) {
  const rawStatus = (r.status || 'sent').toLowerCase();
  // BPP DB uses 'unpaid' for invoices that have been sent but not paid yet;
  // the v3 design expects 'sent' for this state. 'paid'/'overdue'/'voided'
  // /'refunded' map through unchanged. 'draft' = not yet sent.
  const status =
    rawStatus === 'unpaid' || rawStatus === 'open' ? 'sent' :
    rawStatus;
  const cents = readCents(r);
  // Kind picker: explicit `kind` column wins. Heuristic fallback was
  // mislabeling any $1000+ deposit as 'final'. Better: if a proposal_id
  // exists we treat the invoice as 'final' only when it covers ≥ 90% of
  // the proposal total — anything smaller is a 'deposit'. With no
  // proposal_id we keep a permissive cutoff at $1500 (most BPP deposits
  // fall well below this).
  let kind = r.kind;
  if (!kind) {
    if (r.proposal_id) {
      // Cross-ref via the global once it's loaded; on first map pass
      // CRM.proposals may not be populated yet — fall back to size cutoff.
      const prop = (window.CRM?.proposals || []).find(p => p.id === r.proposal_id);
      if (prop && prop.amount_cents > 0) {
        kind = (cents / prop.amount_cents >= 0.9) ? 'final' : 'deposit';
      } else {
        kind = cents >= 150000 ? 'final' : 'deposit';
      }
    } else {
      kind = cents >= 150000 ? 'final' : 'deposit';
    }
  }
  return {
    id: r.id,
    token: r.token || null,
    contact_id: r.contact_id,
    proposal_id: r.proposal_id || null,
    amount_cents: cents,
    kind,
    status,
    sent_at: r.sent_at || r.created_at,
    viewed_at: r.viewed_at || null,
    paid_at: r.paid_at || null,
    // V3 invoice fields — line_items + creator_version exposed so editor can rehydrate.
    line_items: Array.isArray(r.line_items) ? r.line_items : [],
    creator_version: r.creator_version || 'v2',
  };
}

function mapMessage(r) {
  // Real DB columns: id, contact_id, direction, body, created_at,
  // sender, read_at, status. NOTE: there is no `sent_at` or
  // `sender_role` column — the mapper synthesizes them so the rest of
  // the app can read familiar names without caring about schema.
  // Normalize direction at the boundary. Twilio/edge functions write
  // 'outbound'/'inbound' to DB; the rest of the app reads/filters with
  // 'out'/'in'. Until 2026-05-08 this mismatch silently nulled
  // `daysSinceTouch` on every contact whose only activity was an outbound
  // SMS — so "Rotting" + "Silent leads" chips undercounted dramatically.
  const dirRaw = r.direction || 'in';
  const dir = dirRaw === 'outbound' ? 'out' : dirRaw === 'inbound' ? 'in' : dirRaw;
  // sender_role discriminates "key vs Alex bot vs raw customer" so the
  // suggest-reply prompt can label voice samples correctly. The DB
  // column is named `sender` (NOT `sender_role`); the prior mapper
  // referenced the wrong name and the fallback always fired, erasing
  // bot-vs-human distinctions in the inbox.
  const senderRaw = r.sender || r.sender_role;
  return {
    id: r.id,
    contact_id: r.contact_id,
    direction: dir,
    sender_role: senderRaw || (dir === 'out' ? 'key' : 'customer'),
    body: r.body || '',
    sent_at: r.sent_at || r.created_at,
    read_at: r.read_at || null,
  };
}

// ── Bootstrap: empty shell + async fill ──────────────────────────────────
// User's home base — drive-time origin. Hardcoded for the single-user app
// today; could move to a settings panel later. Used by DriveTimeBadge in
// the right pane to show "≈22 min from home" on every contact.
const HOME_ADDRESS = '22 Kimbell Ct Greenville SC';

// Geocode + driving-route via free OSM-stack (Nominatim + OSRM). Both are
// public, fair-use limited (Nominatim: 1 req/sec, OSRM demo: not for prod).
// To stay polite:
//   1. Aggressive 30-day cache for geocodes; 24h for drive results.
//   2. Serial queue — one network call at a time, 1.1s minimum gap.
//   3. In-flight de-dupe — same address requested twice returns the same Promise.
//   4. Identifying User-Agent / Referer (browser sets Referer automatically).
//   5. Bail to null on any error; UI hides the badge cleanly.
const __geoQueue = (function makeQueue() {
  let last = 0;
  // chain is a CHAIN OF SUCCESSES — never rejected. Without the .catch,
  // a single Nominatim 503 (or any thrown error inside fn()) would reject
  // the chain and every subsequent geocode/drive would fail until reload.
  let chain = Promise.resolve();
  return (fn) => {
    const next = chain.then(async () => {
      const wait = Math.max(0, 1100 - (Date.now() - last));
      if (wait) await new Promise(r => setTimeout(r, wait));
      last = Date.now();
      return fn();
    });
    // Keep the chain itself unrejected; surface errors to the caller as null.
    chain = next.then(() => undefined, () => undefined);
    return next.catch(() => null);
  };
})();

const __geoInflight = new Map();

async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const key = 'bpp_v3_geocode:' + address.trim().toLowerCase();
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    if (cached && cached.expiresAt > Date.now()) return cached.coord;
  } catch {}
  if (__geoInflight.has(key)) return __geoInflight.get(key);
  const promise = __geoQueue(async () => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
        { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return null;
      const data = await r.json();
      if (!data[0]) return null;
      const coord = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      window.safeSetItem?.(key, JSON.stringify({ coord, expiresAt: Date.now() + 30*24*3600*1000 }));
      return coord;
    } catch { return null; }
  }).finally(() => __geoInflight.delete(key));
  __geoInflight.set(key, promise);
  return promise;
}

async function driveBetween(originCoord, destCoord) {
  if (!originCoord || !destCoord) return null;
  return __geoQueue(async () => {
    try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${originCoord.lng},${originCoord.lat};${destCoord.lng},${destCoord.lat}?overview=false`);
      if (!r.ok) return null;
      const data = await r.json();
      if (!data?.routes?.[0]) return null;
      const route = data.routes[0];
      return {
        minutes: Math.round(route.duration / 60),
        miles: route.distance / 1609.34,
      };
    } catch { return null; }
  });
}

// Pre-resolve home coordinate once at startup.
let __homeCoord = null;
geocodeAddress(HOME_ADDRESS).then(c => { __homeCoord = c; });

async function driveTimeToContactAddress(contactAddress, contactId) {
  if (!__homeCoord) __homeCoord = await geocodeAddress(HOME_ADDRESS);
  if (!__homeCoord || !contactAddress) return null;
  // Cache per-contact (24h) — re-check daily so a fresh address update flows.
  const key = 'bpp_v3_drive:' + contactId;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    if (cached && cached.expiresAt > Date.now()) return cached.result;
  } catch {}
  const dest = await geocodeAddress(contactAddress);
  const result = await driveBetween(__homeCoord, dest);
  if (result) {
    window.safeSetItem?.(key, JSON.stringify({ result, expiresAt: Date.now() + 24*3600*1000 }));
  }
  return result;
}

window.CRM = {
  contacts: [],
  events: [],
  proposals: [],
  invoices: [],
  messages: [],
  calls: [],
  permits: [],
  materials: [],
  stageHistory: [],
  jurisdictions: [
    // The 4 BPP service-area jurisdictions, matching BPP_JURISDICTIONS in
    // crm-right.jsx (single source of truth). Spartanburg + Pickens counties
    // run on EnerGov (Tyler) via Google SSO with keyelectricupstate@gmail.com.
    // Greenville County uses Accela (eTRAKiT) with username AEC001822.
    // City of Greenville sits inside Greenville County but has its own portal.
    { id: 'j-1', name: 'Spartanburg County', portal_url: 'https://civicaccess.spartanburgcounty.gov/energov_prod/selfservice#/home', username: 'Google SSO · keyelectricupstate@gmail.com', sso: true },
    { id: 'j-2', name: 'Greenville County',  portal_url: 'https://aca.greenvillecounty.org/ACA/',                                    username: 'AEC001822' },
    { id: 'j-3', name: 'Pickens County',     portal_url: 'https://energovweb.pickenscountysc.us/energov_prod/selfservice#/home',     username: 'Google SSO · keyelectricupstate@gmail.com', sso: true },
    { id: 'j-4', name: 'City of Greenville', portal_url: 'https://www.greenvillesc.gov/164/Building-Safety',                        username: 'keyelectricupstate@gmail.com' },
  ],
  STAGE_LABELS,
  STAGE_ORDER,
  STAGE_NUM_TO_STR,
  STAGE_STR_TO_NUM,
  now: new Date(),
  loaded: false,
  authed: false,
  __db,
  __invokeFn,
};

// Keep local synonym so existing components (which read `CRM.foo`) continue to work
const CRM = window.CRM;

// ── Auth gate + fetch ───────────────────────────────────────────────────
async function loadLiveData() {
  if (!__db) {
    console.warn('[CRM] supabase-js not loaded — staying in empty state');
    return;
  }
  const { data: { session } } = await __db.auth.getSession();
  if (!session) {
    window.CRM.authed = false;
    window.CRM.loaded = true;
    window.dispatchEvent(new CustomEvent('crm-data-ready', { detail: { authed: false } }));
    return;
  }
  window.CRM.authed = true;

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days back

  // Wrap each query in a per-table timeout + soft-fail so one slow table
  // doesn't deadlock the whole page. The visible UI shows whatever loads;
  // tables that fail leave their CRM array empty (the UI handles empty
  // gracefully). Realtime will reconcile when the failing table comes back.
  const withTimeout = (p, ms, label) =>
    Promise.race([
      p,
      new Promise(r => setTimeout(() => r({ data: null, error: { message: `${label} timed out after ${ms}ms` } }), ms)),
    ]);

  const fetchTable = (queryBuilder, label) =>
    withTimeout(queryBuilder, 8000, label).catch(e => ({ data: null, error: e }));

  const [contactsR, eventsR, proposalsR, invoicesR, messagesR, stageHistoryR, permitsR, materialsR, callsR] = await Promise.all([
    fetchTable(__db.from('contacts')
      .select('id, name, phone, email, address, stage, status, do_not_contact, pricing_tier, created_at, notes, archived, pinned, tags')
      .order('created_at', { ascending: false })
      .limit(500), 'contacts'),
    fetchTable(__db.from('calendar_events')
      // Real DB columns: id, contact_id, start_at, end_at, title,
      // event_type, status, created_at. status added 2026-05-09 to
      // back the cancel-event flow.
      .select('id, contact_id, start_at, end_at, title, event_type, status, created_at')
      .gte('start_at', since)
      .order('start_at', { ascending: true })
      .limit(500), 'calendar_events'),
    fetchTable(__db.from('proposals')
      .select('id, token, contact_id, pricing_tier, total, amp_type, selected_amp, status, copied_at, created_at, viewed_at, signed_at, sent_at, approved_at, creator_version, length_ft, include_cord, include_inlet, include_permit, pom_offered, pom_accepted, require_deposit, extra_line_items, discount_type, discount_value, notes')
      .order('created_at', { ascending: false })
      .limit(500), 'proposals'),
    fetchTable(__db.from('invoices')
      .select(// Schema notes (verified empirically 2026-05-01): the invoices table has
// NO `kind` / `sent_at` / `viewed_at` columns. mapInvoice derives them:
// kind from a $-amount heuristic, sent_at from created_at, viewed_at = null.
// If those columns ever get added, expand the SELECT and the mapper.
'id, token, contact_id, proposal_id, total, status, created_at, paid_at, line_items, creator_version')
      .order('created_at', { ascending: false })
      .limit(500), 'invoices'),
    fetchTable(__db.from('messages')
      // Real DB columns: id, contact_id, direction, body, created_at.
      // Pull every column the mapper or signal-builder needs:
      // sender drives bot-vs-human voice attribution; read_at drives the
      // unread inbox badge; status carries delivery state. created_at
      // doubles as sent_at via the mapper.
      .select('id, contact_id, direction, body, created_at, read_at, sender, status')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000), 'messages'),
    fetchTable(__db.from('stage_history')
      // Column is `changed_at`, NOT `created_at` — the wrong column name
      // killed every stage_history fetch and left the Pipeline card
      // empty for every contact even though 20 transitions exist.
      .select('id, contact_id, from_stage, to_stage, changed_at')
      .order('changed_at', { ascending: true })
      .limit(2000), 'stage_history'),
    // permits / materials / calls — added 2026-05-09. Before this
    // migration these were `permits: []` placeholders and every UI
    // mutation was lost on refresh.
    fetchTable(__db.from('permits')
      .select('id, contact_id, jurisdiction_id, jurisdiction_name, permit_number, status, submitted_at, approved_at, cost_cents, blocker_note, created_at, updated_at')
      .order('created_at', { ascending: true })
      .limit(500), 'permits'),
    fetchTable(__db.from('materials')
      .select('id, contact_id, kind, status, ordered_at, received_at, installed_at, notes, created_at, updated_at')
      .order('created_at', { ascending: true })
      .limit(500), 'materials'),
    fetchTable(__db.from('calls')
      .select('id, contact_id, direction, started_at, ended_at, duration_sec, voicemail_url, voicemail_duration, voicemail_transcript, listened_at, twilio_call_sid, from_phone, to_phone, status, notes, created_at')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(500), 'calls'),
  ]);

  // Surface any per-table failure once, quietly, in the console — not as a
  // blocking toast. The user sees a working app with whatever loaded.
  const tableErrors = [
    ['contacts', contactsR], ['events', eventsR], ['proposals', proposalsR],
    ['invoices', invoicesR], ['messages', messagesR], ['stage_history', stageHistoryR],
    ['permits', permitsR], ['materials', materialsR], ['calls', callsR],
  ].filter(([, r]) => r.error).map(([n, r]) => `${n}: ${r.error.message || r.error}`);
  if (tableErrors.length) console.warn('[CRM] partial load:', tableErrors);

  window.CRM.contacts  = (contactsR.data  || []).map(mapContact).filter(c => !c.archived);
  window.CRM.events    = (eventsR.data    || []).map(mapEvent);
  window.CRM.proposals = (proposalsR.data || []).map(mapProposal);
  window.CRM.invoices  = (invoicesR.data  || []).map(mapInvoice);
  window.CRM.messages  = (messagesR.data  || []).map(mapMessage);
  window.CRM.stageHistory = stageHistoryR.data || [];
  window.CRM.permits   = (permitsR.data   || []).map(mapPermit);
  window.CRM.materials = (materialsR.data || []).map(mapMaterial);
  window.CRM.calls     = (callsR.data     || []).map(mapCall);
  window.CRM.loaded = true;

  console.log(`[CRM] loaded ${CRM.contacts.length} contacts, ${CRM.events.length} events, ${CRM.proposals.length} proposals, ${CRM.invoices.length} invoices, ${CRM.messages.length} messages, ${CRM.stageHistory.length} stage transitions, ${CRM.permits.length} permits, ${CRM.materials.length} materials, ${CRM.calls.length} calls`);
  window.dispatchEvent(new CustomEvent('crm-data-ready', { detail: { authed: true } }));

  // Realtime — re-fetch the whole table on any change. The lists are small
  // enough (under 500 rows) that a full refresh is simpler than a delta
  // merge and avoids drift bugs. Components re-render via crm-data-changed.
  __db.channel('v3-contacts')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, async () => {
      try {
        const { data, error } = await __db.from('contacts')
          .select('id, name, phone, email, address, stage, status, do_not_contact, pricing_tier, created_at, notes, archived, pinned, tags')
          .order('created_at', { ascending: false }).limit(500);
        if (error) { console.warn('[CRM] realtime contacts refetch failed:', error.message); return; }
        window.CRM.contacts = (data || []).map(mapContact).filter(c => !c.archived);
        window.dispatchEvent(new CustomEvent('crm-data-changed', { detail: { table: 'contacts' } }));
      } catch (e) { console.warn('[CRM] realtime contacts handler error:', e.message); }
    })
    .subscribe();

  __db.channel('v3-messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
      try {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        // SELECT must include `read_at` and `sender` — without read_at,
        // a realtime fire after the user marks a thread read clobbers
        // the local read_at back to null and re-lights the unread badge.
        // Without sender, the bot-vs-key distinction in the inbox is
        // erased and the suggest-reply prompt mislabels voice samples.
        const { data, error } = await __db.from('messages')
          .select('id, contact_id, direction, body, created_at, read_at, sender, status')
          .gte('created_at', since).order('created_at', { ascending: false }).limit(2000);
        if (error) { console.warn('[CRM] realtime messages refetch failed:', error.message); return; }
        window.CRM.messages = (data || []).map(mapMessage);
        window.dispatchEvent(new CustomEvent('crm-data-changed', { detail: { table: 'messages' } }));
      } catch (e) { console.warn('[CRM] realtime messages handler error:', e.message); }
    })
    .subscribe();

  // Invoices + proposals realtime — without these, Mark paid in one tab
  // doesn't propagate to another tab, and a freshly-created proposal sits
  // in stale state until the next online/visibility reconcile.
  __db.channel('v3-invoices')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, async () => {
      try {
        const { data, error } = await __db.from('invoices')
          .select(// Schema notes (verified empirically 2026-05-01): the invoices table has
// NO `kind` / `sent_at` / `viewed_at` columns. mapInvoice derives them:
// kind from a $-amount heuristic, sent_at from created_at, viewed_at = null.
// If those columns ever get added, expand the SELECT and the mapper.
'id, token, contact_id, proposal_id, total, status, created_at, paid_at, line_items, creator_version')
          .order('created_at', { ascending: false }).limit(500);
        if (error) { console.warn('[CRM] realtime invoices refetch failed:', error.message); return; }
        window.CRM.invoices = (data || []).map(mapInvoice);
        window.dispatchEvent(new CustomEvent('crm-data-changed', { detail: { table: 'invoices' } }));
      } catch (e) { console.warn('[CRM] realtime invoices handler error:', e.message); }
    })
    .subscribe();

  __db.channel('v3-proposals')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, async () => {
      try {
        const { data, error } = await __db.from('proposals')
          .select('id, token, contact_id, pricing_tier, total, amp_type, selected_amp, status, copied_at, created_at, viewed_at, signed_at, sent_at, approved_at')
          .order('created_at', { ascending: false }).limit(500);
        if (error) { console.warn('[CRM] realtime proposals refetch failed:', error.message); return; }
        window.CRM.proposals = (data || []).map(mapProposal);
        window.dispatchEvent(new CustomEvent('crm-data-changed', { detail: { table: 'proposals' } }));
      } catch (e) { console.warn('[CRM] realtime proposals handler error:', e.message); }
    })
    .subscribe();

  // calendar_events realtime — without this, an install scheduled in
  // tab A stays invisible in tab B until a hard refresh, and a cancel
  // in tab A leaves a stale "scheduled" event in tab B's calendar.
  __db.channel('v3-calendar-events')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, async () => {
      try {
        const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await __db.from('calendar_events')
          .select('id, contact_id, start_at, end_at, title, event_type, status, created_at')
          .gte('start_at', since)
          .order('start_at', { ascending: true })
          .limit(500);
        if (error) { console.warn('[CRM] realtime calendar refetch failed:', error.message); return; }
        window.CRM.events = (data || []).map(mapEvent);
        window.dispatchEvent(new CustomEvent('crm-data-changed', { detail: { table: 'calendar_events' } }));
      } catch (e) { console.warn('[CRM] realtime calendar handler error:', e.message); }
    })
    .subscribe();

  // permits / materials / calls realtime channels — needed because each
  // mutation in the right pane (PermitStatusActions, MaterialRow, etc.)
  // immediately optimistically mutates `CRM.permits[i]` then awaits the
  // DB write. A second tab open on the same contact needs the change
  // to propagate.
  __db.channel('v3-permits')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'permits' }, async () => {
      try {
        const { data, error } = await __db.from('permits')
          .select('id, contact_id, jurisdiction_id, jurisdiction_name, permit_number, status, submitted_at, approved_at, cost_cents, blocker_note, created_at, updated_at')
          .order('created_at', { ascending: true }).limit(500);
        if (error) { console.warn('[CRM] realtime permits refetch failed:', error.message); return; }
        window.CRM.permits = (data || []).map(mapPermit);
        window.dispatchEvent(new CustomEvent('crm-data-changed', { detail: { table: 'permits' } }));
      } catch (e) { console.warn('[CRM] realtime permits handler error:', e.message); }
    })
    .subscribe();

  __db.channel('v3-materials')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, async () => {
      try {
        const { data, error } = await __db.from('materials')
          .select('id, contact_id, kind, status, ordered_at, received_at, installed_at, notes, created_at, updated_at')
          .order('created_at', { ascending: true }).limit(500);
        if (error) { console.warn('[CRM] realtime materials refetch failed:', error.message); return; }
        window.CRM.materials = (data || []).map(mapMaterial);
        window.dispatchEvent(new CustomEvent('crm-data-changed', { detail: { table: 'materials' } }));
      } catch (e) { console.warn('[CRM] realtime materials handler error:', e.message); }
    })
    .subscribe();

  __db.channel('v3-calls')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, async () => {
      try {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await __db.from('calls')
          .select('id, contact_id, direction, started_at, ended_at, duration_sec, voicemail_url, voicemail_duration, voicemail_transcript, listened_at, twilio_call_sid, from_phone, to_phone, status, notes, created_at')
          .gte('started_at', since)
          .order('started_at', { ascending: false }).limit(500);
        if (error) { console.warn('[CRM] realtime calls refetch failed:', error.message); return; }
        window.CRM.calls = (data || []).map(mapCall);
        window.dispatchEvent(new CustomEvent('crm-data-changed', { detail: { table: 'calls' } }));
      } catch (e) { console.warn('[CRM] realtime calls handler error:', e.message); }
    })
    .subscribe();

}

// Lightweight refetch (no resubscribing) for online/focus reconciliation.
// Avoids the channel-duplication bug that calling loadLiveData() twice
// would create.
async function refetchAll() {
  if (!__db || !window.CRM.authed) return;
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const [c, e, p, i, m] = await Promise.all([
      __db.from('contacts').select('id, name, phone, email, address, stage, status, do_not_contact, pricing_tier, created_at, notes, archived, pinned, tags').order('created_at', { ascending: false }).limit(500),
      __db.from('calendar_events').select('id, contact_id, start_at, end_at, title, event_type, status, created_at').gte('start_at', since).order('start_at', { ascending: true }).limit(500),
      __db.from('proposals').select('id, token, contact_id, pricing_tier, total, amp_type, selected_amp, status, copied_at, created_at, viewed_at, signed_at').order('created_at', { ascending: false }).limit(500),
      __db.from('invoices').select(// Schema notes (verified empirically 2026-05-01): the invoices table has
// NO `kind` / `sent_at` / `viewed_at` columns. mapInvoice derives them:
// kind from a $-amount heuristic, sent_at from created_at, viewed_at = null.
// If those columns ever get added, expand the SELECT and the mapper.
'id, token, contact_id, proposal_id, total, status, created_at, paid_at, line_items, creator_version').order('created_at', { ascending: false }).limit(500),
      __db.from('messages').select('id, contact_id, direction, body, created_at, read_at, sender, status').gte('created_at', since).order('created_at', { ascending: false }).limit(2000),
    ]);
    if (c.data) window.CRM.contacts = c.data.map(mapContact).filter(x => !x.archived);
    if (e.data) window.CRM.events = e.data.map(mapEvent);
    if (p.data) window.CRM.proposals = p.data.map(mapProposal);
    if (i.data) window.CRM.invoices = i.data.map(mapInvoice);
    if (m.data) window.CRM.messages = m.data.map(mapMessage);
    window.dispatchEvent(new CustomEvent('crm-data-changed', { detail: { table: 'all' } }));
  } catch (err) {
    console.warn('[CRM] refetch failed:', err.message);
  }
}

// Reconcile when the page comes back online or the tab regains focus.
// Supabase realtime auto-reconnects, but a direct refetch closes the gap
// for events that fired while the socket was disconnected.
let _reconcileInflight = false;
let _lastReconcile = 0; // 0 = never reconciled; first focus/online triggers
const _reconcile = async () => {
  if (_reconcileInflight) return;
  _reconcileInflight = true;
  try {
    await refetchAll();
    _lastReconcile = Date.now(); // only count successful reconciles
  } finally {
    _reconcileInflight = false;
  }
};
// Expose for pull-to-refresh and any other manual sync gesture.
window.CRM.__refetch = _reconcile;
window.addEventListener('online', _reconcile);
// 'focus' fires too aggressively (every alt-tab); use 'visibilitychange' +
// only refetch if it's been more than 30s since the last successful load.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - _lastReconcile > 30000) {
    _reconcile();
  }
});

// Kick off load (non-blocking).
loadLiveData().catch(err => {
  console.error('[CRM] load failed:', err);
  window.CRM.loaded = true; // unblock render anyway
  window.dispatchEvent(new CustomEvent('crm-data-ready', { detail: { authed: false, error: err.message } }));
});

/* global React, ReactDOM, supabase */
// BPP CRM v2 — live app orchestrator.
// Wraps the Claude-Design-generated components with live Supabase data,
// auth gating, hash-based routing, and the morphing bottom bar state machine.

const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ── Supabase client ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://reowtzedjflwmlptupbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlb3d0emVkamZsd21scHR1cGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NzExMDYsImV4cCI6MjA5MDI0NzEwNn0.srmz3lm08HW7MRGIRA8zAgglTcSrjBwxJ7LDYsEwveE';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.__bpp_db = db;

// ── Helpers ─────────────────────────────────────────────────────────────────

// Normalize DB contact row → list-view row shape expected by LeadRow
const STAGE_MAP = {
  1: 'NEW',       // New Lead
  2: 'QUOTED',    // Quoted
  3: 'BOOKED',    // Booked
  4: 'PERMIT',    // Permit Submitted
  5: 'PAY',       // Ready to Pay
  6: 'PAID',      // Paid
  7: 'PRINT',     // Printed
  8: 'INSPECT',   // Inspection
  9: 'INSPECT',   // Inspection (legacy)
};

function initials(name) {
  if (!name) return '??';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relTimestamp(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60000);
  const diffHr = Math.round(diffMs / 3600000);
  const diffDay = Math.round(diffMs / 86400000);
  if (diffMin < 1) return 'JUST NOW';
  if (diffMin < 60) return `${diffMin}M AGO`;
  if (diffHr < 24) {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ap}`;
  }
  if (diffDay < 2) return 'YESTERDAY';
  if (diffDay < 14) return `${String(diffDay).padStart(2, '0')}D AGO`;
  const d = new Date(iso);
  return `${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()]} ${d.getDate()}`;
}

// Google Street View Static API key — restricted server-side to Street View
// Static API only, no referrer lock. Same pattern as proposal.html's property
// banner. Client-side use is safe because the key can only mint Street View
// image URLs (no geocoding, no routing, no places); no PII exposure.
const SV_KEY = 'AIzaSyB0xWm71ZDzS7ei5-vFx15rNP_lR1ZKbJs';

function streetViewUrl(address, size = 96) {
  if (!address) return null;
  // Filter out addresses that won't return useful imagery: placeholder text
  // (—, N/A, Unknown), short strings without a number (no street = no
  // coverage), and zip-only entries. Without this filter the Street View API
  // returns a gray "we have no imagery" tile on a 200 response, which slips
  // past onError and looks broken in the avatar slot.
  const a = String(address).trim();
  if (a.length < 6 || !/\d/.test(a)) return null;
  if (/^(—|-|n\/?a|none|unknown|no\s*address)$/i.test(a)) return null;
  // Square crop keyed to the rendered avatar size (with 2x scale for retina
  // sharpness without downloading 4K tiles). fov=80 gives a typical house-front
  // composition; pitch=5 angles up slightly to include the eaves. source=outdoor
  // excludes user-uploaded interior pano shots.
  const dim = Math.min(size, 160); // cap at 160px to keep bandwidth reasonable
  return `https://maps.googleapis.com/maps/api/streetview?size=${dim}x${dim}` +
         `&scale=2&location=${encodeURIComponent(a)}` +
         `&fov=80&pitch=5&source=outdoor&key=${SV_KEY}`;
}

function contactToRow(c) {
  const stage = STAGE_MAP[c.stage || 1] || 'NEW';
  // overdue if last activity > 7 days and stage < 4
  const createdAt = c.created_at;
  const ageDays = createdAt ? Math.round((Date.now() - new Date(createdAt).getTime()) / 86400000) : 0;
  return {
    id: c.id,
    name: c.name || '—',
    initials: initials(c.name),
    // Street View photo of the house at their service address, or null if
    // no address on file. Avatar component renders an <img> with onError
    // fallback to the initials chip when Street View has no coverage there.
    photo: c.address ? streetViewUrl(c.address, 96) : null,
    phone: c.phone ? formatPhone(c.phone) : '',
    stage,
    ts: relTimestamp(c.created_at),
    unread: false, // populated by messages query later
    overdue: ageDays > 7 && (c.stage || 1) < 4,
    done: (c.stage || 1) >= 9,
    amberInitials: ageDays > 3 && ageDays <= 7,
    raw: c,
  };
}

function formatPhone(p) {
  if (!p) return '';
  const d = String(p).replace(/\D/g, '');
  const last10 = d.length > 10 ? d.slice(-10) : d;
  if (last10.length !== 10) return p;
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

// When a contact lacks a real name — or someone upstream typed literal
// "Unknown" into the form — "Unknown" is useless in a briefing / Quick
// List row. Fall back to the last 4 digits of the phone so Key can still
// recognise the thread at a glance. Anything else → 'Lead'.
function displayNameFor(c) {
  if (!c) return 'Lead';
  const n = String(c.name || c.contact_name || '').trim();
  if (n && !/^unknown$/i.test(n) && !/^customer$/i.test(n) && !/^lead$/i.test(n) && !/^-+$|^—$/.test(n)) return n;
  const last4 = String(c.phone || '').replace(/\D/g, '').slice(-4);
  return last4 ? `···${last4}` : 'Lead';
}

// ── Error Boundary ──────────────────────────────────────────────────────────
// Catches render-time exceptions in any subtree. Without it, one bad
// component throw blanks the entire app. With it, the subtree shows a
// reset button and the rest of the app keeps working.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', this.props.label || '', err, info);
  }
  render() {
    if (this.state.err) {
      const msg = this.state.err?.message || String(this.state.err);
      return (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
          <div className="chrome-label" style={{ fontSize: 12, color: 'var(--ms-3)' }}>
            {this.props.label || 'SECTION'} CRASHED
          </div>
          <div className="lcd" style={{ padding: 10, fontSize: 12, maxHeight: 160, overflow: 'auto' }}>{msg}</div>
          <button
            className="chrome-label"
            style={{ padding: '8px 14px', height: 36, width: 140, boxShadow: 'var(--raised-2)', cursor: 'pointer' }}
            onClick={() => this.setState({ err: null })}
          >RETRY</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// useFocusTrap — apply to modals so Tab / Shift+Tab cycle between focusable
// elements inside the modal instead of escaping to the underlying page
// (which was NIGHT_SUMMARY's deferred a11y item). Also auto-focuses the
// first focusable element on open and restores focus to the previously
// focused element on close.
//
// Usage: useFocusTrap(ref, open) — ref attached to the modal root div.
function useFocusTrap(rootRef, active) {
  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;
    // Remember who had focus before the modal opened so we can restore on close.
    const prevFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusable = () => Array.from(root.querySelectorAll(
      'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),' +
      ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hasAttribute('aria-hidden'));

    // Auto-focus first focusable — only if focus isn't already inside the modal
    // (e.g. an `autoFocus` input already grabbed focus).
    if (!root.contains(document.activeElement)) {
      const first = getFocusable()[0];
      if (first) setTimeout(() => first.focus(), 0);
    }

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus to the element that was focused before modal opened —
      // only if it's still in the DOM and focusable (page reflows etc.).
      if (prevFocused && document.body.contains(prevFocused) && typeof prevFocused.focus === 'function') {
        try { prevFocused.focus(); } catch {}
      }
    };
  }, [rootRef, active]);
}

// ── Connection banner — two failure modes ─────────────────────────────────
// 1. navigator.onLine → false: device lost network (wifi dropped, airplane
//    mode, etc). Nothing will reach Supabase.
// 2. Realtime channel errored or closed: network is fine but Supabase
//    realtime subscription is dead. CRUD still works, but live updates
//    (new SMS, proposal viewed, stage change from another tab) stop
//    arriving silently. Previously invisible — Key would wonder why the
//    inbox hasn't updated.
//
// Listens to a window-level `bpp:realtime-status` event the main realtime
// channels dispatch when their status callback fires. Any channel reporting
// 'CHANNEL_ERROR' / 'TIMED_OUT' / 'CLOSED' flips the banner; any reporting
// 'SUBSCRIBED' unflips.
function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [rtBroken, setRtBroken] = useState(false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  useEffect(() => {
    const brokenChannels = new Set();
    const handler = (ev) => {
      const { channel, status } = ev.detail || {};
      if (!channel) return;
      if (status === 'SUBSCRIBED' || status === 'CLOSED' && brokenChannels.size === 0) {
        brokenChannels.delete(channel);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        brokenChannels.add(channel);
      } else if (status === 'CLOSED') {
        brokenChannels.delete(channel);
      }
      setRtBroken(brokenChannels.size > 0);
    };
    window.addEventListener('bpp:realtime-status', handler);
    return () => window.removeEventListener('bpp:realtime-status', handler);
  }, []);
  if (online && !rtBroken) return null;
  const label = !online
    ? 'Offline — changes queued until you reconnect'
    : 'Live updates disconnected — reload to restore';
  return (
    <div style={{
      padding: '6px 16px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
      background: !online ? 'var(--ms-3)' : 'var(--ms-4)',
      color: '#fff', textAlign: 'center', letterSpacing: '.04em',
    }}>{label}</div>
  );
}

// ── Shared button primitives ────────────────────────────────────────────────
// PrimaryButton: navy background, white text, hard inset bevel. Use for the
// primary confirmation action in modals and forms. SecondaryButton: flat
// card background, muted text, raised-2 bevel. Cancel / secondary actions.
const PRIMARY_BTN_BEVEL = 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)';
function PrimaryButton({ children, disabled, onClick, type = 'button', style, ...rest }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      height: 40, padding: '0 20px',
      background: disabled ? 'var(--text-muted)' : 'var(--navy)',
      color: '#fff',
      fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
      boxShadow: PRIMARY_BTN_BEVEL,
      cursor: disabled ? 'wait' : 'pointer',
      border: 'none', opacity: disabled ? 0.7 : 1,
      ...style,
    }} {...rest}>{children}</button>
  );
}
function SecondaryButton({ children, onClick, type = 'button', style, ...rest }) {
  return (
    <button type={type} onClick={onClick} style={{
      height: 40, padding: '0 18px',
      background: 'var(--card)', color: 'var(--text-muted)',
      fontFamily: 'var(--font-body)', fontSize: 13, letterSpacing: '.04em',
      boxShadow: 'var(--raised-2)', border: 'none',
      cursor: 'pointer',
      ...style,
    }} {...rest}>{children}</button>
  );
}

// ── Auth Gate ───────────────────────────────────────────────────────────────
function AuthGate({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message || 'Authentication failed.'); return; }
    onAuth(data.user);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'grid', placeItems: 'center',
      padding: 'env(safe-area-inset-top) 24px env(safe-area-inset-bottom)',
    }} className="grid-bg">
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 48, lineHeight: 1, color: 'var(--navy)' }}>BPP</div>
        <div className="chrome-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>OPERATOR TERMINAL // AUTHORIZED USE ONLY</div>
        <div style={{ width: 48, height: 2, background: 'var(--gold)' }} />
        <form onSubmit={submit} className="raised" style={{
          width: '100%', padding: 24,
          display: 'flex', flexDirection: 'column', gap: 16,
          outline: '1px solid rgba(0,0,0,.4)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="chrome-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>EMAIL</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              className="pressed-2"
              style={{ padding: '10px 12px', height: 40, fontFamily: 'var(--font-mono)', fontSize: 14 }}
              required autoFocus
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="chrome-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>PASSWORD</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="pressed-2"
              style={{ padding: '10px 12px', height: 40, fontFamily: 'var(--font-mono)', fontSize: 14 }}
              required
            />
          </div>
          {error ? (
            <div className="lcd" style={{ padding: '6px 12px', fontSize: 13, height: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="pixel" style={{ fontSize: 14 }}>ACCESS DENIED</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, opacity: .85 }}>{error}</span>
            </div>
          ) : null}
          <button type="submit" disabled={busy} className="tactile-raised" style={{
            width: '100%', height: 44,
            background: 'var(--navy)', color: '#fff',
            fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 14,
            letterSpacing: '.08em', textTransform: 'uppercase',
            boxShadow: 'inset 3px 3px 0 rgba(255,255,255,.25), inset -3px -3px 0 rgba(0,0,0,.55)',
            opacity: busy ? 0.6 : 1,
            cursor: busy ? 'wait' : 'pointer',
          }}>{busy ? 'AUTHENTICATING…' : 'SIGN IN'}</button>
        </form>
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
          V4.2 // BPP INTERNAL // CRM V2
        </div>
      </div>
    </div>
  );
}

// ── Live Leads List (wraps LeadsListDesktop/Mobile with real Supabase data) ─
//
// Also computes a "waiting set" — the subset of contacts whose latest message
// is a customer reply nobody has answered yet. Those rows sort to the top and
// render with an amber dot, so "who needs me right now?" is answered at a
// glance without opening every thread. Populates the `unread` field that was
// previously a stubbed-out TODO in contactToRow.
async function fetchWaitingSet() {
  // Pull the most recent messages across the whole account; dedupe to one per
  // contact (newest wins) and flag any whose latest is an inbound customer
  // message (not an Alex bot reply, which is outbound anyway). 500 rows covers
  // multi-day activity comfortably — the dashboard only shows ~200 contacts,
  // so if a contact has any recent thread activity this batch will contain it.
  const { data } = await db.from('messages')
    .select('contact_id, direction, sender, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  const seen = new Set();
  const waiting = new Set();
  for (const m of (data || [])) {
    if (!m?.contact_id || seen.has(m.contact_id)) continue;
    seen.add(m.contact_id);
    // inbound from the customer. Alex replies are sender='ai' + direction='outbound',
    // but guard sender anyway so we don't light up on any future inbound bot events.
    if (m.direction === 'inbound' && m.sender !== 'ai') {
      waiting.add(m.contact_id);
    }
  }
  return waiting;
}

function LiveLeadsList({ desktop = false, onSelect }) {
  const [rows, setRows] = useState([]);
  const [waitingSet, setWaitingSet] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [query, setQuery] = useState('');
  // CRITICAL: all hooks MUST be called before any early return. Previously the
  // pin-sort hooks lived below the loading/err/empty early returns, which
  // caused React error #310 (rendered more hooks than previous render) every
  // time the list transitioned from loading → loaded. This crashed the whole
  // LIST view on first load.
  const [pinsTick, setPinsTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // Archived contacts don't show in the active LIST view. They still
      // exist in DB and can be reached via direct link or by unarchiving
      // from the Edit tab. Mirrors the v1 filter behavior.
      const [contactsRes, waiting] = await Promise.all([
        db.from('contacts')
          .select('id, name, phone, email, address, stage, status, do_not_contact, created_at')
          .neq('status', 'Archived')
          .order('created_at', { ascending: false })
          .limit(200),
        fetchWaitingSet(),
      ]);
      if (!alive) return;
      if (contactsRes.error) { setErr(contactsRes.error.message); setLoading(false); return; }
      setRows((contactsRes.data || []).map(contactToRow));
      setWaitingSet(waiting);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // Realtime channel — re-fetch on contact changes
  useEffect(() => {
    const channel = db.channel('contacts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, async () => {
        const { data } = await db
          .from('contacts')
          .select('id, name, phone, email, address, stage, status, do_not_contact, created_at')
          .neq('status', 'Archived')
          .order('created_at', { ascending: false })
          .limit(200);
        setRows((data || []).map(contactToRow));
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, []);

  // Realtime: messages. Any insert can flip the waiting set — a new inbound
  // adds a contact, an outbound from Key removes one. Refetch is cheap (one
  // query) and keeps the list's amber dots truthful without client-side
  // bookkeeping about which row corresponds to which message.
  useEffect(() => {
    const ch = db.channel('leads-list-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchWaitingSet().then(setWaitingSet);
      })
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, []);

  // Pin change listener — moved up from below the early returns (see comment above)
  useEffect(() => {
    const on = () => setPinsTick(t => t + 1);
    window.addEventListener('bpp:pins-changed', on);
    return () => window.removeEventListener('bpp:pins-changed', on);
  }, []);

  const sortedRows = useMemo(() => {
    const pinSet = new Set(readPins());
    const q = query.trim().toLowerCase();
    // Digit-only query part is checked against the phone; skip if empty
    // because "".includes("") === true would make the phone filter match
    // every row (the exact bug that silently broke this feature on ship).
    // r.raw.address is used because contactToRow doesn't copy address to
    // the top level — only raw has it.
    const qDigits = q.replace(/\D/g, '');
    const filtered = !q ? rows : rows.filter(r => {
      if ((r.name || '').toLowerCase().includes(q)) return true;
      if (qDigits && (r.phone || '').replace(/\D/g, '').includes(qDigits)) return true;
      const addr = r.raw?.address || r.address || '';
      if (addr.toLowerCase().includes(q)) return true;
      return false;
    });
    // Merge: `unread` from the waiting set (customer replied, not yet handled),
    // `pinned` from localStorage. Sort order: pinned > waiting > recency (which
    // is the natural DB order from the initial fetch).
    return filtered
      .map(r => ({ ...r, pinned: pinSet.has(r.id), unread: waitingSet.has(r.id) }))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.unread !== b.unread) return a.unread ? -1 : 1;
        return 0;
      });
  }, [rows, pinsTick, query, waitingSet]);

  if (loading) {
    return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>LOADING CONTACTS...</div>;
  }
  if (err) {
    return <div className="lcd" style={{ margin: 16, padding: 12, fontSize: 13 }}>{err}</div>;
  }
  if (rows.length === 0) {
    return (
      <div style={{
        padding: 48, display: 'grid', placeItems: 'center',
        color: 'var(--text-muted)', textAlign: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 600 }}>No contacts yet</div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', marginTop: 8 }}>
            Waiting for first lead
          </div>
        </div>
      </div>
    );
  }

  const LeadsListDesktop = window.LeadsListDesktop;
  const LeadsListMobile  = window.LeadsListMobile;

  return (
    <LeadsListWithBulkActions
      rows={sortedRows}
      totalCount={rows.length}
      query={query}
      setQuery={setQuery}
      desktop={desktop}
      onSelect={onSelect}
      LeadsListDesktop={LeadsListDesktop}
      LeadsListMobile={LeadsListMobile}
      onBulkApplied={() => { /* realtime subscription will refetch */ }}
    />
  );
}

// Wraps the leads list with a "select mode" that enables bulk actions across
// many contacts at once. Three actions: bulk stage change, bulk archive, bulk
// DNC. Used for pipeline cleanup (dead leads, mistaken entries, seasonal
// hibernate) — saves Key opening each contact individually.
function LeadsListWithBulkActions({ rows, totalCount, query, setQuery, desktop, onSelect, LeadsListDesktop, LeadsListMobile, onBulkApplied }) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  // Stage filter — narrow the visible rows to a single pipeline stage (or
  // "done" = stage 9+). 'all' shows everything. Persisted to localStorage so
  // Key's filter sticks across reloads.
  const [stageFilter, setStageFilter] = useState(() => {
    try { return localStorage.getItem('bpp_v2_stage_filter') || 'all'; } catch { return 'all'; }
  });
  useEffect(() => {
    try { localStorage.setItem('bpp_v2_stage_filter', stageFilter); } catch {}
  }, [stageFilter]);

  // Toggle a contact in the selection set. Called when a row is clicked
  // while select mode is active; otherwise the regular onSelect (open detail)
  // takes over.
  const toggleSelected = useCallback((row) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }, []);

  const handleRowClick = useCallback((row) => {
    if (selectMode) toggleSelected(row);
    else onSelect && onSelect(row);
  }, [selectMode, toggleSelected, onSelect]);

  // Apply stage filter + per-row selection state. Counts-per-stage are
  // computed from the full row set so the chip labels stay accurate even
  // when a filter is active.
  const stageCounts = useMemo(() => {
    const c = { all: rows.length, waiting: 0, new: 0, quoted: 0, booked: 0, done: 0 };
    for (const r of rows) {
      if (r.unread) c.waiting++;
      const s = r.raw?.stage || 1;
      if (s === 1) c.new++;
      else if (s === 2) c.quoted++;
      else if (s >= 3 && s <= 8) c.booked++;
      else if (s >= 9) c.done++;
    }
    return c;
  }, [rows]);

  const filteredByStage = useMemo(() => {
    if (stageFilter === 'all') return rows;
    return rows.filter(r => {
      if (stageFilter === 'waiting') return r.unread === true;
      const s = r.raw?.stage || 1;
      if (stageFilter === 'new')    return s === 1;
      if (stageFilter === 'quoted') return s === 2;
      if (stageFilter === 'booked') return s >= 3 && s <= 8;
      if (stageFilter === 'done')   return s >= 9;
      return true;
    });
  }, [rows, stageFilter]);

  const rowsWithSelectState = useMemo(() => {
    if (!selectMode) return filteredByStage;
    return filteredByStage.map(r => ({ ...r, _selected: selectedIds.has(r.id) }));
  }, [filteredByStage, selectMode, selectedIds]);

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function bulkStage(stage) {
    if (selectedIds.size === 0) return;
    setApplying(true);
    const ids = Array.from(selectedIds);
    try {
      // Pull current stages so we can insert accurate stage_history rows.
      const { data: currentRows } = await db
        .from('contacts').select('id, stage').in('id', ids);
      const currentStageById = Object.fromEntries((currentRows || []).map(r => [r.id, r.stage || 1]));

      const { error: updErr } = await db.from('contacts').update({ stage }).in('id', ids);
      if (updErr) throw updErr;

      // Stage history — one row per contact. Failures here are non-fatal
      // (stage still moved); just log and move on.
      const histRows = ids.map(id => ({
        contact_id: id,
        from_stage: currentStageById[id] ?? null,
        to_stage: stage,
      }));
      db.from('stage_history').insert(histRows).then(() => {}, (e) => console.warn('[bulk] history insert failed', e));

      window.__bpp_toast && window.__bpp_toast(`${ids.length} lead${ids.length === 1 ? '' : 's'} → stage ${stage}`, 'success');
      onBulkApplied && onBulkApplied();
      exitSelectMode();
    } catch (e) {
      window.__bpp_toast && window.__bpp_toast(`Bulk stage failed: ${e.message || e}`, 'error');
    } finally {
      setApplying(false);
      setStagePickerOpen(false);
    }
  }

  async function bulkArchive() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Archive ${count} contact${count === 1 ? '' : 's'}? They're hidden from the list but not deleted.`)) return;
    setApplying(true);
    const ids = Array.from(selectedIds);
    try {
      const { error } = await db.from('contacts').update({ status: 'Archived' }).in('id', ids);
      if (error) throw error;
      window.__bpp_toast && window.__bpp_toast(`${count} lead${count === 1 ? '' : 's'} archived`, 'success');
      onBulkApplied && onBulkApplied();
      exitSelectMode();
    } catch (e) {
      window.__bpp_toast && window.__bpp_toast(`Bulk archive failed: ${e.message || e}`, 'error');
    } finally {
      setApplying(false);
    }
  }

  async function bulkDnc() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Mark ${count} contact${count === 1 ? '' : 's'} as Do Not Contact? All automated follow-ups and Alex replies stop for them.`)) return;
    setApplying(true);
    const ids = Array.from(selectedIds);
    try {
      const { error } = await db.from('contacts').update({
        do_not_contact: true,
        dnc_at: new Date().toISOString(),
        dnc_source: 'crm-bulk',
      }).in('id', ids);
      if (error) throw error;
      window.__bpp_toast && window.__bpp_toast(`${count} lead${count === 1 ? '' : 's'} marked DNC`, 'success');
      onBulkApplied && onBulkApplied();
      exitSelectMode();
    } catch (e) {
      window.__bpp_toast && window.__bpp_toast(`Bulk DNC failed: ${e.message || e}`, 'error');
    } finally {
      setApplying(false);
    }
  }

  // Filter chip definitions. Counts render inline so Key can see "21 waiting"
  // at a glance without applying the filter first.
  const chips = [
    { id: 'all',     label: 'ALL',     count: stageCounts.all },
    { id: 'waiting', label: 'WAITING', count: stageCounts.waiting, tint: 'var(--gold)' },
    { id: 'new',     label: 'NEW',     count: stageCounts.new },
    { id: 'quoted',  label: 'QUOTED',  count: stageCounts.quoted },
    { id: 'booked',  label: 'BOOKED+', count: stageCounts.booked },
    { id: 'done',    label: 'DONE',    count: stageCounts.done },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div style={{ padding: '8px 16px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${totalCount} contacts by name, phone, address…`}
          style={{
            flex: 1, height: 36, padding: '0 12px',
            fontFamily: 'var(--font-body)', fontSize: 14,
            background: 'var(--card)', boxShadow: 'var(--pressed-2)',
            border: 'none',
          }}
        />
        <button
          onClick={() => { if (selectMode) exitSelectMode(); else setSelectMode(true); }}
          title={selectMode ? 'Cancel bulk select' : 'Select multiple for bulk actions'}
          style={{
            height: 36, padding: '0 12px',
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
            background: selectMode ? 'var(--navy)' : 'var(--card)',
            color: selectMode ? 'var(--gold)' : 'var(--text-muted)',
            boxShadow: selectMode ? 'var(--pressed-2)' : 'var(--raised-2)',
            border: 'none', cursor: 'pointer', textTransform: 'uppercase',
          }}>
          {selectMode ? 'CANCEL' : 'SELECT'}
        </button>
      </div>
      {/* Stage filter chips — persisted via localStorage. WAITING highlighted
          gold because it's the single most actionable filter. */}
      <div style={{
        padding: '8px 16px 4px',
        display: 'flex', gap: 6, flexWrap: 'wrap',
      }}>
        {chips.map(c => {
          const active = stageFilter === c.id;
          return (
            <button key={c.id} onClick={() => setStageFilter(c.id)} style={{
              padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600,
              background: active ? 'var(--navy)' : 'var(--card)',
              color: active ? (c.tint || 'var(--gold)') : (c.tint || 'var(--text-muted)'),
              boxShadow: active ? 'var(--pressed-2)' : 'var(--raised-2)',
              cursor: 'pointer', border: 'none', letterSpacing: '.06em',
            }}>
              {c.label} <span style={{ marginLeft: 4, opacity: .6 }}>{c.count}</span>
            </button>
          );
        })}
      </div>
      {query && rowsWithSelectState.length === 0 ? (
        <Empty label={`No matches for "${query}"`} hint="Try fewer characters or open ⌘K — smart search understands natural language." />
      ) : null}
      <div style={{ flex: 1, minHeight: 0 }}>
        {desktop
          ? <LeadsListDesktop rows={rowsWithSelectState} onSelect={handleRowClick} />
          : <LeadsListMobile  rows={rowsWithSelectState} onSelect={handleRowClick} />}
      </div>
      {/* Bulk action bar — slides up from the bottom when at least one lead
          is selected. Four buttons: move to stage, archive, DNC, cancel. */}
      {selectMode && selectedIds.size > 0 ? (
        <div style={{
          position: 'sticky', bottom: 0,
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
          background: 'var(--navy)', color: 'var(--gold)',
          boxShadow: '0 -2px 0 rgba(0,0,0,.3)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span className="chrome-label" style={{ fontSize: 12, letterSpacing: '.08em', flex: '0 0 auto' }}>
            {selectedIds.size} SELECTED
          </span>
          <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={() => setStagePickerOpen(true)} disabled={applying} style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
              background: 'var(--gold)', color: 'var(--navy)', border: 'none',
              cursor: applying ? 'wait' : 'pointer', boxShadow: 'var(--raised-2)',
            }}>Move to stage…</button>
            <button onClick={bulkArchive} disabled={applying} style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
              background: 'transparent', color: 'var(--gold)',
              border: '1px solid rgba(255,186,0,.5)', cursor: applying ? 'wait' : 'pointer',
            }}>Archive</button>
            <button onClick={bulkDnc} disabled={applying} style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
              background: 'transparent', color: 'var(--ms-3)',
              border: '1px solid var(--ms-3)', cursor: applying ? 'wait' : 'pointer',
            }}>DNC</button>
            <button onClick={exitSelectMode} disabled={applying} style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
              background: 'transparent', color: 'rgba(255,186,0,.6)',
              border: 'none', cursor: applying ? 'wait' : 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      ) : null}
      {stagePickerOpen ? (
        <StagePickerModal
          currentStage={1}
          onPick={(s) => bulkStage(s)}
          onClose={() => setStagePickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

// ── Live Pipeline (9-column kanban with live data + drag stage transitions) ─
// Column id → contact.stage number (Supabase schema)
const PIPELINE_COL_TO_STAGE = {
  new: 1,
  quoted: 2,
  booked: 3,
  permit: 4,
  pay: 5,
  paid: 6,
  rprint: 7,
  printed: 8,
  inspect: 9,
};
// Reverse: contact.stage (1-9) → column id
const STAGE_TO_PIPELINE_COL = Object.fromEntries(
  Object.entries(PIPELINE_COL_TO_STAGE).map(([k, v]) => [v, k])
);

function contactToCard(c, waiting = false, proposal = null) {
  const days = c.created_at
    ? Math.round((Date.now() - new Date(c.created_at).getTime()) / 86400000)
    : 0;
  // Best-effort dots: photo flag lives in Alex session, quote in proposals,
  // permit in install_notes. For MVP we heuristic-flag from install_notes + stage.
  const notes = (c.install_notes || '').toLowerCase();
  const hasPhoto = /photo|image|panel_photo/.test(notes) || (c.stage || 1) >= 2;
  const hasQuote = (c.stage || 1) >= 2;
  const hasPermit = (c.stage || 1) >= 4;
  // Install-date awareness. Once a contact is booked (stage ≥ 4) the number
  // that matters isn't "how old is this lead" but "how close is install?"
  // Compute a forward-looking offset so the card can replace the days-ago
  // chip with an install-day chip in those stages.
  let installOffsetDays = null;
  if (c.install_date) {
    const instMs = new Date(c.install_date).getTime();
    if (!isNaN(instMs)) {
      installOffsetDays = Math.round((instMs - Date.now()) / 86400000);
    }
  }
  // Proposal signal — show a chip on the card if the customer has viewed
  // their quote. Most actionable variant: "VIEWED 3h" / "VIEWED 2d" when the
  // view happened but they haven't signed yet — that's the peak-interest
  // follow-up window. Once they sign (stage jumps to 4+) the chip hides.
  let proposalSignal = null;
  if (proposal && proposal.viewed && !proposal.signed && (c.stage || 1) <= 3) {
    let age = null;
    if (proposal.viewedAt) {
      const hrs = (Date.now() - new Date(proposal.viewedAt).getTime()) / 3600000;
      if (hrs < 1)   age = `${Math.max(1, Math.round(hrs * 60))}m`;
      else if (hrs < 24) age = `${Math.round(hrs)}h`;
      else age = `${Math.round(hrs / 24)}d`;
    }
    proposalSignal = { kind: 'viewed', age };
  }
  const cardName = displayNameFor(c);
  const stage = c.stage || 1;
  // Smart staleness flag — a card is stale when it's overdue to move on.
  // Uses `days` (lead age) as a proxy since per-stage dwell time isn't
  // easily readable here without a stage_history join. Thresholds match
  // the F/U framework: pre-booked stages get a looser 7d, mid-funnel 14d,
  // post-install 21d.
  const staleThreshold = stage < 4 ? 7 : stage < 9 ? 14 : 21;
  const stale = days > staleThreshold;
  return {
    id: c.id,
    name: cardName,
    initials: initials(cardName),
    addr: c.address || '—',
    days,
    installOffsetDays, // null when no install_date set; negative = past-due, 0 = today, + = future
    dots: { photo: hasPhoto ? 1 : 0, quote: hasQuote ? 1 : 0, permit: hasPermit ? 1 : 0 },
    overdue: days > 7 && (c.stage || 1) < 4,
    stale, // Smart Pipeline: cards in a column too long get a red ring
    dnc: !!c.do_not_contact,
    jurisdiction: c._jurisdiction_name || null,
    pinned: isPinned(c.id),
    waiting,  // customer's last SMS is unreplied — renders gold corner mark
    proposalSignal, // { kind: 'viewed', age: '3h' } when quote was opened but not signed; null otherwise
    alexActive: c.ai_enabled === true && (c.stage || 1) <= 3, // Alex is actively handling the conversation
  };
}

function LivePipelineToolbar({ stats }) {
  // Navigation moved to the top TabBar. This strip now renders only the
  // pipeline stats ("69 active · $20,723 pipeline") — the informational
  // header Key scans before digging into the kanban.
  if (!stats) return null;
  return (
    <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 14 }}>
        <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{stats.count}</span> active</span>
        {stats.value > 0 ? <span><span style={{ color: 'var(--ms-2)', fontWeight: 600 }}>${stats.value.toLocaleString()}</span> pipeline</span> : null}
      </div>
    </div>
  );
}

function LivePipeline({ onCardClick, onSubView }) {
  const [contacts, setContacts] = useState([]);
  const [waitingIds, setWaitingIds] = useState(() => new Set());
  const [proposalState, setProposalState] = useState(() => new Map()); // contact_id → {viewed, signed, viewed_at}
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [{ data: contacts }, { data: jurisdictions }, { data: recentMsgs }, { data: props }] = await Promise.all([
      db.from('contacts')
        .select('id, name, phone, address, stage, status, install_notes, created_at, do_not_contact, quote_amount, jurisdiction_id, install_date, ai_enabled')
        .neq('status', 'Archived')
        .order('created_at', { ascending: false })
        .limit(500),
      db.from('permit_jurisdictions').select('id, name'),
      // Latest 300 messages to compute "waiting on Key" per contact. Same
      // definition the inbox uses — most recent message is inbound + sender
      // is not Alex. Cards get a gold dot so Key can scan the pipeline and
      // see who owes him a reply without opening each thread.
      db.from('messages')
        .select('contact_id, direction, sender, created_at')
        .order('created_at', { ascending: false }).limit(300),
      // Proposals — surface the "customer viewed the quote but hasn't signed"
      // state on QUOTED-column cards. This is the highest-value sales signal
      // in the pipeline: the window between view and sign is peak interest,
      // and a quick follow-up here converts way better than a generic 48h
      // nudge on a never-viewed quote.
      db.from('proposals')
        .select('contact_id, status, viewed_at, signed_at, created_at')
        .in('status', ['Created', 'Copied', 'Viewed', 'Approved'])
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    // Attach jurisdiction name inline so contactToCard can render it
    const jMap = Object.fromEntries((jurisdictions || []).map(j => [j.id, j.name]));
    const withJ = (contacts || []).map(c => ({ ...c, _jurisdiction_name: jMap[c.jurisdiction_id] || null }));
    setContacts(withJ);
    // Build waiting set: first-seen message per contact decides direction.
    const seen = new Set();
    const waiting = new Set();
    for (const m of (recentMsgs || [])) {
      if (!m.contact_id || seen.has(m.contact_id)) continue;
      seen.add(m.contact_id);
      if (m.direction === 'inbound' && m.sender !== 'ai') waiting.add(m.contact_id);
    }
    setWaitingIds(waiting);
    // Build proposal state: newest proposal per contact wins. Track whether
    // it was viewed, signed, and when it was viewed (for the "viewed Nh ago"
    // chip). Dedupe by contact_id since proposals are sorted newest-first.
    const propState = new Map();
    for (const p of (props || [])) {
      if (!p.contact_id || propState.has(p.contact_id)) continue;
      propState.set(p.contact_id, {
        viewed:   !!p.viewed_at,
        signed:   !!p.signed_at || p.status === 'Approved',
        viewedAt: p.viewed_at || null,
      });
    }
    setProposalState(propState);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    const ch = db.channel('pipeline-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchAll)
      // Messages INSERT must also refetch so the "waiting on Key" gold dot
      // updates the instant a customer reply lands. Previously the subscription
      // only watched the contacts table, which meant a new inbound message
      // wouldn't relight the dot until the contact row itself changed (stage
      // edit, DNC flip, etc.) — stale signal on the exact view most likely to
      // be open when that happens.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchAll)
      // Proposals UPDATE — when the customer opens the quote page, viewed_at
      // flips from null to a timestamp. That's the moment the VIEWED chip
      // should light up on this contact's card in the QUOTED column.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, fetchAll)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [fetchAll]);

  // Re-bucket when pins change so cards get the latest pinned flag
  const [pipelinePinsTick, setPipelinePinsTick] = useState(0);
  useEffect(() => {
    const on = () => setPipelinePinsTick(t => t + 1);
    window.addEventListener('bpp:pins-changed', on);
    return () => window.removeEventListener('bpp:pins-changed', on);
  }, []);

  // Bucket by column id using stage number; pinned cards float to the top of
  // each column, then waiting-on-Key cards next. Cards with a viewed-quote
  // signal also float within the QUOTED column so the peak-interest window
  // is visually obvious. Re-computes on contacts / waiting / proposal / pin
  // changes.
  const buckets = useMemo(() => {
    const b = {};
    Object.keys(PIPELINE_COL_TO_STAGE).forEach(k => { b[k] = []; });
    for (const c of contacts) {
      const colId = STAGE_TO_PIPELINE_COL[c.stage || 1] || 'new';
      b[colId].push(contactToCard(c, waitingIds.has(c.id), proposalState.get(c.id) || null));
    }
    for (const k of Object.keys(b)) {
      b[k].sort((a, x) => {
        if (a.pinned !== x.pinned) return a.pinned ? -1 : 1;
        if (a.waiting !== x.waiting) return a.waiting ? -1 : 1;
        // Within QUOTED, viewed-but-not-signed cards float above the rest
        // — they're the live warm leads Key should follow up on first.
        const aViewed = a.proposalSignal?.kind === 'viewed' ? 1 : 0;
        const xViewed = x.proposalSignal?.kind === 'viewed' ? 1 : 0;
        if (aViewed !== xViewed) return aViewed ? -1 : 1;
        return 0;
      });
    }
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, waitingIds, proposalState, pipelinePinsTick]);

  const counts = useMemo(() => {
    const c = {};
    Object.keys(buckets).forEach(k => { c[k] = buckets[k].length; });
    return c;
  }, [buckets]);

  const handleDrop = useCallback(async (contactId, toColId) => {
    const newStage = PIPELINE_COL_TO_STAGE[toColId];
    if (!newStage) return;
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const oldStage = contact.stage || 1;
    if (oldStage === newStage) return;

    // Optimistic update
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, stage: newStage } : c));
    await db.from('contacts').update({ stage: newStage }).eq('id', contactId);
    await db.from('stage_history').insert({
      contact_id: contactId, from_stage: oldStage, to_stage: newStage,
    }).then(() => {}, () => {});

    // Toast with Undo action (6s window)
    const undo = async () => {
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, stage: oldStage } : c));
      await db.from('contacts').update({ stage: oldStage }).eq('id', contactId);
      await db.from('stage_history').insert({
        contact_id: contactId, from_stage: newStage, to_stage: oldStage,
      }).then(() => {}, () => {});
      window.__bpp_toast && window.__bpp_toast(`Reverted ${contact.name || 'Lead'} to ${STAGE_MAP[oldStage] || 'stage ' + oldStage}`, 'info');
    };
    window.__bpp_toast && window.__bpp_toast(
      `${contact.name || 'Lead'} → ${STAGE_MAP[newStage] || 'stage ' + newStage}`,
      'success',
      { label: 'Undo', onClick: undo }
    );
  }, [contacts]);

  const LeadsPipelineComp = window.LeadsPipeline;

  if (loading) {
    return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>LOADING PIPELINE...</div>;
  }

  return (
    <LeadsPipelineComp
      buckets={buckets}
      counts={counts}
      onCardClick={onCardClick}
      onDropCard={handleDrop}
      toolbar={
        <LivePipelineToolbar
          stats={(() => {
            const active = contacts.filter(c => (c.stage || 1) < 9 && !c.do_not_contact);
            const value = active.reduce((s, c) => s + (Number(c.quote_amount) || 0), 0);
            return { count: active.length, value };
          })()}
        />
      }
    />
  );
}

// ── Live Contact Detail (replaces mock messages in contact-detail.jsx) ──────
// Compact Alex session strip shown above the message thread. Single line by
// default showing status + summary; click to expand for the full summary and
// follow-up count. The status chip always shows regardless of expansion —
// it's the at-a-glance signal Key scans during triage.
//
// Also carries a pause/resume toggle: flips alex_sessions.alex_active +
// contacts.ai_enabled together so Key can take over a conversation manually
// (Alex stops auto-responding) or hand it back. Without this toggle Key had
// to update the DB directly to pause Alex.
function AlexSessionStrip({ session, contactId, contactPhone }) {
  const [expanded, setExpanded] = React.useState(false);
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [localActive, setLocalActive] = React.useState(session.alex_active);
  // Keep local in sync with realtime pushes of session
  React.useEffect(() => { setLocalActive(session.alex_active); }, [session.alex_active]);
  const status = session.opted_out ? 'opted out' : localActive ? 'active' : 'handed off';
  const statusColor = session.opted_out ? 'var(--ms-3)' : localActive ? 'var(--ms-2)' : 'var(--text-faint)';
  const hasSummary = !!(session.summary && session.summary.trim());
  // Alex stores messages[].content as EITHER a string or an array of
  // {text, type: 'text'} blocks (Claude Agent SDK output). Normalise so
  // the transcript rail can treat every message the same.
  const normalisedMessages = React.useMemo(() => {
    const arr = Array.isArray(session?.messages) ? session.messages : [];
    return arr.map(m => {
      let text = '';
      if (typeof m.content === 'string') text = m.content;
      else if (Array.isArray(m.content)) {
        text = m.content.filter(b => b && b.type === 'text').map(b => b.text || '').join(' ').trim();
      }
      return { role: m.role || 'user', text };
    }).filter(m => m.text);
  }, [session?.messages]);
  const canToggle = !session.opted_out; // never override an opt-out; DNC/compliance path only

  async function toggleAlex(e) {
    e.stopPropagation();
    if (!contactPhone || toggling || !canToggle) return;
    setToggling(true);
    const nextActive = !localActive;
    // Optimistic: flip local state immediately so the chip reacts
    setLocalActive(nextActive);
    const sessUpdate = db.from('alex_sessions').update({ alex_active: nextActive }).eq('phone', contactPhone);
    const contactUpdate = contactId
      ? db.from('contacts').update({ ai_enabled: nextActive }).eq('id', contactId)
      : Promise.resolve();
    const [sessRes, contactRes] = await Promise.all([sessUpdate, contactUpdate]);
    setToggling(false);
    if (sessRes.error || contactRes.error) {
      setLocalActive(!nextActive); // revert
      window.__bpp_toast && window.__bpp_toast(`Toggle failed: ${sessRes.error?.message || contactRes.error?.message}`, 'error');
      return;
    }
    window.__bpp_toast && window.__bpp_toast(nextActive ? 'Alex resumed' : 'Alex paused — replies are on you', 'info');
  }

  return (
    <div
      onClick={() => hasSummary && setExpanded(v => !v)}
      title={hasSummary ? 'Click to expand Alex summary' : ''}
      style={{
        padding: '6px 14px',
        background: 'var(--card)',
        borderBottom: '1px solid rgba(0,0,0,.06)',
        fontFamily: 'var(--font-body)', fontSize: 11,
        color: 'var(--text-muted)',
        cursor: hasSummary ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ flex: '0 0 auto' }}>Alex</span>
          <span style={{
            padding: '1px 6px', fontSize: 10, letterSpacing: '.04em', flex: '0 0 auto',
            color: statusColor,
            border: '1px solid currentColor',
          }}>{status}</span>
          {canToggle ? (
            <button onClick={toggleAlex} disabled={toggling} title={localActive ? 'Pause Alex — Key takes over' : 'Resume Alex — auto-respond'} style={{
              padding: '1px 6px', fontSize: 10, letterSpacing: '.04em', flex: '0 0 auto',
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid rgba(0,0,0,.15)', cursor: toggling ? 'wait' : 'pointer',
              fontFamily: 'var(--font-body)',
            }}>{toggling ? '…' : localActive ? 'pause' : 'resume'}</button>
          ) : null}
          {hasSummary && !expanded ? (
            <span style={{
              flex: 1, minWidth: 0, color: 'var(--text-faint)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{session.summary}</span>
          ) : null}
        </span>
        <span className="mono" style={{ fontSize: 10, flex: '0 0 auto' }}>
          {session.followup_count > 0 ? `${session.followup_count} f/u` : '—'}
        </span>
      </div>
      {hasSummary && expanded ? (
        <div style={{
          padding: '4px 0 2px', fontSize: 12, lineHeight: 1.4,
          color: 'var(--text)', whiteSpace: 'pre-wrap',
        }}>{session.summary}</div>
      ) : null}
      {/* Transcript toggle — quality-audit tool. Lets Key see Alex's actual
          responses instead of only the summary so he can spot bad replies
          and feed them back into the prompt. Collapsed by default so the
          strip stays compact. */}
      {normalisedMessages.length > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <button onClick={e => { e.stopPropagation(); setTranscriptOpen(v => !v); }} style={{
            padding: '1px 6px', fontSize: 10, letterSpacing: '.04em',
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid rgba(0,0,0,.15)', cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}>
            {transcriptOpen ? 'hide transcript' : `${normalisedMessages.length} msg transcript`}
          </button>
          {transcriptOpen ? (
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
              {normalisedMessages.filter(m => m.role === 'assistant').length} Alex · {normalisedMessages.filter(m => m.role === 'user').length} user
            </span>
          ) : null}
        </div>
      ) : null}
      {transcriptOpen ? (
        <div onClick={e => e.stopPropagation()} style={{
          marginTop: 6, maxHeight: 260, overflowY: 'auto',
          padding: 8, background: 'var(--bg)',
          boxShadow: 'var(--raised-inset-1)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {normalisedMessages.map((m, i) => {
            // First user message is almost always the internal kickstart
            // ("Send your opening message now.") — dim it so the real
            // conversation pops.
            const isKickstart = i === 0 && m.role === 'user' && /send your opening/i.test(m.text);
            return (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                opacity: isKickstart ? 0.45 : 1,
              }}>
                <span className="mono" style={{
                  fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase',
                  color: m.role === 'assistant' ? 'var(--ms-2)' : 'var(--text-faint)',
                }}>
                  {m.role === 'assistant' ? 'Alex' : isKickstart ? 'system' : 'customer'}
                </span>
                <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                  {m.text}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// Lead profile strip — renders sparky_memory entries for the open contact's
// phone as a compact glanceable summary. Accretes turn-by-turn as Alex runs
// discovery (current_state, pain_point, cost_of_staying) and collects logistics
// (panel_location, address, generator, etc.). Key's "profile every lead and
// keep updating" direction — this is how he sees what Alex learned without
// scrolling the full message thread.
function LeadProfileStrip({ contactPhone }) {
  const [entries, setEntries] = React.useState([]);
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    if (!contactPhone) { setEntries([]); return; }
    let alive = true;
    (async () => {
      const { data } = await db.from('sparky_memory')
        .select('key, value, category, updated_at')
        .like('key', `contact:${contactPhone}:%`)
        .order('updated_at', { ascending: false });
      if (alive) setEntries(data || []);
    })();
    return () => { alive = false; };
  }, [contactPhone]);
  // Realtime — memory rows update as Alex writes. Refetch on any change
  // to the key namespace for this contact.
  React.useEffect(() => {
    if (!contactPhone) return;
    const ch = db.channel(`memory-${contactPhone}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sparky_memory' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.key && String(row.key).startsWith(`contact:${contactPhone}:`)) {
          // Simple refetch — small result set so this is cheap.
          db.from('sparky_memory')
            .select('key, value, category, updated_at')
            .like('key', `contact:${contactPhone}:%`)
            .order('updated_at', { ascending: false })
            .then(({ data }) => setEntries(data || []));
        }
      })
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [contactPhone]);

  if (entries.length === 0) return null;

  // Order fields by a hand-picked priority — discovery answers first
  // (those are what Alex learned), then panel/install logistics, then
  // attribution / background.
  const PRIORITY = [
    'current_state', 'pain_point', 'cost_of_staying',
    'panel_location', 'generator', 'generator_voltage', 'generator_model',
    'address', 'city', 'zip',
    'name', 'referral_source', 'lead_source',
  ];
  const fieldName = (key) => key.split(':').slice(2).join(':');
  const sorted = [...entries].sort((a, b) => {
    const af = fieldName(a.key), bf = fieldName(b.key);
    const ai = PRIORITY.indexOf(af);
    const bi = PRIORITY.indexOf(bf);
    if (ai === -1 && bi === -1) return af.localeCompare(bf);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Collapsed view: the 3 most recent / most important fields as compact
  // chips. Expanded: all fields + their full values.
  const preview = sorted.slice(0, 3);

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      title="Click to expand the full lead profile"
      style={{
        padding: '6px 14px',
        background: 'var(--card)',
        borderBottom: '1px solid rgba(0,0,0,.06)',
        borderLeft: '3px solid var(--ms-2)',
        fontFamily: 'var(--font-body)', fontSize: 11,
        color: 'var(--text-muted)', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ flex: '0 0 auto', color: 'var(--ms-2)' }}>Profile</span>
          {!expanded ? (
            <span style={{
              flex: 1, minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              color: 'var(--text-muted)',
            }}>
              {preview.map((e, i) => (
                <span key={e.key}>
                  {i > 0 ? ' · ' : ''}
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{fieldName(e.key)}:</span>
                  {' '}{String(e.value).slice(0, 30)}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', flex: '0 0 auto' }}>
          {entries.length} field{entries.length === 1 ? '' : 's'}
        </span>
      </div>
      {expanded ? (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            marginTop: 6, padding: '8px 10px', background: 'var(--bg)',
            boxShadow: 'var(--raised-inset-1)',
            display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px',
            fontSize: 12, color: 'var(--text)',
          }}>
          {sorted.map(e => (
            <React.Fragment key={e.key}>
              <span className="mono" style={{
                fontSize: 10, letterSpacing: '.04em',
                color: 'var(--text-faint)', textTransform: 'lowercase',
                paddingTop: 2, whiteSpace: 'nowrap',
              }}>{fieldName(e.key)}</span>
              <span style={{ lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {String(e.value)}
              </span>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Next-action engine ──────────────────────────────────────────────────────
// Computes the single highest-leverage next action for a contact based on
// stage, last-reply recency, Alex session state, and profile depth. Pure
// function — trivial to unit-test and tune as rules evolve. Returns null when
// no action is pressing; the card renders nothing so quiet contacts stay quiet.
//
// Rule priority (first match wins):
//   R1  Urgency flag in profile (medical / storm / safety) — Key must handle.
//   R2  Customer replied <24h ago, no outbound since, Alex isn't active.
//       The "customer waiting" scenario that drops leads.
//   R3  Stage 3, quiet 48h–7d — time for a gentle follow-up nudge.
//   R4  Stage 3, quiet 7d+ — consider a final check-in.
//   R5  Stage 7 (approved, deposit paid) — schedule install + pull permit.
//   R6  Stage ≤2 with <4 profile fields while Alex is actively discovering
//       — informational only, no action for Key.
//
// Extending: append rules at the bottom or insert in priority order. Each
// rule returns { tint, icon, headline, sub, buttons? } or null.
function fmtAgo(hours) {
  if (!Number.isFinite(hours)) return 'a while';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function computeNextAction({ contact, messages, alexSession, profileEntries }) {
  if (!contact || contact.do_not_contact) return null;
  const stage = contact.stage || 1;
  const now = Date.now();

  // Walk messages in reverse — cheaper than sorting when only latest matters.
  let lastInboundAt = null;
  let lastOutboundAt = null;
  const msgs = messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (!m?.created_at) continue;
    if (m.direction === 'inbound' && !lastInboundAt) lastInboundAt = m.created_at;
    if (m.direction === 'outbound' && !lastOutboundAt) lastOutboundAt = m.created_at;
    if (lastInboundAt && lastOutboundAt) break;
  }
  const hrsSince = (at) => at ? (now - new Date(at).getTime()) / 3600000 : Infinity;
  const hoursSinceInbound = hrsSince(lastInboundAt);
  const hoursSinceOutbound = hrsSince(lastOutboundAt);

  // sparky_memory fields keyed as `contact:{phone}:{field}` — strip prefix
  // to get the field name. Small result set so the linear scan is fine.
  const fields = {};
  for (const e of (profileEntries || [])) {
    const name = String(e.key || '').split(':').slice(2).join(':');
    if (name) fields[name] = e.value;
  }
  const fieldCount = Object.keys(fields).length;
  const firstName = (contact.name || '').trim().split(/\s+/)[0] || 'there';

  // R1 — Urgency. Trumps everything up through stage 7.
  const urgency = fields.urgency_flag || fields.medical_need || fields.storm_urgency;
  if (urgency && stage < 7) {
    return {
      tint: 'var(--ms-3)',
      icon: '!',
      headline: 'Urgent — respond personally',
      sub: String(urgency).slice(0, 80),
      buttons: contact.phone ? [{ label: 'Call', kind: 'call', phone: contact.phone }] : [],
    };
  }

  // R2 — Customer waiting. Inbound strictly newer than outbound AND Alex is
  // not actively handling (paused, done, or never enabled for this contact).
  // 6-minute grace window gives Alex time to draft before we nag Key about it.
  const alexHandling = alexSession?.alex_active === true;
  if (
    lastInboundAt
    && hoursSinceInbound < 24
    && hoursSinceInbound + 0.05 < hoursSinceOutbound
    && !alexHandling
    && hoursSinceInbound > 0.1
  ) {
    return {
      tint: 'var(--ms-4)',
      icon: '→',
      headline: 'Customer waiting',
      sub: `They replied ${fmtAgo(hoursSinceInbound)} ago — no response yet`,
      buttons: [{ label: 'Draft with AI', kind: 'suggest' }],
    };
  }

  // R3 — Stage 3, quiet 48h–7d. Use the existing "Follow up" snippet body so
  // drafted copy matches what Key would pick from the snippets menu anyway.
  if (stage === 3 && hoursSinceInbound > 48 && hoursSinceInbound <= 168) {
    return {
      tint: 'var(--gold)',
      icon: '↻',
      headline: '48-hour follow-up due',
      sub: `Quiet for ${fmtAgo(hoursSinceInbound)}. Gentle nudge.`,
      buttons: [{
        label: 'Draft follow-up', kind: 'prefill',
        text: `Hey ${firstName}, just checking in. Want me to hold that install slot, or shift it out a week?`,
      }],
    };
  }

  // R4 — Stage 3, quiet 7d+. Final soft check-in ("No response" snippet).
  if (stage === 3 && hoursSinceInbound > 168) {
    return {
      tint: 'var(--text-muted)',
      icon: '×',
      headline: 'Long silence',
      sub: `${Math.round(hoursSinceInbound / 24)} days quiet. Consider a final check-in.`,
      buttons: [{
        label: 'Draft check-in', kind: 'prefill',
        text: `Hey ${firstName}, just checking in — still have your spot available if you're still interested. Happy to answer any questions or adjust anything on the quote. No pressure at all!`,
      }],
    };
  }

  // R5 — Stage 7. Approved, deposit paid, need to schedule install.
  if (stage === 7) {
    return {
      tint: 'var(--gold)',
      icon: '▶',
      headline: 'Approved — schedule install',
      sub: 'Deposit in. Pull permit + book a date.',
      buttons: [{ label: 'Install brief', kind: 'event', event: 'bpp:open-install-brief' }],
    };
  }

  // R6 — Alex learning phase. Informational; nothing for Key to do yet.
  if (
    stage <= 2
    && fieldCount < 4
    && lastInboundAt
    && hoursSinceInbound < 72
    && alexHandling
  ) {
    return {
      tint: 'var(--ms-2)',
      icon: '◈',
      headline: 'Alex still learning',
      sub: `${fieldCount} profile field${fieldCount === 1 ? '' : 's'} captured so far`,
      buttons: [],
    };
  }

  return null;
}

// Next-action card — renders the computed action as a compact strip above
// the messages thread. Refetches profile entries whenever the contact, stage,
// alex session, or message count changes (those are the inputs that flip the
// rule cascade). Piggybacks on the parent's existing realtime subscriptions
// instead of opening its own — one sparky_memory channel per contact is
// enough (LeadProfileStrip already runs one).
function NextActionCard({ contact, messages, alexSession }) {
  const [profileEntries, setProfileEntries] = useState([]);
  const phone = contact?.phone || null;
  const msgCount = (messages || []).length;
  const stage = contact?.stage || 1;
  const alexActive = alexSession?.alex_active;

  useEffect(() => {
    if (!phone) { setProfileEntries([]); return; }
    let alive = true;
    (async () => {
      const { data } = await db.from('sparky_memory')
        .select('key, value')
        .like('key', `contact:${phone}:%`)
        .limit(50);
      if (alive) setProfileEntries(data || []);
    })();
    return () => { alive = false; };
  }, [phone, msgCount, stage, alexActive]);

  const action = useMemo(
    () => computeNextAction({ contact, messages, alexSession, profileEntries }),
    [contact, messages, alexSession, profileEntries]
  );

  if (!action) return null;

  const run = (btn) => {
    if (btn.kind === 'call' && btn.phone) {
      // window.__bpp_dial is wired by useVoiceDevice at app top-level. Fallback
      // to tel: link if Twilio device hasn't booted yet (fresh load on mobile).
      if (typeof window.__bpp_dial === 'function') {
        window.__bpp_dial(btn.phone);
      } else {
        window.location.href = `tel:${String(btn.phone).replace(/[^0-9+]/g, '')}`;
      }
      return;
    }
    if (btn.kind === 'prefill' && btn.text) {
      window.dispatchEvent(new CustomEvent('bpp:compose-prefill', { detail: { text: btn.text } }));
      window.__bpp_toast && window.__bpp_toast('Draft loaded — review + send', 'info');
      return;
    }
    if (btn.kind === 'suggest') {
      window.dispatchEvent(new CustomEvent('bpp:compose-suggest'));
      return;
    }
    if (btn.kind === 'event' && btn.event) {
      window.dispatchEvent(new CustomEvent(btn.event));
    }
  };

  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--card)',
      borderBottom: '1px solid rgba(0,0,0,.06)',
      borderLeft: `3px solid ${action.tint}`,
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: 'var(--font-body)',
    }}>
      <span style={{
        flex: '0 0 auto',
        width: 22, height: 22,
        display: 'grid', placeItems: 'center',
        background: action.tint, color: '#fff',
        fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
        boxShadow: 'var(--raised-2)',
      }}>{action.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{action.headline}</div>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{action.sub}</div>
      </div>
      {action.buttons?.length ? (
        <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
          {action.buttons.map((b, i) => (
            <button key={i} onClick={() => run(b)} style={{
              padding: '5px 10px', fontSize: 11,
              fontFamily: 'var(--font-body)', fontWeight: 600,
              background: 'var(--card)', color: 'var(--text)',
              boxShadow: 'var(--raised-2)', border: 'none', cursor: 'pointer',
              letterSpacing: '.02em',
            }}>{b.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Duplicate-phone warning strip — renders when another contact shares the
// open contact's phone number. Amber to draw attention; each dupe is a link
// that swaps the panel to that contact so Key can compare and decide.
function DuplicateStrip({ duplicates }) {
  return (
    <div style={{
      padding: '6px 14px',
      background: 'var(--card)',
      borderBottom: '1px solid rgba(0,0,0,.06)',
      borderLeft: '3px solid var(--ms-4)',
      fontFamily: 'var(--font-body)', fontSize: 11,
      color: 'var(--text-muted)',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
    }}>
      <span style={{ color: 'var(--ms-4)' }}>⚠</span>
      <span>
        {duplicates.length === 1 ? 'Duplicate phone:' : `${duplicates.length} duplicates:`}
      </span>
      {duplicates.map((d, i) => (
        <button key={d.id}
          onClick={() => { window.location.hash = `#contact=${d.id}`; }}
          style={{
            padding: '2px 6px', fontSize: 11, fontFamily: 'var(--font-body)',
            background: 'transparent', color: 'var(--navy)',
            border: 'none', cursor: 'pointer', textDecoration: 'underline',
          }}>
          {d.name || 'Unnamed'} · stage {d.stage || 1}
        </button>
      ))}
    </div>
  );
}

// Review-ask strip — renders on stage 9 contacts (install complete) as a
// one-tap CTA to draft a Google-review request SMS. Post-install is peak
// happiness and the single highest-leverage moment for a review ask; every
// 5-star review permanently lifts GBP ranking.
// Same Google Place review shortlink `quo-ai-review` edge function uses. Keeps
// the copy the customer sees byte-identical regardless of whether the SMS was
// auto-fired at stage-9 advance or drafted manually from this strip.
const GOOGLE_REVIEW_URL = 'https://g.page/r/CVxLI9ZsiZS_EAE/review';

function ReviewAskStrip({ contactName }) {
  const draft = () => {
    const first = (contactName || '').split(' ')[0] || 'there';
    // Matches the quo-ai-review fallback body so manual + auto paths send the
    // same text. Link goes on its own line per v1's SMS formatting.
    const msg = `Hey ${first}, really glad everything went smoothly today. If you've got 2 minutes, a Google review would mean a lot to us. And if you know anyone else who could use this, we'd love the intro.\n${GOOGLE_REVIEW_URL}`;
    window.dispatchEvent(new CustomEvent('bpp:compose-prefill', { detail: { text: msg } }));
    window.__bpp_toast && window.__bpp_toast('Review ask drafted — review + send', 'info');
  };
  return (
    <div style={{
      padding: '8px 14px',
      background: 'var(--card)',
      borderBottom: '1px solid rgba(0,0,0,.06)',
      borderLeft: '3px solid var(--gold)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)',
    }}>
      <span>Install complete — ask for a Google review?</span>
      <button onClick={draft} style={{
        padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600,
        background: 'var(--navy)', color: 'var(--gold)',
        boxShadow: 'var(--raised-2)', cursor: 'pointer', border: 'none', letterSpacing: '.04em',
      }}>Draft ask</button>
    </div>
  );
}

// Install-day briefing modal — one-page view for Key on his phone during
// drive-out. Pulls the contact, latest proposal, jurisdiction, profile
// memory, permit meta, and recent messages into a dense scrollable sheet.
// Everything is one-tap: tap phone → call, tap address → Maps, tap portal
// link → jurisdiction site. Designed so Key never has to switch tabs during
// an install day.
function InstallBriefModal({ contact, onClose }) {
  const rootRef = React.useRef(null);
  useFocusTrap(rootRef, true);
  const [data, setData] = React.useState({ loading: true });
  React.useEffect(() => {
    if (!contact?.id) return;
    let alive = true;
    (async () => {
      const [propRes, jurRes, memRes, msgRes] = await Promise.all([
        db.from('proposals').select('selected_amp, selected_surge, include_permit, total, status, notes')
          .eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        contact.jurisdiction_id
          ? db.from('permit_jurisdictions').select('name, phone, link1_url, link1_title').eq('id', contact.jurisdiction_id).maybeSingle()
          : Promise.resolve({ data: null }),
        contact.phone
          ? db.from('sparky_memory').select('key, value').like('key', `contact:${contact.phone}:%`).limit(50)
          : Promise.resolve({ data: [] }),
        db.from('messages').select('direction, sender, body, created_at').eq('contact_id', contact.id)
          .order('created_at', { ascending: false }).limit(5),
      ]);
      const kv = {};
      for (const m of (memRes.data || [])) {
        const field = m.key.split(':').slice(2).join(':');
        kv[field] = m.value;
      }
      if (alive) setData({
        loading: false,
        proposal: propRes.data || null,
        jurisdiction: jurRes.data || null,
        memory: kv,
        recentMsgs: msgRes.data || [],
      });
    })();
    return () => { alive = false; };
  }, [contact?.id, contact?.phone, contact?.jurisdiction_id]);

  // Esc closes
  React.useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!contact) return null;
  const displayPhone = contact.phone ? formatPhone(contact.phone) : '—';
  const install = contact.install_date ? new Date(contact.install_date) : null;
  const installLabel = install && !isNaN(install.getTime())
    ? `${install.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · ${install.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'not scheduled';
  const permitMeta = parsePermitNotes(contact.install_notes);
  const memField = k => (data.memory || {})[k];

  const Section = ({ label, children, tint }) => (
    <div style={{
      padding: '12px 14px', marginBottom: 8,
      background: 'var(--card)', boxShadow: 'var(--raised-2)',
      borderLeft: `3px solid ${tint || 'transparent'}`,
    }}>
      <div className="chrome-label" style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '.08em', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  );
  const Kv = ({ k, v }) => v ? (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, fontSize: 12, padding: '2px 0' }}>
      <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 10, paddingTop: 2, textTransform: 'lowercase' }}>{k}</span>
      <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{v}</span>
    </div>
  ) : null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 95,
      background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div ref={rootRef} onClick={e => e.stopPropagation()} style={{
        width: 520, maxWidth: '100%', margin: '12px 0',
        background: 'var(--bg)', boxShadow: 'var(--raised-2)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px', background: 'var(--navy)', color: 'var(--gold)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span className="chrome-label" style={{ fontSize: 11, letterSpacing: '.12em' }}>INSTALL BRIEF</span>
          <button onClick={onClose} style={{
            width: 26, height: 26, fontSize: 14, display: 'grid', placeItems: 'center',
            background: 'transparent', border: '1px solid rgba(255,186,0,.4)',
            color: 'var(--gold)', cursor: 'pointer',
          }}>×</button>
        </div>

        <div style={{ padding: 12 }}>
          {/* Smart Install Brief — blocker strip. Surfaces missing pieces
              Key would find out about the hard way (no address, no amp,
              no permit number, no panel photo). Empty when everything's
              ready so the brief stays clean on the morning of an install. */}
          {!data.loading ? (() => {
            const blockers = [];
            if (!contact.address) blockers.push('No service address on file');
            if (!data.proposal?.selected_amp && !memField('generator_voltage')) blockers.push('Amp size not confirmed (30A vs 50A)');
            if (!memField('panel_location') && !memField('panel_photo_url')) blockers.push('Panel location / photo missing — ask for one');
            if (contact.jurisdiction_id && !permitMeta.number) blockers.push('Permit number not recorded yet');
            if (data.proposal?.include_permit === false) blockers.push('Permit line wasn\'t on the proposal — confirm Key submitted one');
            if (!blockers.length) return null;
            return (
              <div className="smart-hint" style={{ marginBottom: 8, alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
                <span className="smart-hint__label">Blockers ({blockers.length})</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  {blockers.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="smart-chip smart-chip--red">!</span>
                      <span style={{ fontSize: 12, color: '#fff' }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })() : null}

          {/* WHO + WHEN */}
          <Section label="Who" tint="var(--navy)">
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {contact.name || '(unnamed)'}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, fontSize: 13 }}>
              <a href={`tel:${contact.phone || ''}`} style={{
                color: 'var(--navy)', textDecoration: 'none',
                borderBottom: '1px dashed rgba(0,0,0,.25)',
              }}>{displayPhone}</a>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} style={{ color: 'var(--navy)', textDecoration: 'none', borderBottom: '1px dashed rgba(0,0,0,.25)' }}>{contact.email}</a>
              ) : null}
            </div>
            {contact.do_not_contact ? (
              <div className="mono" style={{ marginTop: 6, padding: '4px 8px', background: 'var(--ms-3)', color: '#fff', fontSize: 10, letterSpacing: '.08em', display: 'inline-block' }}>DNC — DO NOT CONTACT</div>
            ) : null}
          </Section>

          <Section label="When" tint={install ? 'var(--gold)' : 'var(--text-faint)'}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{installLabel}</div>
            {install ? (
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                {(() => {
                  const d = Math.round((install.getTime() - Date.now()) / 86400000);
                  return d === 0 ? 'today' : d === 1 ? 'tomorrow' : d > 0 ? `in ${d} days` : `${Math.abs(d)} days past`;
                })()}
              </div>
            ) : null}
          </Section>

          <Section label="Where" tint="var(--ms-2)">
            {contact.address ? (
              <a href={`https://maps.google.com/maps?q=${encodeURIComponent(contact.address)}`}
                target="_blank" rel="noopener" style={{
                  color: 'var(--navy)', textDecoration: 'none', fontSize: 14,
                  borderBottom: '1px dashed rgba(0,0,0,.25)',
                }}>{contact.address}</a>
            ) : <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>no address on file</span>}
          </Section>

          {/* PANEL + GENERATOR (what Key installs with) */}
          <Section label="Panel & generator" tint="var(--ms-1)">
            <Kv k="amp size" v={data.proposal?.selected_amp ? `${data.proposal.selected_amp}A` : memField('generator_voltage')} />
            <Kv k="panel" v={memField('panel_location')} />
            <Kv k="generator" v={memField('generator') || memField('current_state')} />
            {data.proposal?.selected_surge ? <Kv k="add-ons" v="Whole-home surge protector" /> : null}
          </Section>

          {/* PERMIT */}
          {(data.jurisdiction || permitMeta.number) ? (
            <Section label="Permit" tint="var(--ms-5)">
              {data.jurisdiction?.name ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{data.jurisdiction.name}</div>
              ) : null}
              <Kv k="permit #" v={permitMeta.number} />
              <Kv k="submitted" v={permitMeta.submittedAt} />
              {data.jurisdiction?.link1_url ? (
                <a href={data.jurisdiction.link1_url} target="_blank" rel="noopener" style={{
                  display: 'inline-block', marginTop: 6, padding: '4px 10px',
                  background: 'var(--navy)', color: 'var(--gold)', textDecoration: 'none',
                  fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
                  boxShadow: 'var(--raised-2)',
                }}>Portal ↗</a>
              ) : null}
              {permitMeta.docUrl ? (
                <a href={permitMeta.docUrl} target="_blank" rel="noopener" style={{
                  marginLeft: 6, display: 'inline-block', marginTop: 6, padding: '4px 10px',
                  background: 'var(--card)', color: 'var(--navy)', textDecoration: 'none',
                  fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
                  boxShadow: 'var(--raised-2)',
                }}>Permit PDF ↗</a>
              ) : null}
            </Section>
          ) : null}

          {/* DEAL */}
          {data.proposal ? (
            <Section label="Deal" tint="var(--ms-2)">
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                ${Number(data.proposal.total || 0).toLocaleString()}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2, textTransform: 'lowercase' }}>
                {data.proposal.status}
              </div>
            </Section>
          ) : null}

          {/* WHAT THEY MENTIONED (profile) — facts only, no quotes, no labels */}
          {(memField('current_state') || memField('pain_point') || memField('motivation')) ? (
            <Section label="What they mentioned" tint="var(--ms-4)">
              <Kv k="setup" v={memField('current_state')} />
              <Kv k="pain point" v={memField('pain_point')} />
              <Kv k="motivation" v={memField('motivation')} />
            </Section>
          ) : null}

          {/* NOTES from the proposal + Key's install notes (free text Key wrote) */}
          {(data.proposal?.notes || contact.install_notes?.replace(/^__pm_[a-z_]+:[^\n]*\n?/gm, '').trim()) ? (
            <Section label="Notes" tint="var(--text-faint)">
              {data.proposal?.notes ? (
                <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-muted)', marginBottom: 6 }}>
                  {data.proposal.notes}
                </div>
              ) : null}
              {contact.install_notes ? (() => {
                const free = contact.install_notes.split('\n').filter(l => !/^__pm_/.test(l)).join('\n').trim();
                return free ? <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{free}</div> : null;
              })() : null}
            </Section>
          ) : null}

          {/* LAST WORDS — most recent 3 messages so Key lands knowing where things left off */}
          {data.recentMsgs?.length > 0 ? (
            <Section label="Last words" tint="var(--text-muted)">
              {data.recentMsgs.slice(0, 3).reverse().map((m, i) => (
                <div key={i} style={{
                  padding: '4px 0', fontSize: 12,
                  color: 'var(--text)',
                  borderTop: i > 0 ? '1px solid rgba(0,0,0,.06)' : 'none',
                }}>
                  <span className="mono" style={{ fontSize: 9, letterSpacing: '.08em', color: 'var(--text-faint)', marginRight: 6, textTransform: 'uppercase' }}>
                    {m.direction === 'inbound' ? 'customer' : (m.sender === 'ai' ? 'alex' : 'key')}
                  </span>
                  {(m.body || '').slice(0, 160)}
                </div>
              ))}
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LiveContactDetail({ contactId, onBack, mobile = false, defaultTab }) {
  const [contact, setContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [alexSession, setAlexSession] = useState(null);
  const [duplicates, setDuplicates] = useState([]); // other contacts with same phone
  const [loading, setLoading] = useState(true);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('MESSAGES');
  // Incrementing counter — DetailQuote watches this via a prop + useEffect
  // and opens QuickQuoteModal on each bump. Lets the global `Q` keyboard
  // shortcut fire a quote without requiring the QUOTE tab to be active yet.
  const [quickQuoteTrigger, setQuickQuoteTrigger] = useState(0);
  // Track which contact the user last explicitly clicked a tab on, so we
  // can auto-pick a smart default when switching between contacts.
  const [manualTabContactId, setManualTabContactId] = useState(null);
  const msgScrollRef = useRef(null);
  const detailTabsRef = useRef(null);

  // On mobile the 6 detail tabs (Messages/Timeline/Quote/Permits/Notes/Edit)
  // overflow a 375px viewport. Without this effect, picking a later tab via
  // smart-default (e.g. stage 4 → PERMITS) leaves it off-screen with no
  // visible active indicator.
  useEffect(() => {
    if (!detailTabsRef.current) return;
    const btn = detailTabsRef.current.querySelector(`button[data-detail-tab-id="${detailTab}"]`);
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [detailTab]);

  // Auto-scroll message thread — only when Key is already at the bottom OR
  // on first mount of the tab. If he's scrolled up reading older messages,
  // a new incoming bubble should NOT yank him back to the bottom; that's
  // the Slack/iMessage anti-pattern. Track whether the next scroll should
  // stick via prevMsgCountRef — always stick when message list length
  // resets (contact change / tab switch).
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    const el = msgScrollRef.current;
    if (detailTab !== 'MESSAGES' || !el) return;
    const prevCount = prevMsgCountRef.current;
    const nextCount = messages.length;
    prevMsgCountRef.current = nextCount;
    // Hard-stick on tab mount / contact change (length shrunk OR stayed
    // the same while landing on the tab for the first time). Otherwise
    // only stick if the user was within 80px of the bottom before the new
    // message arrived — gives them breathing room to read older history.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 80;
    const isInitialRender = prevCount === 0;
    if (isInitialRender || nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, detailTab]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [cRes, mRes, invRes] = await Promise.all([
        db.from('contacts').select('*').eq('id', contactId).maybeSingle(),
        db.from('messages').select('*').eq('contact_id', contactId).order('created_at', { ascending: true }).limit(200),
        db.from('invoices').select('total, status').eq('contact_id', contactId),
      ]);
      if (!alive) return;
      setContact(cRes.data || null);
      setMessages(mRes.data || []);
      const outstanding = (invRes.data || [])
        .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
        .reduce((s, i) => s + (Number(i.total) || 0), 0);
      setOutstandingBalance(outstanding);
      // Alex session lookup by phone (alex_sessions table keys on phone, not contact_id)
      if (cRes.data?.phone) {
        const { data: sess } = await db.from('alex_sessions')
          .select('alex_active, opted_out, followup_count, status, summary, updated_at, messages')
          .eq('phone', cRes.data.phone)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (alive) setAlexSession(sess || null);
        // Duplicate detection by phone — other contacts sharing this number
        // are almost always the same person (same lead came in twice, or
        // household member filled out the form). Surface them so Key can
        // decide which record to keep before responding to the wrong thread.
        const { data: dupes } = await db.from('contacts')
          .select('id, name, stage, created_at')
          .eq('phone', cRes.data.phone)
          .neq('id', contactId)
          .limit(3);
        if (alive) setDuplicates(dupes || []);
      } else {
        setAlexSession(null);
        setDuplicates([]);
      }
      setLoading(false);
      // Default tab priority:
      //   1. Caller's defaultTab prop (mapped from current main tab — lets
      //      clicking a contact from Finance land on Quote, Calendar/Permits
      //      land on Permits, etc.)
      //   2. Stage-based smart default (stage 1 → QUOTE, stage 4-8 → PERMITS)
      //   3. MESSAGES fallback
      // All three are skipped if the user manually clicked a different tab
      // for this contact — respect their intent.
      if (cRes.data && manualTabContactId !== contactId) {
        if (defaultTab) {
          setDetailTab(defaultTab);
        } else {
          const s = cRes.data.stage || 1;
          let smart = 'MESSAGES';
          if (s === 1) smart = 'QUOTE';
          else if (s >= 4 && s <= 8) smart = 'PERMITS';
          setDetailTab(smart);
        }
      }
    })();
    return () => { alive = false; };
  }, [contactId]);

  // Listen for the global `Q` shortcut event. Switch to QUOTE tab so
  // DetailQuote is mounted, then bump the trigger so its useEffect fires
  // and opens the QuickQuoteModal. One keypress → quote form in front of
  // Key, no matter which tab he was on.
  useEffect(() => {
    if (!contactId) return;
    const handler = () => {
      setDetailTab('QUOTE');
      setManualTabContactId(contactId);
      // Bump on the next frame so DetailQuote has mounted before it sees
      // the trigger change. Without this, the modal would try to open
      // during the QUOTE tab's first render and miss.
      requestAnimationFrame(() => setQuickQuoteTrigger(n => n + 1));
    };
    window.addEventListener('bpp:open-quick-quote', handler);
    return () => window.removeEventListener('bpp:open-quick-quote', handler);
  }, [contactId]);

  // Listen for the global Shift+B shortcut → open the install brief modal
  // for the currently-selected contact.
  useEffect(() => {
    if (!contactId) return;
    const handler = () => setBriefOpen(true);
    window.addEventListener('bpp:open-install-brief', handler);
    return () => window.removeEventListener('bpp:open-install-brief', handler);
  }, [contactId]);

  // Right-side action bar drives this panel via window events. The bar sends
  // `bpp:focus-detail-tab` to switch sub-tabs; this panel echoes back any
  // sub-tab change via `bpp:detail-tab-changed` so the bar's active-state
  // stays in sync no matter who initiated the switch.
  useEffect(() => {
    if (!contactId) return;
    const handler = (e) => {
      const target = e?.detail?.tab || 'MESSAGES';
      setDetailTab(target);
      setManualTabContactId(contactId);
      window.dispatchEvent(new CustomEvent('bpp:detail-tab-changed', { detail: { tab: target } }));
    };
    window.addEventListener('bpp:focus-detail-tab', handler);
    return () => window.removeEventListener('bpp:focus-detail-tab', handler);
  }, [contactId]);

  // Echo detailTab changes out so the right-action-bar (and any other
  // listener — e.g. a future sparky "what am I looking at" readout) can
  // track which sub-tab the user is on.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bpp:detail-tab-changed', { detail: { tab: detailTab } }));
  }, [detailTab]);

  // Realtime: messages (INSERT + UPDATE) and the contact row itself (UPDATE).
  //   - message INSERT: new bubble appended, dedup'd by id
  //   - message UPDATE: status sent → delivered / failed flips live
  //   - contact UPDATE: stage change, DNC flip, install_date edit, address
  //     edit — Key sees it in the header without navigating away. Important
  //     when Alex or the permit-automation edge fns mutate the contact while
  //     Key has the detail panel open.
  useEffect(() => {
    if (!contactId) return;
    const channel = db.channel(`messages-${contactId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `contact_id=eq.${contactId}` }, (payload) => {
        setMessages(prev => {
          if (payload.new?.id && prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contacts', filter: `id=eq.${contactId}` }, (payload) => {
        if (payload.new) setContact(c => c ? { ...c, ...payload.new } : payload.new);
      })
      // Invoices for this contact — refetch outstanding balance live when a
      // deposit lands (payment → invoice goes paid) or a new invoice is
      // created. Without this the header keeps showing the stale red
      // "Outstanding $X" number after the customer has already paid.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `contact_id=eq.${contactId}` }, async () => {
        const { data: invs } = await db.from('invoices').select('total, status').eq('contact_id', contactId);
        const outstanding = (invs || [])
          .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
          .reduce((s, i) => s + (Number(i.total) || 0), 0);
        setOutstandingBalance(outstanding);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `contact_id=eq.${contactId}` }, (payload) => {
        setMessages(prev => {
          const id = payload.new?.id;
          if (!id) return prev;
          const i = prev.findIndex(m => m.id === id);
          if (i < 0) return prev; // row not in current view — ignore
          const next = prev.slice();
          next[i] = { ...prev[i], ...payload.new };
          return next;
        });
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [contactId]);

  // Realtime: alex_sessions row for THIS contact's phone. Required so the
  // pause/resume toggle reflects changes made on another device (or by Alex
  // itself updating state during ghost/followup flows). Separate channel
  // since it's keyed on phone, which becomes available after the contact
  // fetch completes — can't bake into the contactId-scoped channel above.
  useEffect(() => {
    if (!contact?.phone) return;
    const phone = contact.phone;
    const ch = db.channel(`alex-session-${phone}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alex_sessions', filter: `phone=eq.${phone}` }, (payload) => {
        if (payload.new) setAlexSession(s => s ? { ...s, ...payload.new } : payload.new);
      })
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [contact?.phone]);

  const stageAbbr = contact?.stage ? (STAGE_MAP[contact.stage] || 'NEW') : 'NEW';
  const displayName = contact?.name || 'LOADING...';
  const displayPhone = contact?.phone ? formatPhone(contact.phone) : '';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--card)', boxShadow: 'var(--raised)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        position: 'relative',
        paddingTop: mobile ? 'calc(16px + env(safe-area-inset-top))' : 16,
      }}>
        <button
          onClick={onBack}
          className="tactile-raised"
          style={{
            position: 'absolute', left: 12, top: mobile ? 'calc(12px + env(safe-area-inset-top))' : 12,
            width: 32, height: 32, display: 'grid', placeItems: 'center',
            fontSize: 18, lineHeight: 1, color: 'var(--text)',
            cursor: 'pointer',
          }}
        >{mobile ? '‹' : '×'}</button>
        {contact?.phone && !contact?.do_not_contact ? (
          <button
            onClick={() => window.__bpp_dial && window.__bpp_dial(contact.phone)}
            className="tactile-raised"
            title="Call"
            style={{
              position: 'absolute', right: 12, top: mobile ? 'calc(12px + env(safe-area-inset-top))' : 12,
              width: 36, height: 36, display: 'grid', placeItems: 'center',
              background: 'var(--green)', color: '#fff', cursor: 'pointer',
            }}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
              <path d="M3 3 L5 3 L6 6 L5 7 A5 5 0 0 0 9 11 L10 10 L13 11 L13 13 A1 1 0 0 1 12 14 A11 11 0 0 1 2 4 A1 1 0 0 1 3 3 Z"/>
            </svg>
          </button>
        ) : null}
        <div style={{
          width: 64, height: 64,
          clipPath: 'var(--avatar-clip)',
          background: 'var(--navy)',
          display: 'grid', placeItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-chrome)', fontWeight: 700, color: 'var(--gold)', fontSize: 22 }}>
            {initials(displayName)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PinButton contactId={contactId} />
          <div style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 18,
            color: contact?.do_not_contact ? 'var(--ms-3)' : 'var(--text)',
            textDecoration: contact?.do_not_contact ? 'line-through' : 'none',
          }}>{displayName}</div>
          {contact?.do_not_contact ? (
            <span className="mono" title="Do not contact" style={{
              fontSize: 9, padding: '2px 6px', letterSpacing: '.08em',
              color: '#fff', background: 'var(--ms-3)',
            }}>DNC</span>
          ) : null}
        </div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          {displayPhone ? (
            mobile ? (
              <a href={`tel:${contact?.phone || ''}`}
                title="Call via phone"
                style={{
                  color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 'inherit',
                  textDecoration: 'none', borderBottom: '1px dashed rgba(0,0,0,.2)',
                }}>{displayPhone}</a>
            ) : (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contact?.phone || '')
                    .then(() => window.__bpp_toast && window.__bpp_toast(`Phone copied — ${displayPhone}`, 'success'))
                    .catch(() => {});
                }}
                title="Copy phone"
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 'inherit',
                  cursor: 'pointer',
                }}
              >{displayPhone}</button>
            )
          ) : <span>—</span>}
          <br/>
          {contact?.address ? (
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(contact.address)}`}
              target="_blank" rel="noopener"
              title="Open in Google Maps"
              style={{
                color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 'inherit',
                textDecoration: 'none', borderBottom: '1px dashed rgba(0,0,0,.2)',
              }}
            >{contact.address}</a>
          ) : <span>—</span>}
          {contact?.email ? (
            <>
              <br/>
              <a
                href={`mailto:${contact.email}`}
                title="Email contact"
                style={{
                  color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 'inherit',
                  textDecoration: 'none', borderBottom: '1px dashed rgba(0,0,0,.2)',
                }}
              >{contact.email}</a>
            </>
          ) : null}
        </div>
        {messages.length > 0 ? (() => {
          const latest = messages[messages.length - 1];
          const latestTime = latest?.created_at ? new Date(latest.created_at) : null;
          if (!latestTime) return null;
          const mins = Math.floor((Date.now() - latestTime.getTime()) / 60000);
          const ago = mins < 60
            ? `${mins}m ago`
            : mins < 1440
              ? `${Math.floor(mins / 60)}h ago`
              : `${Math.floor(mins / 1440)}d ago`;
          return (
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
              Last activity · {ago}
            </div>
          );
        })() : null}
        {/* Install date pill — surfaces the scheduled install directly in
            the header so Key never has to open the edit tab to know when
            he's coming out. Colour shifts as it approaches: red=past-due,
            gold=today/tomorrow, navy=<=7d, muted otherwise. */}
        {contact?.install_date ? (() => {
          const inst = new Date(contact.install_date);
          if (isNaN(inst.getTime())) return null;
          const diffDays = Math.round((inst.getTime() - Date.now()) / 86400000);
          let color = 'var(--text-faint)';
          if (diffDays < 0) color = 'var(--ms-3)';
          else if (diffDays <= 1) color = 'var(--gold)';
          else if (diffDays <= 7) color = 'var(--navy)';
          const dateLabel = inst.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const timeLabel = inst.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          return (
            <div className="mono" title={`Install ${diffDays === 0 ? 'today' : diffDays < 0 ? `${Math.abs(diffDays)}d past-due` : `in ${diffDays}d`}`} style={{
              fontSize: 10, color, letterSpacing: '.04em', fontWeight: 600,
              padding: '3px 8px', marginTop: 4, boxShadow: 'var(--raised-2)',
              background: 'var(--card)', whiteSpace: 'nowrap',
            }}>
              Install · {dateLabel} · {timeLabel}
            </div>
          );
        })() : null}
      </div>

      {/* Stage strip (click to open picker) + install-brief trigger */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => setStagePickerOpen(true)}
          style={{
            height: 36, padding: '0 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flex: 1, cursor: 'pointer',
            background: 'var(--card)', boxShadow: 'var(--raised-2)',
            border: 0, textAlign: 'left',
          }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text)' }}>{stageAbbr}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>stage {contact?.stage || 1} ›</span>
        </button>
        {/* Brief — one-page view of everything Key needs on install day.
            Hidden on stages < 3 (no install scheduled yet = nothing to brief). */}
        {(contact?.stage || 1) >= 3 ? (
          <button
            onClick={() => setBriefOpen(true)}
            title="Install brief (B)"
            style={{
              height: 36, padding: '0 14px',
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', background: 'var(--navy)', color: 'var(--gold)',
              boxShadow: 'var(--raised-2)', border: 0,
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em',
            }}>
            BRIEF
          </button>
        ) : null}
      </div>

      {outstandingBalance > 0 ? (
        <button
          onClick={() => { window.location.hash = '#tab=finance'; }}
          title="Open Finance → Invoices"
          style={{
            padding: '8px 14px',
            background: 'var(--card)',
            borderBottom: '2px solid var(--ms-3)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: 'var(--font-body)', fontSize: 12,
            width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}>
          <span style={{ color: 'var(--text-muted)' }}>Outstanding</span>
          <span style={{ color: 'var(--ms-3)', fontWeight: 700 }}>${outstandingBalance.toLocaleString()}</span>
        </button>
      ) : null}

      {alexSession ? (
        <AlexSessionStrip session={alexSession} contactId={contactId} contactPhone={contact?.phone} />
      ) : null}

      {contact?.phone ? (
        <LeadProfileStrip contactPhone={contact.phone} />
      ) : null}

      {contact ? (
        <NextActionCard
          contact={contact}
          messages={messages}
          alexSession={alexSession}
        />
      ) : null}

      {duplicates.length > 0 ? (
        <DuplicateStrip duplicates={duplicates} />
      ) : null}

      {/* Post-install review-ask prompt. Stage 9 means the install is done;
          this is the right moment to ask for a Google review (peak happy).
          Clicking drafts the SMS into the compose bar; Key reviews + sends. */}
      {contact?.stage === 9 && !contact?.do_not_contact ? (
        <ReviewAskStrip contactName={contact?.name} />
      ) : null}

      <SnoozeRow contactId={contactId} contactName={contact?.name} stage={contact?.stage} />


      {briefOpen ? (
        <InstallBriefModal contact={contact} onClose={() => setBriefOpen(false)} />
      ) : null}

      {stagePickerOpen ? (
        <StagePickerModal
          currentStage={contact?.stage || 1}
          onPick={async newStage => {
            if (newStage !== contact.stage) {
              const oldStage = contact.stage || 1;
              await db.from('contacts').update({ stage: newStage }).eq('id', contactId);
              await db.from('stage_history').insert({
                contact_id: contactId, from_stage: oldStage, to_stage: newStage,
              }).then(() => {}, () => {});
              setContact(c => ({ ...c, stage: newStage }));
              // v1 parity — when an install is marked complete (stage 9) fire
              // quo-ai-review so the customer receives a warm Google review
              // request SMS automatically. The edge function de-dupes via a
              // messages-table g.page ILIKE scan so this is safe to call
              // multiple times.
              if (newStage === 9 && oldStage !== 9 && !contact.do_not_contact) {
                db.functions.invoke('quo-ai-review', { body: { contactId } })
                  .then(({ error }) => {
                    if (error) console.warn('[review] auto-fire failed', error);
                    else window.__bpp_toast && window.__bpp_toast('Review ask sent to customer', 'success');
                  })
                  .catch(err => console.warn('[review] auto-fire error', err));
              }
            }
            setStagePickerOpen(false);
          }}
          onClose={() => setStagePickerOpen(false)}
        />
      ) : null}

      {/* Detail tabs live in the right-side action bar (RightTabBar) above
          the panel now — no duplicate row inside. Mobile and desktop share
          the pattern (Key 2026-04-21: mobile is the same serialized — left
          view by default, click into right view with a back button). */}

      {/* Smart Contact Detail: next-best-action hint. One-line prompt at
          the top of the panel that Sparky-style suggests the single most
          useful action Key should take with this contact right now. Reads
          the same signals the Smart List uses (waiting, stuck quote,
          install imminent, etc.) + the Alex session state. */}
      {!loading && contact ? (
        <SmartNextActionHint
          contact={contact}
          messages={messages}
          outstandingBalance={outstandingBalance}
          onJumpTab={(t) => { setDetailTab(t); setManualTabContactId(contactId); window.dispatchEvent(new CustomEvent('bpp:detail-tab-changed', { detail: { tab: t } })); }}
          onOpenQuickQuote={() => window.dispatchEvent(new CustomEvent('bpp:open-quick-quote'))}
        />
      ) : null}

      {/* Tab content */}
      {detailTab === 'MESSAGES' ? (
      <div ref={msgScrollRef} style={{
        flex: 1, overflowY: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {loading ? (
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0' }}>
            No messages yet
          </div>
        ) : messages.map((m, idx) => {
          const isOut = m.direction === 'outbound';
          // Show timestamp on the first message and on a new day or ≥10m gap.
          const prev = messages[idx - 1];
          const thisTime = m.created_at ? new Date(m.created_at) : null;
          const prevTime = prev?.created_at ? new Date(prev.created_at) : null;
          const sameDay = prev && thisTime && prevTime && thisTime.toDateString() === prevTime.toDateString();
          const gapOk = prev && thisTime && prevTime && (thisTime - prevTime) < 10 * 60 * 1000;
          const showTs = !prev || !sameDay || !gapOk;
          return (
            <React.Fragment key={m.id}>
              {showTs && thisTime ? (
                <div className="mono" style={{
                  alignSelf: 'center', fontSize: 10, color: 'var(--text-faint)',
                  margin: '6px 0 2px', letterSpacing: '.04em',
                }}>
                  {sameDay
                    ? thisTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    : thisTime.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              ) : null}
            <div
              onDoubleClick={() => {
                if (m.body) navigator.clipboard.writeText(m.body)
                  .then(() => window.__bpp_toast && window.__bpp_toast('Message copied', 'success'))
                  .catch(() => {});
              }}
              title="Double-click to copy"
              style={{
                alignSelf: isOut ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
                padding: '10px 14px',
                background: isOut ? 'var(--navy)' : 'var(--card)',
                color: isOut ? '#fff' : 'var(--text)',
                boxShadow: 'var(--raised-2)',
                fontSize: 15, lineHeight: 1.4,
                position: 'relative',
                cursor: 'pointer',
              }}>
              {isOut && m.sender === 'ai' ? (
                <span style={{
                  position: 'absolute', left: -6, top: -6,
                  padding: '0 4px',
                  background: 'var(--card)',
                  color: 'var(--text-faint)',
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em',
                  border: '1px solid rgba(0,0,0,.15)',
                }}>alex</span>
              ) : null}
              <MessageBody body={m.body} isOut={isOut} />
              {m.recording_url ? (
                <audio
                  controls
                  src={m.recording_url}
                  preload="none"
                  style={{ display: 'block', marginTop: 6, width: '100%', height: 32 }}
                />
              ) : null}
              {m.duration_seconds ? (
                <div className="mono" style={{ fontSize: 10, color: isOut ? 'rgba(255,255,255,.65)' : 'var(--text-faint)', marginTop: 4 }}>
                  {Math.floor(m.duration_seconds / 60)}:{String(m.duration_seconds % 60).padStart(2, '0')} call
                </div>
              ) : null}
              {/* Delivery status on outbound SMS. Twilio's status-callback
                  updates this column from 'sent' → 'delivered' (successfully
                  reached the handset) or 'failed'/'undelivered' (carrier
                  blocked, number bad, or recipient opted out). Before the
                  JWT-disable fix on twilio-status-callback, this column was
                  permanently stuck at 'sent' — Key had no visibility when a
                  text failed. Now failed shows red so he sees it at a glance. */}
              {isOut && (m.status === 'failed' || m.status === 'undelivered') ? (
                <div className="mono" style={{
                  fontSize: 9, marginTop: 4, letterSpacing: '.08em',
                  color: 'var(--ms-3)', textTransform: 'uppercase',
                }}>⚠ Not delivered</div>
              ) : null}
              {isOut && m.status === 'delivered' ? (
                <div className="mono" style={{
                  fontSize: 9, marginTop: 4, letterSpacing: '.06em',
                  color: 'rgba(255,255,255,.45)', textTransform: 'lowercase',
                }}>delivered</div>
              ) : null}
            </div>
            </React.Fragment>
          );
        })}
      </div>
      ) : null}

      {detailTab === 'TIMELINE' ? <DetailTimeline contactId={contactId} /> : null}
      {detailTab === 'QUOTE' ? <DetailQuote contactId={contactId} openTrigger={quickQuoteTrigger} /> : null}
      {detailTab === 'PERMITS' ? <DetailPermits contact={contact} /> : null}
      {detailTab === 'PHOTOS' ? <DetailPhotos contactId={contactId} contactPhone={contact?.phone} /> : null}
      {detailTab === 'NOTES' ? <DetailNotes contact={contact} onUpdate={(notes) => setContact(c => ({ ...c, install_notes: notes }))} /> : null}
      {detailTab === 'EDIT' ? <DetailEditContact contact={contact} onUpdate={(patch) => setContact(c => ({ ...c, ...patch }))} /> : null}

      {/* Compose — only show on MESSAGES tab */}
      {detailTab === 'MESSAGES' ? (
        <ComposeBar contactId={contactId} contactName={contact?.name} contactPhone={contact?.phone} installDate={contact?.install_date} latestInbound={(() => { for (let i = messages.length - 1; i >= 0; i--) { const m = messages[i]; if (m.direction === 'inbound' && m.sender !== 'ai') return m.body || ''; } return ''; })()} disabled={!!contact?.do_not_contact} />
      ) : null}
    </div>
  );
}

function DetailTimeline({ contactId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      // Collect every event type for this contact, merge by timestamp.
      const [stageRes, propRes, invRes, msgRes, payRes] = await Promise.all([
        db.from('stage_history').select('id, from_stage, to_stage, changed_at').eq('contact_id', contactId).order('changed_at', { ascending: false }).limit(50),
        db.from('proposals').select('id, total, status, created_at, signed_at, viewed_at').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(20),
        db.from('invoices').select('id, total, status, created_at, paid_at').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(20),
        db.from('messages').select('id, direction, body, sender, created_at').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(30),
        db.from('payments').select('id, amount, method, created_at').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(10),
      ]);

      const items = [];
      for (const s of (stageRes.data || [])) items.push({
        id: `s-${s.id}`, at: s.changed_at, kind: 'stage',
        label: `Stage ${s.from_stage ?? '—'} → ${s.to_stage ?? '—'} (${STAGE_MAP[s.to_stage] || '—'})`,
      });
      for (const p of (propRes.data || [])) {
        items.push({ id: `pc-${p.id}`, at: p.created_at, kind: 'proposal', label: `Proposal created · $${Number(p.total||0).toLocaleString()}` });
        if (p.viewed_at) items.push({ id: `pv-${p.id}`, at: p.viewed_at, kind: 'proposal', label: `Proposal viewed by customer` });
        if (p.signed_at) items.push({ id: `ps-${p.id}`, at: p.signed_at, kind: 'proposal', label: `Proposal approved` });
      }
      for (const i of (invRes.data || [])) {
        items.push({ id: `ic-${i.id}`, at: i.created_at, kind: 'invoice', label: `Invoice · $${Number(i.total||0).toLocaleString()}` });
        if (i.paid_at) items.push({ id: `ip-${i.id}`, at: i.paid_at, kind: 'invoice', label: `Invoice paid · $${Number(i.total||0).toLocaleString()}` });
      }
      for (const m of (msgRes.data || [])) {
        const who = m.sender === 'ai' ? 'Alex' : (m.direction === 'inbound' ? 'Customer' : 'Key');
        const preview = (m.body || '').slice(0, 80);
        items.push({ id: `m-${m.id}`, at: m.created_at, kind: 'msg', label: `${who}: ${preview}` });
      }
      for (const p of (payRes.data || [])) {
        items.push({ id: `py-${p.id}`, at: p.created_at, kind: 'payment', label: `Payment · $${Number(p.amount||0).toLocaleString()} · ${p.method || '—'}` });
      }

      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setEvents(items.slice(0, 80));
      setLoading(false);
    })();
  }, [contactId]);

  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>;
  if (events.length === 0) return <Empty label="No activity yet" />;

  // Group by day for readability
  const groups = [];
  let currentDay = null;
  for (const e of events) {
    const day = e.at ? new Date(e.at).toDateString() : 'Unknown';
    if (day !== currentDay) { groups.push({ day, items: [] }); currentDay = day; }
    groups[groups.length - 1].items.push(e);
  }
  const kindTint = {
    stage: 'var(--ms-1)', proposal: 'var(--ms-4)', invoice: 'var(--ms-3)',
    msg: 'var(--text-muted)', payment: 'var(--ms-2)',
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 18 }}>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '.08em',
            color: 'var(--text-faint)', textTransform: 'uppercase',
            paddingBottom: 4, marginBottom: 4,
            borderBottom: '1px solid rgba(0,0,0,.06)',
          }}>{g.day}</div>
          {g.items.map(e => (
            <div key={e.id} style={{
              display: 'grid', gridTemplateColumns: '70px 1fr',
              gap: 12, padding: '6px 0',
            }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                {e.at ? new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'start', gap: 6 }}>
                <span style={{ width: 6, height: 6, marginTop: 6, background: kindTint[e.kind] || 'var(--text-faint)', flex: '0 0 auto' }} />
                {e.label}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const PROPOSAL_BASE_URL = 'https://backuppowerpro.com/proposal.html';
const INVOICE_BASE_URL  = 'https://backuppowerpro.com/invoice.html';

// ── Quick Quote pricing engine ──────────────────────────────────────────────
// Mirrors the legacy QB_S/QB_C constants in crm/crm.html. Kept in sync by
// convention: whenever those constants change, update these too.
const QB_C_V2 = {
  inlet30: 55, inlet50: 85, interlock: 25,
  permitActual: 75, permitCustomer: 125, licenseAmortized: 25,
  mainBreaker: 125, twinQuad: 35, surgeProtector: 85,
  cord30Cost: 60, cord50Cost: 125,
  adCost: 150, minProfit: 500,
};
const QB_S_V2 = {
  base30: 1197, base50: 1497,
  longRun30perFt: 12, longRun50perFt: 14,
  mainBreaker: 224, twinQuad: 129, surge: 375, pom: 447,
  cordValue30: 129, cordValue50: 198,
  permitCustomer: 125, // charged as a line item when include_permit=true
};

// Compute total price + line-items for a single amp variant, matching the
// legacy pBuildPricing output shape that proposal.html expects.
function quickQuoteCompute({ amp, runFt, cordIncluded, includeSurge, includePom, includePermit }) {
  const is50 = amp === '50';
  const extraFt = Math.max(0, (Number(runFt) || 5) - 5);
  const baseCordCost = is50 ? QB_C_V2.cord50Cost : QB_C_V2.cord30Cost;
  const cordValue = is50 ? QB_S_V2.cordValue50 : QB_S_V2.cordValue30;
  const yourSupplies =
    (is50 ? QB_C_V2.inlet50 : QB_C_V2.inlet30) + QB_C_V2.interlock + QB_C_V2.permitActual + QB_C_V2.licenseAmortized +
    (cordIncluded ? baseCordCost : 0) +
    (includeSurge ? QB_C_V2.surgeProtector : 0);
  const totalCost = yourSupplies + QB_C_V2.adCost;
  const longRunSell = extraFt * (is50 ? QB_S_V2.longRun50perFt : QB_S_V2.longRun30perFt);
  const cordDiscount = cordIncluded ? 0 : cordValue;
  const addonSell = (includeSurge ? QB_S_V2.surge : 0) + (includePom ? QB_S_V2.pom : 0) + (includePermit ? QB_S_V2.permitCustomer : 0);
  const standardSell = (is50 ? QB_S_V2.base50 : QB_S_V2.base30) + longRunSell + addonSell - cordDiscount;
  let totalSell = Math.round(Math.max(standardSell, totalCost + QB_C_V2.minProfit));
  if (totalSell % 2 === 0) totalSell += 1;
  return {
    total: totalSell,
    base: (is50 ? QB_S_V2.base50 : QB_S_V2.base30) + longRunSell,
    cord: cordIncluded ? 0 : cordValue, // discount shown if cord not bundled
    cordIncluded,
    mainBreaker: 0, twinQuad: 0,
    surge: includeSurge ? QB_S_V2.surge : 0,
    pom: includePom ? QB_S_V2.pom : 0,
    permit: includePermit ? QB_S_V2.permitCustomer : 0,
    longRun: longRunSell,
    permitInspection: 0,
    extraFt,
    items: [], // proposal.html tolerates empty
  };
}

// Build a proposals row payload matching the legacy schema so proposal.html
// renders correctly. pricing_30 + pricing_50 are both computed so the
// customer's amp toggle on the proposal page still works.
function quickQuoteBuildPayload({ contact, state }) {
  const pricing30 = quickQuoteCompute({ ...state, amp: '30' });
  const pricing50 = quickQuoteCompute({ ...state, amp: '50' });
  const primary = state.amp === '50' ? pricing50 : pricing30;
  return {
    contact_id: contact.id,
    contact_name: contact.name || '',
    contact_email: contact.email || '',
    contact_phone: contact.phone || '',
    contact_address: contact.address || '',
    amp_type: state.amp,
    selected_amp: state.amp,
    run_ft: Number(state.runFt) || 5,
    mode: 'standard',
    include_cord: !!state.cordIncluded,
    cord_included: !!state.cordIncluded,
    price_cord: state.cordIncluded ? 0 : (state.amp === '50' ? QB_S_V2.cordValue50 : QB_S_V2.cordValue30),
    include_surge: !!state.includeSurge,
    price_surge: state.includeSurge ? QB_S_V2.surge : 0,
    surge_price: QB_S_V2.surge,
    include_pom: !!state.includePom,
    pom_price: QB_S_V2.pom,
    include_permit: !!state.includePermit,
    include_main_breaker: false,
    include_twin_quad: false,
    pricing_30: pricing30,
    pricing_50: pricing50,
    total: primary.total,
    price_base: primary.total,
    notes: (state.notes || '').trim(),
    custom_items: [],
    status: 'Created',
    require_deposit: true,
  };
}

function DetailQuote({ contactId, openTrigger = 0 }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickOpen, setQuickOpen] = useState(false);
  const [contact, setContact] = useState(null);
  // Each bump of openTrigger means the global `Q` shortcut fired. Skip
  // the initial 0 so the modal doesn't auto-open when the tab mounts.
  useEffect(() => {
    if (openTrigger > 0) setQuickOpen(true);
  }, [openTrigger]);

  useEffect(() => {
    (async () => {
      const [{ data: props }, { data: c }] = await Promise.all([
        db.from('proposals').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }),
        db.from('contacts').select('id, name, email, phone, address').eq('id', contactId).maybeSingle(),
      ]);
      setProposals(props || []);
      setContact(c);
      setLoading(false);
    })();
  }, [contactId]);

  // Realtime — proposal.view_count bumps when the customer opens the quote
  // page; stripe-webhook flips status to Approved when deposit lands. Both
  // should reflect in this tab live, especially if Key is watching while
  // the customer is actively looking at their quote.
  useEffect(() => {
    if (!contactId) return;
    const ch = db.channel(`quote-${contactId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals', filter: `contact_id=eq.${contactId}` }, async () => {
        const { data: props } = await db.from('proposals').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
        setProposals(props || []);
      })
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [contactId]);

  function copyLink(token) {
    const url = `${PROPOSAL_BASE_URL}?token=${token}`;
    navigator.clipboard.writeText(url)
      .then(() => window.__bpp_toast && window.__bpp_toast('Proposal link copied', 'success'))
      .catch(() => window.__bpp_toast && window.__bpp_toast('Copy failed — select + ⌘C manually', 'error'));
    // v1 parity: flip Created → Copied so the "stuck quote" briefing section
    // (app.jsx:4056) can distinguish "I sent it" from "I just drafted it"
    // 48 h old and still Created = never left Key's laptop.
    setProposals(prev => prev.map(p => p.token === token && p.status === 'Created'
      ? { ...p, status: 'Copied', copied_at: new Date().toISOString() }
      : p));
    db.from('proposals').update({ status: 'Copied', copied_at: new Date().toISOString() })
      .eq('token', token).eq('status', 'Created').then(() => {}, () => {});
  }

  // v1 parity: copyInvoiceLink — generates an unpaid invoice row (or reuses
  // the existing one for this contact) and copies /invoice.html?token=... .
  // Matches crm.html:5920-5947. Used when Key wants to send an invoice link
  // for the REMAINING balance or for a cash/check pay-at-install scenario.
  async function copyInvoiceLink(proposal) {
    try {
      const total = Number(proposal.total) || 0;
      // Check for an existing live invoice on this contact first.
      const existing = await db.from('invoices')
        .select('token, status, total')
        .eq('contact_id', contactId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1);
      let token = existing.data?.[0]?.token;
      if (!token) {
        const lineItems = [{
          name: `Storm-Ready Connection System (${proposal.selected_amp || '30'}A)`,
          amount: total,
        }];
        if (proposal.include_surge && !proposal.selected_surge) lineItems.push({ name: 'Whole-Home Surge Protector', amount: 375 });
        const { data, error } = await db.from('invoices').insert([{
          contact_id: contactId,
          proposal_id: proposal.id,
          contact_name: contact?.name || '',
          contact_email: contact?.email || '',
          contact_phone: contact?.phone || '',
          contact_address: contact?.address || '',
          line_items: lineItems,
          total: total,
          status: 'unpaid',
        }]).select('token').single();
        if (error) throw error;
        token = data.token;
      }
      const url = `${INVOICE_BASE_URL}?token=${token}`;
      await navigator.clipboard.writeText(url);
      window.__bpp_toast && window.__bpp_toast('Invoice link copied', 'success');
    } catch (e) {
      window.__bpp_toast && window.__bpp_toast(`Invoice link failed: ${e.message || e}`, 'error');
    }
  }

  // v1 parity: copyReceiptLink — for Approved proposals, grab the existing
  // paid invoice's /invoice.html token which renders receipt mode, copy to
  // clipboard. Lets Key re-send a receipt when a customer asks "do you have
  // a copy of my payment" without rummaging through Stripe.
  async function copyReceiptLink(proposal) {
    try {
      const { data: inv } = await db.from('invoices')
        .select('token, status')
        .eq('proposal_id', proposal.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!inv || !inv.token) {
        window.__bpp_toast && window.__bpp_toast('No invoice on this proposal yet', 'error');
        return;
      }
      const url = `${INVOICE_BASE_URL}?token=${inv.token}`;
      await navigator.clipboard.writeText(url);
      window.__bpp_toast && window.__bpp_toast(
        inv.status === 'paid' ? 'Receipt link copied' : 'Invoice link copied',
        'success'
      );
    } catch (e) {
      window.__bpp_toast && window.__bpp_toast(`Receipt link failed: ${e.message || e}`, 'error');
    }
  }

  // v1 parity: markPaidOffline — when the customer pays cash/check at the
  // install, Key needs to record the payment, flip the invoice to paid, and
  // fire the auto review text. Mirrors crm.html:5850-5870 markProposalComplete.
  async function markPaidOffline(proposal) {
    const method = window.prompt('Payment method? (Cash / Check / Other)', 'Cash');
    if (!method) return;
    const total = Number(proposal.total) || 0;
    try {
      // Upsert invoice row so we always have a "paid" record for stage-9 books.
      let invoiceId = null;
      const { data: existing } = await db.from('invoices')
        .select('id, status').eq('proposal_id', proposal.id).limit(1);
      if (existing && existing.length) {
        invoiceId = existing[0].id;
        await db.from('invoices').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: method,
        }).eq('id', invoiceId);
      } else {
        const lineItems = [{
          name: `Storm-Ready Connection System (${proposal.selected_amp || '30'}A)`,
          amount: total,
        }];
        const { data: inv } = await db.from('invoices').insert([{
          contact_id: contactId,
          proposal_id: proposal.id,
          contact_name: contact?.name || '',
          contact_email: contact?.email || '',
          contact_phone: contact?.phone || '',
          contact_address: contact?.address || '',
          line_items: lineItems,
          total: total,
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: method,
        }]).select('id').single();
        invoiceId = inv?.id;
      }
      // Record in payments table (matches v1 + stripe-webhook row shape).
      await db.from('payments').insert([{
        contact_id: contactId,
        amount: total,
        method: method,
        status: 'completed',
      }]);
      // Approve the proposal so briefing + timeline line up.
      await db.from('proposals').update({ status: 'Approved', is_locked: true })
        .eq('id', proposal.id).neq('status', 'Approved');
      // Optimistic UI bump.
      setProposals(prev => prev.map(p => p.id === proposal.id
        ? { ...p, status: 'Approved' } : p));
      window.__bpp_toast && window.__bpp_toast(`Marked paid · ${method} · $${total.toLocaleString()}`, 'success');
    } catch (e) {
      window.__bpp_toast && window.__bpp_toast(`Mark paid failed: ${e.message || e}`, 'error');
    }
  }

  function sendReminder(proposal) {
    const first = (contact?.name || '').split(' ')[0] || 'there';
    const total = Number(proposal.total) || 0;
    const deposit = Math.round(total * 0.5);
    const link = `${PROPOSAL_BASE_URL}?token=${proposal.token}`;
    const msg = `Hi ${first}, just sending the quote back — $${total.toLocaleString()} all in, 50% deposit ($${deposit.toLocaleString()}) to lock it in: ${link}`;
    // Broadcast to the compose bar input
    window.dispatchEvent(new CustomEvent('bpp:compose-prefill', { detail: { text: msg } }));
    window.__bpp_toast && window.__bpp_toast('Reminder drafted — review + send', 'info');
  }

  async function depositLink(proposal) {
    if (!proposal.token) return;
    window.__bpp_toast && window.__bpp_toast('Creating deposit checkout…', 'info');
    try {
      const { data, error } = await db.functions.invoke('proposal-deposit-checkout', {
        body: { proposal_token: proposal.token, pay_full: false },
      });
      if (error) throw error;
      const url = data?.url || data?.checkout_url;
      if (!url) throw new Error('no checkout url returned');
      await navigator.clipboard.writeText(url);
      const first = (contact?.name || '').split(' ')[0] || 'there';
      const deposit = Math.round((Number(proposal.total) || 0) * 0.5);
      const msg = `Hi ${first}, here's the deposit link to lock in your install slot — $${deposit.toLocaleString()}: ${url}`;
      window.dispatchEvent(new CustomEvent('bpp:compose-prefill', { detail: { text: msg } }));
      window.__bpp_toast && window.__bpp_toast('Deposit link copied + SMS drafted', 'success');
    } catch (e) {
      window.__bpp_toast && window.__bpp_toast(`Deposit link failed: ${e.message || e}`, 'error');
    }
  }

  async function onQuoteCreated(newProposal) {
    setProposals(prev => [newProposal, ...prev]);
    setQuickOpen(false);
    // Build the SMS body, prefill compose bar, also copy to clipboard as a
    // fallback for workflows outside the CRM (desktop Messages.app, etc.)
    const fname = (contact?.name || '').split(' ')[0] || 'there';
    const totalAmt = newProposal.total;
    const depositAmt = Math.round(totalAmt * 0.5);
    const link = `${PROPOSAL_BASE_URL}?token=${newProposal.token}`;
    const msg = `Hi ${fname}! Here's your quote for the Storm-Ready Connection System — $${totalAmt.toLocaleString()} all in. A 50% deposit ($${depositAmt.toLocaleString()}) is due to confirm your spot. Review & approve here: ${link}`;
    // Prefill the compose bar so Key can review + send in one click instead
    // of pasting from clipboard. Same event depositLink / sendReminder use.
    window.dispatchEvent(new CustomEvent('bpp:compose-prefill', { detail: { text: msg } }));
    try { await navigator.clipboard.writeText(msg); } catch { /* ignore */ }
    window.__bpp_toast && window.__bpp_toast(`Quote created — SMS drafted, $${totalAmt.toLocaleString()}`, 'success');
    // Bump stage to 2 (QUOTED) if still on NEW
    db.from('contacts').update({ stage: 2, quote_amount: totalAmt }).eq('id', contactId)
      .then(() => db.from('stage_history').insert({ contact_id: contactId, from_stage: 1, to_stage: 2 }).then(() => {}, () => {}));
  }

  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <button onClick={() => setQuickOpen(true)} style={{
        width: '100%', height: 40, marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--navy)', color: 'var(--gold)',
        boxShadow: 'var(--raised-2)', cursor: 'pointer',
        border: 'none', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '.04em',
      }}>
        New quote
      </button>
      {quickOpen && contact && (
        <QuickQuoteModal contact={contact} onClose={() => setQuickOpen(false)} onCreated={onQuoteCreated} />
      )}

      {proposals.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)' }}>
          No proposals yet
        </div>
      ) : proposals.map(p => {
        // Status taxonomy in the proposals table:
        //   Created / Copied → live draft, deposit button visible
        //   Approved          → stripe webhook confirmed deposit, show PAID badge
        //   Cancelled         → proposal is dead, no deposit CTA
        const isPaid     = p.status === 'Approved';
        const isCancelled = p.status === 'Cancelled';
        return (
        <div key={p.id} style={{
          padding: '14px 0',
          borderTop: '1px solid rgba(0,0,0,.08)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700 }}>
                  ${(Number(p.total) || 0).toLocaleString()}
                </span>
                {isPaid ? (
                  <span className="mono" style={{
                    fontSize: 10, color: 'var(--ms-2)', letterSpacing: '.08em',
                    padding: '2px 6px', boxShadow: 'var(--raised-2)', textTransform: 'uppercase',
                  }}>✓ Paid</span>
                ) : (
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'lowercase' }}>
                    {p.status || 'sent'}
                  </span>
                )}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                {p.view_count ? ` · ${p.view_count} view${p.view_count === 1 ? '' : 's'}` : ''}
              </div>
            </div>
            {p.token ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <a href={`${PROPOSAL_BASE_URL}?token=${p.token}&preview=1`} target="_blank" rel="noopener"
                   title="Preview without counting as a customer view" style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'var(--font-body)',
                  boxShadow: 'var(--raised-2)', textDecoration: 'none',
                  color: 'var(--text-muted)',
                }}>View</a>
                <button onClick={() => copyLink(p.token)} style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'var(--font-body)',
                  boxShadow: 'var(--raised-2)', cursor: 'pointer',
                  border: 'none', background: 'var(--card)', color: 'var(--text-muted)',
                }}>Copy</button>
                <button onClick={() => sendReminder(p)} style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'var(--font-body)',
                  boxShadow: 'var(--raised-2)', cursor: 'pointer',
                  border: 'none', background: 'var(--card)', color: 'var(--text-muted)',
                }}>Remind</button>
              </div>
            ) : null}
          </div>
          {/* Primary action when the deposit is still owed. Full-width so it's
              the obvious next move when Key opens a proposal the customer
              approved verbally but hasn't paid yet. Hidden for Approved
              (already paid) and Cancelled (dead) proposals. */}
          {p.token && !isPaid && !isCancelled ? (
            <button onClick={() => depositLink(p)} style={{
              width: '100%', height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'var(--ms-2)', color: '#fff',
              boxShadow: 'var(--raised-2)', cursor: 'pointer',
              border: 'none', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '.04em',
            }}>
              Send deposit link — ${Math.round((Number(p.total) || 0) * 0.5).toLocaleString()}
            </button>
          ) : null}
          {/* Secondary row — v1 parity. Invoice link (for remaining-balance or
              cash-pay scenarios) + offline "Mark paid" for when a customer
              hands Key a check at install. Hidden once the proposal is
              Approved (Stripe already handled it) or Cancelled. */}
          {p.token && !isPaid && !isCancelled ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => copyInvoiceLink(p)} style={{
                flex: 1, height: 30, fontSize: 11, fontFamily: 'var(--font-body)',
                boxShadow: 'var(--raised-2)', cursor: 'pointer',
                border: 'none', background: 'var(--card)', color: 'var(--text-muted)',
              }} title="Generate /invoice.html link for this contact">Copy invoice</button>
              <button onClick={() => markPaidOffline(p)} style={{
                flex: 1, height: 30, fontSize: 11, fontFamily: 'var(--font-body)',
                boxShadow: 'var(--raised-2)', cursor: 'pointer',
                border: 'none', background: 'var(--card)', color: 'var(--text-muted)',
              }} title="Record cash/check payment + approve this proposal">Mark paid (offline)</button>
            </div>
          ) : null}
          {/* Approved proposals — surface a "Copy receipt" so Key can
              re-send the paid-invoice link when a customer asks for their
              payment confirmation. */}
          {p.token && isPaid ? (
            <button onClick={() => copyReceiptLink(p)} style={{
              height: 30, fontSize: 11, fontFamily: 'var(--font-body)',
              boxShadow: 'var(--raised-2)', cursor: 'pointer',
              border: 'none', background: 'var(--card)', color: 'var(--text-muted)',
            }} title="Copy /invoice.html link in receipt mode">Copy receipt</button>
          ) : null}
        </div>
        );
      })}
    </div>
  );
}

// ── Quick Quote Modal ──────────────────────────────────────────────────────
// Minimal — just a total that updates as you toggle. No section labels, no
// sub-prices on chips, no cross-amp preview. Complex quotes go to legacy.
// Smart Quote hint — static percentile bucket today (quick heuristic over
// BPP's known base-offer window), swappable to a real percentile pulled
// from prior proposals of the same amp + cord-length later.
function SmartQuoteHint({ total, state }) {
  if (!total || total <= 0) return null;
  const BASE_LOW = 1197;
  const BASE_HIGH = 1497;
  let tone = 'muted', label = '', body = '';
  if (total < BASE_LOW - 50) {
    tone = 'red'; label = 'BELOW MARGIN';
    body = `Below the $${BASE_LOW.toLocaleString()} floor — confirm scope, margin may be too thin.`;
  } else if (total >= BASE_LOW - 50 && total <= BASE_HIGH + 50) {
    tone = 'green'; label = 'IN RANGE';
    body = `Sits inside the $${BASE_LOW}–$${BASE_HIGH} base-offer window.`;
  } else if (total <= BASE_HIGH + 400) {
    tone = 'gold'; label = 'CUSTOM';
    body = `Above base offer — price-anchor the $15K standby before sending.`;
  } else {
    tone = 'gold'; label = 'HIGH TICKET';
    body = `High ticket. Consider splitting with a deposit + remainder invoice.`;
  }
  return (
    <div className="smart-hint" style={{ padding: '8px 12px' }}>
      <span className={`smart-chip smart-chip--${tone}`}>{label}</span>
      <span className="smart-hint__body" style={{ fontSize: 11, color: '#fff' }}>{body}</span>
    </div>
  );
}

function QuickQuoteModal({ contact, onClose, onCreated }) {
  const rootRef = useRef(null);
  useFocusTrap(rootRef, true);
  const [state, setState] = useState({
    amp: '30',
    runFt: 5,
    cordIncluded: true,
    includeSurge: false,
    includePom: false,
    includePermit: true,
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const primary = useMemo(() => quickQuoteCompute(state), [state]);

  async function submit() {
    if (busy) return;
    setBusy(true); setErr(null);
    const payload = quickQuoteBuildPayload({ contact, state });
    const { data, error } = await db.from('proposals').insert([payload]).select().single();
    setBusy(false);
    if (error || !data) { setErr(error?.message || 'insert failed'); return; }
    // Bump the contact's stage from NEW (1) to QUOTED (2) so the LIST chip
    // counts, pipeline buckets, and QUOTED filter stay in sync with the
    // proposals table. Only bump if they're still on stage 1 — we don't
    // want to pull a BOOKED/PAID contact back down to QUOTED if Key opens
    // a fresh quote mid-install. Non-blocking (fire-and-forget) since the
    // proposal insert already succeeded and the caller expects a quick
    // return. Record a stage_history entry for the audit trail.
    if (contact?.id && (contact.stage || 1) === 1) {
      Promise.all([
        db.from('contacts').update({ stage: 2 }).eq('id', contact.id).eq('stage', 1),
        db.from('stage_history').insert({ contact_id: contact.id, from_stage: 1, to_stage: 2 }),
      ]).catch(e => console.warn('[quickquote] stage bump failed', e));
    }
    onCreated(data);
  }

  const toggle = k => setState(s => ({ ...s, [k]: !s[k] }));
  const chips = [
    { key: 'cordIncluded', label: 'Cord' },
    { key: 'includeSurge', label: 'Surge' },
    { key: 'includePom',   label: 'POM' },
    { key: 'includePermit',label: 'Permit' },
  ];

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 95,
      background: 'rgba(0,0,0,.45)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div ref={rootRef} onClick={e => e.stopPropagation()} style={{
        width: 380, maxWidth: '100%',
        padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20,
        background: 'var(--card)', boxShadow: 'var(--raised-2)',
      }}>
        {/* Amp — two buttons, no label */}
        <div style={{ display: 'flex', height: 36, boxShadow: 'var(--raised-2)' }}>
          {['30', '50'].map(a => (
            <button key={a} onClick={() => setState(s => ({ ...s, amp: a }))} style={{
              flex: 1, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 600,
              background: state.amp === a ? 'var(--navy)' : 'transparent',
              color: state.amp === a ? 'var(--gold)' : 'var(--text-muted)',
              boxShadow: state.amp === a ? 'var(--pressed-2)' : 'none',
              border: 'none', cursor: 'pointer', letterSpacing: '.04em',
            }}>{a}A</button>
          ))}
        </div>

        {/* Run ft — just the slider + value, no label */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input type="range" min={5} max={50} value={state.runFt} onChange={e => setState(s => ({ ...s, runFt: Number(e.target.value) }))}
            style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 13, minWidth: 40, textAlign: 'right', color: 'var(--text-muted)' }}>{state.runFt}ft</span>
        </div>

        {/* Includes — tiny chips, name only */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chips.map(c => (
            <button key={c.key} onClick={() => toggle(c.key)} style={{
              padding: '6px 12px', fontSize: 12, fontFamily: 'var(--font-body)',
              background: state[c.key] ? 'var(--navy)' : 'transparent',
              color: state[c.key] ? 'var(--gold)' : 'var(--text-muted)',
              boxShadow: state[c.key] ? 'var(--pressed-2)' : 'var(--raised-2)',
              border: 'none', cursor: 'pointer',
            }}>{c.label}</button>
          ))}
        </div>

        {/* Total — big, no LCD chrome, just the number */}
        <div style={{ textAlign: 'center', padding: '6px 0' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 42, fontWeight: 700, letterSpacing: '-.02em' }}>
            ${primary.total.toLocaleString()}
          </div>
        </div>

        {/* Smart Quote price hint — compares this total against the base-
            offer range ($1,197–$1,497) so Key can tell at a glance whether
            the quote is in-range or a custom deal. Future: pull real
            percentile from prior proposals for this amp/length combo. */}
        <SmartQuoteHint total={primary.total} state={state} />

        {err ? <div className="mono" style={{ fontSize: 11, color: 'var(--ms-3)', textAlign: 'center' }}>{err}</div> : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, height: 40, boxShadow: 'var(--raised-2)', cursor: 'pointer',
            background: 'var(--card)', color: 'var(--text-muted)', border: 'none', fontSize: 12,
            fontFamily: 'var(--font-body)', letterSpacing: '.04em',
          }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{
            flex: 2, height: 40, background: busy ? 'var(--text-muted)' : 'var(--navy)', color: '#fff',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
            boxShadow: busy ? 'var(--pressed-2)' : 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
            cursor: busy ? 'wait' : 'pointer', border: 'none',
          }}>{busy ? 'Creating...' : 'Create & Copy SMS'}</button>
        </div>
      </div>
    </div>
  );
}

// Inspection checklist — 20 panel-readiness items Key steps through during
// the physical install. Same schema as v1 (inspections table: contact_id,
// checklist jsonb, status, items_total/completed, notes) so v1 data migrates
// cleanly. One row per contact (upsert by contact_id on first yes/no tap).
const INSPECTION_ITEMS = [
  'Main breaker rating verified',
  'Panel amperage matches service',
  'All breakers properly labeled',
  'No double-tapped breakers',
  'No signs of overheating or scorching',
  'Proper wire gauge for breaker size',
  'Ground bus and neutral bus separated (sub-panels)',
  'Grounding electrode conductor present',
  'Panel cover fits properly',
  'No exposed/damaged wiring',
  'AFCI breakers where required',
  'GFCI protection verified',
  'Working space clearance adequate (30" wide, 36" deep)',
  'Panel accessible (not blocked)',
  'Weatherproof enclosure if outdoor',
  'Bonding jumper present',
  'Wire connections tight',
  'No aluminum wiring concerns',
  'Correct breaker types for panel',
  'Overall panel condition acceptable',
];

function InspectionChecklist({ contactId }) {
  const [checklist, setChecklist] = useState({});
  const [notes, setNotes] = useState('');
  const [inspId, setInspId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const notesDebounceRef = useRef(null);

  // Load existing inspection (if any)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await db.from('inspections')
        .select('id, checklist, notes')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!alive) return;
      const row = data && data[0];
      setChecklist(row?.checklist || {});
      setNotes(row?.notes || '');
      setInspId(row?.id || null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [contactId]);

  // Compute status from answers — same rules v1 uses
  const answered = Object.keys(checklist).length;
  const total = INSPECTION_ITEMS.length;
  const hasNo = Object.values(checklist).includes('no');
  const status = answered === 0 ? 'not_started'
    : answered < total ? 'in_progress'
    : hasNo ? 'failed' : 'passed';
  const statusColor = status === 'passed' ? 'var(--ms-2)'
    : status === 'failed' ? 'var(--ms-3)'
    : status === 'in_progress' ? 'var(--ms-4)'
    : 'var(--text-faint)';

  async function persist(nextChecklist, nextNotes) {
    const payload = {
      contact_id: contactId,
      checklist: nextChecklist,
      notes: nextNotes || null,
      status: (() => {
        const ans = Object.keys(nextChecklist).length;
        if (ans === 0) return 'not_started';
        if (ans < total) return 'in_progress';
        return Object.values(nextChecklist).includes('no') ? 'failed' : 'passed';
      })(),
      items_total: total,
      items_completed: Object.keys(nextChecklist).length,
    };
    setSaving(true);
    if (inspId) {
      await db.from('inspections').update(payload).eq('id', inspId);
    } else {
      const { data } = await db.from('inspections').insert([payload]).select('id').single();
      if (data?.id) setInspId(data.id);
    }
    setSaving(false);
  }

  function toggle(item) {
    const cur = checklist[item];
    // tri-state cycle: unset → yes → no → unset
    const next = { ...checklist };
    if (!cur) next[item] = 'yes';
    else if (cur === 'yes') next[item] = 'no';
    else delete next[item];
    setChecklist(next);
    persist(next, notes);
  }

  function onNotesChange(v) {
    setNotes(v);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => persist(checklist, v), 800);
  }

  if (loading) return <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', padding: 14 }}>Loading inspection…</div>;

  return (
    <div style={{ padding: 14, background: 'var(--card)', boxShadow: 'var(--raised-2)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 12,
      }}>
        <span className="chrome-label" style={{ fontSize: 11, letterSpacing: '.08em', color: 'var(--text-faint)' }}>
          Inspection
        </span>
        <span className="mono" style={{ fontSize: 10, color: statusColor, letterSpacing: '.06em' }}>
          {answered}/{total} · {status.replace('_', ' ')}
          {saving ? ' · saving' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {INSPECTION_ITEMS.map((item, i) => {
          const v = checklist[item];
          const bg = v === 'yes' ? 'var(--ms-2)' : v === 'no' ? 'var(--ms-3)' : 'transparent';
          const fg = v ? '#fff' : 'var(--text)';
          return (
            <button key={i} onClick={() => toggle(item)} style={{
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
              padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-body)',
              background: bg, color: fg, border: 'none', cursor: 'pointer',
              boxShadow: v ? 'var(--pressed-2)' : 'var(--raised-2)',
            }}>
              <span style={{
                width: 18, height: 18, display: 'inline-grid', placeItems: 'center',
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                background: v ? 'rgba(255,255,255,.25)' : 'var(--card)',
                boxShadow: v ? 'none' : 'var(--pressed-2)',
                flex: '0 0 auto',
              }}>{v === 'yes' ? '✓' : v === 'no' ? '✗' : ''}</span>
              <span style={{ flex: 1 }}>{item}</span>
            </button>
          );
        })}
      </div>
      <textarea
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
        placeholder="Inspection notes (auto-saves)…"
        style={{
          width: '100%', minHeight: 60, marginTop: 12, padding: 10,
          fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.4,
          background: 'var(--card)', resize: 'vertical',
          boxShadow: 'var(--pressed-2)', border: 'none',
        }}
      />
    </div>
  );
}

// Parse permit metadata stored as __pm_*: lines inside contacts.install_notes.
// Pattern set by ai-taskmaster when it submits / tracks a permit. Keys used:
//   __pm_pnum: permit number (e.g. ELE-2026-00123)
//   __pm_psub: submitted date (ISO / free-form)
//   __pm_pdoc: issued-permit PDF URL
//   __pm_mnotes / __pm_minlet / __pm_msurge: materials notes (not surfaced here)
function parsePermitNotes(installNotes) {
  const s = String(installNotes || '');
  const read = key => {
    const m = s.match(new RegExp('^__pm_' + key + ':\\s*(.*)$', 'm'));
    return m ? (m[1] || '').trim() : '';
  };
  return {
    number: read('pnum'),
    submittedAt: read('psub'),
    docUrl: read('pdoc'),
  };
}

function DetailPermits({ contact }) {
  const [jur, setJur] = useState(null);
  useEffect(() => {
    if (!contact?.jurisdiction_id) { setJur(null); return; }
    let alive = true;
    (async () => {
      const { data } = await db.from('permit_jurisdictions')
        .select('id, name, phone, link1_title, link1_url, link2_title, link2_url, link3_title, link3_url, username, password')
        .eq('id', contact.jurisdiction_id).maybeSingle();
      if (alive) setJur(data || null);
    })();
    return () => { alive = false; };
  }, [contact?.jurisdiction_id]);
  if (!contact) return null;
  const cells = stageToPermitCells(contact.stage);
  const headers = ['Submit', 'Pay', 'Paid', 'Print', 'Printed', 'Inspect', 'Pass'];
  const jurLinks = jur ? [
    jur.link1_url ? { title: jur.link1_title || 'Portal', url: jur.link1_url } : null,
    jur.link2_url ? { title: jur.link2_title || 'Link 2', url: jur.link2_url } : null,
    jur.link3_url ? { title: jur.link3_title || 'Link 3', url: jur.link3_url } : null,
  ].filter(Boolean) : [];
  const permitMeta = parsePermitNotes(contact.install_notes);
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <div style={{ padding: '14px 16px', marginBottom: 12, background: 'var(--card)', boxShadow: 'var(--raised-2)' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '.08em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 12 }}>
          Permit pipeline
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          {cells.map((state, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
              <PermitStepCell state={state} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-faint)' }}>{headers[i]}</span>
            </div>
          ))}
        </div>
        {/* Permit metadata parsed from install_notes. Shown only when at
            least one field is populated — avoids empty clutter on pre-
            submission contacts. Permit # is click-to-copy; doc URL opens
            the issued permit PDF in a new tab. */}
        {(permitMeta.number || permitMeta.submittedAt || permitMeta.docUrl) ? (
          <div className="mono" style={{
            marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,.06)',
            fontSize: 11, color: 'var(--text-muted)',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {permitMeta.number ? (
              <div>
                permit #: <button
                  onClick={() => navigator.clipboard.writeText(permitMeta.number)
                    .then(() => window.__bpp_toast && window.__bpp_toast(`Permit # copied — ${permitMeta.number}`, 'success'))}
                  title="Click to copy"
                  style={{
                    padding: 0, background: 'transparent', border: 'none',
                    color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit',
                    borderBottom: '1px dashed rgba(0,0,0,.2)',
                  }}
                >{permitMeta.number}</button>
              </div>
            ) : null}
            {permitMeta.submittedAt ? (
              <div>submitted: <span style={{ color: 'var(--text)' }}>{permitMeta.submittedAt}</span></div>
            ) : null}
            {permitMeta.docUrl ? (
              <div>
                doc: <a
                  href={permitMeta.docUrl} target="_blank" rel="noopener"
                  style={{
                    color: 'var(--navy)', textDecoration: 'none',
                    borderBottom: '1px dashed rgba(0,0,0,.2)',
                  }}
                >open PDF ↗</a>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {/* Jurisdiction block — surfaces portal links + credentials when this
          contact's jurisdiction is set. One-click portal access from the
          contact instead of hunting through saved bookmarks. */}
      {jur ? (
        <div style={{ padding: '14px 16px', marginBottom: 12, background: 'var(--card)', boxShadow: 'var(--raised-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span className="chrome-label" style={{ fontSize: 11, letterSpacing: '.08em', color: 'var(--text-faint)' }}>
              Jurisdiction
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600 }}>{jur.name}</span>
          </div>
          {jurLinks.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: jur.username || jur.phone ? 10 : 0 }}>
              {jurLinks.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener" style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600,
                  background: 'var(--navy)', color: 'var(--gold)',
                  boxShadow: 'var(--raised-2)', textDecoration: 'none', letterSpacing: '.04em',
                }}>{l.title} ↗</a>
              ))}
            </div>
          ) : null}
          {(jur.username || jur.password || jur.phone) ? (
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {jur.username ? <span>user: <span style={{ color: 'var(--text-muted)' }}>{jur.username}</span></span> : null}
              {jur.password ? <span>pw:   <button
                onClick={() => navigator.clipboard.writeText(jur.password).then(() => window.__bpp_toast && window.__bpp_toast('Portal password copied', 'success'))}
                style={{ padding: 0, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                title="Click to copy">•••••••• (copy)</button></span> : null}
              {jur.phone ? <span>ph:   <span style={{ color: 'var(--text-muted)' }}>{jur.phone}</span></span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <InspectionChecklist contactId={contact.id} />
    </div>
  );
}

// `timestamptz` -> <input type="datetime-local"> format (YYYY-MM-DDTHH:MM).
// datetime-local has no TZ; treat as local time. Round to nearest minute.
function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DetailEditContact({ contact, onUpdate }) {
  const [form, setForm] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    address: contact?.address || '',
    install_date: toLocalDatetimeInput(contact?.install_date),
    jurisdiction_id: contact?.jurisdiction_id || '',
    assigned_installer: contact?.assigned_installer || '',
    installer_pay: contact?.installer_pay || '',
    do_not_contact: !!contact?.do_not_contact,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [jurisdictions, setJurisdictions] = useState([]);

  // Load jurisdictions once; rarely change
  useEffect(() => {
    (async () => {
      const { data } = await db.from('permit_jurisdictions').select('id, name').order('name');
      setJurisdictions(data || []);
    })();
  }, []);

  // Re-seed form when the open contact swaps
  useEffect(() => {
    setForm({
      name: contact?.name || '',
      phone: contact?.phone || '',
      email: contact?.email || '',
      address: contact?.address || '',
      install_date: toLocalDatetimeInput(contact?.install_date),
      jurisdiction_id: contact?.jurisdiction_id || '',
      assigned_installer: contact?.assigned_installer || '',
      installer_pay: contact?.installer_pay || '',
      do_not_contact: !!contact?.do_not_contact,
    });
  }, [contact?.id]);

  async function save(e) {
    e?.preventDefault();
    if (!contact) return;
    setSaving(true);
    const dncChanged = !!contact.do_not_contact !== !!form.do_not_contact;
    // install_date: empty string clears the field; non-empty = parse as local.
    const installIso = form.install_date ? new Date(form.install_date).toISOString() : null;
    const patch = {
      name: form.name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      install_date: installIso,
      jurisdiction_id: form.jurisdiction_id || null,
      assigned_installer: form.assigned_installer.trim() || null,
      installer_pay: form.installer_pay ? Number(form.installer_pay) : null,
      do_not_contact: !!form.do_not_contact,
    };
    // Record compliance metadata when flipping DNC on
    if (dncChanged && form.do_not_contact) {
      patch.dnc_at = new Date().toISOString();
      patch.dnc_source = 'crm-manual';
    }
    const { error } = await db.from('contacts').update(patch).eq('id', contact.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      onUpdate && onUpdate(patch);
      window.__bpp_toast && window.__bpp_toast('Contact updated', 'success');
      setTimeout(() => setSaved(false), 2000);
    } else {
      window.__bpp_toast && window.__bpp_toast(`Update failed: ${error.message}`, 'error');
    }
  }

  return (
    <form onSubmit={save} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <EditField label="NAME" value={form.name} onChange={v => setForm({ ...form, name: v })} />
      <EditField label="PHONE" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+18645550100" />
      <EditField label="EMAIL" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" />
      <EditField label="ADDRESS" value={form.address} onChange={v => setForm({ ...form, address: v })} />
      <EditField label="INSTALL DATE" value={form.install_date} onChange={v => setForm({ ...form, install_date: v })} type="datetime-local" placeholder="" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Jurisdiction</label>
        <select
          value={form.jurisdiction_id || ''}
          onChange={e => setForm({ ...form, jurisdiction_id: e.target.value ? Number(e.target.value) : '' })}
          style={{
            padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
            background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
          }}>
          <option value="">— select —</option>
          {jurisdictions.map(j => (
            <option key={j.id} value={j.id}>{j.name}</option>
          ))}
        </select>
      </div>

      {/* Sub-labor prep (phase 1). Free-text installer name so Key can start
          assigning installs without building a full installers table. When
          sub onboarding matures, migrate to a proper installers table with
          login + portal access. installer_pay is per-job for margin tracking. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
        <EditField label="ASSIGNED INSTALLER" value={form.assigned_installer} onChange={v => setForm({ ...form, assigned_installer: v })} placeholder="Key" />
        <EditField label="PAY $" value={form.installer_pay} onChange={v => setForm({ ...form, installer_pay: v.replace(/[^\d.]/g, '') })} placeholder="0" type="text" />
      </div>

      {contact?.created_at ? (
        <div className="mono" style={{
          marginTop: 4, padding: '8px 14px',
          display: 'flex', justifyContent: 'space-between',
          color: 'var(--text-faint)', fontSize: 11,
          borderBottom: '1px solid rgba(0,0,0,.06)',
        }}>
          <span>Created</span>
          <span>{new Date(contact.created_at).toLocaleDateString()} · {Math.round((Date.now() - new Date(contact.created_at).getTime()) / 86400000)}d ago</span>
        </div>
      ) : null}

      <label style={{
        marginTop: 8, padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--card)', boxShadow: 'var(--raised-2)',
        cursor: 'pointer',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: form.do_not_contact ? 'var(--ms-3)' : 'var(--text)' }}>
            Do not contact
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
            Stop all SMS + calls. Compliance sensitive.
          </div>
        </div>
        <input type="checkbox" checked={form.do_not_contact}
          onChange={e => setForm({ ...form, do_not_contact: e.target.checked })}
          style={{ width: 20, height: 20, cursor: 'pointer', accentColor: 'var(--ms-3)' }}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {saved ? (
          <span className="mono" style={{ fontSize: 11, color: 'var(--ms-2)' }}>Saved</span>
        ) : <span />}
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </PrimaryButton>
      </div>

      {/* Archive — light cleanup path for dead leads. Unlike DNC, this
          doesn't set compliance flags or block messaging; it just hides
          the contact from the active pipeline/LIST views. Reversible by
          changing status back in the database. Separate from Save so Key
          doesn't accidentally archive on every edit. */}
      <div style={{ marginTop: 12, padding: 12, background: 'var(--card)', boxShadow: 'var(--pressed-2)' }}>
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Archive
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
          Hide this contact from the pipeline and LIST. Does not affect messaging rules — use DNC for compliance.
        </div>
        <button type="button" disabled={saving || contact?.status === 'Archived'}
          onClick={async () => {
            if (!contact) return;
            const isArchived = contact.status === 'Archived';
            const next = isArchived ? 'New Lead' : 'Archived';
            const { error } = await db.from('contacts').update({ status: next }).eq('id', contact.id);
            if (error) { window.__bpp_toast && window.__bpp_toast(`Failed: ${error.message}`, 'error'); return; }
            onUpdate && onUpdate({ status: next });
            window.__bpp_toast && window.__bpp_toast(isArchived ? 'Unarchived' : 'Archived', 'success', {
              label: 'Undo',
              onClick: async () => {
                await db.from('contacts').update({ status: isArchived ? 'Archived' : 'New Lead' }).eq('id', contact.id);
                onUpdate && onUpdate({ status: isArchived ? 'Archived' : 'New Lead' });
              },
            });
          }}
          style={{
            padding: '8px 14px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600,
            background: contact?.status === 'Archived' ? 'var(--ms-2)' : 'var(--card)',
            color: contact?.status === 'Archived' ? '#fff' : 'var(--text-muted)',
            boxShadow: 'var(--raised-2)', border: 'none', cursor: 'pointer',
          }}>
          {contact?.status === 'Archived' ? 'Unarchive' : 'Archive contact'}
        </button>
      </div>
    </form>
  );
}

function EditField({ label, value, onChange, placeholder, type = 'text' }) {
  const niceLabel = label ? label.charAt(0) + label.slice(1).toLowerCase() : label;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{niceLabel}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
          background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
        }}
      />
    </div>
  );
}

// Split install_notes into:
//   meta  — __pm_*: structured lines (permit #, submitted date, doc URL, etc.)
//   free  — everything else (Key's actual notes for this contact)
// The Notes textarea should only show `free` so Key isn't staring at 5 lines
// of auto-generated __pm_pnum / __pm_psub when he wants to jot something.
// On save we merge `meta` back so ai-taskmaster's structured data survives.
function splitInstallNotes(raw) {
  const s = String(raw || '');
  const metaLines = [];
  const freeLines = [];
  for (const line of s.split('\n')) {
    if (/^__pm_[a-z_]+:/.test(line)) metaLines.push(line);
    else freeLines.push(line);
  }
  return {
    meta: metaLines.join('\n'),
    free: freeLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, ''),
  };
}

function mergeInstallNotes(meta, free) {
  const parts = [];
  if (free && free.trim()) parts.push(free.trim());
  if (meta && meta.trim()) parts.push(meta.trim());
  return parts.join('\n\n');
}

// Photos tab — unified view of every image attached to a contact. Pulls two
// sources: the messages thread (any inbound/outbound row with `[media:URL]`
// in the body) and sparky_memory photo entries Alex saved synchronously when
// media arrived. Dedupes by URL, sorts newest-first, renders as a grid with
// a full-screen lightbox on click. Key uses this on install day to scan
// every panel / outlet / reference pic in one view instead of scrolling the
// whole thread.
function DetailPhotos({ contactId, contactPhone }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const lightbox = lightboxIndex >= 0 ? photos[lightboxIndex] : null;

  // Keyboard nav for the lightbox: left/right to step through photos,
  // escape to close. Runs only while lightbox is open to avoid clashing
  // with global shortcuts.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setLightboxIndex(-1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); setLightboxIndex(i => Math.min(i + 1, photos.length - 1)); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setLightboxIndex(i => Math.max(i - 1, 0)); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, photos.length]);

  useEffect(() => {
    if (!contactId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      // 1. From messages table — any body matching the [media:URL] prefix.
      //    Captures both inbound (Twilio MMS from customer) and outbound
      //    (Alex-sent or Key-sent via the compose bar attach button).
      const msgRes = await db.from('messages')
        .select('id, direction, sender, body, created_at')
        .eq('contact_id', contactId)
        .ilike('body', '[media:%')
        .order('created_at', { ascending: false })
        .limit(100);

      // 2. From sparky_memory — photo URLs Alex saved synchronously when
      //    MMS arrived. These sometimes land before the messages row
      //    persists, so pulling both ensures nothing gets missed.
      let memRows = [];
      if (contactPhone) {
        const { data: mems } = await db.from('sparky_memory')
          .select('key, value, updated_at')
          .like('key', `contact:${contactPhone}:photo_%`)
          .order('updated_at', { ascending: false })
          .limit(50);
        memRows = mems || [];
      }

      const byUrl = new Map();
      // Parse messages first — they're richer (direction + caption).
      for (const m of (msgRes.data || [])) {
        const match = /^\[media:([^\]]+)\]\s*(.*)$/s.exec(String(m.body || ''));
        if (!match) continue;
        const url = match[1].trim();
        const caption = match[2].trim();
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            caption,
            at: m.created_at,
            direction: m.direction,
            sender: m.sender,
          });
        }
      }
      // Layer in memory rows for any URL not yet captured.
      for (const r of memRows) {
        const url = String(r.value || '').trim();
        if (!url || !url.startsWith('http')) continue;
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            caption: '',
            at: r.updated_at,
            direction: 'inbound',
            sender: 'lead',
          });
        }
      }

      const all = Array.from(byUrl.values())
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      if (alive) {
        setPhotos(all);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [contactId, contactPhone]);

  // Realtime — new MMS arriving mid-session (customer sends a follow-up pic,
  // Key sends one from his phone). Scoped filter so we don't refetch on
  // unrelated inserts.
  useEffect(() => {
    if (!contactId) return;
    const ch = db.channel(`photos-${contactId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `contact_id=eq.${contactId}`,
      }, (payload) => {
        const body = String(payload.new?.body || '');
        const match = /^\[media:([^\]]+)\]\s*(.*)$/s.exec(body);
        if (!match) return;
        const url = match[1].trim();
        setPhotos(prev => {
          if (prev.some(p => p.url === url)) return prev;
          return [{
            url,
            caption: match[2].trim(),
            at: payload.new.created_at,
            direction: payload.new.direction,
            sender: payload.new.sender,
          }, ...prev];
        });
      })
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [contactId]);

  if (loading) {
    return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>LOADING PHOTOS...</div>;
  }
  if (photos.length === 0) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 600 }}>No photos yet</div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', marginTop: 6 }}>
            Customer-sent MMS or photos you attach from compose will appear here.
          </div>
        </div>
      </div>
    );
  }

  const fmtAge = (iso) => {
    const hrs = (Date.now() - new Date(iso).getTime()) / 3600000;
    if (hrs < 1)   return `${Math.max(1, Math.round(hrs * 60))}m ago`;
    if (hrs < 24)  return `${Math.round(hrs)}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  };

  return (
    <>
      <div style={{
        flex: 1, overflowY: 'auto', padding: 16,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 10,
      }}>
        {photos.map((p, idx) => (
          <button key={p.url}
            onClick={() => setLightboxIndex(idx)}
            title={p.caption || `${p.direction === 'outbound' ? 'Sent' : 'Received'} ${fmtAge(p.at)}`}
            style={{
              position: 'relative', padding: 0, border: 'none', cursor: 'pointer',
              background: 'var(--card)', boxShadow: 'var(--raised-2)',
              aspectRatio: '1 / 1', overflow: 'hidden',
            }}>
            <img src={p.url} alt="" loading="lazy" decoding="async" style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            }} />
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              padding: '4px 6px',
              background: 'linear-gradient(0deg, rgba(0,0,0,.75), rgba(0,0,0,0))',
              color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.04em',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{p.direction === 'outbound' ? (p.sender === 'ai' ? 'ALEX' : 'KEY') : 'CUSTOMER'}</span>
              <span>{fmtAge(p.at)}</span>
            </div>
          </button>
        ))}
      </div>
      {lightbox ? (
        <div onClick={() => setLightboxIndex(-1)} style={{
          position: 'fixed', inset: 0, zIndex: 120,
          background: 'rgba(0,0,0,.92)',
          display: 'grid', placeItems: 'center', padding: 24, cursor: 'zoom-out',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <img src={lightbox.url} alt="" style={{
              maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain',
              boxShadow: '0 0 0 1px rgba(255,255,255,.1)',
            }} />
            {lightbox.caption ? (
              <div style={{ color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, textAlign: 'center' }}>
                {lightbox.caption}
              </div>
            ) : null}
            <div className="mono" style={{ color: 'rgba(255,255,255,.6)', fontSize: 10, letterSpacing: '.06em', textAlign: 'center' }}>
              {lightboxIndex + 1} / {photos.length} · {lightbox.direction === 'outbound' ? (lightbox.sender === 'ai' ? 'Sent by Alex' : 'Sent by Key') : 'Received from customer'} · {fmtAge(lightbox.at)} · <a href={lightbox.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ color: 'var(--gold)' }}>open original ↗</a>
            </div>
          </div>
          {/* Prev / next buttons — visible only when there are neighbors to
              navigate to. Key sees them on desktop; arrow keys work
              regardless of hover/reach. */}
          {lightboxIndex > 0 ? (
            <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => Math.max(i - 1, 0)); }} style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              width: 48, height: 48, background: 'rgba(255,255,255,.1)', color: '#fff',
              border: '1px solid rgba(255,255,255,.3)', cursor: 'pointer',
              fontSize: 20, display: 'grid', placeItems: 'center',
            }}>‹</button>
          ) : null}
          {lightboxIndex < photos.length - 1 ? (
            <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => Math.min(i + 1, photos.length - 1)); }} style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              width: 48, height: 48, background: 'rgba(255,255,255,.1)', color: '#fff',
              border: '1px solid rgba(255,255,255,.3)', cursor: 'pointer',
              fontSize: 20, display: 'grid', placeItems: 'center',
            }}>›</button>
          ) : null}
          <button onClick={() => setLightboxIndex(-1)} style={{
            position: 'absolute', top: 16, right: 16,
            width: 40, height: 40, background: 'rgba(255,255,255,.1)', color: '#fff',
            border: '1px solid rgba(255,255,255,.3)', cursor: 'pointer',
            fontSize: 18, display: 'grid', placeItems: 'center',
          }}>×</button>
        </div>
      ) : null}
    </>
  );
}

function DetailNotes({ contact, onUpdate }) {
  const initial = splitInstallNotes(contact?.install_notes);
  const [text, setText] = useState(initial.free);
  const [meta, setMeta] = useState(initial.meta);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const lastSavedRef = useRef(initial.free);
  const debounceRef = useRef(null);

  // When the contact changes, re-seed with that contact's notes
  useEffect(() => {
    const parts = splitInstallNotes(contact?.install_notes);
    setText(parts.free);
    setMeta(parts.meta);
    lastSavedRef.current = parts.free;
    setSavedAt(null);
  }, [contact?.id]);

  // Autosave 1.5s after last keystroke if text changed
  useEffect(() => {
    if (!contact) return;
    if (text === lastSavedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save({ silent: true });
    }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [text, contact?.id]);

  // Cmd/Ctrl+S to save while textarea is focused
  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
  }

  async function save({ silent = false } = {}) {
    if (!contact) return;
    setSaving(true);
    const merged = mergeInstallNotes(meta, text);
    const { error } = await db.from('contacts').update({ install_notes: merged }).eq('id', contact.id);
    setSaving(false);
    if (!error) {
      lastSavedRef.current = text;
      setSavedAt(Date.now());
      onUpdate && onUpdate(merged);
      if (!silent) window.__bpp_toast && window.__bpp_toast(`Notes saved for ${contact.name || 'contact'}`, 'success');
    } else {
      window.__bpp_toast && window.__bpp_toast(`Save failed: ${error.message}`, 'error');
    }
  }

  // Format save timestamp — "just now", "3m ago", "1h ago", or "Mon 3:42 PM"
  const savedLabel = (() => {
    if (!savedAt) return '';
    const secs = Math.floor((Date.now() - savedAt) / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  })();

  // Smart Notes — regex pass over the free-text body pulls out structured
  // facts (amp size, panel brand, generator watts, square-footage, service
  // size). Renders as a chip row above the textarea so Key can see what
  // was auto-detected without scrolling to install brief. Pure client-
  // side today; swappable to an LLM extractor later.
  const smartFacts = React.useMemo(() => {
    const out = [];
    if (!text) return out;
    const t = text.toLowerCase();
    const amp = t.match(/\b(30|50)\s*a(?:mp)?\b/);
    if (amp) out.push({ label: `${amp[1]}A`, tone: 'navy' });
    const panel = t.match(/\b(square d|siemens|eaton|ge|cutler[- ]hammer|homeline|bryant|murray)\b/i);
    if (panel) out.push({ label: panel[1].toUpperCase(), tone: 'purple' });
    const watts = t.match(/\b(\d{1,2}(?:\.\d)?)\s*k\s*w\b/i);
    if (watts) out.push({ label: `${watts[1]} kW`, tone: 'gold' });
    const service = t.match(/\b(100|125|150|200|400)\s*(?:a|amp)\s*service\b/i);
    if (service) out.push({ label: `${service[1]}A SERVICE`, tone: 'green' });
    const sqft = t.match(/\b(\d{3,4})\s*(?:sq ?ft|sq\.? ft)\b/i);
    if (sqft) out.push({ label: `${sqft[1]} sqft`, tone: 'muted' });
    return out;
  }, [text]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {smartFacts.length > 0 ? (
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap',
          padding: '6px 10px',
          background: 'var(--card)', boxShadow: 'var(--raised-2)',
        }}>
          <span className="chrome-label" title="Facts Sparky auto-extracted from your notes" style={{
            fontSize: 9, color: 'var(--text-faint)', letterSpacing: '.08em', alignSelf: 'center',
          }}>SPARKY SPOTTED</span>
          {smartFacts.map((f, i) => (
            <span key={i} className={`smart-chip smart-chip--${f.tone}`}>{f.label}</span>
          ))}
        </div>
      ) : null}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Add notes... (auto-saves)"
        style={{
          flex: 1, minHeight: 240, padding: 14,
          fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5,
          background: 'var(--card)', resize: 'vertical',
          boxShadow: 'var(--pressed-2)', border: 'none',
        }}
      />
      {/* Structured permit metadata — hidden from the editable textarea but
          still visible here so Key knows auto-generated data exists on this
          contact. Not editable (use DetailPermits to update permit # etc.). */}
      {meta ? (
        <details className="mono" style={{
          padding: '6px 10px', background: 'var(--card)', boxShadow: 'var(--raised-2)',
          fontSize: 10, color: 'var(--text-faint)',
        }}>
          <summary style={{ cursor: 'pointer', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            structured · {meta.split('\n').length} line{meta.split('\n').length === 1 ? '' : 's'}
          </summary>
          <pre style={{
            margin: '6px 0 0', padding: 0, whiteSpace: 'pre-wrap',
            fontFamily: 'inherit', fontSize: 10, color: 'var(--text-muted)',
          }}>{meta}</pre>
        </details>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          {saving ? 'Saving…' : savedLabel ? `Saved · ${savedLabel}` : 'Autosaves 1.5s after you stop typing'}
        </span>
        <button
          onClick={save}
          disabled={saving || text === lastSavedRef.current}
          style={{
            height: 36, padding: '0 20px',
            background: 'var(--navy)', color: '#fff',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
            letterSpacing: '.04em',
            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
            cursor: (saving || text === lastSavedRef.current) ? 'default' : 'pointer',
            opacity: (saving || text === lastSavedRef.current) ? 0.45 : 1, border: 'none',
          }}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

function StagePickerModal({ currentStage, onPick, onClose, contact }) {
  const rootRef = useRef(null);
  useFocusTrap(rootRef, true);
  const stages = [
    { num: 1, label: 'NEW LEAD',         color: 'var(--ms-1)' },
    { num: 2, label: 'QUOTED',           color: 'var(--ms-4)' },
    { num: 3, label: 'BOOKED',           color: 'var(--ms-2)' },
    { num: 4, label: 'PERMIT SUBMITTED', color: 'var(--ms-5)' },
    { num: 5, label: 'READY TO PAY',     color: 'var(--ms-3)' },
    { num: 6, label: 'PAID',             color: 'var(--ms-2)' },
    { num: 7, label: 'READY TO PRINT',   color: 'var(--ms-5)' },
    { num: 8, label: 'PRINTED',          color: 'var(--ms-6)' },
    { num: 9, label: 'INSPECTION',       color: 'var(--ms-7)' },
  ];
  // Smart Stage Picker — suggest the likely next stage given where the
  // contact is today. Just "current + 1" most of the time; the exception
  // is stage 5 (Ready to Pay) which often jumps straight to 6 (Paid) via
  // the Stripe webhook.
  const suggestedStage = (() => {
    const s = currentStage || 1;
    if (s >= 9) return null;
    return s + 1;
  })();
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 95,
      background: 'rgba(0,0,0,.5)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div ref={rootRef} onClick={e => e.stopPropagation()} style={{
        width: 320, background: 'var(--card)', boxShadow: 'var(--raised-2)',
        padding: 20,
      }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
          marginBottom: 14, letterSpacing: '-.01em',
        }}>
          Change stage
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {stages.map(s => {
            const active = s.num === currentStage;
            const suggested = s.num === suggestedStage;
            return (
              <button
                key={s.num}
                onClick={() => onPick(s.num)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: active ? 'var(--navy)' : 'transparent',
                  color: active ? 'var(--gold)' : 'var(--text)',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: active ? 600 : 500,
                  letterSpacing: '.02em',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  boxShadow: suggested ? 'inset 0 0 0 2px var(--gold)' : 'none',
                }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{s.label.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                  {suggested ? <span className="smart-chip smart-chip--gold">NEXT</span> : null}
                </span>
                <span className="mono" style={{ fontSize: 11, opacity: 0.5 }}>{s.num}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Quick-insert SMS templates. {name} is replaced with the contact's first name.
// SMS snippets — {name} is replaced with the contact's first name at insert.
// Full template set ported from crm.html:11335-11366 for v1 parity. [date] is
// a literal placeholder Key replaces before sending; v1 substituted it from
// contacts.scheduled_install_date when set, but the date's usually in his
// head at send time so typing it is fine.
const SMS_SNIPPETS = [
  { label: 'Intro',           body: "Hi {name}! This is Key with Backup Power Pro. Thanks for reaching out — I can get you a quote today once I know a couple details. Do you already have a generator, or looking to add one?" },
  { label: 'Send quote offer',body: "Hey {name}, thanks for getting back to me! Based on what you've got, I can get you fully connected — generator inlet, interlock kit, cord, permit, inspection, and cleanup — all in one day for $1,197 all in. Want me to send you a full itemized quote?" },
  { label: 'Quote sent',      body: "Hi {name}, just sent over your quote. Let me know if you have any questions — happy to hop on a quick call if that's easier." },
  { label: 'Follow up',       body: "Hey {name}, just checking in. Want me to hold that install slot, or shift it out a week?" },
  { label: 'Price anchor',    body: "Hey {name} — following up on your quote. Just wanted to mention: most homeowners compare us to standby generators, which run $10–20K installed. Our $1,197 all-in installation gives you the same directly-connected result at a fraction of the cost. Happy to answer any questions!" },
  { label: 'Deposit',         body: "Hi {name}! To lock in your install date, a 50% deposit is all that's needed. I'll send the link over now." },
  { label: 'Install confirm', body: "Hi {name}! Just confirming your installation for [date]. I'll plan to arrive around 8–9 AM and we'll be wrapped up in a few hours. Feel free to text me if anything comes up beforehand." },
  { label: 'Day-before',      body: "Hey {name}, just a heads up — I'll be there tomorrow for your generator inlet installation. No prep needed on your end. See you in the morning!" },
  { label: 'Permit update',   body: "Hey {name}, quick update — your permit is moving along. I'll keep you posted as we get closer to your install date. Let me know if you have any questions!" },
  { label: 'Post-install',    body: "Hey {name}, great meeting you today! Quick reminder for when the power goes out: 1) Roll your generator outside (at least 20 ft from windows), 2) Start it up, 3) Plug the cord into the inlet we installed, 4) Flip your transfer switch on the breaker panel. You're all set — feel free to reach out with any questions!" },
  { label: 'Review ask',      body: "Hey {name}, really glad we could get you set up! If you have a minute, an honest Google review goes a long way for a small business like mine. Here's the link: https://g.page/r/CVxLI9ZsiZS_EAE/review — thanks so much!" },
  { label: 'No response',     body: "Hey {name}, just checking in — still have your spot available if you're still interested. Happy to answer any questions or adjust anything on the quote. No pressure at all!" },
];

// Parse a message body and render inline:
// - "[media:https://...] optional caption" → render as <img> + caption
// - URLs inside the text → render as clickable links
// - Otherwise plain text
// Render a plain-text run, applying `**bold**` styling. Sparky responses
// come back in markdown; SMS bodies rarely use double-asterisks so this is
// safe to apply unconditionally.
function renderBold(text, key) {
  if (!text || text.indexOf('**') === -1) return <React.Fragment key={key}>{text}</React.Fragment>;
  const out = [];
  const re = /\*\*(.+?)\*\*/gs;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<React.Fragment key={`${key}-p${i++}`}>{text.slice(last, m.index)}</React.Fragment>);
    out.push(<strong key={`${key}-b${i++}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<React.Fragment key={`${key}-p${i++}`}>{text.slice(last)}</React.Fragment>);
  return <React.Fragment key={key}>{out}</React.Fragment>;
}

// ── Smart Contact Detail: next-best-action hint ─────────────────────────────
// Tiny banner at the top of the contact panel that names the single most
// useful action Key could take right now, plus a one-tap CTA that routes
// him to the right sub-tab. Heuristic-driven today; can swap to a Sparky-
// LLM pass later without changing the UI contract.
function SmartNextActionHint({ contact, messages, outstandingBalance, onJumpTab, onOpenQuickQuote }) {
  const hint = React.useMemo(() => {
    if (!contact) return null;
    const stage = contact.stage || 1;
    const latest = Array.isArray(messages) && messages.length ? messages[messages.length - 1] : null;
    const waiting = latest && latest.direction === 'inbound' && latest.sender !== 'ai';
    const hasInstallDate = !!contact.install_date;
    const installMs = hasInstallDate ? new Date(contact.install_date).getTime() : null;
    const hoursToInstall = installMs !== null ? (installMs - Date.now()) / 3600000 : null;
    const dnc = !!contact.do_not_contact;

    if (dnc) {
      return { body: 'Customer is marked Do Not Contact.', cta: null, tab: null };
    }
    if (waiting) {
      const preview = (latest.body || '').slice(0, 56);
      return { body: `Customer replied: "${preview}${preview.length >= 56 ? '…' : ''}"`, cta: 'REPLY NOW', tab: 'MESSAGES' };
    }
    if (hoursToInstall !== null && hoursToInstall >= 0 && hoursToInstall <= 24) {
      return { body: 'Install is today. Open the install brief and drive out.', cta: 'BRIEF →', tab: 'BRIEF' };
    }
    if (hoursToInstall !== null && hoursToInstall > 24 && hoursToInstall <= 72) {
      return { body: 'Install is in the next 72 hours. Confirm materials + permit are ready.', cta: 'PERMITS', tab: 'PERMITS' };
    }
    if (stage === 1) {
      return { body: 'New lead. Draft a quote or let Alex collect panel photo + amp + address.', cta: 'NEW QUOTE', tab: 'QUOTE' };
    }
    if (stage === 2) {
      return { body: 'Quote is out — follow up or pivot to a deposit link if the customer viewed it.', cta: 'SEE QUOTE', tab: 'QUOTE' };
    }
    if (stage === 3 && !hasInstallDate) {
      return { body: 'Booked but no install date set. Send a scheduling text with your open slots.', cta: 'REPLY', tab: 'MESSAGES' };
    }
    if (stage >= 4 && stage <= 6) {
      return { body: 'Permit in flight. Check status and bump the jurisdiction if it has been >3 days.', cta: 'PERMITS', tab: 'PERMITS' };
    }
    if (stage === 7 || stage === 8) {
      return { body: 'Inspection window — schedule or confirm the inspector visit.', cta: 'PERMITS', tab: 'PERMITS' };
    }
    if (outstandingBalance > 0) {
      return { body: `Outstanding balance: $${Number(outstandingBalance).toLocaleString()}. Nudge the invoice.`, cta: 'INVOICE', tab: 'QUOTE' };
    }
    return null;
  }, [contact, messages, outstandingBalance]);

  if (!hint) return null;

  const onCta = () => {
    if (!hint.tab) return;
    if (hint.tab === 'BRIEF') { window.dispatchEvent(new CustomEvent('bpp:open-install-brief')); return; }
    if (hint.cta === 'NEW QUOTE') { onJumpTab?.('QUOTE'); onOpenQuickQuote?.(); return; }
    onJumpTab?.(hint.tab);
  };

  return (
    <div className="smart-hint" style={{ marginBottom: 2 }}>
      <span className="smart-hint__label">Next</span>
      <span className="smart-hint__body">{hint.body}</span>
      {hint.cta ? (
        <button className="smart-hint__cta" onClick={onCta}>{hint.cta}</button>
      ) : null}
    </div>
  );
}

function MessageBody({ body, isOut }) {
  if (!body) return null;
  // Media prefix (send-sms stores `[media:URL] optional text`)
  const mediaMatch = /^\[media:([^\]]+)\]\s*(.*)$/s.exec(body);
  if (mediaMatch) {
    const [, mediaUrl, caption] = mediaMatch;
    return (
      <>
        <img src={mediaUrl} alt="" loading="lazy" decoding="async" style={{
          display: 'block', maxWidth: '100%', maxHeight: 260, marginBottom: caption ? 6 : 0,
        }} />
        {caption ? <MessageBody body={caption.trim()} isOut={isOut} /> : null}
      </>
    );
  }
  // URL linkification — split on URLs, render links as <a>, non-link runs
  // pass through `renderBold` so `**bold**` in Sparky output renders as a
  // real <strong>.
  const parts = body.split(/(https?:\/\/[^\s]+)/g);
  return (
    <span>
      {parts.map((p, i) => /^https?:\/\//.test(p) ? (
        <a key={i} href={p} target="_blank" rel="noopener"
          style={{ color: isOut ? 'var(--gold)' : 'var(--navy)', wordBreak: 'break-all' }}
        >{p}</a>
      ) : renderBold(p, `p${i}`))}
    </span>
  );
}

// Smart Quick Replies — one-tap pre-written responses driven off the
// customer's most recent inbound message. Regex-match simple patterns
// (email handoff, schedule questions, pricing pushback, photo asks) and
// surface 2-3 chips that prefill the compose bar. No LLM call today; the
// compose bar's existing AI button still handles full drafting.
function smartQuickReplies(latestInbound, contactName) {
  if (!latestInbound) return [];
  const t = latestInbound.toLowerCase();
  const first = (contactName || '').trim().split(/\s+/)[0] || '';
  const salute = first ? `Hey ${first}, ` : 'Hey, ';
  const replies = [];
  if (/@|email|e.mail/.test(t)) {
    replies.push({ label: 'Got it — thx', body: `${salute}got it — I'll send everything over there. Expect a text and an email shortly.` });
  }
  if (/\?\s*$|when|time|date|schedule|book/.test(t)) {
    replies.push({ label: 'Send slots', body: `${salute}I can get you in this week. Would Thu or Fri work better for you?` });
  }
  if (/price|cost|how much|expensive|cheaper|discount|afford/.test(t)) {
    replies.push({ label: 'Value anchor', body: `${salute}happy to break it down. For context, most homeowners compare us to a standby generator at $10–20K installed. Our all-in install runs $1,197. Want the full itemized quote?` });
  }
  if (/photo|picture|panel|meter/.test(t)) {
    replies.push({ label: 'Ask for panel', body: `${salute}can you send a photo of the main electrical panel with the cover open? That'll tell me exactly what you need.` });
  }
  if (/yes|sure|sounds good|let.?s do it|ready|sign me up|book it|lock it in/.test(t)) {
    replies.push({ label: 'Deposit link', body: `${salute}let's lock it in. I'll send a 50% deposit link next — takes 30 seconds, then we're booked.` });
  }
  if (replies.length === 0) {
    replies.push({ label: 'On it', body: `${salute}on it — give me a second and I'll get right back to you.` });
  }
  return replies.slice(0, 3);
}

function ComposeBar({ contactId, contactName, contactPhone, installDate = null, latestInbound = '', disabled = false }) {
  // Auto-save drafts per contact in localStorage so Key doesn't lose a
  // half-typed SMS when he switches contacts or reloads the tab.
  const draftKey = contactId ? `bpp_v2_draft_${contactId}` : null;
  const [text, setText] = useState(() => (draftKey && localStorage.getItem(draftKey)) || '');
  const [sending, setSending] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // Persist draft on every keystroke (cheap; localStorage is synchronous)
  useEffect(() => {
    if (!draftKey) return;
    if (text) localStorage.setItem(draftKey, text);
    else localStorage.removeItem(draftKey);
  }, [text, draftKey]);

  // When the contact changes, re-load its draft
  useEffect(() => {
    if (draftKey) setText(localStorage.getItem(draftKey) || '');
  }, [draftKey]);

  // Listen for broadcasted prefill from sibling components (e.g. Quote tab "Remind").
  useEffect(() => {
    const handler = (ev) => {
      const t = ev?.detail?.text;
      if (typeof t === 'string' && t.length) {
        setText(t);
        // After state updates, focus the input for immediate edit/send
        setTimeout(() => {
          const input = document.querySelector('input[placeholder="Type a message…"]');
          if (input) input.focus();
        }, 50);
      }
    };
    window.addEventListener('bpp:compose-prefill', handler);
    return () => window.removeEventListener('bpp:compose-prefill', handler);
  }, []);

  // Listen for remote AI-suggest triggers (e.g. NextActionCard's "Draft with
  // AI" button). Lets sibling components request a Sparky reply without
  // needing a direct ref into this component.
  useEffect(() => {
    const handler = () => { suggestReply(); };
    window.addEventListener('bpp:compose-suggest', handler);
    return () => window.removeEventListener('bpp:compose-suggest', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, suggesting]);

  // GSM-7 characters fit 160/segment. Unicode (emoji, curly quotes, em dash)
  // fall back to UCS-2 which is 70/segment. Quick heuristic: any non-ASCII
  // char → unicode.
  const isUnicode = /[^\x00-\x7F]/.test(text);
  const perSegment = isUnicode ? 70 : 160;
  const len = text.length;
  const segments = len === 0 ? 0 : Math.ceil(len / perSegment);

  function applySnippet(body) {
    const first = (contactName || '').split(' ')[0] || 'there';
    let out = body.replace(/\{name\}/g, first);
    // Auto-fill install date/time placeholders so Key doesn't have to re-type
    // them for every "Install confirm" he fires. Leave the literal [date] /
    // [time] markers intact if install_date isn't set yet — that way the
    // snippet still draws the eye, and Key knows he needs to book a date
    // before sending.
    const inst = installDate ? new Date(installDate) : null;
    if (inst && !isNaN(inst.getTime())) {
      const dateLabel = inst.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const timeLabel = inst.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      out = out.replace(/\[date\]/gi, dateLabel).replace(/\[time\]/gi, timeLabel);
    }
    setText(out);
    setSnippetsOpen(false);
  }

  // Sparky-backed reply suggestion. Pulls the thread + contact, calls
  // ai-taskmaster with mode=suggest_reply, drops the drafted message into
  // the compose bar. Key reviews + sends — nothing auto-sends.
  //
  // ai-taskmaster returns the full agentic output in `answer` — which often
  // includes Sparky's reasoning ("Looking at this thread…", "Info check:…")
  // before the actual drafted SMS. Strip the thinking so only the customer-
  // facing message lands in the compose bar.
  function extractReply(raw) {
    if (!raw) return '';
    const text = String(raw).trim();
    // Split into paragraphs; the drafted SMS is usually the final
    // conversational paragraph. Drop markdown-headed ones (**, ##), anything
    // that starts with agent-thinking patterns, and "Updated: …" annotations.
    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const agentPrefixes = /^(looking at|let me|i'll|i will|checking|info check|scanning|first|step \d|thinking|analysis|reasoning)/i;
    const candidates = paragraphs.filter(p =>
      !p.includes('**') &&
      !/^#{1,6}\s/.test(p) &&
      !/^updated[: ]/i.test(p) &&
      !/^-\s/.test(p) &&
      !agentPrefixes.test(p)
    );
    // Prefer the last matching paragraph (the final output), or fall back to
    // last paragraph overall.
    const reply = candidates[candidates.length - 1] || paragraphs[paragraphs.length - 1] || text;
    return reply.trim();
  }

  async function suggestReply() {
    if (!contactId || suggesting) return;
    setSuggesting(true);
    try {
      const [{ data: c }, { data: msgs }] = await Promise.all([
        db.from('contacts').select('*').eq('id', contactId).maybeSingle(),
        db.from('messages').select('direction, body, sender, created_at').eq('contact_id', contactId).order('created_at', { ascending: true }).limit(60),
      ]);
      const { data, error } = await db.functions.invoke('ai-taskmaster', {
        body: { mode: 'suggest_reply', contact: c, thread: msgs || [] },
      });
      if (error) throw error;
      const raw = typeof data === 'string' ? data : (data?.reply || data?.text || data?.answer || '');
      const reply = extractReply(raw);
      if (!reply) throw new Error('empty reply from sparky');
      setText(reply);
      // Focus the input so Enter sends immediately
      setTimeout(() => {
        const input = document.querySelector('input[placeholder="Type a message…"]');
        if (input) input.focus();
      }, 30);
    } catch (e) {
      window.__bpp_toast && window.__bpp_toast(`Suggest failed: ${e.message || e}`, 'error');
    } finally {
      setSuggesting(false);
    }
  }

  async function send() {
    if (!text.trim() || !contactId || disabled) return;
    setSending(true);
    try {
      const { data, error } = await db.functions.invoke('send-sms', {
        body: { contactId, body: text.trim() },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'send failed');
      setText('');
    } catch (e) {
      console.error('send failed', e);
      const msg = e?.message || 'Send failed — check network + Twilio credits';
      window.__bpp_toast && window.__bpp_toast(msg, 'error');
    } finally {
      setSending(false);
    }
  }

  // ── Photo send (MMS) ────────────────────────────────────────────────────
  // Ports v1's msgSendPhoto flow. File → Supabase Storage bucket
  // (message-media, public) → send-sms with mediaUrl. The DB body gets
  // stored as "[media:URL] optional caption" which the thread renderer
  // already handles as an inline <img>. 5MB Twilio MMS hard cap.
  async function sendPhoto(file) {
    if (!file || !contactId || disabled) return
    if (!/^image\//.test(file.type)) {
      window.__bpp_toast && window.__bpp_toast('Only image files can be sent via MMS', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      window.__bpp_toast && window.__bpp_toast('File too large — Twilio MMS limit is 5MB', 'error')
      return
    }
    setSending(true)
    window.__bpp_toast && window.__bpp_toast('Uploading photo…', 'info')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const fileName = `${contactId}/${Date.now()}.${ext}`
      const { error: uploadErr } = await db.storage
        .from('message-media')
        .upload(fileName, file, { contentType: file.type, upsert: false })
      if (uploadErr) throw new Error(uploadErr.message)
      const { data: urlData } = db.storage.from('message-media').getPublicUrl(fileName)
      const mediaUrl = urlData?.publicUrl
      if (!mediaUrl) throw new Error('could not get public URL for uploaded photo')

      // Send — text is optional caption; body is whatever's in the compose
      // bar at the time. Caption + image both land in the same SMS.
      const caption = text.trim()
      const { data, error } = await db.functions.invoke('send-sms', {
        body: { contactId, body: caption, mediaUrl },
      })
      if (error) throw error
      if (data && data.success === false) throw new Error(data.error || 'send failed')
      setText('')
      window.__bpp_toast && window.__bpp_toast('Photo sent', 'success')
    } catch (e) {
      console.error('photo send failed', e)
      const msg = e?.message || 'Photo send failed — check network + Twilio credits'
      window.__bpp_toast && window.__bpp_toast(msg, 'error')
    } finally {
      setSending(false)
    }
  }

  function pickPhoto() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (ev) => {
      const file = ev.target.files?.[0]
      if (file) sendPhoto(file)
    }
    input.click()
  }

  if (disabled) {
    return (
      <div style={{
        padding: '12px 14px calc(12px + env(safe-area-inset-bottom))',
        background: 'var(--card)', boxShadow: 'var(--raised)',
        textAlign: 'center',
        fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ms-3)',
      }}>
        This contact is marked Do Not Contact — messaging is disabled.
      </div>
    );
  }

  const smartReplies = React.useMemo(
    () => smartQuickReplies(latestInbound, contactName),
    [latestInbound, contactName]
  );

  return (
    <div style={{
      padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
      background: 'var(--card)',
      boxShadow: 'var(--raised)',
      display: 'flex', flexDirection: 'column', gap: 6,
      position: 'relative',
    }}>
      {/* Smart Quick Replies — only appear when the latest message is an
          un-replied inbound. Click a chip → prefills the compose bar so Key
          can edit + send. Tuned to the common BPP flows (photo ask, price
          pushback, scheduling, deposit). Empty when no inbound match. */}
      {smartReplies.length > 0 && !text ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
          {smartReplies.map((r, i) => (
            <button key={i} onClick={() => setText(r.body)}
              title={r.body}
              className="smart-chip smart-chip--gold"
              style={{ cursor: 'pointer', border: 'none', fontSize: 10, padding: '4px 10px' }}>
              {r.label}
            </button>
          ))}
        </div>
      ) : null}
      {snippetsOpen ? (
        <div style={{
          position: 'absolute', left: 12, right: 12, bottom: '100%',
          marginBottom: 4, padding: 6, zIndex: 5,
          background: 'var(--card)', boxShadow: 'var(--raised-2)',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {SMS_SNIPPETS.map(s => (
            <button key={s.label} onClick={() => applySnippet(s.body)} style={{
              padding: '8px 10px', textAlign: 'left',
              fontFamily: 'var(--font-body)', fontSize: 12,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text)',
            }}>
              <span style={{ fontWeight: 600, marginRight: 8 }}>{s.label}</span>
              <span style={{ color: 'var(--text-faint)' }}>{s.body.slice(0, 60)}…</span>
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setSnippetsOpen(o => !o)} title="Snippets" style={{
          width: 36, height: 36,
          background: 'var(--card)', boxShadow: 'var(--raised-2)',
          border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--text-muted)',
        }}>…</button>
        <button onClick={suggestReply} disabled={suggesting} title="Suggest reply (Sparky)" style={{
          width: 36, height: 36,
          background: suggesting ? 'var(--navy)' : 'var(--card)',
          color: suggesting ? 'var(--gold)' : 'var(--text-muted)',
          boxShadow: suggesting ? 'var(--pressed-2)' : 'var(--raised-2)',
          border: 'none', cursor: suggesting ? 'wait' : 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
        }}>{suggesting ? '…' : 'AI'}</button>
        <button onClick={pickPhoto} disabled={sending} title="Attach photo (MMS)" style={{
          width: 36, height: 36,
          background: 'var(--card)', color: 'var(--text-muted)',
          boxShadow: sending ? 'var(--pressed-2)' : 'var(--raised-2)',
          border: 'none', cursor: sending ? 'wait' : 'pointer',
          display: 'grid', placeItems: 'center',
        }}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter">
            <rect x="1.5" y="2.5" width="13" height="11"/>
            <path d="M1.5 10 L5 7 L8 10 L11 6 L14.5 10.5"/>
            <circle cx="5.5" cy="5.5" r="1"/>
          </svg>
        </button>
        <div style={{
          flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: 'var(--pressed-2)', background: 'var(--card)',
        }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
            to {contactName || '—'}
          </span>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            style={{
              flex: 1, fontFamily: 'var(--font-body)', fontSize: 14, background: 'transparent', border: 'none',
            }}
          />
          {len > 0 ? (
            <span className="mono" title={`${len} chars · ${segments} SMS segment${segments === 1 ? '' : 's'}${isUnicode ? ' · unicode' : ''}`} style={{
              fontSize: 10, color: segments > 1 ? 'var(--ms-4)' : 'var(--text-faint)',
            }}>{len}{segments > 1 ? `/${segments}` : ''}</span>
          ) : null}
        </div>
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          style={{
            width: 40, height: 40,
            background: 'var(--navy)', color: '#fff',
            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
            opacity: sending || !text.trim() ? 0.5 : 1,
            display: 'grid', placeItems: 'center', border: 'none',
          }}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
            <path d="M1 2 L15 8 L1 14 L3 8 L1 2 Z M3 8 L9 8"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Toast notification system ───────────────────────────────────────────────
// Simple pub/sub. Any component calls window.__bpp_toast(text, kind?) and a
// toast appears bottom-right for 4 seconds. Optional action = { label, onClick }
const toastSubs = new Set();
window.__bpp_toast = (text, kind = 'info', action = null) => {
  toastSubs.forEach(fn => fn({ id: Date.now() + Math.random(), text, kind, action }));
};

function ToastRoot() {
  const [toasts, setToasts] = useState([]);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const sub = (t) => {
      setToasts(prev => [...prev, t]);
      // Give action toasts a longer window (6s) so the user can click Undo
      const ttl = t.action ? 6000 : 4000;
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), ttl);
    };
    toastSubs.add(sub);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => { toastSubs.delete(sub); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <div style={isMobile ? {
      // Mobile: top-center, below the top nav, above everything else.
      // Avoids the compose bar at the bottom of the screen.
      position: 'fixed', top: 'calc(100px + env(safe-area-inset-top))',
      left: 12, right: 12, zIndex: 110,
      display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
    } : {
      // Desktop: bottom-right corner, above safe-area.
      position: 'fixed', bottom: 16, right: 16, zIndex: 110,
      display: 'flex', flexDirection: 'column', gap: 8,
      paddingBottom: 'env(safe-area-inset-bottom)',
      maxWidth: 360,
    }}>
      {toasts.map(t => {
        const color =
          t.kind === 'success' ? 'var(--green)' :
          t.kind === 'error'   ? 'var(--red)'   :
          t.kind === 'warn'    ? 'var(--lcd-amber)' :
                                  'var(--navy)';
        const dismiss = () => setToasts(prev => prev.filter(x => x.id !== t.id));
        return (
          <div key={t.id}
            onClick={e => { if (!e.target.closest('button')) dismiss(); }}
            title="Click to dismiss"
            style={{
              padding: '10px 14px',
              background: 'var(--card)',
              boxShadow: 'var(--raised)',
              borderLeft: `4px solid ${color}`,
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, cursor: 'pointer',
            }}>
            <span style={{ width: 8, height: 8, background: color, flex: '0 0 auto' }} />
            <span style={{ flex: 1 }}>{t.text}</span>
            {t.action ? (
              <button onClick={() => {
                try { t.action.onClick(); } catch {}
                dismiss();
              }} style={{
                padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600,
                background: 'transparent', color: 'var(--navy)',
                boxShadow: 'var(--raised-2)', border: 'none', cursor: 'pointer',
              }}>{t.action.label}</button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ── Keyboard Help Overlay (?) ───────────────────────────────────────────────
function KeyboardHelp({ open, onClose }) {
  const rootRef = useRef(null);
  useFocusTrap(rootRef, open);
  if (!open) return null;
  const shortcuts = [
    { keys: '⌘K', label: 'Open command palette' },
    { keys: 'G L', label: 'Go to Leads' },
    { keys: 'G C', label: 'Go to Calendar' },
    { keys: 'G F', label: 'Go to Finance' },
    { keys: 'G M', label: 'Go to Messages' },
    // G S removed — Sparky lives in the right panel, not a tab anymore.
    { keys: 'R', label: 'Reply (focus compose bar)' },
    { keys: 'D', label: 'Dial selected contact' },
    { keys: 'N', label: 'New lead' },
    { keys: 'Q', label: 'Quick quote for open contact' },
    { keys: 'B', label: 'Open morning briefing' },
    { keys: 'Shift+B', label: 'Install brief for open contact' },
    { keys: 'T', label: 'Toggle dark mode' },
    { keys: 'P', label: 'Pin / unpin open contact' },
    { keys: 'Y', label: 'Yank contact summary to clipboard' },
    { keys: 'X', label: 'Export SMS thread transcript' },
    { keys: 'J', label: 'Jump to next waiting thread' },
    { keys: '/', label: 'Focus search (Messages / Sparky)' },
    { keys: '1–9', label: 'Set stage → auto-advance to next waiting' },
    { keys: '⌘S', label: 'Save notes' },
    { keys: 'Esc', label: 'Close detail or modal' },
    { keys: '?', label: 'Show this help' },
  ];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 85,
      background: 'rgba(0,0,0,.45)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div ref={rootRef} onClick={e => e.stopPropagation()} style={{
        width: 380, padding: 24,
        background: 'var(--card)', boxShadow: 'var(--raised-2)',
      }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700, marginBottom: 14, letterSpacing: '-.01em' }}>
          Keyboard shortcuts
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {shortcuts.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < shortcuts.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}>{s.label}</span>
              <span className="mono" style={{
                fontSize: 11, color: 'var(--text-muted)',
                padding: '2px 8px', boxShadow: 'var(--raised-2)', background: 'var(--card)',
              }}>{s.keys}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CSV export — download contacts as .csv ──────────────────────────────────
async function exportContactsCsv() {
  // Broaden the select so the export is useful as a standalone snapshot
  // — Key can open it in Numbers/Excel to segment by install_date,
  // quote_amount, assigned_installer, or landing page (consent_page =
  // which ad variant the lead came from). Prior export omitted all of
  // those, so the CSV wasn't much more than a Rolodex.
  const { data: contacts } = await db
    .from('contacts')
    .select('id, name, phone, email, address, stage, status, do_not_contact, created_at, install_notes, install_date, quote_amount, jurisdiction_id, assigned_installer, installer_pay, consent_page')
    .order('created_at', { ascending: false });
  if (!contacts || contacts.length === 0) {
    window.__bpp_toast && window.__bpp_toast('No contacts to export', 'info');
    return;
  }
  window.__bpp_toast && window.__bpp_toast(`Building export (${contacts.length} contacts)…`, 'info');

  // Hydrate jurisdiction names in one roundtrip so the CSV reads as
  // "Greenville" instead of a uuid.
  const jurIds = Array.from(new Set(contacts.map(c => c.jurisdiction_id).filter(Boolean)));
  let jurMap = {};
  if (jurIds.length > 0) {
    const { data: jurs } = await db.from('permit_jurisdictions').select('id, name').in('id', jurIds);
    jurMap = Object.fromEntries((jurs || []).map(j => [j.id, j.name]));
  }

  const STAGE_LABEL = {
    1: 'NEW', 2: 'QUOTED', 3: 'BOOKED', 4: 'PERMIT', 5: 'PAY',
    6: 'PAID', 7: 'PRINT', 8: 'INSPECT', 9: 'COMPLETE',
  };

  const header = [
    'id', 'name', 'phone', 'email', 'address',
    'stage_num', 'stage_label', 'status', 'do_not_contact',
    'created_at', 'install_date',
    'quote_amount', 'jurisdiction', 'assigned_installer', 'installer_pay',
    'consent_page', 'install_notes',
  ];
  const esc = v => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows = contacts.map(c => [
    esc(c.id), esc(c.name), esc(c.phone), esc(c.email), esc(c.address),
    esc(c.stage), esc(STAGE_LABEL[c.stage] || ''), esc(c.status), esc(c.do_not_contact),
    esc(c.created_at), esc(c.install_date),
    esc(c.quote_amount), esc(c.jurisdiction_id ? (jurMap[c.jurisdiction_id] || '') : ''),
    esc(c.assigned_installer), esc(c.installer_pay),
    esc(c.consent_page), esc(c.install_notes),
  ].join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bpp-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  window.__bpp_toast && window.__bpp_toast(`Exported ${contacts.length} contacts · ${header.length} columns`, 'success');
}

// ── New Lead Modal (action triggered by "+" button) ────────────────────────
function NewLeadModal({ open, onClose, onCreated }) {
  const rootRef = useRef(null);
  useFocusTrap(rootRef, open);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  // Duplicate-phone check. When the phone reaches 10 digits we query to see
  // if a contact already owns that number; if so, show an inline link so
  // Key can jump to the existing record instead of creating a duplicate.
  const [dupe, setDupe] = useState(null);

  // Debounced dupe lookup while Key types. Fires when digits length = 10.
  useEffect(() => {
    if (!open) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setDupe(null); return; }
    const normalized = `+1${digits}`;
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await db.from('contacts')
        .select('id, name, stage, status').eq('phone', normalized).limit(1).maybeSingle();
      if (alive) setDupe(data || null);
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [phone, open]);

  if (!open) return null;

  function formatPhoneInput(v) {
    const digits = v.replace(/\D/g, '').slice(0, 10);
    if (digits.length >= 7) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length >= 4) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    if (digits.length >= 1) return `(${digits}`;
    return '';
  }

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setErr('Phone must be 10 digits'); return; }
    // Block the insert if a dupe already exists — much better than
    // creating two rows with the same phone that Key has to merge later.
    if (dupe) {
      setErr(`Phone already belongs to ${dupe.name || 'existing contact'} — click their name below to open.`);
      return;
    }
    // Basic email validation — only if provided. Blank email is fine for
    // walk-in leads Key captures without email yet; Alex will ask later.
    const emailTrim = email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setErr('Email format looks off. Leave blank to skip.');
      return;
    }
    setBusy(true);
    const { data, error } = await db
      .from('contacts')
      .insert({
        name: name.trim() || 'New Lead',
        phone: `+1${digits}`,
        email: emailTrim || null,
        address: address.trim() || null,
        stage: 1,
        status: 'New Lead',
        ai_enabled: false, // Manual lead — don't fire Alex
      })
      .select()
      .single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onCreated && onCreated(data);
    window.__bpp_toast && window.__bpp_toast(`New lead: ${data.name}`, 'success');
    setName(''); setPhone(''); setEmail(''); setAddress(''); setDupe(null);
    onClose();
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,.5)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <form ref={rootRef} onSubmit={submit} onClick={e => e.stopPropagation()} style={{
        width: 380, maxWidth: '100%',
        padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 16,
        background: 'var(--card)', boxShadow: 'var(--raised-2)',
      }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>
          New lead
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" autoFocus style={{
          padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
          background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
        }} />
        <input value={phone} onChange={e => setPhone(formatPhoneInput(e.target.value))} placeholder="Phone" style={{
          padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
          background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
        }} />
        {/* Smart New Lead hint — derives likely source from the area code
            once the phone is populated. 864/803/704/828 = SC/NC local
            (Meta ad + organic); other = likely out-of-market or referral. */}
        {(() => {
          const digits = phone.replace(/\D/g, '');
          if (digits.length !== 10) return null;
          const area = digits.slice(0, 3);
          const scNc = ['864', '803', '843', '704', '828', '919', '980', '252', '910'];
          const local = scNc.includes(area);
          return (
            <div className="smart-hint" style={{ padding: '6px 10px' }}>
              <span className={`smart-chip smart-chip--${local ? 'green' : 'gold'}`}>
                {local ? 'LOCAL' : 'OUT-OF-MARKET'}
              </span>
              <span className="smart-hint__body" style={{ fontSize: 11 }}>
                {local
                  ? `Area code ${area} is in our service footprint — likely Meta ad or referral.`
                  : `Area code ${area} is outside SC/NC — likely an online form from travel or referral.`}
              </span>
            </div>
          );
        })()}
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" type="email" style={{
          padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
          background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
        }} />
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address (optional)" style={{
          padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
          background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
        }} />
        {err ? <div className="mono" style={{ fontSize: 11, color: 'var(--ms-3)' }}>{err}</div> : null}
        {dupe ? (
          <div className="mono" style={{
            padding: '8px 10px', fontSize: 11,
            background: 'var(--card)', boxShadow: 'var(--raised-2)',
            color: 'var(--ms-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <span>⚠ Existing contact with this phone</span>
            <button type="button" onClick={() => {
              window.location.hash = `#contact=${dupe.id}`;
              onClose();
            }} style={{
              padding: '2px 6px', fontSize: 11, fontFamily: 'var(--font-body)',
              background: 'transparent', color: 'var(--navy)', cursor: 'pointer',
              border: 'none', textDecoration: 'underline',
            }}>Open {dupe.name || 'contact'} →</button>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, height: 40, fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font-body)', letterSpacing: '.04em',
            boxShadow: 'var(--raised-2)', background: 'var(--card)', color: 'var(--text-muted)',
            border: 'none',
          }}>Cancel</button>
          <button type="submit" disabled={busy} style={{
            flex: 2, height: 40,
            background: 'var(--navy)', color: '#fff',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
            letterSpacing: '.04em',
            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
            opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer', border: 'none',
          }}>{busy ? 'Saving…' : 'Create lead'}</button>
        </div>
      </form>
    </div>
  );
}

// ── Twilio Voice SDK ────────────────────────────────────────────────────────
// Loads Twilio Voice SDK (v2.18.1) lazily + mints access token via
// twilio-token edge function + exposes global hooks for outbound dial /
// incoming ring handling.
const VOICE_SDK_URL = 'https://sdk.twilio.com/js/client/v2.18.1/twilio.min.js';

function useVoiceDevice(user) {
  const [device, setDevice] = useState(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | ringing | on-call
  const [incoming, setIncoming] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [err, setErr] = useState(null);
  // Identity-stable key so auth token refreshes (which recreate the user
  // object reference) don't reboot the device in a tight loop.
  const userId = user?.id || null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadSdk() {
      if (window.Twilio?.Device) return;
      // Single in-flight promise shared across mounts — prevents dozens of
      // <script> tags on retries/rerenders, especially when the CDN is
      // blocked by CORS/ORB (e.g., preview sandboxes).
      if (!window.__bpp_twilio_sdk_promise) {
        window.__bpp_twilio_sdk_promise = new Promise((resolve, reject) => {
          const existing = document.querySelector(`script[src="${VOICE_SDK_URL}"]`);
          if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('twilio sdk load error')));
            return;
          }
          const s = document.createElement('script');
          s.src = VOICE_SDK_URL;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('twilio sdk load error'));
          document.head.appendChild(s);
        });
      }
      return window.__bpp_twilio_sdk_promise;
    }

    async function boot() {
      try {
        await loadSdk();
        if (cancelled) return;
        const { data: tokenRes, error } = await db.functions.invoke('twilio-token');
        if (error || !tokenRes?.token) throw new Error(error?.message || 'no token');
        const dev = new window.Twilio.Device(tokenRes.token, {
          logLevel: 1,
          codecPreferences: ['opus', 'pcmu'],
          enableRingingState: true,
        });
        dev.on('registered', () => { if (!cancelled) setReady(true); });
        dev.on('error', e => { setErr(e?.message || String(e)); });
        dev.on('incoming', call => {
          setIncoming(call);
          setStatus('ringing');
          call.on('accept', () => { setStatus('on-call'); setActiveCall(call); setIncoming(null); });
          call.on('disconnect', () => { setStatus('idle'); setActiveCall(null); setIncoming(null); });
          call.on('cancel', () => { setStatus('idle'); setIncoming(null); });
          call.on('reject', () => { setStatus('idle'); setIncoming(null); });
        });
        dev.on('tokenWillExpire', async () => {
          const { data } = await db.functions.invoke('twilio-token');
          if (data?.token) dev.updateToken(data.token);
        });
        await dev.register();
        if (!cancelled) setDevice(dev);
      } catch (e) {
        if (!cancelled) setErr(e?.message || String(e));
      }
    }
    boot();
    return () => { cancelled = true; try { device?.destroy(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function dial(phone) {
    if (!device) return;
    try {
      setStatus('connecting');
      const call = await device.connect({ params: { To: phone } });
      setActiveCall(call);
      call.on('accept', () => setStatus('on-call'));
      call.on('disconnect', () => { setStatus('idle'); setActiveCall(null); });
      call.on('error', e => { setErr(e?.message || String(e)); setStatus('idle'); });
    } catch (e) {
      setErr(e?.message || String(e));
      setStatus('idle');
    }
  }

  function accept() { incoming?.accept(); }
  function decline() { incoming?.reject(); setIncoming(null); setStatus('idle'); }
  function hangup() { activeCall?.disconnect(); }

  return { ready, status, err, incoming, activeCall, dial, accept, decline, hangup };
}

function VoiceCallModal({ voice, onClose }) {
  const [callerName, setCallerName] = useState(null);

  // Look up the contact name for the other party (incoming From, or outgoing
  // To). Runs whenever the number in the modal changes. Key sees a real name
  // on incoming calls instead of just a phone number, so he knows who's
  // calling before he picks up.
  const otherNumber = voice.incoming
    ? voice.incoming.parameters?.From
    : (voice.activeCall?.parameters?.To || voice.activeCall?.customParameters?.get?.('To'));
  useEffect(() => {
    if (!otherNumber) { setCallerName(null); return; }
    const digits = String(otherNumber).replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) { setCallerName(null); return; }
    const normalized = `+1${digits}`;
    let alive = true;
    (async () => {
      const { data } = await db.from('contacts')
        .select('name').eq('phone', normalized).limit(1).maybeSingle();
      if (alive && data?.name) setCallerName(data.name);
    })();
    return () => { alive = false; };
  }, [otherNumber]);

  if (voice.status === 'idle' && !voice.incoming) return null;

  if (voice.incoming) {
    const from = voice.incoming.parameters?.From || 'UNKNOWN';
    const display = callerName ? `${callerName}\n${formatPhone(from)}` : formatPhone(from);
    return (
      <CallCard title="INCOMING CALL" color="var(--lcd-red)" name={display}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
          <button onClick={voice.decline} style={{
            width: 72, height: 72, background: 'var(--red)', color: '#fff',
            clipPath: 'var(--avatar-clip)', cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}>
            <svg viewBox="0 0 16 16" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
              <path d="M3 3 L13 13 M13 3 L3 13"/>
            </svg>
          </button>
          <button onClick={voice.accept} style={{
            width: 72, height: 72, background: 'var(--green)', color: '#fff',
            clipPath: 'var(--avatar-clip)', cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}>
            <svg viewBox="0 0 16 16" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
              <path d="M3 3 L5 3 L6 6 L5 7 A5 5 0 0 0 9 11 L10 10 L13 11 L13 13 A1 1 0 0 1 12 14 A11 11 0 0 1 2 4 A1 1 0 0 1 3 3 Z"/>
            </svg>
          </button>
        </div>
      </CallCard>
    );
  }

  // on-call or connecting
  const toNum = voice.activeCall?.parameters?.To || voice.activeCall?.customParameters?.get?.('To') || 'OUTBOUND';
  const onCallDisplay = callerName ? `${callerName}\n${formatPhone(toNum)}` : (toNum === 'OUTBOUND' ? 'OUTBOUND' : formatPhone(toNum));
  return (
    <CallCard
      title={voice.status === 'connecting' ? 'CONNECTING...' : 'ON CALL'}
      color={voice.status === 'connecting' ? 'var(--lcd-amber)' : 'var(--lcd-green)'}
      name={onCallDisplay}
    >
      <button onClick={voice.hangup} style={{
        width: '80%', margin: '0 auto', height: 56, background: 'var(--red)', color: '#fff',
        fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em',
        boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.2), inset -2px -2px 0 rgba(0,0,0,.4)',
        cursor: 'pointer', display: 'block',
      }}>HANG UP</button>
    </CallCard>
  );
}

function CallCard({ title, color, name, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'rgba(0,0,0,.7)',
      display: 'grid', placeItems: 'center',
    }}>
      <div style={{
        width: 320, padding: 24,
        background: 'var(--card)', boxShadow: 'var(--raised)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 140, height: 140, background: 'var(--navy)',
          clipPath: 'var(--avatar-clip)',
          display: 'grid', placeItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-chrome)', fontWeight: 700, color: 'var(--gold)', fontSize: 36 }}>
            {String(name || '?').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 20,
          textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.25,
        }}>{name}</div>
        <div style={{
          padding: '4px 12px', background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
          fontFamily: 'var(--font-pixel)', fontSize: 14,
          color, textShadow: color === 'var(--lcd-red)' ? 'var(--lcd-glow-red)' : color === 'var(--lcd-green)' ? 'var(--lcd-glow-green)' : 'var(--lcd-glow-amber)',
          letterSpacing: '.08em',
        }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

// ── Live Permits sub-view (7-step tiled board) ─────────────────────────────
// Step index: 0=SUBMIT 1=PAY 2=PAID 3=PRINT 4=PRINTED 5=INSPECT 6=PASS
// Stage → completed-step count:
//   3=BOOKED (nothing submitted yet)
//   4=PERMIT SUBMITTED (step 0 complete)
//   5=READY TO PAY     (step 0-1 in progress — we show 1 in-progress)
//   6=PAID             (step 0-2 complete)
//   7=READY TO PRINT   (0-2 complete, 3 in-progress)
//   8=PRINTED          (0-4 complete, 5 in-progress)
//   9=INSPECTED        (all 7 complete)
function stageToPermitCells(stage) {
  const cells = Array(7).fill('flat');
  const s = Number(stage) || 1;
  if (s >= 4) cells[0] = 'done';                      // SUBMIT
  if (s === 5) cells[1] = 'progress';
  else if (s >= 6) cells[1] = 'done';                 // PAY
  if (s >= 6) cells[2] = 'done';                      // PAID
  if (s === 7) cells[3] = 'progress';
  else if (s >= 8) cells[3] = 'done';                 // PRINT
  if (s >= 8) cells[4] = 'done';                      // PRINTED
  if (s === 8) cells[5] = 'progress';
  else if (s >= 9) cells[5] = 'done';                 // INSPECT SCHED
  if (s >= 9) cells[6] = 'done';                      // INSPECT PASS
  return cells;
}

function LivePermits() {
  const [rows, setRows] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [jurisdictionFilter, setJurisdictionFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  // Realtime: any contacts UPDATE (stage change, jurisdiction assigned,
  // DNC flip) can shift the permit dashboard rows. Cheap refetch on change.
  useEffect(() => {
    const ch = db.channel('permits-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => setRefreshTick(n => n + 1))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, []);

  useEffect(() => {
    (async () => {
      const [cRes, jRes] = await Promise.all([
        db.from('contacts').select('id, name, phone, address, stage, jurisdiction_id, created_at').in('stage', [3, 4, 5, 6, 7, 8, 9]).limit(100),
        db.from('permit_jurisdictions').select('id, name').order('name'),
      ]);
      const jurById = Object.fromEntries((jRes.data || []).map(j => [j.id, j]));
      // Smart Permits priority — rows Key should chase today come first.
      //   0  jurisdiction unset (blocks EVERYTHING — set it before any move)
      //   1  booked (stage 3) — needs permit submission started
      //   2  stage > 3 & aged > 7 days (stalled mid-permit-flow)
      //   3  in flight on schedule
      //   4  inspected / done
      const priority = (c) => {
        if (!c.jurisdiction_id) return 0;
        const stage = c.stage || 1;
        const ageDays = c.created_at ? (Date.now() - new Date(c.created_at).getTime()) / 86400000 : 0;
        if (stage === 3) return 1;
        if (stage >= 4 && stage <= 8 && ageDays > 7) return 2;
        if (stage >= 9) return 4;
        return 3;
      };
      const sorted = (cRes.data || []).slice().sort((a, b) => priority(a) - priority(b));
      setRows(sorted.map(c => ({
        id: c.id, name: displayNameFor(c), address: c.address || '—',
        stage: c.stage,
        createdAt: c.created_at,
        jurisdiction: c.jurisdiction_id ? jurById[c.jurisdiction_id]?.name : null,
        jurisdictionId: c.jurisdiction_id,
        cells: stageToPermitCells(c.stage),
        priority: priority(c),
      })));
      setJurisdictions(jRes.data || []);
      setLoading(false);
    })();
  }, [refreshTick]);

  // Smart chip per row — what the priority bucket means in words.
  const smartPermitFlag = (r) => {
    if (r.priority === 0) return { tone: 'red',  label: 'NO JURISDICTION' };
    if (r.priority === 1) return { tone: 'gold', label: 'SUBMIT NEXT' };
    if (r.priority === 2) return { tone: 'red',  label: 'STALLED' };
    return null;
  };

  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>LOADING PERMITS...</div>;

  const headers = ['SUBMIT', 'PAY', 'PAID', 'PRINT', 'PRINTED', 'INSPECT', 'PASS'];
  const filteredRows = rows.filter(r => {
    if (jurisdictionFilter === 'all') return true;
    if (jurisdictionFilter === 'unset') return !r.jurisdiction;
    return r.jurisdictionId === Number(jurisdictionFilter);
  });

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      {/* Jurisdiction filter chips — helpful when Key needs to batch-submit
          all Greenville permits on the same portal run, for example. */}
      {jurisdictions.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={() => setJurisdictionFilter('all')} style={{
            padding: '4px 12px', fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600,
            background: jurisdictionFilter === 'all' ? 'var(--navy)' : 'var(--card)',
            color: jurisdictionFilter === 'all' ? 'var(--gold)' : 'var(--text-muted)',
            boxShadow: jurisdictionFilter === 'all' ? 'var(--pressed-2)' : 'var(--raised-2)',
            cursor: 'pointer', border: 'none', letterSpacing: '.06em', textTransform: 'uppercase',
          }}>All ({rows.length})</button>
          <button onClick={() => setJurisdictionFilter('unset')} style={{
            padding: '4px 12px', fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600,
            background: jurisdictionFilter === 'unset' ? 'var(--navy)' : 'var(--card)',
            color: jurisdictionFilter === 'unset' ? 'var(--lcd-amber)' : 'var(--text-muted)',
            boxShadow: jurisdictionFilter === 'unset' ? 'var(--pressed-2)' : 'var(--raised-2)',
            cursor: 'pointer', border: 'none', letterSpacing: '.06em', textTransform: 'uppercase',
          }}>Unset ({rows.filter(r => !r.jurisdiction).length})</button>
          {jurisdictions.map(j => {
            const count = rows.filter(r => r.jurisdictionId === j.id).length;
            if (count === 0) return null;
            const active = jurisdictionFilter === String(j.id);
            return (
              <button key={j.id} onClick={() => setJurisdictionFilter(String(j.id))} style={{
                padding: '4px 12px', fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600,
                background: active ? 'var(--navy)' : 'var(--card)',
                color: active ? 'var(--gold)' : 'var(--text-muted)',
                boxShadow: active ? 'var(--pressed-2)' : 'var(--raised-2)',
                cursor: 'pointer', border: 'none', letterSpacing: '.06em', textTransform: 'uppercase',
              }}>{j.name} ({count})</button>
            );
          })}
        </div>
      ) : null}
      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 140px repeat(7, 44px) 1fr',
        gap: 8, alignItems: 'center',
        padding: '8px 14px',
        boxShadow: 'var(--pressed-2)', background: 'var(--card)',
        marginBottom: 8,
      }}>
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>CUSTOMER</span>
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>JURISDICTION</span>
        {headers.map(h => (
          <span key={h} className="chrome-label" style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>{h}</span>
        ))}
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>NEXT</span>
      </div>
      {filteredRows.map(r => {
        const smart = smartPermitFlag(r);
        return (
          <button key={r.id}
            onClick={() => r.id && (window.location.hash = `#contact=${r.id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px repeat(7, 44px) 1fr',
              gap: 8, alignItems: 'center',
              padding: '8px 14px',
              background: 'var(--card)',
              borderBottom: '1px solid rgba(0,0,0,.06)',
              border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              {smart ? <span className={`smart-chip smart-chip--${smart.tone}`}>{smart.label}</span> : null}
            </span>
            <span className="chrome-label" style={{
              fontSize: 10,
              color: r.jurisdiction ? 'var(--text)' : 'var(--lcd-amber)',
            }}>{r.jurisdiction || 'NOT SET'}</span>
            {r.cells.map((state, i) => <PermitStepCell key={i} state={state} />)}
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
              {!r.jurisdiction ? 'SET JURISDICTION' : stageToLabel(r.stage)}
            </span>
          </button>
        );
      })}
      {filteredRows.length === 0 ? <Empty label="NO ACTIVE PERMITS" /> : null}
    </div>
  );
}

function PermitStepCell({ state }) {
  // state: 'flat' | 'progress' | 'done' | 'blocked'
  if (state === 'done') {
    return <div style={{
      width: 40, height: 40, boxShadow: 'var(--pressed-2)', background: 'var(--card)',
      display: 'grid', placeItems: 'center', color: 'var(--green)',
    }}>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
        <path d="M3 8 L7 12 L13 4"/>
      </svg>
    </div>;
  }
  if (state === 'progress') {
    return <div className="tactile-raised" style={{
      width: 40, height: 40, boxShadow: 'var(--raised-2)', background: 'var(--card)',
      display: 'grid', placeItems: 'center', color: 'var(--lcd-amber)',
    }}>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
        <circle cx="8" cy="8" r="5"/>
        <path d="M8 4 L8 8 L11 10"/>
      </svg>
    </div>;
  }
  if (state === 'blocked') {
    return <div className="lcd" style={{
      width: 40, height: 40,
      display: 'grid', placeItems: 'center',
    }}>×</div>;
  }
  return <div style={{
    width: 40, height: 40, boxShadow: 'var(--pressed-2)', background: 'var(--card)',
  }}/>;
}

function stageToLabel(stage) {
  const s = Number(stage) || 1;
  if (s <= 3) return 'AWAITING SUBMIT';
  if (s === 4) return 'AWAITING PAYMENT';
  if (s === 5) return 'PAY PENDING';
  if (s === 6) return 'READY TO PRINT';
  if (s === 7) return 'PRINT PENDING';
  if (s === 8) return 'INSPECTION SOON';
  if (s === 9) return 'COMPLETE';
  return '—';
}

// ── Live Materials sub-view ─────────────────────────────────────────────────
// install_notes uses __pm_* prefix convention (from current crm.html):
//   __pm_amp: 30 | 50
//   __pm_box: 0|1
//   __pm_interlock: 0|1
//   __pm_cord: 0|1
//   __pm_breaker: 0|1
//   __pm_surge: 0|1
//   __pm_order: not-ordered | pending | received
function parseMaterials(notes) {
  const out = { amp: '30', box: 0, interlock: 0, cord: 0, breaker: 0, surge: 0, order: 'not-ordered' };
  if (!notes) return out;
  for (const line of String(notes).split('\n')) {
    const m = line.match(/^__pm_(\w+):\s*(.+)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'amp') out.amp = v.trim();
    else if (k === 'order') out.order = v.trim();
    else out[k] = v.trim() === '1' ? 1 : 0;
  }
  return out;
}

// Serialize materials state back to the __pm_* line-prefix format inside
// install_notes. Preserves any non-materials lines the user has typed.
function materialsToNotes(existingNotes, mat) {
  const keepLines = String(existingNotes || '')
    .split('\n')
    .filter(line => !/^__pm_\w+:/.test(line));
  const matLines = [
    `__pm_amp: ${mat.amp}`,
    `__pm_box: ${mat.box ? 1 : 0}`,
    `__pm_interlock: ${mat.interlock ? 1 : 0}`,
    `__pm_cord: ${mat.cord ? 1 : 0}`,
    `__pm_breaker: ${mat.breaker ? 1 : 0}`,
    `__pm_surge: ${mat.surge ? 1 : 0}`,
    `__pm_order: ${mat.order}`,
  ];
  return [...keepLines.filter(l => l.trim()), ...matLines].join('\n');
}

// Save a materials change back to contacts.install_notes. Toast on success/fail.
async function saveMaterialsForContact(contactId, mat) {
  const { data: existing } = await db.from('contacts').select('install_notes').eq('id', contactId).maybeSingle();
  const newNotes = materialsToNotes(existing?.install_notes, mat);
  const { error } = await db.from('contacts').update({ install_notes: newNotes }).eq('id', contactId);
  if (error) {
    window.__bpp_toast && window.__bpp_toast(`Materials save failed: ${error.message}`, 'error');
    return false;
  }
  return true;
}

function LiveMaterials() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Realtime: contacts UPDATE can change stage (card moves in/out of the
  // stage-3-8 window) or install_notes (Alex writes memory, Key edits the
  // Notes tab). Cheap refetch on any change. Ignore our own optimistic
  // updates by debouncing through refreshTick.
  useEffect(() => {
    const ch = db.channel('materials-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => setRefreshTick(n => n + 1))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('contacts')
        .select('id, name, phone, address, stage, install_notes, install_date')
        .in('stage', [3, 4, 5, 6, 7, 8])
        .limit(50);
      const shaped = (data || []).map(c => ({
        id: c.id, name: displayNameFor(c), address: c.address || '—',
        stage: c.stage,
        installDate: c.install_date,
        mat: parseMaterials(c.install_notes),
      }));
      // Smart Materials sort: installs soonest + unordered parts first.
      // A lead with install in 2 days and BOX unchecked is the most urgent
      // row; a lead with install in 3 weeks and all parts "received" goes
      // to the bottom. Rows without install_date fall through to recency.
      const priority = (r) => {
        const allReceived = r.mat.order === 'received';
        const hasInstall = !!r.installDate;
        if (!hasInstall) return 6;
        const days = (new Date(r.installDate).getTime() - Date.now()) / 86400000;
        if (days < 0) return allReceived ? 5 : 0; // past-due install still missing parts = top
        if (days <= 3) return allReceived ? 3 : 1;
        if (days <= 7) return allReceived ? 4 : 2;
        return allReceived ? 5 : 3;
      };
      shaped.sort((a, b) => priority(a) - priority(b));
      setRows(shaped);
      setLoading(false);
    })();
  }, [refreshTick]);

  // Smart Materials chip — names the urgency of the row so Key scans the
  // list and knows which to order today.
  const smartMaterialsFlag = (r) => {
    const allReceived = r.mat.order === 'received';
    if (!r.installDate) return null;
    const days = (new Date(r.installDate).getTime() - Date.now()) / 86400000;
    if (days < 0 && !allReceived) return { tone: 'red',  label: 'INSTALL PAST · PARTS MISSING' };
    if (days <= 3 && !allReceived) return { tone: 'red',  label: 'INSTALL IN ≤3D' };
    if (days <= 7 && !allReceived) return { tone: 'gold', label: 'ORDER THIS WEEK' };
    return null;
  };

  // Apply a change to one row optimistically then persist
  const updateRow = useCallback(async (rowId, nextMat) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, mat: nextMat } : r));
    setSavingId(rowId);
    const ok = await saveMaterialsForContact(rowId, nextMat);
    setSavingId(null);
    if (!ok) {
      // Re-fetch to rollback on error
      const { data } = await db.from('contacts').select('id, install_notes').eq('id', rowId).maybeSingle();
      if (data) {
        const mat = parseMaterials(data.install_notes);
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, mat } : r));
      }
    }
  }, []);

  const toggleField = (row, field) => updateRow(row.id, { ...row.mat, [field]: row.mat[field] ? 0 : 1 });
  const setAmp = (row, amp) => updateRow(row.id, { ...row.mat, amp });
  const cycleOrder = (row) => {
    const order = row.mat.order === 'not-ordered' ? 'pending'
                : row.mat.order === 'pending'     ? 'received'
                                                  : 'not-ordered';
    updateRow(row.id, { ...row.mat, order });
  };

  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>LOADING MATERIALS...</div>;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px repeat(5, 44px) 100px',
        gap: 8, alignItems: 'center',
        padding: '8px 14px',
        boxShadow: 'var(--pressed-2)', background: 'var(--card)',
        marginBottom: 8,
      }}>
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>CUSTOMER</span>
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>AMP</span>
        {['BOX', 'LOCK', 'CORD', 'BRKR', 'SRGE'].map(l => (
          <span key={l} className="chrome-label" style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>{l}</span>
        ))}
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>ORDER</span>
      </div>
      {rows.map(r => {
        const orderTint =
          r.mat.order === 'received' ? 'var(--ms-2)' :
          r.mat.order === 'pending'  ? 'var(--ms-4)' :
                                        'var(--ms-3)';
        const orderText =
          r.mat.order === 'received' ? 'received' :
          r.mat.order === 'pending'  ? 'pending'  :
                                        'not ordered';
        return (
          <div key={r.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px repeat(5, 44px) 100px',
            gap: 8, alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--card)',
            borderBottom: '1px solid rgba(0,0,0,.06)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <button
                onClick={() => r.id && (window.location.hash = `#contact=${r.id}`)}
                title={r.address !== '—' ? r.address : r.name}
                style={{
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text)', textAlign: 'left', padding: 0,
                }}>{r.name}</button>
              {(() => { const f = smartMaterialsFlag(r); return f ? <span className={`smart-chip smart-chip--${f.tone}`}>{f.label}</span> : null; })()}
            </span>
            <div style={{ display: 'flex', height: 24, boxShadow: 'var(--raised-2)' }}>
              <button onClick={() => setAmp(r, '30')} style={{
                flex: 1, fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '.04em',
                display: 'grid', placeItems: 'center',
                background: r.mat.amp === '30' ? 'var(--navy)' : 'transparent',
                color: r.mat.amp === '30' ? 'var(--gold)' : 'var(--text-faint)',
                border: 'none', cursor: 'pointer',
              }}>30A</button>
              <button onClick={() => setAmp(r, '50')} style={{
                flex: 1, fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '.04em',
                display: 'grid', placeItems: 'center',
                background: r.mat.amp === '50' ? 'var(--navy)' : 'transparent',
                color: r.mat.amp === '50' ? 'var(--gold)' : 'var(--text-faint)',
                border: 'none', cursor: 'pointer',
              }}>50A</button>
            </div>
            <MatCheck on={r.mat.box} onClick={() => toggleField(r, 'box')} />
            <MatCheck on={r.mat.interlock} onClick={() => toggleField(r, 'interlock')} />
            <MatCheck on={r.mat.cord} onClick={() => toggleField(r, 'cord')} />
            <MatCheck on={r.mat.breaker} onClick={() => toggleField(r, 'breaker')} />
            <MatCheck on={r.mat.surge} onClick={() => toggleField(r, 'surge')} />
            <button onClick={() => cycleOrder(r)} style={{
              padding: '4px 8px', textAlign: 'center',
              color: orderTint, fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '.04em',
              border: 'none', cursor: 'pointer', background: 'transparent',
              opacity: savingId === r.id ? 0.5 : 1,
            }}>{orderText}</button>
          </div>
        );
      })}
      {rows.length === 0 ? <Empty label="NO ACTIVE MATERIALS" /> : null}
    </div>
  );
}

function MatCheck({ on, onClick }) {
  const base = {
    width: 32, height: 32, background: 'var(--card)',
    cursor: onClick ? 'pointer' : 'default',
    border: 'none', padding: 0,
  };
  if (on) {
    return <button onClick={onClick} style={{
      ...base, boxShadow: 'var(--pressed-2)',
      display: 'grid', placeItems: 'center', color: 'var(--green)',
    }}>
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
        <path d="M3 8 L7 12 L13 4"/>
      </svg>
    </button>;
  }
  return <button onClick={onClick} style={{ ...base, boxShadow: 'var(--raised-2)' }} aria-label="Check off" />;
}

// ── Funnel widget primitives ───────────────────────────────────────────────
// Compact stage-count + conversion-arrow used in the Finance 7-day funnel.
// Kept deliberately plain — no LCD chrome, no bevels beyond the parent strip.
function FunnelStep({ label, count }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '.08em' }}>{label}</span>
    </span>
  );
}
function FunnelArrow({ rate }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'var(--text-faint)' }}>
      <span className="mono" style={{ fontSize: 9, letterSpacing: '.04em' }}>{rate}</span>
      <span style={{ fontSize: 12, lineHeight: 1 }}>→</span>
    </span>
  );
}

// ── Live Finance (KPI strip + proposals/invoices/payments tables) ──────────
function LiveFinance({ initialSub = 'prop' } = {}) {
  const [data, setData] = useState({
    proposals: [], invoices: [], payments: [],
    installsThisWeek: 0,
    // 7-day funnel counts — top-of-funnel to bottom
    newLeads7d: 0, proposals7d: 0, depositsPaid7d: 0, installs7d: 0,
    loading: true,
  });
  const [subView, setSubView] = useState(initialSub);
  const [refreshTick, setRefreshTick] = useState(0);

  // Realtime: re-run the fetch when anything Finance-relevant changes.
  // Debounces via refreshTick; the dependency below picks up the next tick.
  useEffect(() => {
    const bump = () => setRefreshTick(n => n + 1);
    const ch = db.channel('finance-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, bump)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, []);

  useEffect(() => {
    (async () => {
      const weekAgoIso = new Date(Date.now() - 7 * 86400000).toISOString();
      const [propRes, invRes, payRes, historyRes, newLeadsRes, proposals7dRes, deposits7dRes] = await Promise.all([
        db.from('proposals').select('id, contact_id, contact_name, total, status, signed_at, viewed_at, view_count, created_at').order('created_at', { ascending: false }).limit(20),
        db.from('invoices').select('id, contact_id, contact_name, total, status, notes, paid_at, created_at').order('created_at', { ascending: false }).limit(20),
        db.from('payments').select('id, contact_id, amount, method, created_at').order('created_at', { ascending: false }).limit(20),
        // Installs-this-week: transitions to stage 9 (inspection/done) in last 7 days
        db.from('stage_history').select('contact_id, to_stage, changed_at').eq('to_stage', 9).gte('changed_at', weekAgoIso),
        // Funnel: new leads in last 7d (head=count-only keeps the query cheap)
        db.from('contacts').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
        // Funnel: proposals created in last 7d
        db.from('proposals').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
        // Funnel: deposits paid in last 7d (invoices with notes=deposit that went to paid)
        db.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'paid').eq('notes', 'deposit').gte('paid_at', weekAgoIso),
      ]);
      const uniqueInstalls = new Set((historyRes.data || []).map(r => r.contact_id));
      // Resolve contact rows for all referenced contact_ids so the
      // Payments / Proposals / Invoices tables can fall back from a stored
      // "Unknown" contact_name to the phone last-4 via displayNameFor.
      const allIds = new Set();
      for (const p of (payRes.data || []))  if (p.contact_id) allIds.add(p.contact_id);
      for (const p of (propRes.data || [])) if (p.contact_id) allIds.add(p.contact_id);
      for (const p of (invRes.data || []))  if (p.contact_id) allIds.add(p.contact_id);
      const idsArr = Array.from(allIds);
      const { data: refContacts } = idsArr.length
        ? await db.from('contacts').select('id, name, phone').in('id', idsArr)
        : { data: [] };
      const nameById = Object.fromEntries((refContacts || []).map(c => [c.id, displayNameFor(c)]));
      const patchName = (row) => nameById[row.contact_id] || displayNameFor({ name: row.contact_name }) || row.contact_name || null;

      setData({
        proposals: (propRes.data || []).map(p => ({ ...p, contact_name: patchName(p) })),
        invoices:  (invRes.data  || []).map(p => ({ ...p, contact_name: patchName(p) })),
        payments:  (payRes.data  || []).map(p => ({ ...p, contact_name: patchName(p) })),
        installsThisWeek: uniqueInstalls.size,
        newLeads7d: newLeadsRes.count || 0,
        proposals7d: proposals7dRes.count || 0,
        depositsPaid7d: deposits7dRes.count || 0,
        installs7d: uniqueInstalls.size,
        loading: false,
      });
    })();
  }, [refreshTick]);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const outstanding = data.invoices
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const paidThisMonth = data.invoices
      .filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at).getTime() >= monthStart)
      .reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const awaitingDeposit = data.invoices.filter(i => i.notes === 'deposit' && i.status !== 'paid').length;
    const overdue = data.invoices.filter(i => {
      if (i.status === 'paid' || i.status === 'cancelled') return false;
      const age = (Date.now() - new Date(i.created_at).getTime()) / 86400000;
      return age > 14;
    }).length;
    return { outstanding, paidThisMonth, awaitingDeposit, overdue };
  }, [data]);

  const subTabs = [
    { id: 'prop', label: 'Proposals', count: data.proposals.length },
    { id: 'inv',  label: 'Invoices',  count: data.invoices.length },
    { id: 'pay',  label: 'Payments',  count: data.payments.length },
  ];

  if (data.loading) {
    return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>LOADING FINANCE...</div>;
  }

  // 7-day conversion funnel — top-of-funnel to bottom. Conversion percent
  // is shown between stages so Key sees where leads drop off.
  // e.g. 20 NEW → 10 QUOTED (50%) → 3 PAID (30%) → 1 INSTALLED (33%)
  const pct = (num, den) => den > 0 ? Math.round((num / den) * 100) + '%' : '—';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 7-day funnel — the CEO glance: top-of-funnel + conversion rates */}
      <div style={{
        margin: '16px 16px 0', padding: '10px 14px',
        background: 'var(--card)', boxShadow: 'var(--pressed-2)',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        fontFamily: 'var(--font-body)', fontSize: 12,
      }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '.08em', marginRight: 4 }}>
          LAST 7 DAYS
        </span>
        <FunnelStep label="NEW" count={data.newLeads7d} />
        <FunnelArrow rate={pct(data.proposals7d, data.newLeads7d)} />
        <FunnelStep label="QUOTED" count={data.proposals7d} />
        <FunnelArrow rate={pct(data.depositsPaid7d, data.proposals7d)} />
        <FunnelStep label="PAID" count={data.depositsPaid7d} />
        <FunnelArrow rate={pct(data.installs7d, data.depositsPaid7d)} />
        <FunnelStep label="INSTALLED" count={data.installs7d} />
      </div>
      {/* KPI strip */}
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <KpiCard label="INSTALLS THIS WEEK" value={String(data.installsThisWeek).padStart(2, '0')} tone="green" />
        <KpiCard label="OUTSTANDING" value={`$${kpis.outstanding.toLocaleString()}`} tone="red" onClick={() => setSubView('inv')} />
        <KpiCard label="THIS MONTH" value={`$${kpis.paidThisMonth.toLocaleString()}`} tone="green" onClick={() => setSubView('pay')} />
        <KpiCard label="DEPOSITS PENDING" value={String(kpis.awaitingDeposit).padStart(2, '0')} tone="amber" onClick={() => setSubView('inv')} />
        <KpiCard label="OVERDUE" value={String(kpis.overdue).padStart(2, '0')} tone={kpis.overdue > 0 ? 'red' : 'green'} onClick={() => setSubView('inv')} />
      </div>
      {/* Sub tabs */}
      <div style={{ padding: '0 16px', display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,0,0,.08)' }}>
        {subTabs.map(s => (
          <button key={s.id} onClick={() => setSubView(s.id)} style={{
            height: 40, padding: '0 16px', fontSize: 13,
            fontFamily: 'var(--font-body)', fontWeight: s.id === subView ? 600 : 500,
            color: s.id === subView ? 'var(--text)' : 'var(--text-muted)',
            borderBottom: s.id === subView ? '2px solid var(--gold)' : '2px solid transparent',
            cursor: 'pointer', background: 'transparent', border: 'none',
            borderBottomStyle: 'solid',
          }}>{s.label} <span style={{ color: 'var(--text-faint)', marginLeft: 4, fontWeight: 400 }}>{s.count}</span></button>
        ))}
      </div>
      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {subView === 'prop' && <ProposalsLiveTable rows={data.proposals} />}
        {subView === 'inv'  && <InvoicesLiveTable  rows={data.invoices} />}
        {subView === 'pay'  && <PaymentsLiveFeed   rows={data.payments} />}
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone = 'red', onClick }) {
  // Minimal: a big number over a tiny label. Color tone tints only the
  // label. Clickable cards get a subtle hover state.
  const toneColor = tone === 'green' ? 'var(--ms-2)' : tone === 'amber' ? 'var(--ms-4)' : 'var(--ms-3)';
  const Wrap = onClick ? 'button' : 'div';
  return (
    <Wrap onClick={onClick} style={{
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
      background: 'var(--card)', boxShadow: 'var(--raised-2)',
      border: 'none', textAlign: 'left',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 700,
        color: 'var(--text)', letterSpacing: '-.01em',
      }}>{value}</div>
      <div className="chrome-label" style={{ fontSize: 10, color: toneColor, letterSpacing: '.08em' }}>{label}</div>
    </Wrap>
  );
}

// Turn an unpaid proposal's age into a follow-up prompt, per Key's
// 3-move silent-prospect framework:
//   < 48hr              — normal (no nudge)
//   48hr → 4d           — F/U 1 (amber, send new info)
//   4d → 7d             — F/U 2 (orange, reference their specific concern)
//   7d+                 — EXIT (red, exit message)
// Approved / Cancelled proposals get no nudge (either closed or dead).
function followUpState(p) {
  if (p.status === 'Approved' || p.status === 'Cancelled') return null;
  if (!p.created_at) return null;
  const days = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
  if (days < 2)  return null;
  if (days < 4)  return { label: 'F/U 1',  tint: 'var(--ms-4)' };
  if (days < 7)  return { label: 'F/U 2',  tint: 'var(--ms-3)' };
  return                { label: 'EXIT',   tint: 'var(--ms-3)' };
}

// Smart Proposals — compute the row's most actionable signal.
// Priorities (one chip max, highest wins):
//   HOT       viewed ≥3 times, not approved, <7d old (peak-interest window)
//   UNOPENED  zero views, copied ≥2d ago (push the link)
//   EXIT      aged past F/U 2 without approval (send goodbye)
//   REPEAT    viewed ≥10 times but still not approved (stuck on price/deposit)
// Returns { tone, label } or null.
function smartProposalFlag(p) {
  const status = (p.status || '').toLowerCase();
  if (status === 'approved' || status === 'declined' || status === 'cancelled') return null;
  const views = Number(p.view_count) || 0;
  const ageDays = p.created_at ? (Date.now() - new Date(p.created_at).getTime()) / 86400000 : 0;
  if (views >= 10) return { tone: 'red', label: 'STUCK' };
  if (views >= 3 && ageDays < 7) return { tone: 'gold', label: 'HOT' };
  if (views === 0 && ageDays >= 2) return { tone: 'red', label: 'UNOPENED' };
  if (ageDays >= 7) return { tone: 'red', label: 'EXIT' };
  return null;
}

function ProposalsLiveTable({ rows }) {
  if (rows.length === 0) return <Empty label="NO PROPOSALS" />;
  const statusTint = {
    sent: 'var(--ms-1)', viewed: 'var(--ms-4)', approved: 'var(--ms-2)',
    expired: 'var(--ms-5)', declined: 'var(--ms-3)',
  };
  // Smart sort: HOT first (peak interest — close now), then UNOPENED
  // (customer never saw the quote), then everything else by recency.
  const sortRank = (p) => {
    const f = smartProposalFlag(p);
    if (!f) return 5;
    if (f.label === 'HOT') return 0;
    if (f.label === 'STUCK') return 1;
    if (f.label === 'UNOPENED') return 2;
    if (f.label === 'EXIT') return 3;
    return 4;
  };
  const sorted = rows.slice().sort((a, b) => {
    const r = sortRank(a) - sortRank(b);
    if (r !== 0) return r;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  return (
    <div style={{ background: 'var(--card)', boxShadow: 'var(--raised-2)' }}>
      {sorted.map((p, i) => {
        const status = (p.status || 'sent').toLowerCase();
        const tint = statusTint[status] || 'var(--text-faint)';
        const fu = followUpState(p);
        const views = Number(p.view_count) || 0;
        const smart = smartProposalFlag(p);
        return (
          <div key={p.id}
            onClick={() => p.contact_id && (window.location.hash = `#contact=${p.contact_id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: '64px 1fr 80px 54px 70px 90px 100px',
              gap: 12, alignItems: 'center',
              padding: '12px 16px',
              borderBottom: i < sorted.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
              cursor: p.contact_id ? 'pointer' : 'default',
            }}>
            <span>{smart ? <span className={`smart-chip smart-chip--${smart.tone}`}>{smart.label}</span> : null}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>{p.contact_name || '—'}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
            </span>
            <span className="mono" title={views === 0 ? 'Customer has not opened the quote' : `Customer opened the quote ${views} time${views === 1 ? '' : 's'}`} style={{
              fontSize: 11, textAlign: 'center',
              color: views === 0 ? 'var(--ms-3)' : views >= 3 ? 'var(--ms-2)' : 'var(--text-muted)',
            }}>{views === 0 ? '👁 0' : `👁 ${views}`}</span>
            {fu ? (
              <span className="chrome-label" style={{
                fontSize: 10, color: fu.tint, textAlign: 'center', letterSpacing: '.08em',
                border: `1px solid ${fu.tint}`, padding: '2px 4px',
              }}>{fu.label}</span>
            ) : <span />}
            <span className="chrome-label" style={{
              fontSize: 10, color: tint, textAlign: 'center', letterSpacing: '.08em',
            }}>{status.toLowerCase()}</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
              ${(Number(p.total) || 0).toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Smart Invoices — surface the row's most actionable signal so Key can
// scan a stack of open invoices and see who to chase first.
//   VIEWED·UNPAID   customer opened it but didn't pay (peak push window)
//   OVERDUE         >7d since send, still unpaid
//   UNOPENED        >2d since send, customer never opened the link
//   STALE           >14d old, give up or switch to cash
function smartInvoiceFlag(inv) {
  const status = (inv.status || '').toLowerCase();
  if (status === 'paid' || status === 'cancelled') return null;
  const ageDays = inv.created_at ? (Date.now() - new Date(inv.created_at).getTime()) / 86400000 : 0;
  const viewed = !!inv.viewed_at;
  if (ageDays >= 14) return { tone: 'red',  label: 'STALE' };
  if (viewed && ageDays >= 1) return { tone: 'gold', label: 'VIEWED · UNPAID' };
  if (ageDays >= 7) return { tone: 'red',  label: 'OVERDUE' };
  if (!viewed && ageDays >= 2) return { tone: 'red',  label: 'UNOPENED' };
  return null;
}

function InvoicesLiveTable({ rows }) {
  if (rows.length === 0) return <Empty label="NO INVOICES" />;
  // invoices.notes is populated by proposal-deposit-checkout as either
  // 'deposit' (50%) or 'full_payment' (100%).
  const kindLabel = (n) => {
    if (n === 'deposit') return 'deposit';
    if (n === 'full_payment') return 'full';
    return '—';
  };
  // Sort unpaid to the top, weighted by the smart flag priority.
  const sortRank = (inv) => {
    const status = (inv.status || '').toLowerCase();
    if (status === 'paid') return 9;
    if (status === 'cancelled') return 8;
    const f = smartInvoiceFlag(inv);
    if (!f) return 5;
    if (f.label === 'VIEWED · UNPAID') return 0;
    if (f.label === 'OVERDUE') return 1;
    if (f.label === 'UNOPENED') return 2;
    if (f.label === 'STALE') return 3;
    return 4;
  };
  const sorted = rows.slice().sort((a, b) => {
    const r = sortRank(a) - sortRank(b);
    if (r !== 0) return r;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  return (
    <div style={{ background: 'var(--card)', boxShadow: 'var(--raised-2)' }}>
      {sorted.map((inv, i) => {
        const paid = inv.status === 'paid';
        const tint = paid ? 'var(--ms-2)' : 'var(--ms-3)';
        const smart = smartInvoiceFlag(inv);
        return (
          <div key={inv.id}
            onClick={() => inv.contact_id && (window.location.hash = `#contact=${inv.contact_id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 100px 70px 100px 100px',
              gap: 12, alignItems: 'center',
              padding: '12px 16px',
              borderBottom: i < sorted.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
              cursor: inv.contact_id ? 'pointer' : 'default',
            }}>
            <span>{smart ? <span className={`smart-chip smart-chip--${smart.tone}`}>{smart.label}</span> : null}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>{inv.contact_name || '—'}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
            </span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '.04em' }}>
              {kindLabel(inv.notes)}
            </span>
            <span className="chrome-label" style={{
              fontSize: 10, color: tint, textAlign: 'center', letterSpacing: '.08em',
            }}>{(inv.status || 'sent').toLowerCase()}</span>
            <span className="mono" style={{
              fontSize: 13, fontWeight: 700, textAlign: 'right',
              color: paid ? 'var(--ms-2)' : 'var(--text)',
            }}>
              ${(Number(inv.total) || 0).toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PaymentsLiveFeed({ rows }) {
  if (rows.length === 0) return <Empty label="NO PAYMENTS YET" />;
  return (
    <div style={{ boxShadow: 'var(--pressed-2)', background: 'var(--card)' }}>
      {rows.map((p, i) => (
        <div key={p.id} style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr 120px',
          gap: 12, alignItems: 'center',
          padding: '10px 14px',
          borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
        }}>
          <span className="pixel" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
          </span>
          <span
            onClick={() => p.contact_id && (window.location.hash = `#contact=${p.contact_id}`)}
            style={{ fontFamily: 'var(--font-body)', fontSize: 13, cursor: p.contact_id ? 'pointer' : 'default' }}>
            {p.contact_name || '—'} · <span style={{ color: 'var(--text-muted)' }}>{p.method || 'Payment'}</span>
          </span>
          <span className="mono" style={{
            fontSize: 14, fontWeight: 700, textAlign: 'right',
            color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)',
          }}>
            ${(Number(p.amount) || 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// Smart Empty state — pairs a pixel label with a plain-English hint the
// smart layer thinks is the most useful next step. Hints are keyed off
// the `label` so each surface gets something relevant without having to
// pass a hint prop from every caller. Falls back to just the label.
const EMPTY_HINTS = {
  'NO PROPOSALS':       "Open a contact and press Q — QuickQuote drafts one in 10 seconds.",
  'NO INVOICES':        "Invoices auto-generate when a proposal is approved and a deposit link is sent.",
  'NO PAYMENTS YET':    "Stripe payments land here once a customer clicks Pay on an invoice.",
  'NO ACTIVE PERMITS':  "Permits show up once a contact moves to stage 3 (Booked). Want to skip ahead?",
  'NO ACTIVE MATERIALS':"Parts tracker activates when someone books. Nobody in the pipeline yet.",
  'NO CALLS YET':       "Inbound and outbound calls log here once Twilio Voice dials out.",
  'NO MATCHES':         "No matches — try a looser term, or ⌘K for smart search ('who owes me money').",
  'NO ACTIVITY YET':    "Activity shows up here as Alex messages, quotes, and stage changes roll in.",
};
function Empty({ label, hint }) {
  const key = (label || '').toUpperCase().trim();
  const body = hint || EMPTY_HINTS[key] || null;
  return (
    <div style={{
      padding: 48, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 10,
      textAlign: 'center', letterSpacing: '.04em',
    }}>
      <div className="chrome-label" style={{
        fontSize: 11, letterSpacing: '.14em',
        color: 'var(--text-muted)',
      }}>◆ {(label || '').toLowerCase()}</div>
      {body ? (
        <div style={{
          fontSize: 12, lineHeight: 1.5,
          maxWidth: 360, color: 'var(--text-faint)',
          fontFamily: 'var(--font-body)', letterSpacing: 0,
        }}>{body}</div>
      ) : null}
    </div>
  );
}

// ── Live Calendar — weekly grid view ────────────────────────────────────────
// Proper Sun-Sat columns showing install_date blocks where they land in time.
// Key scrolls through weeks via prev/next/today, filters by installer, and
// sees unscheduled-but-booked contacts in a sidebar so he can drag-n-quote
// the scheduling in his head. Click any block or the sidebar row to open
// that contact.
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  d.setDate(d.getDate() - day); // walk back to Sunday
  return d;
}

function LiveCalendar() {
  const [scheduled, setScheduled] = useState([]);
  const [unscheduled, setUnscheduled] = useState([]);
  const [events, setEvents] = useState([]); // non-install calendar_events rows
  const [installers, setInstallers] = useState([]);
  const [installerFilter, setInstallerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalDefaults, setEventModalDefaults] = useState({});
  // Which week is on screen. Default = this week (Sun of current week).
  // Prev/Next buttons shift by 7 days; Today snaps back.
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    const ch = db.channel('calendar-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => setRefreshTick(n => n + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => setRefreshTick(n => n + 1))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Scheduled: anything with install_date within 6 months ±. Gives Key
      // room to scroll forward for future bookings + back for recent history
      // without refetching per week swap.
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();
      const sixMonthsAhead = new Date(Date.now() + 180 * 86400000).toISOString();
      const [schedRes, unschedRes, eventsRes] = await Promise.all([
        db.from('contacts')
          .select('id, name, address, stage, install_date, assigned_installer, installer_pay, do_not_contact')
          .not('install_date', 'is', null)
          .gte('install_date', sixMonthsAgo)
          .lte('install_date', sixMonthsAhead)
          .order('install_date', { ascending: true })
          .limit(200),
        db.from('contacts')
          .select('id, name, address, stage, assigned_installer')
          .is('install_date', null)
          .in('stage', [3, 4, 5, 6, 7, 8])
          .eq('do_not_contact', false)
          .order('created_at', { ascending: false })
          .limit(40),
        // Non-install events: material pickups, meetings, inspection walks,
        // anything Key wants on the calendar that isn't tied to a single
        // contact.install_date row.
        db.from('calendar_events')
          .select('id, title, start_at, end_at, contact_id, notes, event_type, contacts(id, name)')
          .gte('start_at', sixMonthsAgo)
          .lte('start_at', sixMonthsAhead)
          .order('start_at', { ascending: true })
          .limit(200),
      ]);
      setScheduled(schedRes.data || []);
      setUnscheduled(unschedRes.data || []);
      setEvents(eventsRes.data || []);
      const installerSet = new Set();
      for (const r of [...(schedRes.data || []), ...(unschedRes.data || [])]) {
        if (r.assigned_installer) installerSet.add(r.assigned_installer);
      }
      setInstallers(Array.from(installerSet).sort());
      setLoading(false);
    })();
  }, [refreshTick]);

  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>LOADING CALENDAR...</div>;

  const filterFn = (e) => {
    if (installerFilter === 'all') return true;
    if (installerFilter === 'unassigned') return !e.assigned_installer;
    return e.assigned_installer === installerFilter;
  };
  const filteredScheduled = scheduled.filter(filterFn);
  const filteredUnscheduled = unscheduled.filter(filterFn);

  // Build the 7 day columns for the current weekStart.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Bucket installs into the 7 day keys for the current week. Anything outside
  // the current week is simply hidden until Key scrolls to that week.
  const weekInstalls = {};
  const weekEvents = {};
  days.forEach(d => { weekInstalls[dayKey(d)] = []; weekEvents[dayKey(d)] = []; });
  for (const inst of filteredScheduled) {
    const d = new Date(inst.install_date);
    const key = dayKey(d);
    if (key in weekInstalls) weekInstalls[key].push(inst);
  }
  for (const ev of events) {
    const d = new Date(ev.start_at);
    const key = dayKey(d);
    if (key in weekEvents) weekEvents[key].push(ev);
  }
  // Sort each day's installs + events by time-of-day so the column reads
  // top-to-bottom morning-to-evening.
  for (const k of Object.keys(weekInstalls)) {
    weekInstalls[k].sort((a, b) => new Date(a.install_date).getTime() - new Date(b.install_date).getTime());
    weekEvents[k].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isToday = (d) => d.getTime() === today.getTime();
  const weekLabel = (() => {
    const end = days[6];
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const monthFmt = { month: 'short' };
    return sameMonth
      ? `${weekStart.toLocaleDateString(undefined, monthFmt)} ${weekStart.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
      : `${weekStart.toLocaleDateString(undefined, monthFmt)} ${weekStart.getDate()} – ${end.toLocaleDateString(undefined, monthFmt)} ${end.getDate()}, ${end.getFullYear()}`;
  })();

  const stepWeek = (delta) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  return (
    <div style={{ height: '100%', padding: 24, overflow: 'auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 0 auto' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>Installs</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
            {weekLabel} · {filteredScheduled.length} scheduled · {filteredUnscheduled.length} awaiting date
            {installerFilter !== 'all' ? ` · ${installerFilter}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
          <button onClick={() => {
            // datetime-local expects LOCAL time in YYYY-MM-DDTHH:mm. Using
            // toISOString().slice gives UTC which shows up offset from Key's
            // wall clock. Build the string from local fields.
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const nowLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            setEventModalDefaults({ start_at: nowLocal });
            setEventModalOpen(true);
          }} title="Add event to the calendar" style={{
            padding: '0 12px', height: 32, background: 'var(--card)', color: 'var(--text)',
            boxShadow: 'var(--raised-2)', fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '.06em', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}>+ EVENT</button>
          <button onClick={() => stepWeek(-1)} title="Previous week" style={{
            width: 32, height: 32, background: 'var(--card)', boxShadow: 'var(--raised-2)',
            border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)',
          }}>‹</button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} title="Jump to this week" style={{
            padding: '0 14px', height: 32, background: 'var(--navy)', color: 'var(--gold)',
            boxShadow: 'var(--raised-2)', fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '.08em', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}>TODAY</button>
          <button onClick={() => stepWeek(1)} title="Next week" style={{
            width: 32, height: 32, background: 'var(--card)', boxShadow: 'var(--raised-2)',
            border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)',
          }}>›</button>
        </div>
      </div>

      {installers.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {['all', 'unassigned', ...installers].map(i => (
            <button key={i} onClick={() => setInstallerFilter(i)} style={{
              padding: '4px 12px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600,
              background: installerFilter === i ? 'var(--navy)' : 'var(--card)',
              color: installerFilter === i ? 'var(--gold)' : 'var(--text-muted)',
              boxShadow: installerFilter === i ? 'var(--pressed-2)' : 'var(--raised-2)',
              cursor: 'pointer', border: 'none', letterSpacing: '.06em', textTransform: 'uppercase',
            }}>{i}</button>
          ))}
        </div>
      ) : null}

      {/* 7-day grid. Mobile collapses to stacked day cards; desktop keeps 7
          columns. Each day column shows header + a stack of install blocks. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 4,
      }}>
        {days.map(d => {
          const key = dayKey(d);
          const items = weekInstalls[key] || [];
          const dayEvents = weekEvents[key] || [];
          const highlight = isToday(d);
          // Smart Calendar day heat — subtle top stripe tinted by how busy
          // the day is. Also detects time overlaps (two installs within
          // 2 hours of each other) and surfaces a warning chip.
          const totalItems = items.length + dayEvents.length;
          const heatTone = totalItems === 0 ? null
                         : totalItems === 1 ? 'green'
                         : totalItems === 2 ? 'gold'
                                            : 'red';
          const times = items.map(i => new Date(i.install_date).getTime()).sort();
          let hasOverlap = false;
          for (let i = 1; i < times.length; i++) {
            if (times[i] - times[i - 1] < 2 * 3600 * 1000) { hasOverlap = true; break; }
          }
          return (
            <div key={key} style={{
              minHeight: 220,
              background: highlight ? 'var(--card)' : 'var(--card)',
              boxShadow: hasOverlap
                ? 'inset 0 0 0 2px var(--red), var(--pressed-2)'
                : 'var(--pressed-2)',
              display: 'flex', flexDirection: 'column',
              borderLeft: highlight ? '3px solid var(--gold)' : '3px solid transparent',
              position: 'relative',
            }}>
              {/* Smart heat strip — 4px stripe on top of the day column.
                  Red = ≥3 items (packed), gold = 2 (tight), green = 1 (one
                  install). No strip on empty days. */}
              {heatTone ? (
                <div className={`smart-bar smart-bar--${heatTone}`} title={`${totalItems} item${totalItems === 1 ? '' : 's'} scheduled`} />
              ) : null}
              {hasOverlap ? (
                <div title="Two installs booked within 2 hours of each other" style={{
                  position: 'absolute', right: 6, top: 6,
                  zIndex: 2,
                }}>
                  <span className="smart-chip smart-chip--red">OVERLAP</span>
                </div>
              ) : null}
              <div style={{
                padding: '8px 10px',
                borderBottom: '1px solid rgba(0,0,0,.08)',
                background: highlight ? 'var(--navy)' : 'transparent',
                color: highlight ? 'var(--gold)' : 'var(--text-muted)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              }}>
                <div>
                  <div className="chrome-label" style={{ fontSize: 10, letterSpacing: '.1em', fontWeight: 700 }}>
                    {d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                    {d.getDate()}
                  </div>
                </div>
                {/* Per-day + button — prefills start_at with 9 AM on that
                    day so common "add inspection walk at 10am Tuesday" flow
                    is one click + one field edit. */}
                <button onClick={() => {
                  const at = new Date(d);
                  at.setHours(9, 0, 0, 0);
                  // Local datetime-local string
                  const pad = (n) => String(n).padStart(2, '0');
                  const iso = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
                  setEventModalDefaults({ start_at: iso });
                  setEventModalOpen(true);
                }} title="Add event on this day" style={{
                  width: 20, height: 20,
                  background: 'transparent', color: highlight ? 'var(--gold)' : 'var(--text-faint)',
                  border: '1px solid currentColor', cursor: 'pointer',
                  fontSize: 12, display: 'grid', placeItems: 'center',
                }}>+</button>
              </div>
              <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                {items.length === 0 && dayEvents.length === 0 ? (
                  <div className="mono" style={{ fontSize: 9, color: 'var(--text-faint)', padding: '6px 4px', textTransform: 'lowercase', letterSpacing: '.06em' }}>
                    —
                  </div>
                ) : null}
                {/* Non-install events — rendered first so they're distinct
                    from the install blocks. Different tint by event_type. */}
                {dayEvents.map(ev => {
                  const t = new Date(ev.start_at);
                  const timeLabel = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                  const typeTint = ev.event_type === 'meeting' ? 'var(--ms-4)'
                                 : ev.event_type === 'pickup'  ? 'var(--ms-5)'
                                 : ev.event_type === 'inspect' ? 'var(--ms-2)'
                                                               : 'var(--text-faint)';
                  const cn = ev.contacts?.name || null;
                  return (
                    <button key={'ev-' + ev.id}
                      onClick={() => {
                        if (confirm(`Delete event "${ev.title}"?`)) {
                          db.from('calendar_events').delete().eq('id', ev.id).then(
                            () => window.__bpp_toast && window.__bpp_toast('Event deleted', 'info'),
                            (e) => window.__bpp_toast && window.__bpp_toast('Delete failed: ' + (e.message || e), 'error')
                          );
                        }
                      }}
                      title={`${ev.title}${cn ? ' · ' + cn : ''}${ev.notes ? '\n' + ev.notes : ''}\n(click to delete)`}
                      style={{
                        textAlign: 'left', padding: '4px 6px', background: 'var(--bg)',
                        boxShadow: 'var(--raised-2)', border: 'none', cursor: 'pointer',
                        borderLeft: `3px solid ${typeTint}`,
                        display: 'flex', flexDirection: 'column', gap: 1,
                      }}>
                      <span className="mono" style={{ fontSize: 8, color: 'var(--text-faint)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                        {timeLabel} · {(ev.event_type || 'event').toUpperCase()}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{ev.title}</span>
                      {cn ? (
                        <span className="mono" style={{
                          fontSize: 8, color: 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{cn.slice(0, 22)}</span>
                      ) : null}
                    </button>
                  );
                })}
                {items.map(e => {
                  const t = new Date(e.install_date);
                  const timeLabel = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                  const stageTint = (e.stage || 1) >= 8 ? 'var(--ms-2)' : (e.stage || 1) >= 4 ? 'var(--gold)' : 'var(--ms-1)';
                  return (
                    <button key={e.id}
                      onClick={() => e.id && (window.location.hash = `#contact=${e.id}`)}
                      title={`${e.name}${e.address ? ' · ' + e.address : ''} · stage ${e.stage}`}
                      style={{
                        textAlign: 'left', padding: '6px 8px', background: 'var(--card)',
                        boxShadow: 'var(--raised-2)', border: 'none', cursor: 'pointer',
                        borderLeft: `3px solid ${stageTint}`,
                        opacity: e.do_not_contact ? 0.5 : 1,
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}>
                      <span className="mono" style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '.06em' }}>
                        {timeLabel}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{e.name || '—'}</span>
                      {e.address ? (
                        <span className="mono" style={{
                          fontSize: 9, color: 'var(--text-faint)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{e.address.slice(0, 28)}</span>
                      ) : null}
                      {e.assigned_installer && installerFilter === 'all' ? (
                        <span className="mono" style={{
                          fontSize: 8, color: 'var(--ms-2)', letterSpacing: '.08em',
                          textTransform: 'uppercase',
                        }}>{e.assigned_installer}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Awaiting date — sidebar below the grid so it doesn't steal horizontal
          space on the week view. Clicking any row opens that contact so Key
          can set an install_date. */}
      {filteredUnscheduled.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <div className="chrome-label" style={{
            fontSize: 11, letterSpacing: '.1em', color: 'var(--ms-3)',
            padding: '6px 0', marginBottom: 4, borderBottom: '1px solid rgba(0,0,0,.08)',
          }}>
            Awaiting date ({filteredUnscheduled.length})
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 6,
          }}>
            {filteredUnscheduled.map(e => (
              <button key={e.id}
                onClick={() => e.id && (window.location.hash = `#contact=${e.id}`)}
                style={{
                  textAlign: 'left', padding: '10px 12px', background: 'var(--card)',
                  boxShadow: 'var(--raised-2)', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600 }}>{e.name || '—'}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                  {e.address || '—'}
                </span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--ms-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  Stage {e.stage} · needs date
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {eventModalOpen ? (
        <CalendarEventModal
          defaults={eventModalDefaults}
          onClose={() => setEventModalOpen(false)}
          onSaved={() => { setEventModalOpen(false); setRefreshTick(n => n + 1); }}
        />
      ) : null}
    </div>
  );
}

// Modal to create a new calendar_events row. Contact is optional — Key can
// log a material pickup or meeting without tying it to a customer. Event
// type determines the left-stripe color when rendered in the week grid.
function CalendarEventModal({ defaults, onClose, onSaved }) {
  const rootRef = useRef(null);
  useFocusTrap(rootRef, true);
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(defaults?.start_at || '');
  const [endAt, setEndAt] = useState(defaults?.end_at || '');
  const [notes, setNotes] = useState('');
  const [eventType, setEventType] = useState('other');
  const [contactQuery, setContactQuery] = useState('');
  const [contactMatches, setContactMatches] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Debounced contact search — Key types a name to attach the event to a
  // specific lead. Optional.
  useEffect(() => {
    const q = contactQuery.trim();
    if (!q) { setContactMatches([]); return; }
    if (selectedContact && selectedContact.name === contactQuery) return;
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await db.from('contacts')
        .select('id, name, phone')
        .ilike('name', `%${q}%`)
        .limit(5);
      if (alive) setContactMatches(data || []);
    }, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [contactQuery, selectedContact]);

  async function save(e) {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) { setErr('Title required'); return; }
    if (!startAt) { setErr('Start time required'); return; }
    setSaving(true);
    try {
      const startIso = new Date(startAt).toISOString();
      const endIso = endAt ? new Date(endAt).toISOString() : null;
      const { error } = await db.from('calendar_events').insert({
        title: title.trim(),
        start_at: startIso,
        end_at: endIso,
        notes: notes.trim() || null,
        event_type: eventType,
        contact_id: selectedContact?.id || null,
      });
      if (error) throw error;
      window.__bpp_toast && window.__bpp_toast('Event added', 'success');
      onSaved && onSaved();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 95,
      background: 'rgba(0,0,0,.5)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <form ref={rootRef} onSubmit={save} onClick={e => e.stopPropagation()} style={{
        width: 420, maxWidth: '100%',
        padding: 24, display: 'flex', flexDirection: 'column', gap: 12,
        background: 'var(--card)', boxShadow: 'var(--raised-2)',
      }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>
          Add calendar event
        </div>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (e.g. Inspection walkthrough)" style={{
          padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
          background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
        }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Start</span>
            <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} required style={{
              padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
              background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
            }} />
          </label>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>End (optional)</span>
            <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} style={{
              padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
              background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
            }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'install', label: 'Install' },
            { id: 'meeting', label: 'Meeting' },
            { id: 'pickup',  label: 'Pickup' },
            { id: 'inspect', label: 'Inspection' },
            { id: 'other',   label: 'Other' },
          ].map(t => (
            <button type="button" key={t.id} onClick={() => setEventType(t.id)} style={{
              padding: '6px 12px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600,
              background: eventType === t.id ? 'var(--navy)' : 'var(--card)',
              color: eventType === t.id ? 'var(--gold)' : 'var(--text-muted)',
              boxShadow: eventType === t.id ? 'var(--pressed-2)' : 'var(--raised-2)',
              cursor: 'pointer', border: 'none', letterSpacing: '.04em',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Contact (optional)</span>
          <input value={contactQuery} onChange={e => { setContactQuery(e.target.value); setSelectedContact(null); }}
            placeholder="Search contact name…" style={{
              padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
              background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
            }} />
          {!selectedContact && contactMatches.length > 0 ? (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--card)', boxShadow: 'var(--raised-2)',
              zIndex: 5,
            }}>
              {contactMatches.map(c => (
                <button key={c.id} type="button" onClick={() => { setSelectedContact(c); setContactQuery(c.name); setContactMatches([]); }} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontFamily: 'var(--font-body)', fontSize: 13,
                  background: 'transparent', color: 'var(--text)', cursor: 'pointer', border: 'none',
                  borderBottom: '1px solid rgba(0,0,0,.06)',
                }}>
                  {c.name} <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 11 }}>{c.phone || ''}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={3} style={{
          padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, resize: 'vertical',
          background: 'var(--card)', boxShadow: 'var(--pressed-2)', border: 'none',
        }} />
        {err ? <div className="mono" style={{ fontSize: 11, color: 'var(--ms-3)' }}>{err}</div> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, height: 40, fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font-body)', letterSpacing: '.04em',
            boxShadow: 'var(--raised-2)', background: 'var(--card)', color: 'var(--text-muted)',
            border: 'none',
          }}>Cancel</button>
          <button type="submit" disabled={saving} style={{
            flex: 1, height: 40, fontSize: 12, fontWeight: 600, letterSpacing: '.04em',
            fontFamily: 'var(--font-body)',
            background: 'var(--navy)', color: 'var(--gold)',
            boxShadow: 'var(--raised-2)', border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving…' : 'Save event'}</button>
        </div>
      </form>
    </div>
  );
}

// ── Live Messages Inbox ─────────────────────────────────────────────────────
// For each contact, pull their latest message as the preview + count unread.
function LiveMessages({ onSelect, activeId, compact = false }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    // Latest 300 messages; we group client-side.
    // Include `status` so the inbox row can flag failed outbound delivery.
    const { data: msgs } = await db
      .from('messages')
      .select('id, contact_id, direction, body, sender, status, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (!msgs) { setThreads([]); return; }

    // Group by contact_id, take latest per contact. Skip rows with no
    // contact_id (e.g., legacy call-log entries) — passing a null id into
    // .in() below yields a PostgREST "invalid uuid" error that silently
    // drops ALL rows from the lookup and empties the inbox.
    const byContact = {};
    for (const m of msgs) {
      if (!m.contact_id) continue;
      if (!byContact[m.contact_id]) byContact[m.contact_id] = { latest: m, count: 0 };
      if (m.direction === 'inbound') byContact[m.contact_id].count++;
    }

    const ids = Object.keys(byContact).slice(0, 50);
    if (ids.length === 0) { setThreads([]); return; }

    const { data: contacts } = await db
      .from('contacts')
      .select('id, name, stage')
      .in('id', ids);
    const contactMap = Object.fromEntries((contacts || []).map(c => [c.id, c]));

    // Build threads
    const out = ids
      .map(id => {
        const c = contactMap[id];
        if (!c) return null;
        const { latest, count } = byContact[id];
        const isOut = latest.direction === 'outbound';
        const isAi = latest.sender === 'ai';
        // Latest outbound failed delivery — flag the thread so the inbox
        // row renders red. This is the single most actionable signal: Key
        // thought he texted the customer, carrier rejected it, customer
        // never heard back.
        const failed = isOut && (latest.status === 'failed' || latest.status === 'undelivered');
        return {
          contactId: id,
          name: c.name || '—',
          i: initials(c.name),
          // Red tint for failed-delivery threads draws the eye immediately.
          tint: failed ? 'red' : 'navy',
          dir: isOut ? 'out' : 'in',
          prev: (latest.body || '').slice(0, 120),
          ts: relTimestamp(latest.created_at),
          // If the latest message in the thread is inbound AND it's from
          // the customer (not a system log), treat the thread as "waiting
          // on Key" — used by MessagesInbox to draw a gold bar on the row.
          waiting: !isOut && latest.sender !== 'ai',
          unread: 0,
          alex: isAi && isOut,
          failed,
        };
      })
      .filter(Boolean);
    // Sort: waiting-on-Key threads first, then by latest message time (desc).
    // Rank uses inserted order of byContact which is already newest-first.
    const order = Object.fromEntries(ids.map((id, i) => [id, i]));
    out.sort((a, b) => {
      // Failed-delivery first (most urgent), waiting second, then recency.
      if (a.failed !== b.failed) return a.failed ? -1 : 1;
      if (a.waiting !== b.waiting) return a.waiting ? -1 : 1;
      return (order[a.contactId] ?? 0) - (order[b.contactId] ?? 0);
    });
    setThreads(out);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchThreads().finally(() => setLoading(false));
  }, [fetchThreads]);

  // Realtime — refresh on any message change. INSERTs surface new threads
  // and inbound replies. UPDATEs matter because Twilio's status-callback
  // flips `status` from 'sent' → 'delivered' OR 'failed'/'undelivered', and
  // the failed state drives the red tint + sort-to-top ordering. Without the
  // UPDATE subscription, a failed delivery wouldn't visibly escalate until
  // Key refreshed the tab manually — exactly the signal he needs in real time.
  useEffect(() => {
    const ch = db.channel('messages-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchThreads)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [fetchThreads]);

  if (loading) {
    return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>LOADING INBOX...</div>;
  }

  const MessagesInbox = window.MessagesInbox;
  return <MessagesInbox threads={threads} onSelect={t => onSelect(t.contactId)} activeId={activeId} compact={compact} />;
}

// ── Smart Calls — callback priority on top of a flat call log ───────────────
// Calls live in messages with status='call'. Smart layer ranks:
//   VOICEMAIL    inbound call with a recording_url and zero-duration or null
//                duration — the customer left a message waiting for Key
//   MISSED       inbound with no recording and very short duration (<5s)
//   RETURN       outbound that connected but is older than 24h w/o follow-up
// Recency is the tiebreaker.
function smartCallFlag(c) {
  const inbound = c.direction === 'inbound';
  const hasRec = !!c.recordingUrl;
  const dur = c.durationSec || 0;
  const ageHours = c.at ? (Date.now() - new Date(c.at).getTime()) / 3600000 : 0;
  if (inbound && hasRec && dur < 5 && ageHours < 72) return { tone: 'red',  label: 'VOICEMAIL' };
  if (inbound && !hasRec && dur <= 5 && ageHours < 72) return { tone: 'red',  label: 'MISSED' };
  if (inbound && hasRec && ageHours < 24) return { tone: 'gold', label: 'VOICEMAIL' };
  if (!inbound && dur > 30 && ageHours > 24 && ageHours < 168) return { tone: 'gold', label: 'RETURN' };
  return null;
}

function LiveCalls({ onSelect }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: calls } = await db.from('messages')
        .select('id, contact_id, direction, body, sender, status, created_at, recording_url, duration_seconds')
        .eq('status', 'call')
        .order('created_at', { ascending: false })
        .limit(200);
      const ids = Array.from(new Set((calls || []).map(c => c.contact_id).filter(Boolean)));
      const { data: contacts } = ids.length
        ? await db.from('contacts').select('id, name, phone').in('id', ids)
        : { data: [] };
      const cMap = Object.fromEntries((contacts || []).map(c => [c.id, c]));
      const shaped = (calls || []).map(c => ({
        id: c.id,
        contactId: c.contact_id,
        direction: c.direction,
        durationSec: c.duration_seconds,
        recordingUrl: c.recording_url,
        at: c.created_at,
        name: displayNameFor(cMap[c.contact_id] || { name: null, phone: (c.body || '').match(/\+?\d{10,}/)?.[0] || null }),
      }));
      // Smart Calls sort: priority-tagged rows float up.
      const priority = (r) => {
        const f = smartCallFlag(r);
        if (!f) return 5;
        if (f.label === 'VOICEMAIL') return 0;
        if (f.label === 'MISSED') return 1;
        if (f.label === 'RETURN') return 2;
        return 3;
      };
      shaped.sort((a, b) => {
        const d = priority(a) - priority(b);
        if (d !== 0) return d;
        return new Date(b.at) - new Date(a.at);
      });
      setRows(shaped);
      setLoading(false);
    })();
  }, [tick]);

  useEffect(() => {
    const ch = db.channel('calls-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'status=eq.call' }, () => setTick(n => n + 1))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, []);

  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>LOADING CALLS...</div>;
  if (rows.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div className="chrome-label" style={{ fontSize: 14, letterSpacing: '.12em', marginBottom: 8 }}>NO CALLS YET</div>
      <div style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}>Inbound and outbound calls log here once Twilio Voice is dialed.</div>
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '8px 16px 24px' }}>
      {rows.map(r => {
        const mins = r.durationSec ? Math.floor(r.durationSec / 60) : 0;
        const secs = r.durationSec ? r.durationSec % 60 : 0;
        const dur = r.durationSec ? `${mins}:${secs.toString().padStart(2, '0')}` : '—';
        const dir = r.direction === 'inbound' ? '↙' : '↗';
        const smart = smartCallFlag(r);
        return (
          <button key={r.id} onClick={() => r.contactId && onSelect && onSelect(r.contactId)}
            className="tactile-flat" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,.06)',
              background: 'var(--card)', border: 'none', textAlign: 'left',
              cursor: r.contactId ? 'pointer' : 'default',
            }}>
            <span className="mono" style={{ fontSize: 14, color: 'var(--text-muted)', width: 14 }}>{dir}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {dur}{r.recordingUrl ? ' · ⏺ recording' : ''} · {relTimestamp(r.at)}
              </div>
            </div>
            {smart ? <span className={`smart-chip smart-chip--${smart.tone}`}>{smart.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ── Smart List — Sparky-scored single feed ──────────────────────────────────
// Replaces the old sectioned Quick List + the recency-sorted LIST. One flat
// list of active contacts ranked by a priority score so what Key should act
// on next stays at the top. Each row shows a "reason chip" explaining why
// it's ranked there — "Replied 2h ago", "Install today 10am", "Stuck quote
// 8d silent", etc. (Key 2026-04-21: "sparky should work behind the scenes
// to optimize the list so important things stay at the top" + "smart
// versions of our basic things, like apple's smart shuffle".)
//
// Score inputs (additive; higher = higher in the list):
//   +100  waiting on Key's reply (customer replied, no response sent)
//   +90   install scheduled today
//   +70   install within 3 days
//   +50   install within 7 days
//   +40   permit printed / inspection scheduled (stage 7-8, needs follow-through)
//   +30+age  stuck quote >2d old, scaled by how stale
//   +25   permit in flight (stages 4-6)
//   +20   booked but no install date (stage 3)
//   +15   brand-new lead within last 24h (stage 1)
//   +8    inbound message within the last hour
//   -200  snoozed (drops out of the list)
//   -50   do-not-contact
//   -30   complete (stage 9+)
function scoreContact({ contact, signals }) {
  let score = 0;
  const stage = contact.stage || 1;
  if (signals.snoozed) return -1;               // sentinel — caller drops
  if (contact.do_not_contact) score -= 50;
  if (stage >= 9) score -= 30;
  if (signals.waitingOnKey) score += 100;
  if (signals.installToday) score += 90;
  else if (signals.installWithin3d) score += 70;
  else if (signals.installWithinWeek) score += 50;
  if (stage === 7 || stage === 8) score += 40;
  if (signals.stuckQuoteDays > 2) score += 30 + Math.min(signals.stuckQuoteDays, 10);
  if (stage >= 4 && stage <= 6) score += 25;
  if (stage === 3 && !contact.install_date) score += 20;
  if (stage === 1 && signals.ageHours < 24) score += 15;
  if (signals.lastInboundMinutes !== null && signals.lastInboundMinutes < 60) score += 8;
  return score;
}

// Build the human-readable "reason chip" for why a row is ranked where it is.
// Picks the single strongest signal so the chip is always scannable in one
// glance — no stacked badges.
function reasonChipFor({ contact, signals }) {
  if (signals.waitingOnKey) {
    const age = signals.lastInboundMinutes;
    const ageText = age < 60 ? `${Math.max(1, Math.round(age))}m` : age < 60 * 24 ? `${Math.round(age / 60)}h` : `${Math.round(age / (60 * 24))}d`;
    return { label: `REPLIED ${ageText} AGO`, tone: 'gold' };
  }
  if (signals.installToday) {
    const t = new Date(contact.install_date);
    return { label: `INSTALL TODAY ${t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, tone: 'green' };
  }
  if (signals.installWithin3d) {
    const t = new Date(contact.install_date);
    const day = t.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
    return { label: `INSTALL ${day}`, tone: 'green' };
  }
  if (signals.installWithinWeek) {
    const t = new Date(contact.install_date);
    const day = t.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
    return { label: `INSTALL ${day}`, tone: 'navy' };
  }
  if (contact.stage === 7 || contact.stage === 8) return { label: 'AWAITING INSPECTION', tone: 'purple' };
  if (signals.stuckQuoteDays > 2) {
    const d = Math.round(signals.stuckQuoteDays);
    const f = d >= 7 ? 'EXIT' : d >= 4 ? 'F/U 2' : 'F/U 1';
    return { label: `[${f}] ${d}D SILENT`, tone: 'red' };
  }
  if (contact.stage >= 4 && contact.stage <= 6) return { label: STAGE_MAP[contact.stage] || `STAGE ${contact.stage}`, tone: 'purple' };
  if (contact.stage === 3 && !contact.install_date) return { label: 'BOOKED · NEEDS DATE', tone: 'gold' };
  if (contact.stage === 1 && signals.ageHours < 24) return { label: 'NEW LEAD', tone: 'navy' };
  if (contact.do_not_contact) return { label: 'DNC', tone: 'red' };
  return { label: STAGE_MAP[contact.stage] || `STAGE ${contact.stage || 1}`, tone: 'muted' };
}

function LiveQuickList({ onSelect }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Realtime refresh — any change to contacts / messages / proposals can
  // shift section contents (new reply arrives, stage moves forward, quote
  // gets approved). Snooze is a client-side localStorage state, so also
  // listen for the custom 'bpp:snoozes-changed' event fired by the Snooze
  // row on the contact detail. Single channel, cheap full-refetch.
  useEffect(() => {
    const bump = () => setTick(n => n + 1);
    const ch = db.channel('quicklist-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, bump)
      .subscribe();
    window.addEventListener('bpp:snoozes-changed', bump);
    return () => { db.removeChannel(ch); window.removeEventListener('bpp:snoozes-changed', bump); };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(startOfToday.getTime() + 86400000);
      const in3Days   = new Date(startOfToday.getTime() + 3 * 86400000);
      const in7Days   = new Date(startOfToday.getTime() + 7 * 86400000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();

      // One broad contacts pull + targeted side queries (messages for
      // waiting-on-Key detection, proposals for stuck-quote age). Sparky
      // scoring happens synchronously on the client — cheap, no API call.
      const [contactsRes, recentMsgs, stuckRes] = await Promise.all([
        db.from('contacts')
          .select('id, name, phone, address, stage, status, install_date, created_at, do_not_contact')
          .neq('status', 'Archived')
          .lt('stage', 9)
          .limit(500),
        db.from('messages')
          .select('contact_id, direction, sender, body, created_at')
          .order('created_at', { ascending: false }).limit(400),
        db.from('proposals')
          .select('id, contact_id, total, status, created_at')
          .in('status', ['Created', 'Copied'])
          .lt('created_at', twoDaysAgo)
          .limit(100),
      ]);

      // Waiting-on-Key: newest message per contact is inbound-from-customer.
      const firstByContact = new Map();
      for (const m of (recentMsgs.data || [])) {
        if (!m.contact_id || firstByContact.has(m.contact_id)) continue;
        firstByContact.set(m.contact_id, m);
      }
      // Stuck-quote age per contact (days since oldest open proposal).
      const stuckDaysById = new Map();
      for (const p of (stuckRes.data || [])) {
        if (!p.contact_id) continue;
        const days = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
        const prev = stuckDaysById.get(p.contact_id);
        if (!prev || days > prev) stuckDaysById.set(p.contact_id, days);
      }

      const scored = [];
      for (const c of (contactsRes.data || [])) {
        const snoozed = isSnoozedFor(c.id);
        if (snoozed) continue;
        const latest = firstByContact.get(c.id);
        const waitingOnKey = !!latest && latest.direction === 'inbound' && latest.sender !== 'ai';
        const lastInboundMinutes = latest && latest.direction === 'inbound'
          ? (Date.now() - new Date(latest.created_at).getTime()) / 60000
          : null;
        const installMs = c.install_date ? new Date(c.install_date).getTime() : null;
        const ageHours = c.created_at ? (Date.now() - new Date(c.created_at).getTime()) / 3600000 : 9999;
        const signals = {
          snoozed: false,
          waitingOnKey,
          lastInboundMinutes,
          installToday: installMs !== null && installMs >= startOfToday.getTime() && installMs < endOfToday.getTime(),
          installWithin3d: installMs !== null && installMs >= endOfToday.getTime() && installMs < in3Days.getTime(),
          installWithinWeek: installMs !== null && installMs >= in3Days.getTime() && installMs < in7Days.getTime(),
          stuckQuoteDays: stuckDaysById.get(c.id) || 0,
          ageHours,
        };
        const score = scoreContact({ contact: c, signals });
        // Cull everything that scored zero or negative — those are leads
        // with no open action. Keep new-lead boost-eligible stage-1 rows
        // even if their score is thin so the list isn't empty on a slow day.
        if (score <= 0 && !(c.stage === 1 && ageHours < 72)) continue;
        const reason = reasonChipFor({ contact: c, signals });
        const preview = waitingOnKey ? (latest?.body || '').slice(0, 60) : '';
        scored.push({
          id: c.id,
          name: displayNameFor(c),
          phone: c.phone,
          address: c.address,
          stage: c.stage || 1,
          score,
          reason,
          preview,
        });
      }
      scored.sort((a, b) => b.score - a.score);
      setRows(scored.slice(0, 60));
      setLoading(false);
    })();
  }, [tick]);

  if (loading) {
    return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>LOADING...</div>;
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="chrome-label" style={{ fontSize: 14, letterSpacing: '.12em', marginBottom: 8 }}>CLEAR DESK</div>
        <div style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}>No open replies, no installs this week, no stuck quotes. Go advertise or chase a new lead.</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '8px 0 24px' }}>
      {rows.map(r => <SmartListRow key={r.id} row={r} onSelect={onSelect} />)}
    </div>
  );
}

function SmartListRow({ row, onSelect }) {
  return (
    <button
      onClick={() => row.id && onSelect && onSelect(row.id)}
      className="tactile-flat"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(0,0,0,.06)',
        background: 'var(--card)', border: 'none', textAlign: 'left', cursor: 'pointer',
      }}
    >
      <div style={{
        width: 36, height: 36, flex: '0 0 auto',
        background: 'var(--navy)', clipPath: 'var(--avatar-clip)',
        display: 'grid', placeItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-chrome)', fontWeight: 700, color: 'var(--gold)', fontSize: 12, letterSpacing: '.04em' }}>
          {initials(row.name)}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.name}
        </div>
        {row.preview ? (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            "{row.preview}{row.preview.length >= 60 ? '…' : ''}"
          </div>
        ) : (
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {row.phone ? formatPhone(row.phone) : ''}
          </div>
        )}
      </div>
      <span className={`smart-chip smart-chip--${row.reason.tone}`}>{row.reason.label}</span>
    </button>
  );
}

// ── Morning Briefing modal — once per day ───────────────────────────────────
function LiveMorningBriefing({ onClose, onPickContact }) {
  const [sections, setSections] = useState({ urgent: [], installsToday: [], waiting: [], stuckQuotes: [], overdue: [], today: [], materials: [], goodNews: [] });
  // Lead-flow health — catches the "ads are spending but leads stopped"
  // silent failure in real time. Daily lead-volume-alert SMS only fires
  // at 8:30 AM; this surfaces the same signal every time Key opens the
  // briefing. { last24h, priorWeekDailyAvg } — renders red bar when
  // last24h=0 AND baseline>=1, amber when below half baseline.
  const [leadHealth, setLeadHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
      // Start of TODAY in Key's local timezone (SC, UTC-4/-5), not UTC midnight.
      // The old query built `YYYY-MM-DDT00:00:00` with no timezone — Postgres
      // interpreted that as UTC, so leads created 8pm–midnight last night
      // (still "yesterday" locally) showed up under "New today".
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayIso = startOfToday.toISOString();
      const endOfToday = new Date(startOfToday.getTime() + 86400000).toISOString();
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

      // Parallel fetches: installs today / overdue / new-today /
      // materials-awaiting / paid / waiting-on-Key / stuck quotes /
      // lead flow health (24h vs 7-day baseline).
      const twoDaysAgoIso = new Date(Date.now() - 2 * 86400000).toISOString();
      const oneDayAgoIso = new Date(Date.now() - 86400000).toISOString();
      const eightDaysAgoIso = new Date(Date.now() - 8 * 86400000).toISOString();
      const [installsRes, overdueRes, recentRes, awaitingMatRes, paidRes, waitingMsgsRes, stuckPropsRes, lead24Res, leadPrior7Res] = await Promise.all([
        db.from('contacts')
          .select('id, name, phone, address, install_date')
          .gte('install_date', todayIso)
          .lt('install_date', endOfToday)
          .order('install_date', { ascending: true })
          .limit(5),
        db.from('contacts')
          .select('id, name, phone, created_at, stage').lt('created_at', fiveDaysAgo)
          .lt('stage', 4).eq('do_not_contact', false).limit(5),
        db.from('contacts')
          .select('id, name, phone, created_at, stage')
          .gte('created_at', todayIso).limit(5),
        db.from('contacts')
          .select('id, name, phone, stage, install_notes')
          .in('stage', [3, 4]).limit(10),
        db.from('invoices')
          .select('id, contact_name, total, paid_at')
          .eq('status', 'paid').gte('paid_at', twoDaysAgo).limit(5),
        // Pull the latest 200 messages, group by contact, flag threads where
        // the most recent one came from the customer (inbound + non-AI). Same
        // logic as the J shortcut — surfacing it here means Key sees who's
        // waiting before he even opens the inbox.
        db.from('messages')
          .select('contact_id, direction, sender, body, created_at')
          .order('created_at', { ascending: false }).limit(200),
        // Stuck quotes: proposals older than 2 days still in Created/Copied
        // (not Approved, not Cancelled). Same definition the F/U chips use.
        db.from('proposals')
          .select('id, contact_id, contact_name, total, status, created_at')
          .in('status', ['Created', 'Copied'])
          .lt('created_at', twoDaysAgoIso)
          .order('created_at', { ascending: true })
          .limit(10),
        // Lead count last 24h (head: true = count-only, no rows).
        db.from('contacts').select('id', { count: 'exact', head: true }).gte('created_at', oneDayAgoIso),
        // Lead count 8→1 days ago → compute 7-day prior daily average.
        db.from('contacts').select('id', { count: 'exact', head: true })
          .gte('created_at', eightDaysAgoIso).lt('created_at', oneDayAgoIso),
      ]);
      // Compute lead-flow health. Alert tones:
      //   red  — 0 leads in 24h AND prior 7-day avg >= 1
      //   amber — <50% of prior avg (and prior avg >= 2 to avoid noise)
      //   none — healthy OR prior baseline too thin to judge
      const last24h = Number(lead24Res.count || 0);
      const prior7dTotal = Number(leadPrior7Res.count || 0);
      const prior7dAvg = prior7dTotal / 7;
      let healthTone = null;
      let healthLabel = '';
      if (last24h === 0 && prior7dAvg >= 1) {
        healthTone = 'red';
        healthLabel = `No leads in 24h (7-day avg: ${prior7dAvg.toFixed(1)}/day)`;
      } else if (prior7dAvg >= 2 && last24h < prior7dAvg * 0.5) {
        healthTone = 'amber';
        healthLabel = `${last24h} lead${last24h === 1 ? '' : 's'} in 24h — below half of ${prior7dAvg.toFixed(1)}/day baseline`;
      } else if (prior7dAvg >= 1) {
        healthTone = 'ok';
        healthLabel = `${last24h} lead${last24h === 1 ? '' : 's'} in 24h · ${prior7dAvg.toFixed(1)}/day baseline`;
      }
      setLeadHealth(healthTone ? { tone: healthTone, label: healthLabel, last24h, baseline: prior7dAvg } : null);

      // Materials: booked/permit leads whose install_notes don't yet have any __pm_ line
      const awaitingMaterials = (awaitingMatRes.data || [])
        .filter(c => !/__pm_/.test(c.install_notes || ''))
        .slice(0, 5)
        .map(c => ({ text: `Pick materials for ${displayNameFor(c)}`, id: c.id }));

      // Waiting on Key: for each contact, pick the newest message; keep only
      // if it's inbound-from-customer. Cap at 5 so the briefing stays scannable.
      const waitingSeen = new Set();
      const waitingIds = [];
      const waitingPreviewByContact = {};
      for (const m of (waitingMsgsRes.data || [])) {
        if (!m.contact_id || waitingSeen.has(m.contact_id)) continue;
        waitingSeen.add(m.contact_id);
        if (m.direction === 'inbound' && m.sender !== 'ai') {
          waitingIds.push(m.contact_id);
          waitingPreviewByContact[m.contact_id] = (m.body || '').slice(0, 60);
        }
      }
      const capped = waitingIds.slice(0, 5);
      const stuckPropContactIds = (stuckPropsRes.data || []).map(p => p.contact_id).filter(Boolean);
      const contactLookupIds = Array.from(new Set([...capped, ...stuckPropContactIds]));
      const lookupContactsRes = contactLookupIds.length
        ? await db.from('contacts').select('id, name, phone, do_not_contact').in('id', contactLookupIds)
        : { data: [] };
      const lookupContactMap = Object.fromEntries((lookupContactsRes.data || []).map(c => [c.id, c]));
      const waiting = capped
        .map(id => {
          const c = lookupContactMap[id];
          if (!c || c.do_not_contact) return null;
          if (isSnoozedFor(id)) return null;
          const preview = waitingPreviewByContact[id];
          const name = displayNameFor(c);
          const text = preview
            ? `${name} — "${preview}${preview.length >= 60 ? '…' : ''}"`
            : name;
          return { text, id };
        })
        .filter(Boolean);

      // Stuck quotes: turn each into a row with the age-based F/U label
      // (F/U 1 / F/U 2 / EXIT), same rule the Finance chips use. Cap 5.
      const stuckQuotes = (stuckPropsRes.data || [])
        .filter(p => p.contact_id && !isSnoozedFor(p.contact_id))
        .slice(0, 5)
        .map(p => {
          const days = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
          const label = days >= 7 ? 'EXIT' : days >= 4 ? 'F/U 2' : 'F/U 1';
          const total = Number(p.total) || 0;
          const fromContact = lookupContactMap[p.contact_id];
          const name = displayNameFor(fromContact ? fromContact : { name: p.contact_name });
          return {
            text: `[${label}] ${name} · $${total.toLocaleString()} · ${Math.round(days)}d silent`,
            id: p.contact_id,
          };
        });

      // Urgent customers: sparky_memory entries where Alex tagged an urgency
      // signal (medical device dependency, active safety concern, storm-week
      // dire scenario). Alex writes these via write_memory with a handful of
      // conventional keys — pull them all, map back to contacts, filter to
      // still-active (not stage ≥7 / DNC / snoozed) so the section shows
      // genuinely-pressing cases.
      let urgent = [];
      try {
        const { data: urgencyMems } = await db.from('sparky_memory')
          .select('key, value, updated_at')
          .or('key.ilike.contact:%:urgency_flag,key.ilike.contact:%:medical_need,key.ilike.contact:%:storm_urgency')
          .order('updated_at', { ascending: false })
          .limit(20);
        const phoneByKey = (k) => String(k).split(':')[1];
        const phoneSet = Array.from(new Set((urgencyMems || []).map(m => phoneByKey(m.key)).filter(Boolean)));
        if (phoneSet.length > 0) {
          const { data: urgContacts } = await db.from('contacts')
            .select('id, name, phone, stage, do_not_contact')
            .in('phone', phoneSet);
          const byPhone = Object.fromEntries((urgContacts || []).map(c => [c.phone, c]));
          const seen = new Set();
          for (const m of (urgencyMems || [])) {
            const phone = phoneByKey(m.key);
            if (!phone || seen.has(phone)) continue;
            const c = byPhone[phone];
            if (!c || c.do_not_contact || (c.stage || 1) >= 7) continue;
            if (isSnoozedFor(c.id)) continue;
            seen.add(phone);
            urgent.push({
              text: `${displayNameFor(c)} — ${String(m.value).slice(0, 60)}${String(m.value).length > 60 ? '…' : ''}`,
              id: c.id,
            });
          }
          urgent = urgent.slice(0, 5);
        }
      } catch (e) {
        console.warn('[briefing] urgent fetch failed', e);
      }

      setSections({
        urgent,
        installsToday: (installsRes.data || []).map(c => ({
          text: `${new Date(c.install_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} — ${displayNameFor(c)}${c.address ? ' · ' + c.address.split(',')[0] : ''}`,
          id: c.id,
        })),
        waiting,
        stuckQuotes,
        overdue: (overdueRes.data || [])
          .filter(c => !isSnoozedFor(c.id))
          .map(c => ({
            text: `${displayNameFor(c)} — ${Math.round((Date.now() - new Date(c.created_at).getTime()) / 86400000)} days silent`,
            id: c.id,
          })),
        today: (recentRes.data || []).map(c => ({
          text: `New today: ${displayNameFor(c)}`, id: c.id,
        })),
        materials: awaitingMaterials.filter(m => !isSnoozedFor(m.id)),
        goodNews: (paidRes.data || []).map(inv => ({
          text: `${inv.contact_name || 'Customer'} paid $${Number(inv.total || 0).toLocaleString()}`,
          id: inv.id,
        })),
      });
      setLoading(false);
    })();
  }, [refreshTick]);

  // Auto-refresh the brief every 60s while it's open. Without this the
  // "Waiting" and "Installing today" counts freeze at whatever they were
  // when the modal was opened — if a customer replies at 8:05 while Key
  // has the brief up from 8:00, the count stays stale. 60s is a cheap
  // cadence since the parallel queries are all count-only or limit-5.
  useEffect(() => {
    const t = setInterval(() => setRefreshTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Escape closes the briefing. Every other modal in v2 honors Escape;
  // LiveMorningBriefing was the one holdout — Key would hit Esc expecting
  // the modal to close and nothing would happen.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rootRef = useRef(null);
  useFocusTrap(rootRef, true);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,.5)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div ref={rootRef} onClick={e => e.stopPropagation()} style={{
        width: 640, maxWidth: '100%', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto',
        background: 'var(--card)', boxShadow: 'var(--raised)',
      }}>
        <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 700, letterSpacing: '-.01em',
            }}>{(() => {
              const h = new Date().getHours();
              if (h < 12) return 'Good morning, Key';
              if (h < 17) return 'Good afternoon, Key';
              return 'Good evening, Key';
            })()}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
              {new Date().toDateString().toLowerCase()}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, fontSize: 16, display: 'grid', placeItems: 'center',
            background: 'var(--card)', boxShadow: 'var(--raised-2)', border: 'none', cursor: 'pointer',
          }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Loading brief…</div>
        ) : (
          <div style={{ padding: '0 24px' }}>
            {/* Lead-flow health — first thing Key sees. Red bar = drought
                (zero leads in 24h despite a real baseline). Would've caught
                the Apr 15-19 silent-leak bug immediately. */}
            {leadHealth ? (
              <div style={{
                padding: '10px 14px', marginBottom: 14,
                background: leadHealth.tone === 'red' ? 'var(--ms-3)'
                           : leadHealth.tone === 'amber' ? 'var(--ms-4)'
                           : 'var(--card)',
                color: leadHealth.tone === 'ok' ? 'var(--text-muted)' : '#fff',
                boxShadow: leadHealth.tone === 'ok' ? 'var(--raised-2)' : 'none',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: leadHealth.tone === 'ok' ? 500 : 700,
                letterSpacing: '.02em',
              }}>
                <span style={{ fontSize: 14 }}>{leadHealth.tone === 'red' ? '■' : leadHealth.tone === 'amber' ? '▲' : '●'}</span>
                <span>{leadHealth.label}</span>
              </div>
            ) : null}
            {/* Smart briefing: "Sparky noticed…" insight derived from the
                same data the briefing already pulled. One-liner that points
                at the single most-leverage observation of the day (peak-
                interest lead, biggest outstanding invoice, etc.). No LLM
                call here yet — scaffold the visual first, plug Sparky in
                when the data pipeline is cheap enough. */}
            {(() => {
              const hot = (sections.stuckQuotes || []).find(r => /F\/U 1/.test(r.text));
              const urgentCount = (sections.urgent || []).length;
              const waiting = (sections.waiting || []);
              let body = null;
              if (urgentCount > 0) body = `${urgentCount} urgent lead${urgentCount === 1 ? '' : 's'} (medical / storm) — clear these first.`;
              else if (waiting.length >= 3) body = `${waiting.length} customers are waiting on your reply — batch through them to keep momentum.`;
              else if (hot) body = `Your freshest stuck quote just crossed F/U 1 — follow up while the lead is still warm.`;
              else if ((sections.installsToday || []).length === 0 && (sections.today || []).length === 0) body = 'Wide-open day. Fire a batch of F/U 1s to quotes sitting between 2–4 days.';
              if (!body) return null;
              return (
                <div className="smart-hint" style={{ marginBottom: 14 }}>
                  <span className="smart-hint__label">Sparky noticed</span>
                  <span className="smart-hint__body">{body}</span>
                </div>
              );
            })()}
            {/* Urgent — customers Alex tagged with medical / storm / safety
                flags and are still active. Top of the briefing because medical
                power dependencies and active-risk cases beat even today's
                installs for response priority. Hidden when empty. */}
            {sections.urgent.length > 0 ? (
              <BriefSection label="Urgent" tint="var(--ms-3)" items={sections.urgent} onPick={onPickContact} />
            ) : null}
            {/* Installing today — if Key has an install today, the single
                most important thing on the schedule after any urgent case. */}
            {sections.installsToday.length > 0 ? (
              <BriefSection label="Installing today" tint="var(--ms-2)" items={sections.installsToday} onPick={onPickContact} />
            ) : null}
            {/* Waiting on Key — most actionable list. */}
            <BriefSection label="Waiting" tint="var(--gold)" items={sections.waiting} onPick={onPickContact} />
            {/* Stuck quotes — proposals 2d+ old still unpaid. Same F/U chips
                the Finance tab uses, but surfaced here so Key sees them
                without navigating. Hidden when empty. */}
            {sections.stuckQuotes.length > 0 ? (
              <BriefSection label="Stuck quotes" tint="var(--ms-4)" items={sections.stuckQuotes} onPick={onPickContact} />
            ) : null}
            <BriefSection label="Overdue" tint="var(--ms-3)" items={sections.overdue} onPick={onPickContact} />
            <BriefSection label="Today" tint="var(--ms-4)" items={sections.today} onPick={onPickContact} />
            <BriefSection label="Materials" tint="var(--text-muted)" items={sections.materials} onPick={onPickContact} />
            <BriefSection label="Good news" tint="var(--ms-2)" items={sections.goodNews} />
          </div>
        )}

        <div style={{ padding: '20px 24px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setRefreshTick(t => t + 1)} style={{
            fontSize: 12, padding: '10px 16px', cursor: 'pointer',
            background: 'var(--card)', boxShadow: 'var(--raised-2)', border: 'none',
            fontFamily: 'var(--font-body)', color: 'var(--text-muted)',
          }}>Refresh</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              fontSize: 12, padding: '10px 16px', cursor: 'pointer',
              background: 'var(--card)', boxShadow: 'var(--raised-2)', border: 'none',
              fontFamily: 'var(--font-body)', color: 'var(--text-muted)',
            }}>Dismiss</button>
            <button onClick={onClose} style={{
              padding: '10px 20px', background: 'var(--navy)', color: '#fff',
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
              boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
              cursor: 'pointer', border: 'none',
            }}>Open CRM</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BriefSection({ label, tint, items, onPick }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        paddingBottom: 6, marginBottom: 4,
        fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '.12em',
        color: tint, textTransform: 'uppercase',
        borderBottom: '1px solid rgba(0,0,0,.08)',
      }}>{label} <span style={{ color: 'var(--text-faint)', marginLeft: 4 }}>{items.length}</span></div>
      <div>
        {items.length === 0 ? (
          <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>—</div>
        ) : items.map((it, i) => (
          <button key={i} onClick={() => onPick && it.id && onPick(it.id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 0', fontSize: 13,
            fontFamily: 'var(--font-body)', color: 'var(--text)',
            background: 'transparent', border: 'none',
            cursor: onPick && it.id ? 'pointer' : 'default',
          }}
          onMouseEnter={e => { if (onPick && it.id) e.currentTarget.style.color = 'var(--navy)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text)'; }}
          >{it.text}</button>
        ))}
      </div>
    </div>
  );
}

// ── Live Sparky AI Chat ─────────────────────────────────────────────────────
// Agents inbox — unactioned rows from sparky_inbox surfaced as cards. Alex /
// permit-morning-check / pipeline / brief all write to this table when they
// need Key's eyes on something. Key dismisses (mark read) or actions (opens
// the contact, sends the draft reply). v1 had this in the taskmaster panel;
// v2 was missing the UI entirely, so everything Alex reported after we
// silenced the SMS notifications was invisible until now.
function AgentsInboxStrip() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await db.from('sparky_inbox')
        .select('*, contacts(id, name, phone)')
        .eq('actioned', false)
        .order('created_at', { ascending: false })
        .limit(20);
      setItems(data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime — fire on any inbox INSERT (new notification) or UPDATE
  // (dismiss/action from another tab). Cheap refetch keeps the strip in
  // sync without per-row listeners.
  useEffect(() => {
    const ch = db.channel('agents-inbox-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sparky_inbox' }, load)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  async function dismiss(id) {
    setItems(prev => prev.filter(x => x.id !== id));
    await db.from('sparky_inbox').update({ read: true, actioned: true }).eq('id', id);
  }
  async function openContact(item) {
    const cid = item.contact_id;
    if (!cid) return;
    // Mark actioned so it doesn't resurface next time we open the panel.
    dismiss(item.id);
    window.location.hash = `#contact=${cid}`;
  }
  async function sendDraft(item) {
    if (!item.draft_reply || !item.contact_id) return;
    // Don't auto-send — prefill the compose bar via the existing event so
    // Key reviews before hitting send. Same pattern the Review-ask strip uses.
    window.dispatchEvent(new CustomEvent('bpp:compose-prefill', { detail: { text: item.draft_reply } }));
    window.__bpp_toast && window.__bpp_toast('Draft loaded — review + send', 'info');
    window.location.hash = `#contact=${item.contact_id}`;
    dismiss(item.id);
  }

  if (loading) return null;
  if (items.length === 0) return null;

  const fmtAge = (iso) => {
    if (!iso) return '';
    const hrs = (Date.now() - new Date(iso).getTime()) / 3600000;
    if (hrs < 1)   return `${Math.max(1, Math.round(hrs * 60))}m ago`;
    if (hrs < 24)  return `${Math.round(hrs)}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  };

  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--card)',
      boxShadow: 'var(--raised-2)',
      display: 'flex', flexDirection: 'column', gap: 8,
      borderBottom: '1px solid rgba(0,0,0,.06)',
    }}>
      <div className="chrome-label" style={{
        fontSize: 11, letterSpacing: '.1em',
        color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>⚡</span><span>Agents inbox · {items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(item => {
          const agentLabel = String(item.agent || 'agent').toUpperCase();
          const isUrgent = item.priority === 'urgent';
          const contactName = item.contacts?.name || '';
          return (
            <div key={item.id} style={{
              padding: '10px 12px',
              background: 'var(--bg)',
              boxShadow: 'var(--pressed-2)',
              borderLeft: `3px solid ${isUrgent ? 'var(--ms-3)' : 'var(--ms-1)'}`,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div className="mono" style={{
                fontSize: 10, letterSpacing: '.08em',
                color: isUrgent ? 'var(--ms-3)' : 'var(--text-faint)',
              }}>
                {agentLabel}{contactName ? ` · ${contactName}` : ''} · {fmtAge(item.created_at)}
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}>
                {item.summary}
              </div>
              {item.draft_reply ? (
                <div style={{
                  padding: '6px 8px', marginTop: 2,
                  background: 'var(--card)', boxShadow: 'var(--raised-2)',
                  fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}>
                  Draft: "{item.draft_reply}"
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                {item.draft_reply && item.contact_id ? (
                  <button onClick={() => sendDraft(item)} style={{
                    padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600,
                    background: 'var(--navy)', color: 'var(--gold)', boxShadow: 'var(--raised-2)',
                    border: 'none', cursor: 'pointer', letterSpacing: '.04em',
                  }}>Load draft</button>
                ) : null}
                {item.contact_id ? (
                  <button onClick={() => openContact(item)} style={{
                    padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600,
                    background: 'var(--card)', color: 'var(--text)', boxShadow: 'var(--raised-2)',
                    border: 'none', cursor: 'pointer', letterSpacing: '.04em',
                  }}>Open contact</button>
                ) : null}
                <button onClick={() => dismiss(item.id)} style={{
                  padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600,
                  background: 'transparent', color: 'var(--text-muted)',
                  border: 'none', cursor: 'pointer', letterSpacing: '.04em',
                }}>Dismiss</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveSparky({ currentContactId = null }) {
  const [messages, setMessages] = useState([
    { who: 'sparky', text: "Standing by. Ask anything about the pipeline, a lead, or tell me what to draft." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('chat');
  const [currentContactName, setCurrentContactName] = useState(null);
  const scrollRef = useRef(null);

  // The right-side action bar drives mode from outside (Key 2026-04-21:
  // surface-scoped toolbar). Keep the internal mode row in Sparky for mobile
  // + back-compat, but also accept the external event.
  useEffect(() => {
    const on = (e) => { if (e?.detail?.mode) setMode(e.detail.mode); };
    window.addEventListener('bpp:sparky-mode', on);
    return () => window.removeEventListener('bpp:sparky-mode', on);
  }, []);

  // When entering Sparky with a contact already selected, fetch that
  // contact's name so the quick-asks can offer to do things about them.
  useEffect(() => {
    if (!currentContactId) { setCurrentContactName(null); return; }
    let alive = true;
    (async () => {
      const { data } = await db.from('contacts').select('name').eq('id', currentContactId).maybeSingle();
      if (alive) setCurrentContactName(data?.name || null);
    })();
    return () => { alive = false; };
  }, [currentContactId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Palette "Ask Sparky: <query>" dispatches this event so the right-panel
  // Sparky can consume it. Ref pattern so the handler always calls the
  // freshest `send` (which internally reads mode + currentContactId); the
  // straightforward closure would pin those to the first render's values.
  const sendRef = useRef(null);
  useEffect(() => {
    const handler = (ev) => {
      const q = ev?.detail?.text;
      if (typeof q === 'string' && q.trim()) {
        setInput(q);
        setTimeout(() => {
          if (sendRef.current) sendRef.current(q);
        }, 30);
      }
    };
    window.addEventListener('bpp:sparky-prefill', handler);
    return () => window.removeEventListener('bpp:sparky-prefill', handler);
  }, []);

  async function send(overrideText) {
    const q = (overrideText ?? input).trim();
    if (!q || sending) return;
    setSending(true);
    const newMsgs = [...messages, { who: 'key', text: q }];
    setMessages(newMsgs);
    setInput('');
    try {
      const body = {
        mode,
        question: q,
        history: newMsgs.slice(-10).map(m => ({ role: m.who === 'key' ? 'user' : 'assistant', content: m.text })),
        context_source: 'sparky',
      };
      // If a contact is currently open in the detail panel, pass its id so
      // Sparky can skip the lookup and jump straight to answering about them.
      if (currentContactId) body.contact = { id: currentContactId };
      const { data, error } = await db.functions.invoke('ai-taskmaster', { body });
      if (error) throw error;
      const reply = (data?.answer || data?.response || data?.message || data?.text || JSON.stringify(data)).toString();
      setMessages(prev => [...prev, { who: 'sparky', text: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { who: 'sparky', text: `Error: ${e.message || 'something went wrong'}` }]);
    } finally {
      setSending(false);
    }
  }

  // Keep sendRef pointed at the freshest closure so the bpp:sparky-prefill
  // handler (registered once with [] deps) calls the latest send, not the
  // stale first-render one. Mode + currentContactId change but the handler's
  // closure doesn't — the ref is the bridge.
  sendRef.current = send;

  // Common daily questions Key asks — tap to send without typing.
  // When a contact is open, show that contact's first name in the first two
  // suggestions so Key can jump straight into asking about them.
  const firstName = (currentContactName || '').split(' ')[0];
  const quickAsks = firstName ? [
    `Tell me what I need to know about ${firstName}`,
    `Draft a follow-up SMS for ${firstName}`,
    "Who hasn't replied in 3+ days?",
    'Pipeline summary for today',
  ] : [
    "Who hasn't replied in 3+ days?",
    'Pipeline summary for today',
    'Leads with no address on file',
    'Which bookings need materials ordered?',
  ];

  const modes = [
    { id: 'chat', label: 'Chat' },
    { id: 'briefing', label: 'Briefing' },
    { id: 'contact_insight', label: 'Insight' },
    { id: 'suggest_reply', label: 'Reply' },
    { id: 'draft_followup', label: 'Draft' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Agents inbox — Alex / permit-check / pipeline / brief notifications
          that need Key's eyes. Hidden when empty so it doesn't waste space. */}
      <AgentsInboxStrip />
      {/* Mode selector */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 18 }}>
        {modes.map(m => {
          const on = m.id === mode;
          return (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '4px 0', fontSize: 12,
              fontFamily: 'var(--font-body)', fontWeight: on ? 700 : 500,
              color: on ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: on ? '2px solid var(--gold)' : '2px solid transparent',
              background: 'transparent', border: 'none',
              borderBottomStyle: 'solid', cursor: 'pointer',
            }}>{m.label}</button>
          );
        })}
      </div>

      {/* Quick-ask suggestions — only while chat is empty-ish */}
      {messages.length <= 1 && !sending ? (
        <div style={{ padding: '0 16px 4px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {quickAsks.map(q => (
            <button key={q} onClick={() => send(q)} style={{
              padding: '6px 12px', fontSize: 12,
              fontFamily: 'var(--font-body)', color: 'var(--text-muted)',
              background: 'var(--card)', boxShadow: 'var(--raised-2)',
              border: 'none', cursor: 'pointer',
            }}>{q}</button>
          ))}
        </div>
      ) : null}

      {/* Chat scroll */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '8px 16px 16px',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.map((m, i) => m.who === 'key' ? (
          <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <div style={{
              maxWidth: '72%', background: 'var(--navy)', color: '#fff',
              padding: '10px 14px', boxShadow: 'var(--raised-2)',
              fontSize: 14, lineHeight: 1.4,
            }}><MessageBody body={m.text} isOut={true} /></div>
          </div>
        ) : (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
            <span style={{
              width: 20, height: 20, flex: '0 0 auto',
              background: 'var(--gold)', color: '#1a1a1a',
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-pixel)', fontSize: 14,
              boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.5), inset -1px -1px 0 rgba(0,0,0,.35)',
            }}>S</span>
            <div style={{
              maxWidth: '72%', background: 'var(--card)',
              boxShadow: 'var(--pressed-2)', padding: '10px 14px',
              fontSize: 14, lineHeight: 1.4, color: 'var(--text)',
              whiteSpace: 'pre-wrap',
            }}><MessageBody body={m.text} isOut={false} /></div>
          </div>
        ))}
        {sending ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 20, height: 20, background: 'var(--gold)', boxShadow: 'var(--raised-2)' }} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>THINKING...</span>
          </div>
        ) : null}
      </div>

      {/* Sparky compose bar — bottom */}
      <div style={{
        padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
        background: 'var(--card)', boxShadow: 'var(--raised)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: 'var(--pressed-2)', background: 'var(--card)' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>sparky</span>
          <input value={input} onChange={e => setInput(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask anything…"
            style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 14, background: 'transparent', border: 'none' }}
          />
        </div>
        <button onClick={() => send()} disabled={sending || !input.trim()} style={{
          width: 40, height: 40, background: 'var(--navy)', color: '#fff',
          boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
          opacity: sending || !input.trim() ? 0.5 : 1, display: 'grid', placeItems: 'center',
        }}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
            <path d="M1 2 L15 8 L1 14 L3 8 L1 2 Z M3 8 L9 8"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Command Palette ⌘K ──────────────────────────────────────────────────────
// Pinned contacts (localStorage) — Key's VIP list. Stored as an array of
// contact UUIDs under bpp_v2_pinned_contacts. readPins/writePins/togglePin
// keep the storage layer boring; PinButton is a small star toggle.
function readPins() {
  try { return JSON.parse(localStorage.getItem('bpp_v2_pinned_contacts') || '[]'); } catch { return []; }
}
function writePins(ids) {
  try { localStorage.setItem('bpp_v2_pinned_contacts', JSON.stringify(ids)); } catch {}
  // Broadcast so PinButton instances and list views can re-read
  window.dispatchEvent(new CustomEvent('bpp:pins-changed'));
}
function togglePin(id) {
  if (!id) return false;
  const pins = readPins();
  const i = pins.indexOf(id);
  if (i >= 0) { pins.splice(i, 1); writePins(pins); return false; }
  pins.unshift(id); writePins(pins); return true;
}
function isPinned(id) { return id && readPins().includes(id); }

function SnoozeRow({ contactId, contactName, stage }) {
  const [daysLeft, setDaysLeft] = useState(() => isSnoozedFor(contactId));
  useEffect(() => {
    setDaysLeft(isSnoozedFor(contactId));
    const on = () => setDaysLeft(isSnoozedFor(contactId));
    window.addEventListener('bpp:snoozes-changed', on);
    return () => window.removeEventListener('bpp:snoozes-changed', on);
  }, [contactId]);
  if (!contactId) return null;
  const presets = [1, 3, 7];
  // Smart Snooze suggestion — stage-aware default. Brand-new leads want
  // a tight 1d reminder, quoted leads resurface at 3d (the F/U 1 cadence),
  // booked+ leads sleep for 7d. Rendered as a gold ring on the preset
  // that matches the current contact's lifecycle stage.
  const smartPreset = stage === 1 ? 1 : stage === 2 ? 3 : 7;
  if (daysLeft > 0) {
    return (
      <div style={{
        padding: '6px 14px', borderBottom: '1px solid rgba(0,0,0,.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)',
      }}>
        <span>Snoozed · {daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>
        <button onClick={() => { unsnoozeContact(contactId); window.__bpp_toast && window.__bpp_toast('Snooze cleared', 'info'); }} style={{
          padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-body)',
          background: 'transparent', color: 'var(--text-muted)',
          boxShadow: 'var(--raised-2)', border: 'none', cursor: 'pointer',
        }}>Clear</button>
      </div>
    );
  }
  return (
    <div style={{
      padding: '4px 14px', borderBottom: '1px solid rgba(0,0,0,.06)',
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-faint)',
    }}>
      <span>Snooze</span>
      {presets.map(n => {
        const suggested = n === smartPreset;
        return (
          <button key={n} onClick={() => {
            snoozeContact(contactId, n);
            window.__bpp_toast && window.__bpp_toast(`${contactName || 'Contact'} snoozed ${n} day${n === 1 ? '' : 's'}`, 'info');
          }}
          title={suggested ? `Suggested for stage ${stage}` : `${n} day snooze`}
          style={{
            padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-body)',
            background: 'transparent', color: suggested ? 'var(--navy)' : 'var(--text-muted)',
            boxShadow: suggested
              ? 'inset 0 0 0 1px var(--gold), var(--raised-2)'
              : 'var(--raised-2)',
            border: 'none', cursor: 'pointer',
            fontWeight: suggested ? 700 : 400,
          }}>{n}d</button>
        );
      })}
    </div>
  );
}

function PinButton({ contactId }) {
  const [pinned, setPinned] = useState(() => isPinned(contactId));
  useEffect(() => {
    setPinned(isPinned(contactId));
    const onChange = () => setPinned(isPinned(contactId));
    window.addEventListener('bpp:pins-changed', onChange);
    return () => window.removeEventListener('bpp:pins-changed', onChange);
  }, [contactId]);
  if (!contactId) return null;
  return (
    <button
      onClick={() => {
        const now = togglePin(contactId);
        setPinned(now);
        window.__bpp_toast && window.__bpp_toast(now ? 'Pinned' : 'Unpinned', 'info');
      }}
      title={pinned ? 'Unpin contact' : 'Pin contact'}
      style={{
        padding: 0, background: 'transparent', border: 'none',
        color: pinned ? 'var(--gold)' : 'var(--text-faint)',
        fontSize: 16, lineHeight: 1, cursor: 'pointer',
      }}
    >{pinned ? '★' : '☆'}</button>
  );
}

// Snooze — Key marks a contact to resurface later. Per-contact,
// { contactId: unixMsDue }. readSnoozes/writeSnoozes/isSnoozedFor/snoozeContact
// keep the store boring; due contacts surface in the morning briefing.
function readSnoozes() {
  try { return JSON.parse(localStorage.getItem('bpp_v2_snoozes') || '{}'); } catch { return {}; }
}
function writeSnoozes(obj) {
  try { localStorage.setItem('bpp_v2_snoozes', JSON.stringify(obj)); } catch {}
  window.dispatchEvent(new CustomEvent('bpp:snoozes-changed'));
}
function snoozeContact(id, days) {
  const obj = readSnoozes();
  obj[id] = Date.now() + (days * 86400000);
  writeSnoozes(obj);
}
function unsnoozeContact(id) {
  const obj = readSnoozes();
  if (obj[id]) { delete obj[id]; writeSnoozes(obj); }
}
function isSnoozedFor(id) {
  const obj = readSnoozes();
  const due = obj[id];
  if (!due) return 0;
  const ms = due - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000); // whole days remaining
}

// Track recently viewed contacts in localStorage so the command palette
// can show "Recent" when there's no query. Called from App each time
// selectedContact changes.
function recordRecentContact(id) {
  if (!id) return;
  try {
    const raw = localStorage.getItem('bpp_v2_recent_contacts');
    const arr = raw ? JSON.parse(raw) : [];
    const filtered = arr.filter(x => x !== id);
    filtered.unshift(id);
    localStorage.setItem('bpp_v2_recent_contacts', JSON.stringify(filtered.slice(0, 10)));
  } catch {}
}

// Smart Search — natural-language intent parser for ⌘K. Before the
// generic text search fires, match the query against common BPP-specific
// intents ("who owes me money", "installs today", "stuck quotes", "near
// Greenville") and run a more targeted query. Returns null when nothing
// matches — caller falls through to the default behavior.
async function smartSearchIntent(q) {
  const t = q.toLowerCase().trim();
  const nowIso = new Date().toISOString();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  const twoDaysAgoIso = new Date(Date.now() - 2 * 86400000).toISOString();

  // Outstanding money / owe me
  if (/\b(owe|owes|unpaid|outstanding|invoice|bill)\b/.test(t)) {
    const { data } = await db.from('invoices')
      .select('id, contact_id, contact_name, total, status')
      .in('status', ['sent', 'unpaid'])
      .order('created_at', { ascending: false }).limit(10);
    const hits = (data || []).map(inv => ({
      type: 'contact', id: inv.contact_id, name: inv.contact_name || '—',
      phone: '', stage: `INV $${(Number(inv.total) || 0).toLocaleString()}`,
      _intent: 'UNPAID',
    })).filter(h => h.id);
    return { intent: 'outstanding', hits };
  }
  // Installs today
  if (/\binstall(s|ing)?\s+today|today.?s install|what.?s on deck\b/.test(t)) {
    const { data } = await db.from('contacts')
      .select('id, name, phone, stage, install_date')
      .gte('install_date', startOfToday.toISOString())
      .lt('install_date', endOfToday.toISOString())
      .order('install_date', { ascending: true }).limit(10);
    return {
      intent: 'installs-today',
      hits: (data || []).map(c => ({
        type: 'contact', id: c.id, name: displayNameFor(c),
        phone: formatPhone(c.phone), stage: STAGE_MAP[c.stage || 1] || 'NEW',
        _intent: 'TODAY',
      })),
    };
  }
  // Stuck quotes
  if (/\bstuck|aging quote|cold quote|quote.*silent|exit\b/.test(t)) {
    const { data } = await db.from('proposals')
      .select('contact_id, contact_name, total, status, created_at')
      .in('status', ['Created', 'Copied'])
      .lt('created_at', twoDaysAgoIso)
      .order('created_at', { ascending: true }).limit(10);
    return {
      intent: 'stuck-quotes',
      hits: (data || []).filter(p => p.contact_id).map(p => {
        const days = Math.round((Date.now() - new Date(p.created_at).getTime()) / 86400000);
        return {
          type: 'contact', id: p.contact_id,
          name: displayNameFor({ name: p.contact_name }), phone: '',
          stage: `Q$${(Number(p.total) || 0).toLocaleString()} · ${days}d`,
          _intent: 'STUCK',
        };
      }),
    };
  }
  // Waiting-on-Key (unreplied inbounds)
  if (/\b(waiting|need.*reply|needs.*reply|owe.*reply|unread|to reply)\b/.test(t)) {
    const { data } = await db.from('messages')
      .select('contact_id, direction, sender, created_at')
      .order('created_at', { ascending: false }).limit(200);
    const seen = new Set();
    const ids = [];
    for (const m of (data || [])) {
      if (!m.contact_id || seen.has(m.contact_id)) continue;
      seen.add(m.contact_id);
      if (m.direction === 'inbound' && m.sender !== 'ai') ids.push(m.contact_id);
      if (ids.length >= 10) break;
    }
    if (ids.length === 0) return { intent: 'waiting', hits: [] };
    const { data: cs } = await db.from('contacts').select('id, name, phone, stage').in('id', ids);
    const byId = Object.fromEntries((cs || []).map(c => [c.id, c]));
    return {
      intent: 'waiting',
      hits: ids.map(id => byId[id]).filter(Boolean).map(c => ({
        type: 'contact', id: c.id, name: displayNameFor(c),
        phone: formatPhone(c.phone), stage: STAGE_MAP[c.stage || 1] || 'NEW',
        _intent: 'REPLY',
      })),
    };
  }
  // New leads today
  if (/\bnew lead|today.?s lead|new today\b/.test(t)) {
    const { data } = await db.from('contacts')
      .select('id, name, phone, stage, created_at')
      .gte('created_at', startOfToday.toISOString()).limit(20);
    return {
      intent: 'new-today',
      hits: (data || []).map(c => ({
        type: 'contact', id: c.id, name: displayNameFor(c),
        phone: formatPhone(c.phone), stage: STAGE_MAP[c.stage || 1] || 'NEW',
        _intent: 'NEW',
      })),
    };
  }
  // Near <city> — Greenville, Greer, Simpsonville, Spartanburg, etc.
  const nearMatch = t.match(/\b(?:near|in|around)\s+([a-z][a-z\s]{2,30})\b/i);
  if (nearMatch) {
    const city = nearMatch[1].trim();
    const { data } = await db.from('contacts')
      .select('id, name, phone, stage, address')
      .ilike('address', `%${city}%`).limit(10);
    return {
      intent: 'near-' + city.toLowerCase(),
      hits: (data || []).map(c => ({
        type: 'contact', id: c.id, name: displayNameFor(c),
        phone: formatPhone(c.phone), stage: STAGE_MAP[c.stage || 1] || 'NEW',
        _intent: city.slice(0, 14).toUpperCase(),
      })),
    };
  }
  return null;
}

function CommandPalette({ open, onClose, onSelectContact, onSwitchTab, onAction }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [intent, setIntent] = useState(null);
  const inputRef = useRef(null);

  // Show recent contacts when palette opens without a query
  useEffect(() => {
    if (!open || query.trim()) return;
    let alive = true;
    (async () => {
      let ids = [];
      try {
        const raw = localStorage.getItem('bpp_v2_recent_contacts');
        if (raw) ids = JSON.parse(raw).slice(0, 5);
      } catch {}
      if (ids.length === 0) { setResults([]); return; }
      const { data } = await db
        .from('contacts').select('id, name, phone, stage, address').in('id', ids);
      if (!alive) return;
      const byId = Object.fromEntries((data || []).map(c => [c.id, c]));
      const hits = ids.map(id => byId[id]).filter(Boolean).map(c => ({
        type: 'contact', id: c.id, name: c.name, phone: formatPhone(c.phone),
        stage: STAGE_MAP[c.stage || 1] || 'NEW',
        _recent: true,
      }));
      setResults(hits);
      setCursor(0);
    })();
    return () => { alive = false; };
  }, [open, query]);

  // Search
  useEffect(() => {
    if (!open || !query.trim()) return;
    let alive = true;
    const q = query.trim();
    (async () => {
      // Smart Search — try intent parser first. If the query reads like
      // "who owes me money", "installs today", "near greenville", the
      // palette jumps straight to a curated result set instead of running
      // the generic text search. Falls through otherwise.
      const intentRes = await smartSearchIntent(q);
      if (!alive) return;
      if (intentRes && intentRes.hits?.length) {
        setResults(intentRes.hits);
        setIntent(intentRes.intent);
        setCursor(0);
        return;
      }
      setIntent(null);
      // Parallel: contact fields + message bodies. Message-body search lets
      // Key find "the guy who asked about 50A" by typing "50A" — contacts
      // search alone only matches name/phone/address. Only queries when the
      // term is ≥ 3 chars to avoid full-text scans on common short tokens.
      const runContacts = db
        .from('contacts')
        .select('id, name, phone, stage, address')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%,address.ilike.%${q}%`)
        .limit(8);
      const runMessages = q.length >= 3
        ? db.from('messages')
            .select('contact_id, body, created_at, direction')
            .ilike('body', `%${q}%`)
            .not('contact_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] });
      const [contactsRes, messagesRes] = await Promise.all([runContacts, runMessages]);
      if (!alive) return;
      const contactHits = (contactsRes.data || []).map(c => ({
        type: 'contact', id: c.id, name: c.name, phone: formatPhone(c.phone), stage: STAGE_MAP[c.stage || 1] || 'NEW',
      }));
      // De-dupe message hits by contact_id so a chatty lead doesn't flood
      // the results. Keep the most recent hit per contact. Then hydrate
      // the contact name for each surviving hit.
      const seen = new Set(contactHits.map(c => c.id));
      const messageRowByContact = new Map();
      for (const m of (messagesRes.data || [])) {
        if (!m.contact_id || seen.has(m.contact_id) || messageRowByContact.has(m.contact_id)) continue;
        messageRowByContact.set(m.contact_id, m);
      }
      let messageHits = [];
      if (messageRowByContact.size > 0) {
        const ids = Array.from(messageRowByContact.keys());
        const { data: names } = await db.from('contacts')
          .select('id, name, phone, stage').in('id', ids);
        const byId = Object.fromEntries((names || []).map(c => [c.id, c]));
        messageHits = ids.map(id => {
          const c = byId[id];
          const m = messageRowByContact.get(id);
          if (!c) return null;
          // Extract a ~80-char preview centered on the match
          const body = m.body || '';
          const idx = body.toLowerCase().indexOf(q.toLowerCase());
          const start = Math.max(0, idx - 20);
          const preview = (start > 0 ? '…' : '') + body.slice(start, start + 80) + (body.length > start + 80 ? '…' : '');
          return {
            type: 'message', id: c.id, name: c.name || '(unnamed)',
            stage: STAGE_MAP[c.stage || 1] || 'NEW',
            preview, direction: m.direction,
          };
        }).filter(Boolean);
      }
      const navHits = [
        { type: 'nav', id: 'leads', label: 'Go to Leads' },
        { type: 'nav', id: 'calendar', label: 'Go to Calendar' },
        { type: 'nav', id: 'finance', label: 'Go to Finance' },
        { type: 'nav', id: 'messages', label: 'Go to Messages' },
        // "Go to Sparky" nav removed — Sparky is the right-panel default
        // when no contact is selected; it's always one click away (just
        // close the contact detail panel). Having it as a nav target was
        // duplicative.
      ].filter(n => n.label.toLowerCase().includes(q.toLowerCase()));
      const actionHits = [
        { type: 'action', id: 'export_csv', label: 'Export contacts as CSV' },
        { type: 'action', id: 'show_help', label: 'Show keyboard shortcuts' },
        { type: 'action', id: 'open_briefing', label: 'Open morning briefing' },
        { type: 'action', id: 'new_lead', label: 'New lead' },
        { type: 'action', id: 'toggle_dark', label: 'Toggle dark mode' },
        { type: 'action', id: 'create_installer_token', label: 'Create installer access token' },
        { type: 'action', id: 'list_installer_tokens', label: 'List installer access tokens' },
      ].filter(a => a.label.toLowerCase().includes(q.toLowerCase()));
      const sparkyHit = [{ type: 'sparky', label: `Ask Sparky: "${q}"` }];
      setResults([...contactHits, ...messageHits, ...navHits, ...actionHits, ...sparkyHit]);
      setCursor(0);
    })();
    return () => { alive = false; };
  }, [query, open]);

  // Auto-focus on open + reset state. Without the reset, reopening the
  // palette still shows the previous query's results and cursor position
  // (confusing when Key is looking for something new).
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      if (inputRef.current) inputRef.current.focus();
    }
  }, [open]);

  // Keyboard nav
  function onKey(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[cursor];
      if (!hit) return;
      if (hit.type === 'contact') { onSelectContact(hit.id); onClose(); }
      else if (hit.type === 'nav') { onSwitchTab(hit.id); onClose(); }
      else if (hit.type === 'action') { onAction && onAction(hit.id); onClose(); }
      else if (hit.type === 'sparky') {
        // "Ask Sparky: <query>" — the sparky panel is the right-side default
        // when no contact is selected. Deselect so the panel shows Sparky,
        // then dispatch a prefill event so its input gets the query. The
        // setTimeout lets React mount LiveSparky (which mounts its event
        // listener) BEFORE the dispatch — otherwise the listener isn't
        // registered in time and the prefill is lost.
        const text = query.trim();
        onSelectContact(null);
        onClose();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('bpp:sparky-prefill', { detail: { text } }));
        }, 60);
      }
    }
  }

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,.5)',
      display: 'grid', placeItems: 'start center', paddingTop: 120,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: 'calc(100vw - 32px)',
        background: 'var(--card)', boxShadow: 'var(--raised)',
      }}>
        <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey}
            placeholder="SEARCH OR ASK — 'WHO OWES ME MONEY', 'INSTALLS TODAY', …"
            className="pressed-2"
            style={{ flex: 1, padding: '10px 14px', height: 48, fontFamily: 'var(--font-mono)', fontSize: 16 }}
          />
          <span className="pixel" style={{ fontSize: 10, padding: '4px 8px', boxShadow: 'var(--raised-2)', color: 'var(--text-muted)' }}>ESC</span>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto', borderTop: '1px solid rgba(0,0,0,.1)' }}>
          {!query.trim() && results.length > 0 && results[0]._recent ? (
            <div className="mono" style={{
              padding: '8px 14px 4px', fontSize: 10, letterSpacing: '.08em',
              color: 'var(--text-faint)', textTransform: 'uppercase',
            }}>Recent</div>
          ) : null}
          {/* Smart Search intent header — when the query triggered a
              curated list (outstanding / installs today / stuck / near …)
              show a small badge so Key knows Sparky interpreted the ask. */}
          {intent && query.trim() ? (
            <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="smart-chip smart-chip--gold">SMART · {intent.toUpperCase()}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '.06em' }}>
                {results.length} result{results.length === 1 ? '' : 's'}
              </span>
            </div>
          ) : null}
          {results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)' }}>
              {query.trim() ? 'No results' : 'Type to search contacts, navigation, or ask Sparky'}
            </div>
          ) : results.map((r, i) => {
            const active = i === cursor;
            const bg = active ? 'var(--card)' : 'transparent';
            const boxShadow = active ? 'inset 3px 0 0 var(--gold), var(--pressed-2)' : 'none';
            return (
              <div key={i} onClick={() => {
                if (r.type === 'contact' || r.type === 'message') { onSelectContact(r.id); onClose(); }
                else if (r.type === 'nav') { onSwitchTab(r.id); onClose(); }
                else if (r.type === 'action') { onAction && onAction(r.id); onClose(); }
                else {
                  // "Ask Sparky: <query>" hit — Sparky is the right-panel
                  // default when no contact is selected. Deselect + prefill
                  // with a setTimeout so LiveSparky mounts before dispatch
                  // (otherwise its event listener isn't registered yet and
                  // the prefill is silently dropped).
                  const text = query.trim();
                  onSelectContact(null);
                  onClose();
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('bpp:sparky-prefill', { detail: { text } }));
                  }, 60);
                }
              }} style={{
                padding: '10px 16px', cursor: 'pointer', background: bg, boxShadow,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                {r.type === 'contact' ? (
                  <>
                    <span style={{
                      width: 32, height: 32, background: 'var(--navy)',
                      clipPath: 'var(--avatar-clip)',
                      display: 'grid', placeItems: 'center', flex: '0 0 auto',
                    }}><span style={{ fontFamily: 'var(--font-chrome)', fontWeight: 700, color: 'var(--gold)', fontSize: 11 }}>{initials(r.name)}</span></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.phone} · {r.stage}</div>
                    </div>
                  </>
                ) : r.type === 'message' ? (
                  // Message-body hit — show the contact's initials + matched
                  // preview so Key can spot the thread he's looking for by
                  // quote content rather than just name.
                  <>
                    <span style={{
                      width: 32, height: 32, background: 'var(--navy)',
                      clipPath: 'var(--avatar-clip)',
                      display: 'grid', placeItems: 'center', flex: '0 0 auto',
                    }}><span style={{ fontFamily: 'var(--font-chrome)', fontWeight: 700, color: 'var(--gold)', fontSize: 11 }}>{initials(r.name)}</span></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                        <span className="mono" style={{ fontSize: 9, letterSpacing: '.08em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
                          {r.direction === 'inbound' ? '← msg' : '→ msg'}
                        </span>
                      </div>
                      <div className="mono" style={{
                        fontSize: 11, color: 'var(--text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.preview}</div>
                    </div>
                  </>
                ) : (
                  <span className="chrome-label" style={{ fontSize: 12, color: r.type === 'sparky' ? 'var(--gold)' : 'var(--text)' }}>
                    {r.type === 'sparky' ? '→ ' : '• '}{r.label}
                  </span>
                )}
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>↵</span>
              </div>
            );
          })}
        </div>
        <div style={{
          padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '.04em', color: 'var(--text-faint)',
          display: 'flex', gap: 16,
          borderTop: '1px solid rgba(0,0,0,.06)',
        }}>
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

// ── Right-side action bar — surface-scoped toolbar ──────────────────────────
// This is NOT a history of open surfaces and NOT preset shortcuts. It's a
// custom action row tailored to whatever surface is currently in the right
// panel (Key 2026-04-21: "the right bar has a custom row of buttons for
// the screen present in the right section, if a new section is opened in
// the right section a whole new bar gets shown with diffrent buttons
// optimized for that screen").
//
// Surface → buttons:
//   SPARKY   → CHAT · BRIEFING · INSIGHT · REPLY · DRAFT       (Sparky modes)
//   CONTACT  → MESSAGES · TIMELINE · QUOTE · PHOTOS · PERMITS · NOTES · EDIT
//              + CALL + BRIEF + CLOSE (utilities Key hits while texting/working the record)
//   INVOICE  → VIEW · COPY LINK · RESEND · MARK PAID · REFUND   (future)
//   PROPOSAL → VIEW · COPY SMS · RESEND · CONVERT TO INVOICE    (future)
//   CALL     → PLAY · TRANSCRIBE · CALL BACK                    (future)
function RightTabBar({ selectedContact, contactLabel, contactPhone, onCloseContact, onOpenBrief }) {
  // Mirror of LiveContactDetail's internal detailTab so we can highlight
  // the active button here. LiveContactDetail dispatches
  // `bpp:detail-tab-changed` whenever its detailTab changes; we dispatch
  // `bpp:focus-detail-tab` to drive it in the other direction.
  const [activeDetail, setActiveDetail] = React.useState('MESSAGES');
  React.useEffect(() => {
    const on = (e) => { if (e?.detail?.tab) setActiveDetail(e.detail.tab); };
    window.addEventListener('bpp:detail-tab-changed', on);
    return () => window.removeEventListener('bpp:detail-tab-changed', on);
  }, []);
  // Reset to MESSAGES default whenever the selected contact changes, mirroring
  // the LiveContactDetail default-tab logic.
  React.useEffect(() => { setActiveDetail('MESSAGES'); }, [selectedContact]);

  const focusDetail = (tab) => window.dispatchEvent(new CustomEvent('bpp:focus-detail-tab', { detail: { tab } }));

  let buttons;
  if (selectedContact) {
    // Contact surface toolbar. Labels double up as shortcuts while Key is
    // texting someone — "Open Contact" style affordances for common
    // pivots without leaving the panel.
    const sub = [
      { id: 'MESSAGES', label: 'Messages' },
      { id: 'TIMELINE', label: 'Timeline' },
      { id: 'QUOTE',    label: 'Quote' },
      { id: 'PHOTOS',   label: 'Photos' },
      { id: 'PERMITS',  label: 'Permits' },
      { id: 'NOTES',    label: 'Notes' },
      { id: 'EDIT',     label: 'Edit' },
    ];
    buttons = (
      <>
        <span className="chrome-label" title={contactLabel} style={{ padding: '0 10px', display: 'flex', alignItems: 'center', color: 'var(--text)', fontSize: 11, letterSpacing: '.08em', fontWeight: 700, flex: '0 0 auto', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contactLabel || 'CONTACT'}
        </span>
        {sub.map(t => {
          const on = activeDetail === t.id;
          return (
            <button key={t.id} onClick={() => focusDetail(t.id)} className="chrome-label" style={{
              height: '100%', padding: '0 10px',
              background: 'transparent', border: 'none',
              color: on ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 12,
              boxShadow: on ? 'inset 0 -3px 0 var(--gold)' : 'none',
              cursor: 'pointer',
            }}>{t.label}</button>
          );
        })}
        <div style={{ flex: 1 }} />
        {contactPhone ? (
          <button
            onClick={() => window.__bpp_dial && window.__bpp_dial(contactPhone)}
            className="chrome-label" title="Call"
            style={{ height: '100%', padding: '0 10px', background: 'transparent', border: 'none', color: 'var(--green)', fontSize: 12, cursor: 'pointer' }}
          >CALL</button>
        ) : null}
        <button
          onClick={onOpenBrief}
          className="chrome-label" title="Install brief"
          style={{ height: '100%', padding: '0 10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
        >BRIEF</button>
        <button
          onClick={onCloseContact}
          aria-label="Close contact"
          style={{ height: '100%', padding: '0 10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer' }}
        >×</button>
      </>
    );
  } else {
    // Sparky surface toolbar. Mirrors the five Sparky modes already rendered
    // inside LiveSparky. Click dispatches `bpp:sparky-mode` so LiveSparky
    // switches mode without coupling the two components by prop-drilling.
    const modes = [
      { id: 'chat',     label: 'Chat' },
      { id: 'briefing', label: 'Briefing' },
      { id: 'insight',  label: 'Insight' },
      { id: 'reply',    label: 'Reply' },
      { id: 'draft',    label: 'Draft' },
    ];
    buttons = (
      <>
        <span className="chrome-label" style={{ padding: '0 10px', display: 'flex', alignItems: 'center', color: 'var(--text)', fontSize: 11, letterSpacing: '.08em', fontWeight: 700 }}>SPARKY</span>
        {modes.map(m => (
          <button key={m.id}
            onClick={() => window.dispatchEvent(new CustomEvent('bpp:sparky-mode', { detail: { mode: m.id } }))}
            className="chrome-label"
            style={{
              height: '100%', padding: '0 10px',
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
            }}>{m.label}</button>
        ))}
      </>
    );
  }

  return (
    <div role="toolbar" aria-label={selectedContact ? 'Contact actions' : 'Sparky modes'}
      style={{
        height: 44, display: 'flex', alignItems: 'stretch',
        padding: '0 8px',
        background: 'var(--card)', boxShadow: 'var(--pressed-2)',
        borderLeft: '1px solid rgba(0,0,0,.08)',
        overflowX: 'auto', whiteSpace: 'nowrap',
        position: 'relative', zIndex: 2,
      }}>
      {buttons}
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // Initial tab + selected contact can be supplied via URL hash:
  //   #tab=finance
  //   #contact=<uuid>
  // (handy for bookmarks / deep-links from Sparky or briefing)
  const initial = (() => {
    const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    let tab = h.get('tab') || 'quick';
    // Legacy redirects (pre-flat-tabs bookmarks):
    //   #tab=leads    → #tab=quick    (QUICK is the new default landing)
    //   #tab=sparky   → #tab=quick    (Sparky moved to right panel months ago)
    if (tab === 'leads' || tab === 'sparky') tab = 'quick';
    return { tab, contact: h.get('contact') || null };
  })();
  const [tab, setTab] = useState(initial.tab);
  const [selectedContact, setSelectedContact] = useState(initial.contact);
  // Redirect desktop-only tabs → QUICK on mobile so stale deep links or
  // a user who resized down to phone width don't land on a mangled layout.
  useEffect(() => {
    const deskOnly = window.MOBILE_DESKTOP_ONLY_TABS;
    if (window.innerWidth < 768 && deskOnly && deskOnly.has(tab)) setTab('quick');
  }, [tab]);
  // Cheap fetch of the current contact's display name + phone so the
  // right-side action bar can label the contact and wire the CALL button.
  // Re-fires only when selectedContact changes.
  const [rightPanelContactLabel, setRightPanelContactLabel] = useState('');
  const [rightPanelContactPhone, setRightPanelContactPhone] = useState('');
  useEffect(() => {
    let alive = true;
    if (!selectedContact) { setRightPanelContactLabel(''); setRightPanelContactPhone(''); return; }
    db.from('contacts').select('name, phone').eq('id', selectedContact).maybeSingle()
      .then(({ data }) => { if (!alive) return;
        setRightPanelContactLabel(displayNameFor(data || {}).toUpperCase());
        setRightPanelContactPhone(data?.phone || '');
      });
    return () => { alive = false; };
  }, [selectedContact]);
  // One-shot override for LiveContactDetail's default tab — lets callers
  // like the Quick List's STUCK QUOTES section land Key directly on the
  // Quote tab instead of the tab that'd come from the main-tab mapping.
  // Cleared after the detail panel reads it.
  const [nextDetailTab, setNextDetailTab] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('bpp_v2_theme') === 'dark');

  // Apply theme
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('bpp_v2_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Keep URL hash in sync so reload preserves tab + selected contact.
  // QUICK is the default landing, so no ?tab= param means QUICK.
  useEffect(() => {
    const h = new URLSearchParams();
    if (tab && tab !== 'quick') h.set('tab', tab);
    if (selectedContact) h.set('contact', selectedContact);
    const next = h.toString();
    const target = next ? `#${next}` : '';
    if (window.location.hash !== target) {
      // replaceState so we don't flood the history stack
      window.history.replaceState(null, '', window.location.pathname + window.location.search + target);
    }
  }, [tab, selectedContact]);

  // Listen for hashchange — lets other components (Finance tables, Sparky links)
  // navigate by setting window.location.hash = #contact=uuid
  useEffect(() => {
    const onHash = () => {
      const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
      let hashTab = h.get('tab');
      // Legacy redirects so stale bookmarks don't render blank.
      if (hashTab === 'sparky' || hashTab === 'leads') hashTab = 'quick';
      const hashContact = h.get('contact');
      if (hashTab && hashTab !== tab) setTab(hashTab);
      if (hashContact && hashContact !== selectedContact) setSelectedContact(hashContact);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [tab, selectedContact]);

  // Voice device (outbound dial + incoming ring)
  const voice = useVoiceDevice(user);

  // Track "unread" count for page-title badge (simple heuristic: count
  // inbound messages that arrived while the tab was either unfocused OR
  // the user wasn't viewing their specific thread). Reset on visibility +
  // on detail panel open.
  const [unreadCount, setUnreadCount] = useState(0);
  // Sparky inbox unactioned count — drives a badge on the SPARKY tab so Key
  // sees that agent notifications are waiting without navigating there. Kept
  // in sync via a shared realtime sub on sparky_inbox.
  const [sparkyInboxCount, setSparkyInboxCount] = useState(0);
  const tabFocusedRef = useRef(!document.hidden);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { count } = await db.from('sparky_inbox')
        .select('id', { count: 'exact', head: true })
        .eq('actioned', false);
      if (alive) setSparkyInboxCount(count || 0);
    };
    load();
    const ch = db.channel('sparky-inbox-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sparky_inbox' }, load)
      .subscribe();
    return () => { alive = false; db.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const onVis = () => {
      tabFocusedRef.current = !document.hidden;
      if (!document.hidden) setUnreadCount(0);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Reset unread when opening a contact detail; record recents for palette
  useEffect(() => {
    if (selectedContact) {
      setUnreadCount(0);
      recordRecentContact(selectedContact);
    }
  }, [selectedContact]);

  // Update page title + favicon dot for unread count
  useEffect(() => {
    document.title = unreadCount > 0
      ? `(${unreadCount}) BPP CRM`
      : 'BPP CRM v2';
    // Paint a tiny favicon with a red dot if unread > 0
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      // BPP navy square base
      ctx.fillStyle = '#0b1f3b';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#ffba00';
      ctx.font = 'bold 38px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('B', 32, 34);
      if (unreadCount > 0) {
        // Red dot top-right
        ctx.beginPath();
        ctx.arc(50, 14, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
      }
      const url = canvas.toDataURL('image/png');
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = url;
    } catch {}
  }, [unreadCount]);

  // Global new-inbound-SMS listener → toast + unread bump + desktop notification
  useEffect(() => {
    if (!user) return;
    const ch = db.channel('global-inbound-sms')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'direction=eq.inbound',
      }, async (payload) => {
        const m = payload.new;
        // Skip the toast if the viewer is already on that thread — they can
        // see the new bubble arrive, no need to nudge them.
        if (tabFocusedRef.current && m.contact_id === selectedContact) return;
        // Respect snoozes: if Key snoozed this contact (localStorage), the
        // whole point was to mute interruptions. Unread count still bumps
        // silently so the badge/favicon accurately reflects pending work.
        if (m.contact_id && isSnoozedFor(m.contact_id)) {
          if (!tabFocusedRef.current || m.contact_id !== selectedContact) {
            setUnreadCount(c => c + 1);
          }
          return;
        }
        const { data: c } = await db.from('contacts').select('name').eq('id', m.contact_id).maybeSingle();
        const name = c?.name || 'Unknown';
        const preview = (m.body || '').slice(0, 60);
        // Action toast: one click opens the thread + switches to Leads tab so
        // the contact slide-over surfaces over the pipeline. Replaces the old
        // "notice the tab badge → navigate manually" flow.
        window.__bpp_toast(`SMS from ${name}: "${preview}"`, 'info', {
          label: 'Open',
          onClick: () => {
            setSelectedContact(m.contact_id);
            setTab('quick');
            window.location.hash = `#tab=leads&contact=${m.contact_id}`;
          },
        });
        // Native desktop notification when tab isn't focused
        if (!tabFocusedRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const n = new Notification(`SMS from ${name}`, {
              body: preview,
              tag: `bpp-sms-${m.contact_id}`,
              icon: '/assets/images/logo-main.png',
            });
            n.onclick = () => {
              window.focus();
              window.location.hash = `#contact=${m.contact_id}`;
              setSelectedContact(m.contact_id);
              n.close();
            };
          } catch {}
        }
        // Only bump unread if viewer isn't looking at this contact
        if (!tabFocusedRef.current || m.contact_id !== selectedContact) {
          setUnreadCount(c => c + 1);
        }
      })
      // New-lead notification — contacts INSERT fires the instant a form
      // submission lands in Supabase. After the Apr 15-18 silent drop the
      // cost of NOT knowing a lead came in is a lost sale; ping Key the
      // second it happens so he can fire the first text within minutes
      // (inside the 5-minute speed-to-lead window).
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'contacts',
      }, async (payload) => {
        const c = payload.new;
        if (!c) return;
        const name = c.name || 'New lead';
        const addr = c.address || c.city || '';
        window.__bpp_toast && window.__bpp_toast(
          `🟢 New lead: ${name}${addr ? ` · ${addr.slice(0, 40)}` : ''}`,
          'success',
          {
            label: 'Open',
            onClick: () => {
              setSelectedContact(c.id);
              setTab('quick');
              window.location.hash = `#tab=leads&contact=${c.id}`;
            },
          }
        );
        if (!tabFocusedRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const n = new Notification(`🟢 New lead — ${name}`, {
              body: addr || (c.phone || ''),
              tag: `bpp-lead-${c.id}`,
              icon: '/assets/images/logo-main.png',
              requireInteraction: true, // new-lead = speed-to-lead window, don't let it dismiss itself
            });
            n.onclick = () => {
              window.focus();
              window.location.hash = `#tab=leads&contact=${c.id}`;
              setSelectedContact(c.id);
              n.close();
            };
          } catch {}
        }
      })
      // Proposal-viewed notification — customer opens /proposal.html?token=X
      // and it patches viewed_at on first view. That's peak-interest timing
      // for a follow-up ("saw you opened the quote, any questions?"). Fires
      // only on the null → non-null transition; subsequent re-opens just
      // bump view_count without re-notifying.
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'proposals',
      }, async (payload) => {
        const p = payload.new, prev = payload.old;
        if (!p || !prev) return;
        if (!prev.viewed_at && p.viewed_at) {
          const { data: c } = p.contact_id
            ? await db.from('contacts').select('name').eq('id', p.contact_id).maybeSingle()
            : { data: null };
          const name = c?.name || p.contact_name || 'Customer';
          window.__bpp_toast && window.__bpp_toast(
            `👀 ${name} opened their quote`,
            'info',
            {
              label: 'Open',
              onClick: () => {
                if (!p.contact_id) return;
                setSelectedContact(p.contact_id);
                setTab('quick');
                window.location.hash = `#tab=leads&contact=${p.contact_id}`;
              },
            }
          );
          if (!tabFocusedRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              const n = new Notification(`${name} opened the quote`, {
                body: `$${Number(p.total || 0).toLocaleString()} — first view`,
                tag: `bpp-quote-view-${p.id}`,
                icon: '/assets/images/logo-main.png',
              });
              n.onclick = () => {
                window.focus();
                if (p.contact_id) {
                  window.location.hash = `#contact=${p.contact_id}`;
                  setSelectedContact(p.contact_id);
                }
                n.close();
              };
            } catch {}
          }
        }
      })
      // Deposit-paid notification — invoices status flips to paid via
      // stripe-webhook. Celebrate the win, open to the contact so Key can
      // reply with install-date confirmation.
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'invoices',
      }, async (payload) => {
        const i = payload.new, prev = payload.old;
        if (!i || !prev) return;
        if (prev.status !== 'paid' && i.status === 'paid') {
          const name = i.contact_name || 'Customer';
          const amt = Number(i.total || 0).toLocaleString();
          window.__bpp_toast && window.__bpp_toast(
            `💸 ${name} paid $${amt}`,
            'success',
            {
              label: 'Open',
              onClick: () => {
                if (!i.contact_id) return;
                setSelectedContact(i.contact_id);
                setTab('quick');
                window.location.hash = `#tab=leads&contact=${i.contact_id}`;
              },
            }
          );
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              const n = new Notification(`💸 ${name} paid $${amt}`, {
                body: i.notes === 'deposit' ? 'Deposit received — schedule install' : 'Payment received',
                tag: `bpp-paid-${i.id}`,
                icon: '/assets/images/logo-main.png',
              });
              n.onclick = () => {
                window.focus();
                if (i.contact_id) {
                  window.location.hash = `#contact=${i.contact_id}`;
                  setSelectedContact(i.contact_id);
                }
                n.close();
              };
            } catch {}
          }
        }
      })
      // Outbound-failed toast — the delivery-status callback (twilio-status-
      // callback, fixed this session) patches status sent → failed /
      // undelivered when the carrier rejects a message (bad number, spam
      // filter, opt-out). Surface that as a live toast so Key knows within
      // seconds that his text didn't reach the customer, not days later
      // when he checks the thread and wonders why they never replied.
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: 'direction=eq.outbound',
      }, async (payload) => {
        const m = payload.new;
        const prev = payload.old;
        // Only fire on the sent → failed transition; subsequent status
        // updates (e.g. webhook retry) shouldn't re-toast.
        if (!m || !(m.status === 'failed' || m.status === 'undelivered')) return;
        if (prev && (prev.status === 'failed' || prev.status === 'undelivered')) return;
        const { data: c } = await db.from('contacts').select('name').eq('id', m.contact_id).maybeSingle();
        const name = c?.name || 'Unknown';
        window.__bpp_toast && window.__bpp_toast(
          `⚠ SMS to ${name} failed to deliver`,
          'error',
          {
            label: 'Open',
            onClick: () => {
              setSelectedContact(m.contact_id);
              setTab('quick');
              window.location.hash = `#tab=leads&contact=${m.contact_id}`;
            },
          }
        );
      })
      .subscribe((status) => {
        // Surface realtime connection health via the shared banner —
        // SUBSCRIBED/CLOSED are healthy, CHANNEL_ERROR/TIMED_OUT are not.
        window.dispatchEvent(new CustomEvent('bpp:realtime-status', {
          detail: { channel: 'global-inbound-sms', status },
        }));
      });
    return () => { db.removeChannel(ch); };
  }, [user, selectedContact]);

  // One-shot: ask for Notification permission once per user
  useEffect(() => {
    if (!user) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default' && !localStorage.getItem('bpp_v2_notif_asked')) {
      localStorage.setItem('bpp_v2_notif_asked', '1');
      Notification.requestPermission().catch(() => {});
    }
  }, [user]);

  // Expose dial globally so the contact detail can call it via window.__bpp_dial
  useEffect(() => {
    window.__bpp_dial = (phone) => voice.dial(phone);
  }, [voice]);

  // Morning briefing trigger — once per day on first load
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem('bpp_v2_brief_shown');
    if (lastShown !== today) {
      setBriefOpen(true);
      localStorage.setItem('bpp_v2_brief_shown', today);
    }
  }, [user]);

  // Responsive
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Global keyboard shortcuts
  //   ⌘K / Ctrl+K → command palette
  //   Esc → close detail panel / modal (handled per-modal)
  //   g then L/C/F/M/S → nav to tab (2-key chord, vim-style)
  //   ⌘/ → show keyboard help modal (future)
  const [gPending, setGPending] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      // Skip if focus is in an input/textarea
      const t = e.target;
      const editable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
        return;
      }
      if (editable) return;

      // g-chord: g then a letter to jump to a tab. Flat tabs expanded the
      // vocabulary; stick to first-letter wherever it isn't ambiguous.
      //   q=quick · c=calendar · p=pipeline · l=list · m=messages · v=calls
      //   r=proposals · i=invoices · t=permits · a=materials · f=finance
      if (gPending) {
        const map = {
          q: 'quick', c: 'calendar', p: 'pipeline', l: 'list',
          m: 'messages', v: 'calls', r: 'proposals', i: 'invoices',
          t: 'permits', a: 'materials', f: 'finance',
        };
        const target = map[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          setTab(target);
        }
        setGPending(false);
        return;
      }
      if (e.key === 'g') {
        e.preventDefault();
        setGPending(true);
        setTimeout(() => setGPending(false), 1000);
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setHelpOpen(o => !o);
        return;
      }
      // r → focus SMS compose bar when contact detail is open
      if (e.key === 'r' && selectedContact) {
        const composeInput = document.querySelector('input[placeholder="Type a message…"]');
        if (composeInput) {
          e.preventDefault();
          composeInput.focus();
        }
      }
      // d → dial the selected contact via Twilio Voice
      if (e.key === 'd' && selectedContact) {
        (async () => {
          const { data } = await db.from('contacts').select('phone, do_not_contact, name').eq('id', selectedContact).maybeSingle();
          if (data?.do_not_contact) {
            window.__bpp_toast && window.__bpp_toast(`${data?.name || 'Contact'} is DNC — not dialing`, 'error');
            return;
          }
          if (data?.phone && window.__bpp_dial) {
            e.preventDefault();
            window.__bpp_dial(data.phone);
            window.__bpp_toast && window.__bpp_toast(`Dialing ${data.phone}…`, 'info');
          }
        })();
      }
      // Esc → close detail panel
      if (e.key === 'Escape' && selectedContact) {
        setSelectedContact(null);
      }
      // b → reopen morning briefing
      if (e.key === 'b' && !e.shiftKey && !briefOpen) {
        e.preventDefault();
        setBriefOpen(true);
      }
      // Shift+B → install brief for the selected contact
      if (e.key === 'B' && e.shiftKey && selectedContact) {
        e.preventDefault();
        setTab('quick');
        window.dispatchEvent(new CustomEvent('bpp:open-install-brief'));
      }
      // t → toggle theme (dark/light)
      if (e.key === 't') {
        e.preventDefault();
        setIsDark(d => !d);
      }
      // p → pin/unpin the currently open contact
      if (e.key === 'p' && selectedContact) {
        e.preventDefault();
        const nowPinned = togglePin(selectedContact);
        window.__bpp_toast && window.__bpp_toast(nowPinned ? 'Pinned' : 'Unpinned', 'info');
      }
      // y → yank (copy) a formatted contact summary to clipboard
      if (e.key === 'y' && selectedContact) {
        e.preventDefault();
        (async () => {
          const { data: c } = await db.from('contacts').select('name, phone, email, address, stage').eq('id', selectedContact).maybeSingle();
          if (!c) return;
          const block = [
            c.name || 'Unknown',
            c.phone ? formatPhone(c.phone) : null,
            c.email || null,
            c.address || null,
            `Stage: ${STAGE_MAP[c.stage || 1] || 'NEW'}`,
          ].filter(Boolean).join('\n');
          try {
            await navigator.clipboard.writeText(block);
            window.__bpp_toast && window.__bpp_toast('Contact summary copied', 'success');
          } catch {
            window.__bpp_toast && window.__bpp_toast('Copy failed', 'error');
          }
        })();
      }
      // x → export SMS thread transcript for the open contact
      if (e.key === 'x' && selectedContact) {
        e.preventDefault();
        (async () => {
          const [{ data: c }, { data: msgs }] = await Promise.all([
            db.from('contacts').select('name, phone').eq('id', selectedContact).maybeSingle(),
            db.from('messages').select('direction, body, sender, created_at').eq('contact_id', selectedContact).order('created_at', { ascending: true }).limit(500),
          ]);
          if (!msgs || msgs.length === 0) {
            window.__bpp_toast && window.__bpp_toast('No messages to export', 'info');
            return;
          }
          const header = [
            `Transcript: ${c?.name || 'Unknown'} ${c?.phone ? '('+formatPhone(c.phone)+')' : ''}`.trim(),
            `Exported: ${new Date().toLocaleString()}`,
            '—'.repeat(40),
            '',
          ].join('\n');
          const body = msgs.map(m => {
            const who = m.sender === 'ai' ? 'Alex' : (m.direction === 'inbound' ? 'Customer' : 'Key');
            const ts = m.created_at ? new Date(m.created_at).toLocaleString() : '';
            return `[${ts}] ${who}:\n${m.body || ''}\n`;
          }).join('\n');
          try {
            await navigator.clipboard.writeText(header + body);
            window.__bpp_toast && window.__bpp_toast(`Transcript copied (${msgs.length} messages)`, 'success');
          } catch {
            window.__bpp_toast && window.__bpp_toast('Copy failed', 'error');
          }
        })();
      }
      // Helper: find the next waiting thread (customer sent last message, not AI).
      // Skips `skipId` so "next" advances rather than re-selecting the current one.
      const findNextWaiting = async (skipId) => {
        const { data: msgs } = await db.from('messages')
          .select('contact_id, direction, sender, created_at')
          .order('created_at', { ascending: false }).limit(300);
        if (!msgs) return null;
        const seen = new Set();
        for (const m of msgs) {
          if (!m.contact_id) continue;
          if (seen.has(m.contact_id)) continue;
          seen.add(m.contact_id);
          if (m.direction === 'inbound' && m.sender !== 'ai') {
            if (m.contact_id === skipId) continue;
            return m.contact_id;
          }
        }
        return null;
      };
      // j → jump to next waiting thread (customer sent last message).
      // Works from anywhere — opens the slide-over on the Leads tab.
      if (e.key === 'j') {
        e.preventDefault();
        (async () => {
          const next = await findNextWaiting(selectedContact);
          if (next) {
            setSelectedContact(next);
            setTab('quick');
            window.__bpp_toast && window.__bpp_toast('Next waiting thread', 'info');
          } else {
            window.__bpp_toast && window.__bpp_toast('No waiting threads', 'info');
          }
        })();
      }
      // n → new lead modal
      if (e.key === 'n' && !newLeadOpen) {
        e.preventDefault();
        setNewLeadOpen(true);
      }
      // q → quick quote modal for the open contact (requires a selection).
      // Switches to QUOTE tab if needed and opens the pricing chips.
      if (e.key === 'q' && selectedContact) {
        e.preventDefault();
        setTab('quick');
        window.dispatchEvent(new CustomEvent('bpp:open-quick-quote'));
      }
      // 1–9 → change stage on the currently selected contact, then auto-advance
      // to the next waiting thread. This turns morning triage into a rhythm:
      // open card → press 2 → next card appears → press 3 → next card appears.
      if (/^[1-9]$/.test(e.key) && selectedContact) {
        e.preventDefault();
        const newStage = Number(e.key);
        const fromId = selectedContact; // capture for undo closure
        (async () => {
          const { data } = await db.from('contacts').select('stage, name').eq('id', fromId).maybeSingle();
          const oldStage = data?.stage || 1;
          if (oldStage === newStage) {
            window.__bpp_toast && window.__bpp_toast(`${data?.name || 'Contact'} already at ${STAGE_MAP[newStage] || 'stage ' + newStage}`, 'info');
            return;
          }
          await db.from('contacts').update({ stage: newStage }).eq('id', fromId);
          await db.from('stage_history').insert({
            contact_id: fromId, from_stage: oldStage, to_stage: newStage,
          }).then(() => {}, () => {});
          window.__bpp_toast && window.__bpp_toast(
            `${data?.name || 'Contact'} → ${STAGE_MAP[newStage] || 'stage ' + newStage}`,
            'success',
            { label: 'Undo', onClick: async () => {
              await db.from('contacts').update({ stage: oldStage }).eq('id', fromId);
              await db.from('stage_history').insert({ contact_id: fromId, from_stage: newStage, to_stage: oldStage }).then(()=>{}, ()=>{});
              setSelectedContact(fromId); // bring the user back to the undone contact
            }}
          );
          // Auto-advance: find next waiting thread (skip the one we just moved)
          const next = await findNextWaiting(fromId);
          if (next) {
            setSelectedContact(next);
          } else {
            // Caught up — close the slide-over so the pipeline is visible
            setSelectedContact(null);
            window.__bpp_toast && window.__bpp_toast('Inbox clear — caught up', 'info');
          }
        })();
      }
      // / → focus a visible search input on whatever tab is active
      if (e.key === '/') {
        const search = document.querySelector('input[placeholder="Search threads…"], input[placeholder="Ask anything…"]');
        if (search) { e.preventDefault(); search.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gPending, selectedContact, briefOpen, newLeadOpen]);

  // Auth bootstrap
  useEffect(() => {
    (async () => {
      const { data } = await db.auth.getSession();
      setUser(data.session?.user || null);
      setAuthReady(true);
    })();
    const { data: sub } = db.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authReady) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <AuthGate onAuth={setUser} />;

  // Pull Shell components from window
  const TopBar = window.TopBar;
  const TabBar = window.TabBar;

  const handleCardClick = (id) => setSelectedContact(id);

  // Flat-tab routing (Key 2026-04-21: "no tabs within tabs"). Each tab maps
  // directly to a single full-height component. Legacy `#tab=leads` URLs
  // redirect up at parse time (see hash effect) to the matching flat tab.
  const content = (() => {
    if (tab === 'quick') {
      return (
        <LiveQuickList onSelect={(id, section) => {
          if (section === 'stuck') setNextDetailTab('QUOTE');
          else if (section === 'permits') setNextDetailTab('PERMITS');
          else setNextDetailTab('MESSAGES');
          setSelectedContact(id);
        }} />
      );
    }
    if (tab === 'calendar')  return <LiveCalendar />;
    if (tab === 'pipeline')  return <LivePipeline onCardClick={handleCardClick} />;
    if (tab === 'list')      return <LiveLeadsList desktop={!isMobile} onSelect={r => setSelectedContact(r.id)} />;
    if (tab === 'messages')  return <LiveMessages onSelect={id => setSelectedContact(id)} activeId={selectedContact} />;
    if (tab === 'calls')     return <LiveCalls onSelect={id => setSelectedContact(id)} />;
    if (tab === 'proposals') return <LiveFinance initialSub="prop" />;
    if (tab === 'invoices')  return <LiveFinance initialSub="inv" />;
    if (tab === 'permits')   return <LivePermits />;
    if (tab === 'materials') return <LiveMaterials />;
    if (tab === 'finance')   return <LiveFinance />;
    return null;
  })();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {TopBar ? (
          <TopBar
            compact={isMobile}
            isDark={isDark}
            onToggleDark={() => setIsDark(d => !d)}
            onNewLead={() => setNewLeadOpen(true)}
            onOpenSearch={() => setPaletteOpen(true)}
          />
        ) : <div style={{ padding: 16 }}>BPP CRM</div>}
      </div>
      {/* Two separate tab strips side-by-side above the two content columns
          (Key 2026-04-21: "top bar above the left with all the tabs. then
          have a tab bar above the right with tabs"). Left = main-tab nav.
          Right = dynamic hotkey strip for open right-panel surfaces
          (Sparky always pinned; contact tab appears when one is selected). */}
      {!isMobile ? (
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {TabBar ? <TabBar active={tab} scrollable={false} onChange={setTab} badges={(() => {
              const b = {};
              if (unreadCount > 0) b.messages = unreadCount;
              return b;
            })()} /> : null}
          </div>
          <div style={{ flex: '0 0 480px', width: 480 }}>
            <RightTabBar
              selectedContact={selectedContact}
              contactLabel={rightPanelContactLabel}
              contactPhone={rightPanelContactPhone}
              onCloseContact={() => setSelectedContact(null)}
              onOpenBrief={() => window.dispatchEvent(new CustomEvent('bpp:open-install-brief'))}
            />
          </div>
        </div>
      ) : (
        TabBar ? <TabBar active={tab} scrollable={true} onChange={setTab} badges={(() => {
          const b = {};
          if (unreadCount > 0) b.messages = unreadCount;
          return b;
        })()} /> : null
      )}
      {/* Desktop: two-column layout. Left = current tab content. Right = a
          persistent 480px panel — Sparky by default, contact detail when a
          contact is selected. Mobile keeps the old overlay behavior since
          a phone viewport can't show both columns meaningfully. */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative' }} className="grid-bg">
        <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
          <ErrorBoundary label={tab.toUpperCase()}>
            {content}
          </ErrorBoundary>
        </div>
        {!isMobile ? (
          <div style={{
            flex: '0 0 480px',
            width: 480,
            borderLeft: '1px solid rgba(0,0,0,.08)',
            display: 'flex', flexDirection: 'column',
            background: 'var(--card)',
          }}>
            {selectedContact ? (
              <ErrorBoundary label="CONTACT DETAIL">
                <LiveContactDetail
                  contactId={selectedContact}
                  onBack={() => setSelectedContact(null)}
                  mobile={false}
                  defaultTab={(() => {
                    // One-shot override wins (e.g. Quick List STUCK QUOTES
                    // land on QUOTE directly so Key can review + draft F/U).
                    if (nextDetailTab) {
                      const t = nextDetailTab;
                      // Clear on next tick so a follow-up contact click
                      // reverts to the main-tab mapping below.
                      queueMicrotask(() => setNextDetailTab(null));
                      return t;
                    }
                    // Otherwise map the flat tab Key is currently viewing
                    // to the detail tab that makes the most sense to open.
                    if (tab === 'proposals' || tab === 'invoices' || tab === 'finance') return 'QUOTE';
                    if (tab === 'calendar' || tab === 'permits' || tab === 'materials') return 'PERMITS';
                    if (tab === 'messages' || tab === 'calls') return 'MESSAGES';
                    return undefined; // QUICK / LIST / PIPELINE → stage-based smart default
                  })()}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary label="SPARKY SIDEBAR">
                <LiveSparky currentContactId={null} />
              </ErrorBoundary>
            )}
          </div>
        ) : selectedContact ? (
          <div style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0,
            width: '100%',
            zIndex: 20,
            display: 'flex', flexDirection: 'column',
            background: 'var(--card)',
          }}>
            {/* Mobile uses the same per-surface action bar as desktop. Key
                2026-04-21: "mobile will work similar" — left screen by
                default, click into a right surface, back button returns.
                The RightTabBar here sits above the contact detail full-
                width and renders the same sub-tab / CALL / BRIEF / × row. */}
            <RightTabBar
              selectedContact={selectedContact}
              contactLabel={rightPanelContactLabel}
              contactPhone={rightPanelContactPhone}
              onCloseContact={() => setSelectedContact(null)}
              onOpenBrief={() => window.dispatchEvent(new CustomEvent('bpp:open-install-brief'))}
            />
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <ErrorBoundary label="CONTACT DETAIL">
                <LiveContactDetail
                  contactId={selectedContact}
                  onBack={() => setSelectedContact(null)}
                  mobile={true}
                />
              </ErrorBoundary>
            </div>
          </div>
        ) : null}
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectContact={id => { setSelectedContact(id); setTab('quick'); }}
        onSwitchTab={id => setTab(id)}
        onAction={id => {
          if (id === 'export_csv') exportContactsCsv();
          else if (id === 'show_help') setHelpOpen(true);
          else if (id === 'open_briefing') setBriefOpen(true);
          else if (id === 'new_lead') setNewLeadOpen(true);
          else if (id === 'toggle_dark') setIsDark(d => !d);
          else if (id === 'create_installer_token') {
            (async () => {
              const name = window.prompt('Installer name (e.g. "Marcus")');
              if (!name || !name.trim()) return;
              const token = (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2) + Date.now().toString(36);
              const { error } = await db.from('installer_tokens').insert({ token, installer_name: name.trim() });
              if (error) { window.__bpp_toast && window.__bpp_toast(`Failed: ${error.message}`, 'error'); return; }
              const url = `https://backuppowerpro.com/sub/?token=${token}`;
              try { await navigator.clipboard.writeText(url); } catch {}
              window.__bpp_toast && window.__bpp_toast(`Token for ${name.trim()} copied. Text it to them.`, 'success', {
                label: 'View',
                onClick: () => window.open(url, '_blank'),
              });
            })();
          }
          else if (id === 'list_installer_tokens') {
            (async () => {
              const { data } = await db.from('installer_tokens').select('token, installer_name, created_at, revoked_at').order('created_at', { ascending: false });
              if (!data || data.length === 0) {
                window.__bpp_toast && window.__bpp_toast('No installer tokens yet. Use "Create installer access token".', 'info');
                return;
              }
              const summary = data.map(t => `${t.installer_name}${t.revoked_at ? ' (revoked)' : ''} — /sub/?token=${t.token}`).join('\n');
              window.prompt('Installer tokens (copy to share; revoke via SQL if leaked):', summary);
            })();
          }
        }}
      />
      {briefOpen ? <LiveMorningBriefing
        onClose={() => setBriefOpen(false)}
        onPickContact={id => { setSelectedContact(id); setTab('quick'); setBriefOpen(false); }}
      /> : null}
      <NewLeadModal
        open={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        onCreated={c => {
          setSelectedContact(c.id);
          setTab('quick');
        }}
      />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <VoiceCallModal voice={voice} />
      <OfflineBanner />
      <ToastRoot />
    </div>
  );
}

// Boot
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App />);

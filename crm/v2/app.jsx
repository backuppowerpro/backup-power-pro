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

function contactToRow(c) {
  const stage = STAGE_MAP[c.stage || 1] || 'NEW';
  // overdue if last activity > 7 days and stage < 4
  const createdAt = c.created_at;
  const ageDays = createdAt ? Math.round((Date.now() - new Date(createdAt).getTime()) / 86400000) : 0;
  return {
    id: c.id,
    name: c.name || '—',
    initials: initials(c.name),
    photo: null,
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

// ── Offline indicator — thin banner when navigator.onLine flips false ──────
function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  if (online) return null;
  return (
    <div style={{
      padding: '6px 16px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
      background: 'var(--ms-3)', color: '#fff', textAlign: 'center', letterSpacing: '.04em',
    }}>Offline — changes queued until you reconnect</div>
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
function LiveLeadsList({ desktop = false, onSelect }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await db
        .from('contacts')
        .select('id, name, phone, email, address, stage, status, do_not_contact, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!alive) return;
      if (error) { setErr(error.message); setLoading(false); return; }
      setRows((data || []).map(contactToRow));
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
          .order('created_at', { ascending: false })
          .limit(200);
        setRows((data || []).map(contactToRow));
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, []);

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

  // Apply pin state + sort pinned first
  const [pinsTick, setPinsTick] = useState(0);
  useEffect(() => {
    const on = () => setPinsTick(t => t + 1);
    window.addEventListener('bpp:pins-changed', on);
    return () => window.removeEventListener('bpp:pins-changed', on);
  }, []);
  const sortedRows = useMemo(() => {
    const pinSet = new Set(readPins());
    return rows
      .map(r => ({ ...r, pinned: pinSet.has(r.id) }))
      .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
  }, [rows, pinsTick]);

  const LeadsListDesktop = window.LeadsListDesktop;
  const LeadsListMobile  = window.LeadsListMobile;

  return desktop
    ? <LeadsListDesktop rows={sortedRows} onSelect={onSelect} />
    : <LeadsListMobile  rows={sortedRows} onSelect={onSelect} />;
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

function contactToCard(c) {
  const days = c.created_at
    ? Math.round((Date.now() - new Date(c.created_at).getTime()) / 86400000)
    : 0;
  // Best-effort dots: photo flag lives in Alex session, quote in proposals,
  // permit in install_notes. For MVP we heuristic-flag from install_notes + stage.
  const notes = (c.install_notes || '').toLowerCase();
  const hasPhoto = /photo|image|panel_photo/.test(notes) || (c.stage || 1) >= 2;
  const hasQuote = (c.stage || 1) >= 2;
  const hasPermit = (c.stage || 1) >= 4;
  return {
    id: c.id,
    name: c.name || '—',
    initials: initials(c.name),
    addr: c.address || '—',
    days,
    dots: { photo: hasPhoto ? 1 : 0, quote: hasQuote ? 1 : 0, permit: hasPermit ? 1 : 0 },
    overdue: days > 7 && (c.stage || 1) < 4,
    dnc: !!c.do_not_contact,
    jurisdiction: c._jurisdiction_name || null,
    pinned: isPinned(c.id),
  };
}

function LivePipelineToolbar({ active = 'pipeline', onSubView, stats }) {
  // Sub-view switch only — the MINE/ALL/OVERDUE/HAS-PHOTO filter row
  // was not wired up and was visual noise. Re-add when the filters
  // are actually functional.
  const subs = [
    { id: 'pipeline', label: 'PIPELINE' },
    { id: 'list',     label: 'LIST' },
    { id: 'permits',  label: 'PERMITS' },
    { id: 'mat',      label: 'MATERIALS' },
  ];
  return (
    <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', height: 36, boxShadow: 'var(--raised-2)' }}>
        {subs.map(s => (
          <button key={s.id} className="chrome-label"
            onClick={() => onSubView && onSubView(s.id)}
            style={{
              height: 36, padding: '0 16px', fontSize: 12,
              background: s.id === active ? 'var(--navy)' : 'transparent',
              color: s.id === active ? 'var(--gold)' : 'var(--text)',
              boxShadow: s.id === active ? 'var(--pressed-2)' : 'none',
              cursor: 'pointer', border: 'none',
            }}>{s.label}</button>
        ))}
      </div>
      {stats ? (
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 14 }}>
          <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{stats.count}</span> active</span>
          {stats.value > 0 ? <span><span style={{ color: 'var(--ms-2)', fontWeight: 600 }}>${stats.value.toLocaleString()}</span> pipeline</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function LivePipeline({ onCardClick, onSubView }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [{ data: contacts }, { data: jurisdictions }] = await Promise.all([
      db.from('contacts')
        .select('id, name, phone, address, stage, install_notes, created_at, do_not_contact, quote_amount, jurisdiction_id')
        .order('created_at', { ascending: false })
        .limit(500),
      db.from('permit_jurisdictions').select('id, name'),
    ]);
    // Attach jurisdiction name inline so contactToCard can render it
    const jMap = Object.fromEntries((jurisdictions || []).map(j => [j.id, j.name]));
    const withJ = (contacts || []).map(c => ({ ...c, _jurisdiction_name: jMap[c.jurisdiction_id] || null }));
    setContacts(withJ);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    const ch = db.channel('pipeline-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchAll)
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
  // each column. Re-computes on contacts change OR pins change.
  const buckets = useMemo(() => {
    const b = {};
    Object.keys(PIPELINE_COL_TO_STAGE).forEach(k => { b[k] = []; });
    for (const c of contacts) {
      const colId = STAGE_TO_PIPELINE_COL[c.stage || 1] || 'new';
      b[colId].push(contactToCard(c));
    }
    for (const k of Object.keys(b)) {
      b[k].sort((a, x) => (a.pinned === x.pinned ? 0 : a.pinned ? -1 : 1));
    }
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, pipelinePinsTick]);

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
          active="pipeline"
          onSubView={onSubView}
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
function LiveContactDetail({ contactId, onBack, mobile = false }) {
  const [contact, setContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [alexSession, setAlexSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('MESSAGES');
  // Track which contact the user last explicitly clicked a tab on, so we
  // can auto-pick a smart default when switching between contacts.
  const [manualTabContactId, setManualTabContactId] = useState(null);
  const msgScrollRef = useRef(null);

  // Auto-scroll message thread to bottom when messages change or tab opens
  useEffect(() => {
    if (detailTab === 'MESSAGES' && msgScrollRef.current) {
      msgScrollRef.current.scrollTop = msgScrollRef.current.scrollHeight;
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
          .select('alex_active, opted_out, followup_count, status, summary, updated_at')
          .eq('phone', cRes.data.phone)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (alive) setAlexSession(sess || null);
      } else {
        setAlexSession(null);
      }
      setLoading(false);
      // Smart default tab based on stage, unless user manually picked one for this contact
      if (cRes.data && manualTabContactId !== contactId) {
        const s = cRes.data.stage || 1;
        let smart = 'MESSAGES';
        if (s === 1) smart = 'QUOTE';         // NEW → send a quote
        else if (s >= 4 && s <= 8) smart = 'PERMITS'; // permit / install phases
        setDetailTab(smart);
      }
    })();
    return () => { alive = false; };
  }, [contactId]);

  // Realtime messages for this contact
  useEffect(() => {
    if (!contactId) return;
    const channel = db.channel(`messages-${contactId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `contact_id=eq.${contactId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [contactId]);

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
      </div>

      {/* Stage strip (click to open picker) */}
      <button
        onClick={() => setStagePickerOpen(true)}
        style={{
          height: 36, padding: '0 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', cursor: 'pointer',
          background: 'var(--card)', boxShadow: 'var(--raised-2)',
          border: 0, textAlign: 'left',
        }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text)' }}>{stageAbbr}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>stage {contact?.stage || 1} ›</span>
      </button>

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
        <div style={{
          padding: '6px 14px',
          background: 'var(--card)',
          borderBottom: '1px solid rgba(0,0,0,.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: 'var(--font-body)', fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          <span>
            Alex
            <span style={{
              marginLeft: 6, padding: '1px 6px', fontSize: 10, letterSpacing: '.04em',
              color: alexSession.alex_active ? 'var(--ms-2)' : 'var(--text-faint)',
              border: '1px solid currentColor',
            }}>
              {alexSession.opted_out ? 'opted out' : alexSession.alex_active ? 'active' : 'handed off'}
            </span>
          </span>
          <span className="mono" style={{ fontSize: 10 }}>
            {alexSession.followup_count > 0 ? `${alexSession.followup_count} follow-up${alexSession.followup_count === 1 ? '' : 's'}` : '—'}
          </span>
        </div>
      ) : null}

      <SnoozeRow contactId={contactId} contactName={contact?.name} />


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
            }
            setStagePickerOpen(false);
          }}
          onClose={() => setStagePickerOpen(false)}
        />
      ) : null}

      {/* Detail tabs */}
      <div style={{
        height: 42, display: 'flex', alignItems: 'stretch',
        padding: '0 16px', gap: 16,
        borderBottom: '1px solid rgba(0,0,0,.08)',
        overflowX: 'auto',
      }}>
        {[
          { id: 'MESSAGES', label: 'Messages' },
          { id: 'TIMELINE', label: 'Timeline' },
          { id: 'QUOTE',    label: 'Quote' },
          { id: 'PERMITS',  label: 'Permits' },
          { id: 'NOTES',    label: 'Notes' },
          { id: 'EDIT',     label: 'Edit' },
        ].map(t => {
          const on = t.id === detailTab;
          return (
            <button key={t.id}
              onClick={() => { setDetailTab(t.id); setManualTabContactId(contactId); }}
              style={{
                height: '100%', padding: '0 4px', fontSize: 13,
                fontFamily: 'var(--font-body)', fontWeight: on ? 700 : 500,
                color: on ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: on ? '2px solid var(--gold)' : '2px solid transparent',
                borderBottomStyle: 'solid',
                background: 'transparent', border: 'none',
                cursor: 'pointer', flex: '0 0 auto',
              }}>{t.label}</button>
          );
        })}
      </div>

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
            </div>
            </React.Fragment>
          );
        })}
      </div>
      ) : null}

      {detailTab === 'TIMELINE' ? <DetailTimeline contactId={contactId} /> : null}
      {detailTab === 'QUOTE' ? <DetailQuote contactId={contactId} /> : null}
      {detailTab === 'PERMITS' ? <DetailPermits contact={contact} /> : null}
      {detailTab === 'NOTES' ? <DetailNotes contact={contact} onUpdate={(notes) => setContact(c => ({ ...c, install_notes: notes }))} /> : null}
      {detailTab === 'EDIT' ? <DetailEditContact contact={contact} onUpdate={(patch) => setContact(c => ({ ...c, ...patch }))} /> : null}

      {/* Compose — only show on MESSAGES tab */}
      {detailTab === 'MESSAGES' ? (
        <ComposeBar contactId={contactId} contactName={contact?.name} contactPhone={contact?.phone} disabled={!!contact?.do_not_contact} />
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

function DetailQuote({ contactId }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickOpen, setQuickOpen] = useState(false);
  const [contact, setContact] = useState(null);

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

  function copyLink(token) {
    const url = `${PROPOSAL_BASE_URL}?token=${token}`;
    navigator.clipboard.writeText(url)
      .then(() => window.__bpp_toast && window.__bpp_toast('Proposal link copied', 'success'))
      .catch(() => window.__bpp_toast && window.__bpp_toast('Copy failed — select + ⌘C manually', 'error'));
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
    // Build the SMS body and copy to clipboard
    const fname = (contact?.name || '').split(' ')[0] || 'there';
    const totalAmt = newProposal.total;
    const depositAmt = Math.round(totalAmt * 0.5);
    const link = `${PROPOSAL_BASE_URL}?token=${newProposal.token}`;
    const msg = `Hi ${fname}! Here's your quote for the Storm-Ready Connection System — $${totalAmt.toLocaleString()} all in. A 50% deposit ($${depositAmt.toLocaleString()}) is due to confirm your spot. Review & approve here: ${link}`;
    try {
      await navigator.clipboard.writeText(msg);
      window.__bpp_toast && window.__bpp_toast(`Quote created + SMS copied — $${totalAmt.toLocaleString()}`, 'success');
    } catch {
      window.__bpp_toast && window.__bpp_toast(`Quote created — link: ${link}`, 'success');
    }
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
      ) : proposals.map(p => (
        <div key={p.id} style={{
          padding: '14px 0',
          borderTop: '1px solid rgba(0,0,0,.08)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700 }}>
                ${(Number(p.total) || 0).toLocaleString()}
              </span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'lowercase' }}>
                {p.status || 'sent'}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
              {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
              {p.view_count ? ` · ${p.view_count} view${p.view_count === 1 ? '' : 's'}` : ''}
            </div>
          </div>
          {p.token ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <a href={`${PROPOSAL_BASE_URL}?token=${p.token}`} target="_blank" rel="noopener" style={{
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
              <button onClick={() => depositLink(p)} style={{
                padding: '6px 12px', fontSize: 11, fontFamily: 'var(--font-body)',
                boxShadow: 'var(--raised-2)', cursor: 'pointer',
                border: 'none', background: 'var(--card)', color: 'var(--ms-2)',
              }}>Deposit</button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Quick Quote Modal ──────────────────────────────────────────────────────
// Minimal — just a total that updates as you toggle. No section labels, no
// sub-prices on chips, no cross-amp preview. Complex quotes go to legacy.
function QuickQuoteModal({ contact, onClose, onCreated }) {
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
      <div onClick={e => e.stopPropagation()} style={{
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

function DetailPermits({ contact }) {
  if (!contact) return null;
  const cells = stageToPermitCells(contact.stage);
  const headers = ['Submit', 'Pay', 'Paid', 'Print', 'Printed', 'Inspect', 'Pass'];
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
      </div>
    </div>
  );
}

function DetailEditContact({ contact, onUpdate }) {
  const [form, setForm] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    address: contact?.address || '',
    do_not_contact: !!contact?.do_not_contact,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-seed form when the open contact swaps
  useEffect(() => {
    setForm({
      name: contact?.name || '',
      phone: contact?.phone || '',
      email: contact?.email || '',
      address: contact?.address || '',
      do_not_contact: !!contact?.do_not_contact,
    });
  }, [contact?.id]);

  async function save(e) {
    e?.preventDefault();
    if (!contact) return;
    setSaving(true);
    const dncChanged = !!contact.do_not_contact !== !!form.do_not_contact;
    const patch = {
      name: form.name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
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

function DetailNotes({ contact, onUpdate }) {
  const [text, setText] = useState(contact?.install_notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const lastSavedRef = useRef(contact?.install_notes || '');
  const debounceRef = useRef(null);

  // When the contact changes, re-seed with that contact's notes
  useEffect(() => {
    const t = contact?.install_notes || '';
    setText(t);
    lastSavedRef.current = t;
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
    const { error } = await db.from('contacts').update({ install_notes: text }).eq('id', contact.id);
    setSaving(false);
    if (!error) {
      lastSavedRef.current = text;
      setSaved(true);
      onUpdate && onUpdate(text);
      if (!silent) window.__bpp_toast && window.__bpp_toast(`Notes saved for ${contact.name || 'contact'}`, 'success');
      setTimeout(() => setSaved(false), 1500);
    } else {
      window.__bpp_toast && window.__bpp_toast(`Save failed: ${error.message}`, 'error');
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {saved ? (
          <span className="mono" style={{ fontSize: 11, color: 'var(--ms-2)' }}>
            Saved
          </span>
        ) : <span />}
        <button
          onClick={save}
          disabled={saving}
          style={{
            height: 36, padding: '0 20px',
            background: 'var(--navy)', color: '#fff',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
            letterSpacing: '.04em',
            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1, border: 'none',
          }}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

function StagePickerModal({ currentStage, onPick, onClose }) {
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
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 95,
      background: 'rgba(0,0,0,.5)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
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
                }}>
                <span>{s.label.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
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
const SMS_SNIPPETS = [
  { label: 'Intro', body: "Hi {name}! This is Key with Backup Power Pro. Thanks for reaching out — I can get you a quote today once I know a couple details. Do you already have a generator, or looking to add one?" },
  { label: 'Quote sent', body: "Hi {name}, just sent over your quote. Let me know if you have any questions — happy to hop on a quick call if that's easier." },
  { label: 'Follow up', body: "Hey {name}, just checking in. Want me to hold that install slot, or shift it out a week?" },
  { label: 'Deposit', body: "Hi {name}! To lock in your install date, a 50% deposit is all that's needed. I'll send the link over now." },
];

// Parse a message body and render inline:
// - "[media:https://...] optional caption" → render as <img> + caption
// - URLs inside the text → render as clickable links
// - Otherwise plain text
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
  // URL linkification — split on URLs, render links as <a>
  const parts = body.split(/(https?:\/\/[^\s]+)/g);
  if (parts.length === 1) return <span>{body}</span>;
  return (
    <span>
      {parts.map((p, i) => /^https?:\/\//.test(p) ? (
        <a key={i} href={p} target="_blank" rel="noopener"
          style={{ color: isOut ? 'var(--gold)' : 'var(--navy)', wordBreak: 'break-all' }}
        >{p}</a>
      ) : <React.Fragment key={i}>{p}</React.Fragment>)}
    </span>
  );
}

function ComposeBar({ contactId, contactName, contactPhone, disabled = false }) {
  // Auto-save drafts per contact in localStorage so Key doesn't lose a
  // half-typed SMS when he switches contacts or reloads the tab.
  const draftKey = contactId ? `bpp_v2_draft_${contactId}` : null;
  const [text, setText] = useState(() => (draftKey && localStorage.getItem(draftKey)) || '');
  const [sending, setSending] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);

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

  // GSM-7 characters fit 160/segment. Unicode (emoji, curly quotes, em dash)
  // fall back to UCS-2 which is 70/segment. Quick heuristic: any non-ASCII
  // char → unicode.
  const isUnicode = /[^\x00-\x7F]/.test(text);
  const perSegment = isUnicode ? 70 : 160;
  const len = text.length;
  const segments = len === 0 ? 0 : Math.ceil(len / perSegment);

  function applySnippet(body) {
    const first = (contactName || '').split(' ')[0] || 'there';
    setText(body.replace(/\{name\}/g, first));
    setSnippetsOpen(false);
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

  return (
    <div style={{
      padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
      background: 'var(--card)',
      boxShadow: 'var(--raised)',
      display: 'flex', flexDirection: 'column', gap: 6,
      position: 'relative',
    }}>
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
  if (!open) return null;
  const shortcuts = [
    { keys: '⌘K', label: 'Open command palette' },
    { keys: 'G L', label: 'Go to Leads' },
    { keys: 'G C', label: 'Go to Calendar' },
    { keys: 'G F', label: 'Go to Finance' },
    { keys: 'G M', label: 'Go to Messages' },
    { keys: 'G S', label: 'Go to Sparky' },
    { keys: 'R', label: 'Reply (focus compose bar)' },
    { keys: 'D', label: 'Dial selected contact' },
    { keys: 'N', label: 'New lead' },
    { keys: 'B', label: 'Open morning briefing' },
    { keys: 'T', label: 'Toggle dark mode' },
    { keys: 'P', label: 'Pin / unpin open contact' },
    { keys: 'J', label: 'Jump to next waiting thread' },
    { keys: '/', label: 'Focus search (Messages / Sparky)' },
    { keys: '1–9', label: 'Set stage on open contact' },
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
      <div onClick={e => e.stopPropagation()} style={{
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
  const { data } = await db
    .from('contacts')
    .select('id, name, phone, email, address, stage, status, do_not_contact, created_at, install_notes')
    .order('created_at', { ascending: false });
  if (!data || data.length === 0) return;

  const header = ['id', 'name', 'phone', 'email', 'address', 'stage', 'status', 'do_not_contact', 'created_at', 'install_notes'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows = data.map(r => header.map(h => esc(r[h])).join(','));
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
  window.__bpp_toast && window.__bpp_toast(`Exported ${data.length} contacts`, 'success');
}

// ── New Lead Modal (action triggered by "+" button) ────────────────────────
function NewLeadModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

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
    setBusy(true);
    const { data, error } = await db
      .from('contacts')
      .insert({
        name: name.trim() || 'New Lead',
        phone: `+1${digits}`,
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
    setName(''); setPhone(''); setAddress('');
    onClose();
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,.5)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} style={{
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
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address (optional)" style={{
          padding: '10px 12px', height: 40, fontFamily: 'var(--font-body)', fontSize: 14,
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
  if (voice.status === 'idle' && !voice.incoming) return null;

  if (voice.incoming) {
    const from = voice.incoming.parameters?.From || 'UNKNOWN';
    return (
      <CallCard title="INCOMING CALL" color="var(--lcd-red)" name={formatPhone(from)}>
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
  return (
    <CallCard
      title={voice.status === 'connecting' ? 'CONNECTING...' : 'ON CALL'}
      color={voice.status === 'connecting' ? 'var(--lcd-amber)' : 'var(--lcd-green)'}
      name={voice.activeCall?.parameters?.To || voice.activeCall?.customParameters?.get?.('To') || 'OUTBOUND'}
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
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 20, textAlign: 'center' }}>{name}</div>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [cRes, jRes] = await Promise.all([
        db.from('contacts').select('id, name, address, stage, jurisdiction_id').in('stage', [3, 4, 5, 6, 7, 8, 9]).limit(100),
        db.from('permit_jurisdictions').select('id, name').order('name'),
      ]);
      const jurById = Object.fromEntries((jRes.data || []).map(j => [j.id, j]));
      const sorted = (cRes.data || []).sort((a, b) => {
        const ja = a.jurisdiction_id ? 0 : -1; // rows without jurisdiction float to top
        const jb = b.jurisdiction_id ? 0 : -1;
        return ja - jb;
      });
      setRows(sorted.map(c => ({
        id: c.id, name: c.name || '—', address: c.address || '—',
        stage: c.stage,
        jurisdiction: c.jurisdiction_id ? jurById[c.jurisdiction_id]?.name : null,
        cells: stageToPermitCells(c.stage),
      })));
      setJurisdictions(jRes.data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>LOADING PERMITS...</div>;

  const headers = ['SUBMIT', 'PAY', 'PAID', 'PRINT', 'PRINTED', 'INSPECT', 'PASS'];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
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
      {rows.map(r => (
        <div key={r.id} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 140px repeat(7, 44px) 1fr',
          gap: 8, alignItems: 'center',
          padding: '8px 14px',
          background: 'var(--card)',
          borderBottom: '1px solid rgba(0,0,0,.06)',
        }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
          <span className="chrome-label" style={{
            fontSize: 10,
            color: r.jurisdiction ? 'var(--text)' : 'var(--lcd-amber)',
          }}>{r.jurisdiction || 'NOT SET'}</span>
          {r.cells.map((state, i) => <PermitStepCell key={i} state={state} />)}
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
            {!r.jurisdiction ? 'SET JURISDICTION' : stageToLabel(r.stage)}
          </span>
        </div>
      ))}
      {rows.length === 0 ? <Empty label="NO ACTIVE PERMITS" /> : null}
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

  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('contacts')
        .select('id, name, address, stage, install_notes')
        .in('stage', [3, 4, 5, 6, 7, 8])
        .limit(50);
      setRows((data || []).map(c => ({
        id: c.id, name: c.name || '—', address: c.address || '—',
        stage: c.stage,
        mat: parseMaterials(c.install_notes),
      })));
      setLoading(false);
    })();
  }, []);

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
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
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

// ── Live Finance (KPI strip + proposals/invoices/payments tables) ──────────
function LiveFinance() {
  const [data, setData] = useState({ proposals: [], invoices: [], payments: [], installsThisWeek: 0, loading: true });
  const [subView, setSubView] = useState('prop');

  useEffect(() => {
    (async () => {
      const weekAgoIso = new Date(Date.now() - 7 * 86400000).toISOString();
      const [propRes, invRes, payRes, historyRes] = await Promise.all([
        db.from('proposals').select('id, contact_id, contact_name, total, status, signed_at, viewed_at, created_at').order('created_at', { ascending: false }).limit(20),
        db.from('invoices').select('id, contact_id, contact_name, total, status, notes, paid_at, created_at').order('created_at', { ascending: false }).limit(20),
        db.from('payments').select('id, contact_id, amount, method, created_at').order('created_at', { ascending: false }).limit(20),
        // Installs-this-week: transitions to stage 9 (inspection/done) in last 7 days
        db.from('stage_history').select('contact_id, to_stage, changed_at').eq('to_stage', 9).gte('changed_at', weekAgoIso),
      ]);
      const uniqueInstalls = new Set((historyRes.data || []).map(r => r.contact_id));
      setData({
        proposals: propRes.data || [],
        invoices: invRes.data || [],
        payments: payRes.data || [],
        installsThisWeek: uniqueInstalls.size,
        loading: false,
      });
    })();
  }, []);

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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

function ProposalsLiveTable({ rows }) {
  if (rows.length === 0) return <Empty label="NO PROPOSALS" />;
  const statusTint = {
    sent: 'var(--ms-1)', viewed: 'var(--ms-4)', approved: 'var(--ms-2)',
    expired: 'var(--ms-5)', declined: 'var(--ms-3)',
  };
  return (
    <div style={{ background: 'var(--card)', boxShadow: 'var(--raised-2)' }}>
      {rows.map((p, i) => {
        const status = (p.status || 'sent').toLowerCase();
        const tint = statusTint[status] || 'var(--text-faint)';
        return (
          <div key={p.id}
            onClick={() => p.contact_id && (window.location.hash = `#contact=${p.contact_id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 100px 100px',
              gap: 12, alignItems: 'center',
              padding: '12px 16px',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
              cursor: p.contact_id ? 'pointer' : 'default',
            }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>{p.contact_name || '—'}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
            </span>
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

function InvoicesLiveTable({ rows }) {
  if (rows.length === 0) return <Empty label="NO INVOICES" />;
  return (
    <div style={{ background: 'var(--card)', boxShadow: 'var(--raised-2)' }}>
      {rows.map((inv, i) => {
        const paid = inv.status === 'paid';
        const tint = paid ? 'var(--ms-2)' : 'var(--ms-3)';
        return (
          <div key={inv.id}
            onClick={() => inv.contact_id && (window.location.hash = `#contact=${inv.contact_id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 100px 100px',
              gap: 12, alignItems: 'center',
              padding: '12px 16px',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
              cursor: inv.contact_id ? 'pointer' : 'default',
            }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>{inv.contact_name || '—'}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
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
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>
            {p.method || 'PAYMENT'} · {p.contact_id?.slice(0, 8) || '—'}
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

function Empty({ label }) {
  return (
    <div style={{
      padding: 48, display: 'grid', placeItems: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 12,
      color: 'var(--text-faint)', textAlign: 'center',
      letterSpacing: '.04em',
    }}>{(label || '').toLowerCase()}</div>
  );
}

// ── Live Calendar (week view based on stage_history / install dates) ────────
function LiveCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Use install_notes heuristic + recent stage_history to infer upcoming installs.
      // Proper calendar requires an events table — stub until one exists.
      const { data: contacts } = await db
        .from('contacts')
        .select('id, name, stage, install_notes, created_at')
        .in('stage', [3, 4, 5, 6, 7, 8])
        .limit(20);
      setEvents((contacts || []).map(c => ({
        id: c.id, name: c.name, stage: c.stage,
      })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>LOADING CALENDAR...</div>;

  return (
    <div style={{ height: '100%', padding: 24, overflow: 'auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>
          Upcoming installs
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
          {events.length} lead{events.length === 1 ? '' : 's'} post-booking · weekly grid wires in once an events table exists
        </div>
      </div>
      <div style={{ background: 'var(--card)', boxShadow: 'var(--raised-2)' }}>
        {events.map((e, i) => (
          <div key={e.id}
            onClick={() => e.id && (window.location.hash = `#contact=${e.id}`)}
            style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 80px',
              gap: 12, alignItems: 'center', padding: '12px 16px',
              borderBottom: i < events.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
              cursor: 'pointer',
            }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>stage {e.stage}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>{e.name || '—'}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right' }}>tbd</span>
          </div>
        ))}
        {events.length === 0 ? <Empty label="No upcoming installs" /> : null}
      </div>
    </div>
  );
}

// ── Live Messages Inbox ─────────────────────────────────────────────────────
// For each contact, pull their latest message as the preview + count unread.
function LiveMessages({ onSelect, activeId, compact = false }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    // Latest 50 messages joined on contact — we group client-side.
    const { data: msgs } = await db
      .from('messages')
      .select('id, contact_id, direction, body, sender, created_at')
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
        return {
          contactId: id,
          name: c.name || '—',
          i: initials(c.name),
          tint: 'navy',
          dir: isOut ? 'out' : 'in',
          prev: (latest.body || '').slice(0, 120),
          ts: relTimestamp(latest.created_at),
          // If the latest message in the thread is inbound AND it's from
          // the customer (not a system log), treat the thread as "waiting
          // on Key" — used by MessagesInbox to draw a gold bar on the row.
          waiting: !isOut && latest.sender !== 'ai',
          unread: 0,
          alex: isAi && isOut,
        };
      })
      .filter(Boolean);
    // Sort: waiting-on-Key threads first, then by latest message time (desc).
    // Rank uses inserted order of byContact which is already newest-first.
    const order = Object.fromEntries(ids.map((id, i) => [id, i]));
    out.sort((a, b) => {
      if (a.waiting !== b.waiting) return a.waiting ? -1 : 1;
      return (order[a.contactId] ?? 0) - (order[b.contactId] ?? 0);
    });
    setThreads(out);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchThreads().finally(() => setLoading(false));
  }, [fetchThreads]);

  // Realtime — refresh on any message insert
  useEffect(() => {
    const ch = db.channel('messages-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchThreads)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [fetchThreads]);

  if (loading) {
    return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>LOADING INBOX...</div>;
  }

  const MessagesInbox = window.MessagesInbox;
  return <MessagesInbox threads={threads} onSelect={t => onSelect(t.contactId)} activeId={activeId} compact={compact} />;
}

// ── Morning Briefing modal — once per day ───────────────────────────────────
function LiveMorningBriefing({ onClose, onPickContact }) {
  const [sections, setSections] = useState({ overdue: [], today: [], materials: [], goodNews: [] });
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

      // Parallel fetches: overdue (stale leads pre-book), new-today leads,
      // contacts in booked/permit stages that still have no materials notes,
      // and invoices that got paid in the last 48h.
      const [overdueRes, recentRes, awaitingMatRes, paidRes] = await Promise.all([
        db.from('contacts')
          .select('id, name, created_at, stage').lt('created_at', fiveDaysAgo)
          .lt('stage', 4).eq('do_not_contact', false).limit(5),
        db.from('contacts')
          .select('id, name, created_at, stage')
          .gte('created_at', today + 'T00:00:00').limit(5),
        db.from('contacts')
          .select('id, name, stage, install_notes')
          .in('stage', [3, 4]).limit(10),
        db.from('invoices')
          .select('id, contact_name, total, paid_at')
          .eq('status', 'paid').gte('paid_at', twoDaysAgo).limit(5),
      ]);

      // Materials: booked/permit leads whose install_notes don't yet have any __pm_ line
      const awaitingMaterials = (awaitingMatRes.data || [])
        .filter(c => !/__pm_/.test(c.install_notes || ''))
        .slice(0, 5)
        .map(c => ({ text: `Pick materials for ${c.name || 'lead'}`, id: c.id }));

      setSections({
        // Hide contacts the user has actively snoozed — they'll resurface
        // automatically when the snooze period expires
        overdue: (overdueRes.data || [])
          .filter(c => !isSnoozedFor(c.id))
          .map(c => ({
            text: `${c.name || 'Lead'} — ${Math.round((Date.now() - new Date(c.created_at).getTime()) / 86400000)} days silent`,
            id: c.id,
          })),
        today: (recentRes.data || []).map(c => ({
          text: `New today: ${c.name || 'Unknown'}`, id: c.id,
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

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,.5)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
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
function LiveSparky({ currentContactId = null }) {
  const [messages, setMessages] = useState([
    { who: 'sparky', text: "Standing by. Ask anything about the pipeline, a lead, or tell me what to draft." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('chat');
  const [currentContactName, setCurrentContactName] = useState(null);
  const scrollRef = useRef(null);

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

function SnoozeRow({ contactId, contactName }) {
  const [daysLeft, setDaysLeft] = useState(() => isSnoozedFor(contactId));
  useEffect(() => {
    setDaysLeft(isSnoozedFor(contactId));
    const on = () => setDaysLeft(isSnoozedFor(contactId));
    window.addEventListener('bpp:snoozes-changed', on);
    return () => window.removeEventListener('bpp:snoozes-changed', on);
  }, [contactId]);
  if (!contactId) return null;
  const presets = [1, 3, 7];
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
      {presets.map(n => (
        <button key={n} onClick={() => {
          snoozeContact(contactId, n);
          window.__bpp_toast && window.__bpp_toast(`${contactName || 'Contact'} snoozed ${n} day${n === 1 ? '' : 's'}`, 'info');
        }} style={{
          padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-body)',
          background: 'transparent', color: 'var(--text-muted)',
          boxShadow: 'var(--raised-2)', border: 'none', cursor: 'pointer',
        }}>{n}d</button>
      ))}
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

function CommandPalette({ open, onClose, onSelectContact, onSwitchTab, onAction }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [cursor, setCursor] = useState(0);
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
      const { data } = await db
        .from('contacts')
        .select('id, name, phone, stage, address')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%,address.ilike.%${q}%`)
        .limit(8);
      if (!alive) return;
      const contactHits = (data || []).map(c => ({
        type: 'contact', id: c.id, name: c.name, phone: formatPhone(c.phone), stage: STAGE_MAP[c.stage || 1] || 'NEW',
      }));
      const navHits = [
        { type: 'nav', id: 'leads', label: 'Go to Leads' },
        { type: 'nav', id: 'calendar', label: 'Go to Calendar' },
        { type: 'nav', id: 'finance', label: 'Go to Finance' },
        { type: 'nav', id: 'messages', label: 'Go to Messages' },
        { type: 'nav', id: 'sparky', label: 'Go to Sparky' },
      ].filter(n => n.label.toLowerCase().includes(q.toLowerCase()));
      const actionHits = [
        { type: 'action', id: 'export_csv', label: 'Export contacts as CSV' },
        { type: 'action', id: 'show_help', label: 'Show keyboard shortcuts' },
        { type: 'action', id: 'open_briefing', label: 'Open morning briefing' },
        { type: 'action', id: 'new_lead', label: 'New lead' },
        { type: 'action', id: 'toggle_dark', label: 'Toggle dark mode' },
      ].filter(a => a.label.toLowerCase().includes(q.toLowerCase()));
      const sparkyHit = [{ type: 'sparky', label: `Ask Sparky: "${q}"` }];
      setResults([...contactHits, ...navHits, ...actionHits, ...sparkyHit]);
      setCursor(0);
    })();
    return () => { alive = false; };
  }, [query, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
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
      else if (hit.type === 'sparky') { onSwitchTab('sparky'); onClose(); }
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
            placeholder="SEARCH OR RUN COMMAND..."
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
                if (r.type === 'contact') { onSelectContact(r.id); onClose(); }
                else if (r.type === 'nav') { onSwitchTab(r.id); onClose(); }
                else if (r.type === 'action') { onAction && onAction(r.id); onClose(); }
                else { onSwitchTab('sparky'); onClose(); }
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

// ── Leads sub-view toolbar (shared across list/permits/materials) ──────────
function LeadsSubToolbar({ active, onChange }) {
  const subs = [
    { id: 'pipeline', label: 'PIPELINE' },
    { id: 'list',     label: 'LIST' },
    { id: 'permits',  label: 'PERMITS' },
    { id: 'mat',      label: 'MATERIALS' },
  ];
  return (
    <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ display: 'flex', height: 36, boxShadow: 'var(--raised-2)' }}>
        {subs.map(s => (
          <button key={s.id} onClick={() => onChange(s.id)} className="chrome-label" style={{
            height: 36, padding: '0 16px', fontSize: 12,
            background: s.id === active ? 'var(--navy)' : 'transparent',
            color: s.id === active ? 'var(--gold)' : 'var(--text)',
            boxShadow: s.id === active ? 'var(--pressed-2)' : 'none',
            cursor: 'pointer',
          }}>{s.label}</button>
        ))}
      </div>
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
    return { tab: h.get('tab') || 'leads', contact: h.get('contact') || null };
  })();
  const [tab, setTab] = useState(initial.tab);
  const [leadsSubView, setLeadsSubView] = useState(() => window.innerWidth < 768 ? 'list' : 'pipeline');
  const [selectedContact, setSelectedContact] = useState(initial.contact);
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

  // Keep URL hash in sync so reload preserves tab + selected contact
  useEffect(() => {
    const h = new URLSearchParams();
    if (tab && tab !== 'leads') h.set('tab', tab);
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
      const hashTab = h.get('tab');
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
  const tabFocusedRef = useRef(!document.hidden);

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
        const { data: c } = await db.from('contacts').select('name').eq('id', m.contact_id).maybeSingle();
        const name = c?.name || 'Unknown';
        const preview = (m.body || '').slice(0, 60);
        window.__bpp_toast(`SMS from ${name}: "${preview}"`, 'info');
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
      .subscribe();
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

      // g-chord: g then l/c/f/m/s
      if (gPending) {
        const map = { l: 'leads', c: 'calendar', f: 'finance', m: 'messages', s: 'sparky' };
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
      if (e.key === 'b' && !briefOpen) {
        e.preventDefault();
        setBriefOpen(true);
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
      // j → jump to next waiting thread (customer sent last message).
      // Works from anywhere — opens Messages tab + the top waiting contact.
      if (e.key === 'j') {
        e.preventDefault();
        (async () => {
          // Pull the latest 300 messages, group by contact, find contacts
          // where the most recent message is inbound + sender != 'ai'.
          const { data: msgs } = await db.from('messages')
            .select('contact_id, direction, sender, created_at')
            .order('created_at', { ascending: false }).limit(300);
          if (!msgs) return;
          const seen = new Set();
          for (const m of msgs) {
            if (!m.contact_id) continue;
            if (seen.has(m.contact_id)) continue;
            seen.add(m.contact_id);
            if (m.direction === 'inbound' && m.sender !== 'ai') {
              // Skip the currently-selected one (jump should move forward)
              if (m.contact_id === selectedContact) continue;
              setSelectedContact(m.contact_id);
              setTab('leads'); // slide-over renders over Leads tab
              window.__bpp_toast && window.__bpp_toast('Next waiting thread', 'info');
              return;
            }
          }
          window.__bpp_toast && window.__bpp_toast('No waiting threads', 'info');
        })();
      }
      // n → new lead modal
      if (e.key === 'n' && !newLeadOpen) {
        e.preventDefault();
        setNewLeadOpen(true);
      }
      // 1–9 → change stage on the currently selected contact
      if (/^[1-9]$/.test(e.key) && selectedContact) {
        e.preventDefault();
        const newStage = Number(e.key);
        (async () => {
          const { data } = await db.from('contacts').select('stage, name').eq('id', selectedContact).maybeSingle();
          const oldStage = data?.stage || 1;
          if (oldStage === newStage) {
            window.__bpp_toast && window.__bpp_toast(`${data?.name || 'Contact'} already at ${STAGE_MAP[newStage] || 'stage ' + newStage}`, 'info');
            return;
          }
          await db.from('contacts').update({ stage: newStage }).eq('id', selectedContact);
          await db.from('stage_history').insert({
            contact_id: selectedContact, from_stage: oldStage, to_stage: newStage,
          }).then(() => {}, () => {});
          window.__bpp_toast && window.__bpp_toast(
            `${data?.name || 'Contact'} → ${STAGE_MAP[newStage] || 'stage ' + newStage}`,
            'success',
            { label: 'Undo', onClick: async () => {
              await db.from('contacts').update({ stage: oldStage }).eq('id', selectedContact);
              await db.from('stage_history').insert({ contact_id: selectedContact, from_stage: newStage, to_stage: oldStage }).then(()=>{}, ()=>{});
            }}
          );
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

  const content = (() => {
    if (tab === 'leads') {
      if (leadsSubView === 'pipeline') {
        return <LivePipeline onCardClick={handleCardClick} onSubView={setLeadsSubView} />;
      }
      if (leadsSubView === 'permits') {
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <LeadsSubToolbar active="permits" onChange={setLeadsSubView} />
            <div style={{ flex: 1, overflow: 'hidden' }}><LivePermits /></div>
          </div>
        );
      }
      if (leadsSubView === 'mat') {
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <LeadsSubToolbar active="mat" onChange={setLeadsSubView} />
            <div style={{ flex: 1, overflow: 'hidden' }}><LiveMaterials /></div>
          </div>
        );
      }
      // list view
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <LeadsSubToolbar active="list" onChange={setLeadsSubView} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <LiveLeadsList desktop={!isMobile} onSelect={r => setSelectedContact(r.id)} />
          </div>
        </div>
      );
    }
    if (tab === 'calendar') return <LiveCalendar />;
    if (tab === 'finance') return <LiveFinance />;
    if (tab === 'messages') return <LiveMessages onSelect={id => setSelectedContact(id)} activeId={selectedContact} />;
    if (tab === 'sparky') return <LiveSparky currentContactId={selectedContact} />;
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
          />
        ) : <div style={{ padding: 16 }}>BPP CRM</div>}
      </div>
      {TabBar ? <TabBar active={tab} scrollable={isMobile} onChange={setTab} badges={unreadCount > 0 ? { messages: unreadCount } : {}} /> : null}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }} className="grid-bg">
        <ErrorBoundary label={tab.toUpperCase()}>
          {content}
        </ErrorBoundary>
        {selectedContact ? (
          <div style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0,
            width: isMobile ? '100%' : 480,
            zIndex: 20,
          }}>
            <ErrorBoundary label="CONTACT DETAIL">
              <LiveContactDetail
                contactId={selectedContact}
                onBack={() => setSelectedContact(null)}
                mobile={isMobile}
              />
            </ErrorBoundary>
          </div>
        ) : null}
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectContact={id => { setSelectedContact(id); setTab('leads'); }}
        onSwitchTab={id => setTab(id)}
        onAction={id => {
          if (id === 'export_csv') exportContactsCsv();
          else if (id === 'show_help') setHelpOpen(true);
          else if (id === 'open_briefing') setBriefOpen(true);
          else if (id === 'new_lead') setNewLeadOpen(true);
          else if (id === 'toggle_dark') setIsDark(d => !d);
        }}
      />
      {briefOpen ? <LiveMorningBriefing
        onClose={() => setBriefOpen(false)}
        onPickContact={id => { setSelectedContact(id); setTab('leads'); setBriefOpen(false); }}
      /> : null}
      <NewLeadModal
        open={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        onCreated={c => {
          setSelectedContact(c.id);
          setTab('leads');
        }}
      />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <VoiceCallModal voice={voice} />
      <OfflineBanner />
      <ToastRoot />
    </div>
  );
}

function Placeholder({ name }) {
  return (
    <div style={{
      height: '100%', display: 'grid', placeItems: 'center',
      color: 'var(--text-muted)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 600 }}>{name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
          Wiring in next session
        </div>
      </div>
    </div>
  );
}

// Boot
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App />);

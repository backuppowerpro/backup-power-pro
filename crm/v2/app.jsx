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
        .limit(50);
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
          .limit(50);
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
        fontFamily: 'var(--font-pixel)', fontSize: 20,
        color: 'var(--text-muted)', textAlign: 'center',
      }}>
        <div>
          <div>NO CONTACTS YET</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-chrome)', letterSpacing: '.12em', marginTop: 8 }}>
            WAITING FOR FIRST LEAD
          </div>
        </div>
      </div>
    );
  }

  const LeadsListDesktop = window.LeadsListDesktop;
  const LeadsListMobile  = window.LeadsListMobile;

  return desktop
    ? <LeadsListDesktop rows={rows} onSelect={onSelect} />
    : <LeadsListMobile  rows={rows} onSelect={onSelect} />;
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
  };
}

function LivePipelineToolbar({ active = 'pipeline', onSubView }) {
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
    <div style={{ padding: '16px 16px 8px', display: 'flex' }}>
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
    </div>
  );
}

function LivePipeline({ onCardClick, onSubView }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data } = await db
      .from('contacts')
      .select('id, name, phone, address, stage, install_notes, created_at, do_not_contact')
      .order('created_at', { ascending: false })
      .limit(500);
    setContacts(data || []);
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

  // Bucket by column id using stage number
  const buckets = useMemo(() => {
    const b = {};
    Object.keys(PIPELINE_COL_TO_STAGE).forEach(k => { b[k] = []; });
    for (const c of contacts) {
      const colId = STAGE_TO_PIPELINE_COL[c.stage || 1] || 'new';
      b[colId].push(contactToCard(c));
    }
    return b;
  }, [contacts]);

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

    // Persist
    await db.from('contacts').update({ stage: newStage }).eq('id', contactId);
    // Record stage history
    await db.from('stage_history').insert({
      contact_id: contactId,
      from_stage: oldStage,
      to_stage: newStage,
    }).then(() => {}, () => {});
    window.__bpp_toast && window.__bpp_toast(`${contact.name || 'Lead'} → stage ${newStage}`, 'success');
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
      toolbar={<LivePipelineToolbar active="pipeline" onSubView={onSubView} />}
    />
  );
}

// ── Live Contact Detail (replaces mock messages in contact-detail.jsx) ──────
function LiveContactDetail({ contactId, onBack, mobile = false }) {
  const [contact, setContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('MESSAGES');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [cRes, mRes] = await Promise.all([
        db.from('contacts').select('*').eq('id', contactId).maybeSingle(),
        db.from('messages').select('*').eq('contact_id', contactId).order('created_at', { ascending: true }).limit(200),
      ]);
      if (!alive) return;
      setContact(cRes.data || null);
      setMessages(mRes.data || []);
      setLoading(false);
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
        {contact?.phone ? (
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
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 18 }}>{displayName}</div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          {displayPhone}<br/>{contact?.address || '—'}
        </div>
      </div>

      {/* Stage strip (click to open picker) */}
      <button
        onClick={() => setStagePickerOpen(true)}
        className="lcd"
        style={{
          height: 40, padding: '0 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', cursor: 'pointer',
          border: 0, textAlign: 'left',
        }}>
        <span className="pixel" style={{ fontSize: 14 }}>{stageAbbr}</span>
        <span className="pixel lcd--amber" style={{ fontSize: 11 }}>STAGE {contact?.stage || 1} ▸</span>
      </button>
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
        height: 44, display: 'flex', alignItems: 'stretch',
        padding: '0 8px',
        boxShadow: 'var(--pressed-2)',
      }}>
        {['MESSAGES', 'TIMELINE', 'QUOTE', 'PERMITS', 'NOTES', 'EDIT'].map(t => (
          <button key={t} onClick={() => setDetailTab(t)} className="chrome-label" style={{
            height: '100%', padding: '0 14px', fontSize: 11,
            color: t === detailTab ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: t === detailTab ? 'inset 0 -3px 0 var(--gold)' : 'none',
            cursor: 'pointer',
          }}>{t}</button>
        ))}
      </div>

      {/* Tab content */}
      {detailTab === 'MESSAGES' ? (
      <div style={{
        flex: 1, overflowY: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {loading ? (
          <div className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>LOADING MESSAGES...</div>
        ) : messages.length === 0 ? (
          <div className="mono" style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0' }}>
            NO MESSAGES YET
          </div>
        ) : messages.map(m => {
          const isOut = m.direction === 'outbound';
          return (
            <div key={m.id} style={{
              alignSelf: isOut ? 'flex-end' : 'flex-start',
              maxWidth: '78%',
              padding: '10px 14px',
              background: isOut ? 'var(--navy)' : 'var(--card)',
              color: isOut ? '#fff' : 'var(--text)',
              boxShadow: 'var(--raised-2)',
              fontSize: 15, lineHeight: 1.4,
              position: 'relative',
            }}>
              {isOut && m.sender === 'ai' ? (
                <span style={{
                  position: 'absolute', left: -8, top: -8,
                  width: 16, height: 16,
                  background: 'var(--gold)', color: 'var(--navy)',
                  fontFamily: 'var(--font-pixel)', fontSize: 12,
                  display: 'grid', placeItems: 'center',
                  boxShadow: 'var(--raised-2)',
                }}>A</span>
              ) : null}
              {m.body}
            </div>
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
        <ComposeBar contactId={contactId} contactName={contact?.name} contactPhone={contact?.phone} />
      ) : null}
    </div>
  );
}

function DetailTimeline({ contactId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('stage_history')
        .select('*')
        .eq('contact_id', contactId)
        .order('changed_at', { ascending: false })
        .limit(50);
      setEvents(data || []);
      setLoading(false);
    })();
  }, [contactId]);
  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>;
  if (events.length === 0) return <Empty label="NO TIMELINE EVENTS" />;
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      {events.map(e => (
        <div key={e.id} style={{
          display: 'grid', gridTemplateColumns: '120px 1fr',
          gap: 12, padding: '10px 0',
          borderBottom: '1px solid rgba(0,0,0,.08)',
        }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {e.changed_at ? new Date(e.changed_at).toLocaleString() : '—'}
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>
            Stage {e.from_stage ?? '—'} → Stage {e.to_stage ?? '—'}
          </span>
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
  const headers = ['SUBMIT', 'PAY', 'PAID', 'PRINT', 'PRINTED', 'INSPECT', 'PASS'];
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <div className="raised" style={{ padding: 14, marginBottom: 12 }}>
        <div className="chrome-label" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          PERMIT PIPELINE
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {cells.map((state, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <PermitStepCell state={state} />
              <span className="chrome-label" style={{ fontSize: 8, color: 'var(--text-faint)' }}>{headers[i]}</span>
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
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e) {
    e?.preventDefault();
    if (!contact) return;
    setSaving(true);
    const { error } = await db
      .from('contacts')
      .update({
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      })
      .eq('id', contact.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      onUpdate && onUpdate(form);
      window.__bpp_toast && window.__bpp_toast(`Contact updated`, 'success');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {saved ? (
          <span className="mono lcd--green" style={{ fontSize: 11, color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)' }}>
            SAVED
          </span>
        ) : <span />}
        <button type="submit" disabled={saving} className="tactile-raised" style={{
          height: 40, padding: '0 20px',
          background: 'var(--navy)', color: '#fff',
          fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 12,
          letterSpacing: '.08em', textTransform: 'uppercase',
          boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.2), inset -2px -2px 0 rgba(0,0,0,.5)',
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>{saving ? 'SAVING...' : 'SAVE'}</button>
      </div>
    </form>
  );
}

function EditField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pressed-2"
        style={{ padding: '10px 12px', height: 40, fontFamily: 'var(--font-mono)', fontSize: 14 }}
      />
    </div>
  );
}

function DetailNotes({ contact, onUpdate }) {
  const [text, setText] = useState(contact?.install_notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!contact) return;
    setSaving(true);
    const { error } = await db.from('contacts').update({ install_notes: text }).eq('id', contact.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      onUpdate && onUpdate(text);
      window.__bpp_toast && window.__bpp_toast(`Notes saved for ${contact.name || 'contact'}`, 'success');
      setTimeout(() => setSaved(false), 2000);
    } else {
      window.__bpp_toast && window.__bpp_toast(`Save failed: ${error.message}`, 'error');
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="ADD NOTES..."
        className="pressed-2"
        style={{
          flex: 1, minHeight: 240, padding: 14,
          fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.5,
          background: 'var(--card)', resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {saved ? (
          <span className="mono lcd--green" style={{ fontSize: 11, textShadow: 'var(--lcd-glow-green)', color: 'var(--lcd-green)' }}>
            SAVED
          </span>
        ) : <span />}
        <button
          onClick={save}
          disabled={saving}
          className="tactile-raised"
          style={{
            height: 36, padding: '0 16px',
            background: 'var(--navy)', color: '#fff',
            fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 12,
            letterSpacing: '.08em', textTransform: 'uppercase',
            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.2), inset -2px -2px 0 rgba(0,0,0,.5)',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}>{saving ? 'SAVING...' : 'SAVE'}</button>
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
        width: 340, background: 'var(--card)', boxShadow: 'var(--raised)',
        padding: 16,
      }}>
        <div className="chrome-label" style={{ fontSize: 12, marginBottom: 12, color: 'var(--text-muted)' }}>
          CHANGE STAGE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {stages.map(s => {
            const active = s.num === currentStage;
            return (
              <button
                key={s.num}
                onClick={() => onPick(s.num)}
                className="chrome-label"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', marginBottom: 4,
                  background: active ? 'var(--navy)' : 'var(--card)',
                  color: active ? 'var(--gold)' : 'var(--text)',
                  boxShadow: active ? 'var(--pressed-2)' : 'var(--raised-2)',
                  fontSize: 12, cursor: 'pointer',
                  borderLeft: `4px solid ${s.color}`,
                }}>
                <span>{s.label}</span>
                <span className="pixel" style={{ fontSize: 10, opacity: 0.7 }}>{String(s.num).padStart(2, '0')}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ComposeBar({ contactId, contactName, contactPhone }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim() || !contactId) return;
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

  return (
    <div style={{
      padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
      background: 'var(--card)',
      boxShadow: 'var(--raised)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div className="pressed-2" style={{
        flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span className="pixel" style={{ fontSize: 10, color: 'var(--gold)' }}>
          TO: {contactName ? contactName.toUpperCase() : '—'} »
        </span>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="TYPE A MESSAGE..."
          style={{
            flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13,
          }}
        />
      </div>
      <button
        onClick={send}
        disabled={sending || !text.trim()}
        style={{
          width: 40, height: 40,
          background: 'var(--navy)', color: '#fff',
          boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
          opacity: sending || !text.trim() ? 0.5 : 1,
          display: 'grid', placeItems: 'center',
        }}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
          <path d="M1 2 L15 8 L1 14 L3 8 L1 2 Z M3 8 L9 8"/>
        </svg>
      </button>
    </div>
  );
}

// ── Toast notification system ───────────────────────────────────────────────
// Simple pub/sub. Any component calls window.__bpp_toast(text, kind?) and a
// toast appears bottom-right for 4 seconds.
const toastSubs = new Set();
window.__bpp_toast = (text, kind = 'info') => {
  toastSubs.forEach(fn => fn({ id: Date.now() + Math.random(), text, kind }));
};

function ToastRoot() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const sub = (t) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 4000);
    };
    toastSubs.add(sub);
    return () => toastSubs.delete(sub);
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 110,
      display: 'flex', flexDirection: 'column', gap: 8,
      paddingBottom: 'env(safe-area-inset-bottom)',
      maxWidth: 320,
    }}>
      {toasts.map(t => {
        const color =
          t.kind === 'success' ? 'var(--green)' :
          t.kind === 'error'   ? 'var(--red)'   :
          t.kind === 'warn'    ? 'var(--lcd-amber)' :
                                  'var(--navy)';
        return (
          <div key={t.id} className="raised" style={{
            padding: '10px 14px',
            background: 'var(--card)',
            boxShadow: 'var(--raised)',
            borderLeft: `4px solid ${color}`,
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13,
          }}>
            <span style={{ width: 8, height: 8, background: color, flex: '0 0 auto' }} />
            <span>{t.text}</span>
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
    { keys: 'G L', label: 'Go to Leads tab' },
    { keys: 'G C', label: 'Go to Calendar' },
    { keys: 'G F', label: 'Go to Finance' },
    { keys: 'G M', label: 'Go to Messages' },
    { keys: 'G S', label: 'Go to Sparky' },
    { keys: '?', label: 'Show this help' },
    { keys: 'Esc', label: 'Close modal / detail' },
  ];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 85,
      background: 'rgba(0,0,0,.5)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} className="raised" style={{
        width: 420, padding: 20,
      }}>
        <div className="chrome-label" style={{ fontSize: 14, marginBottom: 14 }}>KEYBOARD SHORTCUTS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shortcuts.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px',
              background: i % 2 === 0 ? 'var(--card)' : 'transparent',
              boxShadow: i % 2 === 0 ? 'var(--pressed-2)' : 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>{s.label}</span>
              <span className="pixel" style={{
                fontSize: 12,
                padding: '3px 10px',
                boxShadow: 'var(--raised-2)',
                background: 'var(--card)', color: 'var(--text)',
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
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="raised" style={{
        width: 420, maxWidth: '100%',
        padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div className="chrome-label" style={{ fontSize: 14 }}>NEW LEAD</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>FIRST NAME</label>
          <input value={name} onChange={e => setName(e.target.value)} className="pressed-2" placeholder="Sarah M" autoFocus
            style={{ padding: '10px 12px', height: 40, fontFamily: 'var(--font-mono)', fontSize: 14 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>PHONE *</label>
          <input value={phone} onChange={e => setPhone(formatPhoneInput(e.target.value))} className="pressed-2" placeholder="(864) 555-0100"
            style={{ padding: '10px 12px', height: 40, fontFamily: 'var(--font-mono)', fontSize: 14 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>ADDRESS</label>
          <input value={address} onChange={e => setAddress(e.target.value)} className="pressed-2" placeholder="412 Laurel Ridge Rd"
            style={{ padding: '10px 12px', height: 40, fontFamily: 'var(--font-mono)', fontSize: 14 }} />
        </div>
        {err ? <div className="lcd" style={{ padding: '6px 12px', fontSize: 12 }}>{err}</div> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onClose} className="chrome-label" style={{
            flex: 1, height: 40, fontSize: 12, cursor: 'pointer',
            boxShadow: 'var(--raised-2)', background: 'var(--card)',
          }}>CANCEL</button>
          <button type="submit" disabled={busy} className="tactile-raised" style={{
            flex: 2, height: 40,
            background: 'var(--navy)', color: '#fff',
            fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 12,
            letterSpacing: '.08em', textTransform: 'uppercase',
            boxShadow: 'inset 3px 3px 0 rgba(255,255,255,.25), inset -3px -3px 0 rgba(0,0,0,.55)',
            opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer',
          }}>{busy ? 'SAVING...' : 'CREATE LEAD'}</button>
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
        const orderColor =
          r.mat.order === 'received' ? 'var(--lcd-green)' :
          r.mat.order === 'pending'  ? 'var(--lcd-amber)' :
                                        'var(--lcd-red)';
        const orderGlow =
          r.mat.order === 'received' ? 'var(--lcd-glow-green)' :
          r.mat.order === 'pending'  ? 'var(--lcd-glow-amber)' :
                                        'var(--lcd-glow-red)';
        return (
          <div key={r.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px repeat(5, 44px) 100px',
            gap: 8, alignItems: 'center',
            padding: '8px 14px',
            background: 'var(--card)',
            borderBottom: '1px solid rgba(0,0,0,.06)',
          }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            <div style={{ display: 'flex', height: 28, boxShadow: 'var(--raised-2)' }}>
              <button onClick={() => setAmp(r, '30')} className="chrome-label" style={{
                flex: 1, fontSize: 10, display: 'grid', placeItems: 'center',
                background: r.mat.amp === '30' ? 'var(--navy)' : 'transparent',
                color: r.mat.amp === '30' ? 'var(--gold)' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer',
              }}>30A</button>
              <button onClick={() => setAmp(r, '50')} className="chrome-label" style={{
                flex: 1, fontSize: 10, display: 'grid', placeItems: 'center',
                background: r.mat.amp === '50' ? 'var(--navy)' : 'transparent',
                color: r.mat.amp === '50' ? 'var(--gold)' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer',
              }}>50A</button>
            </div>
            <MatCheck on={r.mat.box} onClick={() => toggleField(r, 'box')} />
            <MatCheck on={r.mat.interlock} onClick={() => toggleField(r, 'interlock')} />
            <MatCheck on={r.mat.cord} onClick={() => toggleField(r, 'cord')} />
            <MatCheck on={r.mat.breaker} onClick={() => toggleField(r, 'breaker')} />
            <MatCheck on={r.mat.surge} onClick={() => toggleField(r, 'surge')} />
            <button onClick={() => cycleOrder(r)} className="chrome-label" style={{
              height: 24, padding: '0 8px',
              display: 'grid', placeItems: 'center',
              background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
              color: orderColor, textShadow: orderGlow,
              fontSize: 10, letterSpacing: '.04em',
              border: 'none', cursor: 'pointer',
              opacity: savingId === r.id ? 0.5 : 1,
            }}>{(r.mat.order || 'NOT ORDERED').toUpperCase()}</button>
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
  const [data, setData] = useState({ proposals: [], invoices: [], payments: [], loading: true });
  const [subView, setSubView] = useState('prop');

  useEffect(() => {
    (async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [propRes, invRes, payRes] = await Promise.all([
        db.from('proposals').select('id, contact_id, contact_name, total, status, signed_at, viewed_at, created_at').order('created_at', { ascending: false }).limit(20),
        db.from('invoices').select('id, contact_id, contact_name, total, status, notes, paid_at, created_at').order('created_at', { ascending: false }).limit(20),
        db.from('payments').select('id, contact_id, amount, method, created_at').order('created_at', { ascending: false }).limit(20),
      ]);
      setData({
        proposals: propRes.data || [],
        invoices: invRes.data || [],
        payments: payRes.data || [],
        loading: false,
      });
    })();
  }, []);

  const kpis = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const outstanding = data.invoices
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const paidThisWeek = data.invoices
      .filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at).getTime() > weekAgo)
      .reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const awaitingDeposit = data.invoices.filter(i => i.notes === 'deposit' && i.status !== 'paid').length;
    const overdue = data.invoices.filter(i => {
      if (i.status === 'paid') return false;
      const age = (Date.now() - new Date(i.created_at).getTime()) / 86400000;
      return age > 14;
    }).length;
    return { outstanding, paidThisWeek, awaitingDeposit, overdue };
  }, [data]);

  const subTabs = [
    { id: 'prop', label: 'PROPOSALS', count: data.proposals.length },
    { id: 'inv',  label: 'INVOICES',  count: data.invoices.length },
    { id: 'pay',  label: 'PAYMENTS',  count: data.payments.length },
  ];

  if (data.loading) {
    return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>LOADING FINANCE...</div>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* KPI strip */}
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard label="OUTSTANDING" value={`$${kpis.outstanding.toLocaleString()}`} tone="red" />
        <KpiCard label="PAID THIS WEEK" value={`$${kpis.paidThisWeek.toLocaleString()}`} tone="green" />
        <KpiCard label="DEPOSITS PENDING" value={String(kpis.awaitingDeposit).padStart(2, '0')} tone="amber" />
        <KpiCard label="OVERDUE" value={String(kpis.overdue).padStart(2, '0')} tone={kpis.overdue > 0 ? 'red' : 'green'} />
      </div>
      {/* Sub tabs */}
      <div style={{ padding: '0 16px', display: 'flex', gap: 0, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.1)' }}>
        {subTabs.map(s => (
          <button key={s.id} onClick={() => setSubView(s.id)} className="chrome-label" style={{
            height: 40, padding: '0 20px', fontSize: 12,
            color: s.id === subView ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: s.id === subView ? 'inset 0 -3px 0 var(--gold)' : 'none',
            cursor: 'pointer',
          }}>{s.label} · {s.count}</button>
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

function KpiCard({ label, value, tone = 'red' }) {
  const color = tone === 'green' ? 'var(--lcd-green)' : tone === 'amber' ? 'var(--lcd-amber)' : 'var(--lcd-red)';
  const glow = tone === 'green' ? 'var(--lcd-glow-green)' : tone === 'amber' ? 'var(--lcd-glow-amber)' : 'var(--lcd-glow-red)';
  return (
    <div className="raised" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
        padding: '6px 10px', fontFamily: 'var(--font-pixel)', fontSize: 24,
        color, textShadow: glow, letterSpacing: '.06em',
      }}>{value}</div>
      <div className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function ProposalsLiveTable({ rows }) {
  if (rows.length === 0) return <Empty label="NO PROPOSALS" />;
  const statusColor = {
    sent: 'var(--ms-1)', viewed: 'var(--ms-4)', approved: 'var(--ms-2)',
    expired: 'var(--ms-5)', declined: 'var(--ms-3)',
  };
  return (
    <div style={{ boxShadow: 'var(--pressed-2)', background: 'var(--card)' }}>
      {rows.map((p, i) => {
        const status = (p.status || 'sent').toLowerCase();
        const color = statusColor[status] || 'var(--ms-8)';
        return (
          <div key={p.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 100px 100px',
            gap: 12, alignItems: 'center',
            padding: '10px 14px',
            borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
          }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>{p.contact_name || '—'}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
            </span>
            <span className="chrome-label" style={{
              fontSize: 10, padding: '4px 8px', background: color, color: '#fff',
              boxShadow: 'var(--raised-2)', textAlign: 'center',
            }}>{status.toUpperCase()}</span>
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
    <div style={{ boxShadow: 'var(--pressed-2)', background: 'var(--card)' }}>
      {rows.map((inv, i) => {
        const paid = inv.status === 'paid';
        return (
          <div key={inv.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 100px 100px',
            gap: 12, alignItems: 'center',
            padding: '10px 14px',
            borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
          }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>{inv.contact_name || '—'}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
            </span>
            <span className="chrome-label" style={{
              fontSize: 10, padding: '4px 8px',
              background: paid ? 'var(--ms-2)' : 'var(--ms-3)', color: '#fff',
              boxShadow: 'var(--raised-2)', textAlign: 'center',
            }}>{(inv.status || 'sent').toUpperCase()}</span>
            <span className={`mono ${paid ? 'lcd--green' : ''}`} style={{
              fontSize: 14, fontWeight: 700, textAlign: 'right',
              color: paid ? 'var(--lcd-green)' : 'var(--lcd-red)',
              textShadow: paid ? 'var(--lcd-glow-green)' : 'var(--lcd-glow-red)',
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
      fontFamily: 'var(--font-pixel)', fontSize: 20,
      color: 'var(--text-faint)', textAlign: 'center',
    }}>{label}</div>
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
      <div className="raised" style={{ padding: 20, marginBottom: 16 }}>
        <div className="chrome-label" style={{ fontSize: 12, marginBottom: 8 }}>UPCOMING — {events.length} LEADS POST-BOOKING</div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Full weekly/agenda calendar UI wires in after the events table is added to Supabase. For now, this surface shows contacts booked or in the install pipeline.
        </div>
      </div>
      <div style={{ boxShadow: 'var(--pressed-2)', background: 'var(--card)' }}>
        {events.map((e, i) => (
          <div key={e.id} style={{
            display: 'grid', gridTemplateColumns: '80px 1fr 80px',
            gap: 12, alignItems: 'center', padding: '10px 14px',
            borderBottom: i < events.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
          }}>
            <span className="pixel" style={{ fontSize: 11, color: 'var(--text-muted)' }}>STAGE {e.stage}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>{e.name || '—'}</span>
            <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'right' }}>TBD</span>
          </div>
        ))}
        {events.length === 0 ? <Empty label="NO UPCOMING INSTALLS" /> : null}
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
          unread: 0, // TODO: track read state — for now, inbound=1, hide for outbound
          alex: isAi && isOut,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Sort by most recent (already sorted by messages order)
        return 0;
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
function LiveMorningBriefing({ onClose }) {
  const [sections, setSections] = useState({ overdue: [], today: [], materials: [], goodNews: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Overdue: stage < 4 and created > 5 days ago
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const [overdueRes, recentRes] = await Promise.all([
        db.from('contacts').select('id, name, created_at, stage').lt('created_at', fiveDaysAgo).lt('stage', 4).eq('do_not_contact', false).limit(5),
        db.from('contacts').select('id, name, created_at, stage').gte('created_at', today + 'T00:00:00').limit(5),
      ]);
      setSections({
        overdue: (overdueRes.data || []).map(c => ({
          text: `Follow up with ${c.name} — ${Math.round((Date.now() - new Date(c.created_at).getTime()) / 86400000)} days silent`,
          id: c.id,
        })),
        today: [], // TODO: integrate calendar/events table
        materials: [], // TODO: integrate materials state
        goodNews: (recentRes.data || []).map(c => ({ text: `New lead: ${c.name || 'Unknown'}`, id: c.id })),
      });
      setLoading(false);
    })();
  }, []);

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
        <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-pixel)', fontSize: 32, color: 'var(--lcd-red)',
              textShadow: 'var(--lcd-glow-red)', background: 'var(--lcd-bg)', padding: '2px 12px',
              display: 'inline-block', boxShadow: 'var(--pressed-2)',
            }}>GOOD MORNING, KEY</div>
            <div className="chrome-label" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              {new Date().toDateString().toUpperCase()}
            </div>
          </div>
          <button onClick={onClose} className="tactile-raised" style={{ width: 32, height: 32, fontSize: 18, display: 'grid', placeItems: 'center' }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 13 }}>LOADING BRIEF...</div>
        ) : (
          <>
            <BriefSection label="OVERDUE" color="var(--lcd-red)" items={sections.overdue} />
            <BriefSection label="TODAY" color="var(--lcd-amber)" items={sections.today} />
            <BriefSection label="MATERIALS TO ORDER" color="var(--navy)" items={sections.materials} />
            <BriefSection label="GOOD NEWS" color="var(--lcd-green)" items={sections.goodNews} />
          </>
        )}

        <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--raised)' }}>
          <button onClick={onClose} className="chrome-label" style={{ fontSize: 12, padding: '8px 16px', cursor: 'pointer' }}>DISMISS</button>
          <button onClick={onClose} style={{
            padding: '12px 24px', background: 'var(--navy)', color: '#fff',
            fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 13, letterSpacing: '.08em',
            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
            cursor: 'pointer',
          }}>OPEN CRM</button>
        </div>
      </div>
    </div>
  );
}

function BriefSection({ label, color, items }) {
  return (
    <div style={{ margin: '0 20px 16px', boxShadow: 'var(--pressed-2)' }}>
      <div className="chrome-label" style={{
        padding: '6px 12px', fontSize: 11,
        background: color, color: color === 'var(--navy)' ? '#fff' : (color.includes('amber') || color.includes('green') ? '#1a1a1a' : '#fff'),
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.3)',
      }}>{label} · {items.length}</div>
      <div>
        {items.length === 0 ? (
          <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>NOTHING HERE</div>
        ) : items.map((it, i) => (
          <div key={i} style={{
            padding: '10px 14px', fontSize: 14,
            borderBottom: i < items.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
          }}>{it.text}</div>
        ))}
      </div>
    </div>
  );
}

// ── Live Sparky AI Chat ─────────────────────────────────────────────────────
function LiveSparky() {
  const [messages, setMessages] = useState([
    { who: 'sparky', text: "Standing by. Ask anything about the pipeline, a lead, or tell me what to draft." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('chat');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || sending) return;
    setSending(true);
    const newMsgs = [...messages, { who: 'key', text: q }];
    setMessages(newMsgs);
    setInput('');
    try {
      const { data, error } = await db.functions.invoke('ai-taskmaster', {
        body: {
          mode,
          question: q,
          history: newMsgs.slice(-10).map(m => ({ role: m.who === 'key' ? 'user' : 'assistant', content: m.text })),
          context_source: 'sparky',
        },
      });
      if (error) throw error;
      const reply = (data?.answer || data?.response || data?.message || data?.text || JSON.stringify(data)).toString();
      setMessages(prev => [...prev, { who: 'sparky', text: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { who: 'sparky', text: `Error: ${e.message || 'something went wrong'}` }]);
    } finally {
      setSending(false);
    }
  }

  const modes = [
    { id: 'chat', label: 'CHAT' },
    { id: 'briefing', label: 'BRIEFING' },
    { id: 'contact_insight', label: 'INSIGHT' },
    { id: 'suggest_reply', label: 'REPLY' },
    { id: 'draft_followup', label: 'DRAFT' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Mode selector */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} className="chrome-label" style={{
            height: 28, padding: '0 12px', fontSize: 10,
            background: m.id === mode ? 'var(--navy)' : 'var(--card)',
            color: m.id === mode ? 'var(--gold)' : 'var(--text)',
            boxShadow: m.id === mode ? 'var(--pressed-2)' : 'var(--raised-2)',
            cursor: 'pointer',
          }}>{m.label}</button>
        ))}
      </div>

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
            }}>{m.text}</div>
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
            }}>{m.text}</div>
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
        <div className="pressed-2" style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pixel" style={{ fontSize: 10, color: 'var(--gold)' }}>ASK SPARKY »</span>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="ASK ANYTHING..."
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
          <span className="lcd lcd--green" style={{ padding: '2px 6px', fontSize: 10 }}>SONNET-4-6</span>
        </div>
        <button onClick={send} disabled={sending || !input.trim()} style={{
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
function CommandPalette({ open, onClose, onSelectContact, onSwitchTab, onAction }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  // Search
  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); return; }
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
          {results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)' }}>
              {query.trim() ? 'NO RESULTS' : 'TYPE TO SEARCH CONTACTS, NAVIGATION, OR ASK SPARKY'}
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
        <div className="pressed-2" style={{
          padding: '8px 16px', fontFamily: 'var(--font-pixel)', fontSize: 10,
          letterSpacing: '.12em', color: 'var(--text-muted)',
          display: 'flex', gap: 16,
        }}>
          <span>↑↓ NAVIGATE</span>
          <span>↵ SELECT</span>
          <span>ESC CLOSE</span>
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
  const [tab, setTab] = useState('leads');
  const [leadsSubView, setLeadsSubView] = useState(() => window.innerWidth < 768 ? 'list' : 'pipeline');
  const [selectedContact, setSelectedContact] = useState(null);
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

  // Reset unread when opening a contact detail
  useEffect(() => {
    if (selectedContact) setUnreadCount(0);
  }, [selectedContact]);

  // Update page title
  useEffect(() => {
    document.title = unreadCount > 0
      ? `(${unreadCount}) BPP CRM`
      : 'BPP CRM v2';
  }, [unreadCount]);

  // Global new-inbound-SMS listener → toast + unread bump
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
        // Only bump unread if viewer isn't looking at this contact
        if (!tabFocusedRef.current || m.contact_id !== selectedContact) {
          setUnreadCount(c => c + 1);
        }
      })
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [user, selectedContact]);

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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gPending]);

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
    if (tab === 'sparky') return <LiveSparky />;
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
      {TabBar ? <TabBar active={tab} scrollable={isMobile} onChange={setTab} /> : null}
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
        }}
      />
      {briefOpen ? <LiveMorningBriefing onClose={() => setBriefOpen(false)} /> : null}
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
      <ToastRoot />
    </div>
  );
}

function Placeholder({ name }) {
  return (
    <div style={{
      height: '100%', display: 'grid', placeItems: 'center',
      fontFamily: 'var(--font-pixel)', fontSize: 32, letterSpacing: '.08em',
      color: 'var(--text-muted)', textTransform: 'uppercase',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div>{name}</div>
        <div style={{ fontFamily: 'var(--font-chrome)', fontSize: 11, letterSpacing: '.12em', color: 'var(--text-faint)', marginTop: 8 }}>
          WIRING IN NEXT SESSION
        </div>
      </div>
    </div>
  );
}

// Boot
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App />);

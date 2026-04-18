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
          <button type="submit" disabled={busy} style={{
            width: '100%', height: 44,
            background: 'var(--navy)', color: '#fff',
            fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 14,
            letterSpacing: '.08em', textTransform: 'uppercase',
            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -2px 0 rgba(0,0,0,.5)',
            opacity: busy ? 0.6 : 1,
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
  const subs = [
    { id: 'pipeline', label: 'PIPELINE' },
    { id: 'list',     label: 'LIST' },
    { id: 'permits',  label: 'PERMITS' },
    { id: 'mat',      label: 'MATERIALS' },
  ];
  const filters = [
    { id: 'mine',    label: 'MINE' },
    { id: 'all',     label: 'ALL', active: true },
    { id: 'overdue', label: 'OVERDUE' },
    { id: 'photo',   label: 'HAS PHOTO' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 16px 8px', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', height: 36, boxShadow: 'var(--raised-2)' }}>
        {subs.map(s => (
          <button key={s.id} className="chrome-label"
            onClick={() => onSubView && onSubView(s.id)}
            style={{
              height: 36, padding: '0 16px', fontSize: 12,
              background: s.id === active ? 'var(--navy)' : 'transparent',
              color: s.id === active ? 'var(--gold)' : 'var(--text)',
              boxShadow: s.id === active ? 'var(--pressed-2)' : 'none',
              cursor: 'pointer',
            }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {filters.map(f => (
          <button key={f.id} className="chrome-label" style={{
            height: 28, padding: '0 12px', fontSize: 11,
            background: f.active ? 'var(--navy)' : 'var(--card)',
            color: f.active ? '#fff' : 'var(--text)',
            boxShadow: f.active ? 'var(--pressed-2)' : 'var(--raised-2)',
            cursor: 'pointer',
          }}>{f.label}</button>
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
          }}
        >{mobile ? '‹' : '×'}</button>
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

      {/* Stage strip */}
      <div className="lcd" style={{
        height: 40, padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span className="pixel" style={{ fontSize: 14 }}>{stageAbbr}</span>
        <span className="pixel lcd--amber" style={{ fontSize: 11 }}>STAGE {contact?.stage || 1}</span>
      </div>

      {/* Messages */}
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

      {/* Compose */}
      <ComposeBar contactId={contactId} contactName={contact?.name} contactPhone={contact?.phone} />
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
      await db.functions.invoke('send-sms', {
        body: { contactId, body: text.trim() },
      });
      setText('');
    } catch (e) {
      console.error('send failed', e);
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
      const reply = (data?.response || data?.message || data?.text || JSON.stringify(data)).toString();
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
function CommandPalette({ open, onClose, onSelectContact, onSwitchTab }) {
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
      const sparkyHit = [{ type: 'sparky', label: `Ask Sparky: "${q}"` }];
      setResults([...contactHits, ...navHits, ...sparkyHit]);
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

// ── Main App ────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState('leads');
  const [leadsSubView, setLeadsSubView] = useState(() => window.innerWidth < 768 ? 'list' : 'pipeline');
  const [selectedContact, setSelectedContact] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Responsive
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ⌘K / Ctrl+K to open command palette
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      return <LiveLeadsList desktop={!isMobile} onSelect={r => setSelectedContact(r.id)} />;
    }
    if (tab === 'calendar') return <Placeholder name="CALENDAR" />;
    if (tab === 'finance') return <Placeholder name="FINANCE" />;
    if (tab === 'messages') return <Placeholder name="MESSAGES" />;
    if (tab === 'sparky') return <LiveSparky />;
    return null;
  })();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {TopBar ? <TopBar compact={isMobile} /> : <div style={{ padding: 16 }}>BPP CRM</div>}
      </div>
      {TabBar ? <TabBar active={tab} scrollable={isMobile} onChange={setTab} /> : null}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }} className="grid-bg">
        {content}
        {selectedContact ? (
          <div style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0,
            width: isMobile ? '100%' : 480,
            zIndex: 20,
          }}>
            <LiveContactDetail
              contactId={selectedContact}
              onBack={() => setSelectedContact(null)}
              mobile={isMobile}
            />
          </div>
        ) : null}
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectContact={id => { setSelectedContact(id); setTab('leads'); }}
        onSwitchTab={id => setTab(id)}
      />
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

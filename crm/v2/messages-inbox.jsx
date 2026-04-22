/* global React */
// Messages — Inbox list + open-thread split view

const MsgIcons = {
  arrL:  <svg viewBox="0 0 16 16" width="10" height="10"><path d="M10 3 L4 8 L10 13"/></svg>,
  arrR:  <svg viewBox="0 0 16 16" width="10" height="10"><path d="M6 3 L12 8 L6 13"/></svg>,
  phone: <svg viewBox="0 0 16 16" width="11" height="11"><path d="M3 3 L5 3 L6 6 L5 7 A5 5 0 0 0 9 11 L10 10 L13 11 L13 13 A1 1 0 0 1 12 14 A11 11 0 0 1 2 4 A1 1 0 0 1 3 3 Z"/></svg>,
};

const THREADS = [
  { name:'Sarah M',  i:'SM', tint:'navy',  dir:'in',    prev:'ok I need to talk to my husband', ts:'3:12 PM',  unread:2, active:true },
  { name:'Dave H',   i:'DH', tint:'navy',  dir:'photo', prev:'[photo]',                          ts:'2:48 PM',  unread:1 },
  { name:'Robert K', i:'RK', tint:'navy',  dir:'in',    prev:'thanks Key sounds good',           ts:'1:20 PM',  unread:0 },
  { name:'Mark L',   i:'ML', tint:'gold',  dir:'call',  prev:'voice call · incoming',            call:'0:43',   ts:'11:42 AM', unread:0 },
  { name:'Mike J',   i:'MJ', tint:'navy',  dir:'in',    prev:'Just checking in — Key is holding your install slot...', ts:'10:05 AM', unread:3, alex:true },
  { name:'Linda W',  i:'LW', tint:'red',   dir:'out',   prev:'Final check — still want to move forward?', ts:'YESTERDAY', unread:0, alex:true },
  { name:'Helen S',  i:'HS', tint:'green', dir:'in',    prev:'see you Thursday',                 ts:'YESTERDAY', unread:0 },
  { name:'Ashley P', i:'AP', tint:'gold',  dir:'photo', prev:'[photo] · Perfect, Key will get back to you...', ts:'YESTERDAY', unread:1, alex:true },
  { name:'Tom B',    i:'TB', tint:'navy',  dir:'in',    prev:'$1,497? seems steep',              ts:'APR 12',   unread:0 },
  { name:'Carl W',   i:'CW', tint:'red',   dir:'in',    prev:'I decided to go with another company', ts:'APR 11', unread:0 },
];

const TINTS = { navy:'var(--navy)', gold:'var(--gold)', red:'var(--ms-3)', green:'var(--ms-2)' };

function ThreadAvatar({ t, size = 48 }) {
  if (!t) return null;
  const tint = t.tint || 'navy';
  return (
    <div style={{
      width: size, height: size, flex: '0 0 auto',
      background: TINTS[tint] || 'var(--navy)',
      clipPath: 'var(--avatar-clip)',
      display: 'grid', placeItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-chrome)', fontWeight: 700,
        color: tint === 'gold' ? '#1a1a1a' : 'var(--gold)',
        fontSize: size >= 48 ? 14 : 11, letterSpacing: '.04em',
      }}>{t.i || '?'}</span>
    </div>
  );
}

function AlexBadge() {
  return (
    <span style={{
      marginLeft: 6, padding: '1px 5px',
      color: 'var(--text-faint)',
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em',
      border: '1px solid rgba(0,0,0,.15)',
    }}>alex</span>
  );
}

function Preview({ t }) {
  const icon = t.dir === 'out' ? MsgIcons.arrR : t.dir === 'call' ? MsgIcons.phone : MsgIcons.arrL;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-body)', fontSize: 13,
      color: t.unread ? 'var(--text)' : 'var(--text-muted)',
      fontWeight: t.unread ? 500 : 400,
      overflow: 'hidden',
    }}>
      <span style={{ color: 'var(--text-faint)', display:'inline-flex', flex:'0 0 auto' }}>{icon}</span>
      {t.call && (
        <span style={{
          padding:'0 4px', background:'var(--lcd-bg)', boxShadow:'var(--pressed-2)',
          color:'var(--lcd-red)', textShadow:'var(--lcd-glow-red)',
          fontFamily:'var(--font-pixel)', fontSize:12,
        }}>{t.call}</span>
      )}
      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {t.alex && <span style={{ color: 'var(--text-faint)', marginRight: 4 }}>Alex:</span>}
        {t.prev}
      </span>
    </div>
  );
}

// Smart Messages urgency detector. Scans the latest inbound preview for
// keywords that imply something Key should drop what he's doing for.
// Returns the matched bucket or null so the thread row can paint a chip.
const SMART_URGENT_PATTERNS = [
  { tone: 'red',  label: 'URGENT',   re: /\b(urgent|emergency|asap|right now|today|this morning|tonight|now|immediately)\b/i },
  { tone: 'red',  label: 'STORM',    re: /\b(storm|power out|outage|no power|hurricane|ice storm|snow)\b/i },
  { tone: 'red',  label: 'MEDICAL',  re: /\b(medical|oxygen|cpap|dialysis|medication|doctor|prescription)\b/i },
  { tone: 'gold', label: 'READY',    re: /\b(ready to pay|ready to book|let'?s do it|sign me up|book it|lock it in|when can you)\b/i },
  { tone: 'gold', label: 'QUESTION', re: /\?\s*$/ },
  { tone: 'navy', label: 'OFFER',    re: /\b(afterpay|financing|discount|deposit|cash)\b/i },
];
function smartMessageFlag(t) {
  if (!t?.prev) return null;
  for (const p of SMART_URGENT_PATTERNS) {
    if (p.re.test(t.prev)) return { tone: p.tone, label: p.label };
  }
  return null;
}

function ThreadRow({ t, compact = false, active = false }) {
  const flag = smartMessageFlag(t);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact ? '48px 1fr 64px' : '48px 1fr 100px',
      gap: 12, alignItems: 'center',
      padding: '10px 14px', minHeight: 72,
      background: 'var(--card)',
      boxShadow: active ? 'var(--pressed-2)' : 'none',
      borderBottom: '1px solid rgba(0,0,0,.06)',
      borderLeft: t.waiting ? '3px solid var(--gold)' : '3px solid transparent',
      paddingLeft: 11,
    }}>
      <ThreadAvatar t={t} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 15,
            fontWeight: t.unread ? 700 : 600, color: 'var(--text)',
          }}>{t.name}</span>
          {t.unread > 0 && <span style={{ width:6, height:6, background:'var(--gold)', display:'inline-block' }} />}
          {t.alex && <AlexBadge />}
          {flag ? <span className={`smart-chip smart-chip--${flag.tone}`}>{flag.label}</span> : null}
        </div>
        <Preview t={t} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
        <span className="mono" style={{ fontSize:11, color:'var(--text-faint)', letterSpacing:'.04em' }}>{t.ts}</span>
        {t.unread > 0 && (
          <span className="mono" style={{
            fontSize: 11, color: 'var(--ms-3)',
          }}>{t.unread}</span>
        )}
      </div>
    </div>
  );
}

function MsgChips({ active = 'all', onChange }) {
  // Minimal — text tabs, no LCD count, no raised pills.
  const chips = [
    { id:'all',   label:'All',     title: 'All threads' },
    { id:'pin',   label:'Pinned',  title: 'Only pinned contacts' },
    { id:'un',    label:'Waiting', title: 'Threads where the customer sent the last message' },
    { id:'alex',  label:'Alex',    title: 'Threads where Alex sent the latest outbound' },
    { id:'key',   label:'Me',      title: "Threads where you sent the latest outbound" },
    { id:'call',  label:'Calls',   title: 'Threads containing voice calls' },
  ];
  return (
    <div style={{ display:'flex', gap:18, padding:'14px 16px 10px' }}>
      {chips.map(c => {
        const on = c.id === active;
        return (
          <button key={c.id} onClick={() => onChange && onChange(c.id)}
            title={c.title}
            style={{
              padding: '4px 0', fontSize: 12,
              fontFamily: 'var(--font-body)', fontWeight: on ? 700 : 500,
              color: on ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: on ? '2px solid var(--gold)' : '2px solid transparent',
              background: 'transparent', border: 'none',
              borderBottomStyle: 'solid', cursor: 'pointer',
            }}>{c.label}</button>
        );
      })}
    </div>
  );
}

function MessagesInbox({ compact = false, threads, onSelect, activeId }) {
  const raw = threads || THREADS;
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const query = q.trim().toLowerCase();
  let data = raw;
  if (filter === 'un')    data = data.filter(t => t.waiting);
  if (filter === 'pin')   {
    const pins = (() => { try { return new Set(JSON.parse(localStorage.getItem('bpp_v2_pinned_contacts') || '[]')); } catch { return new Set(); } })();
    data = data.filter(t => pins.has(t.contactId));
  }
  if (filter === 'alex')  data = data.filter(t => t.alex);
  if (filter === 'key')   data = data.filter(t => t.dir === 'out' && !t.alex);
  if (filter === 'call')  data = data.filter(t => t.dir === 'call' || t.call);
  if (query) data = data.filter(t => (t.name || '').toLowerCase().includes(query) || (t.prev || '').toLowerCase().includes(query));
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding: '12px 16px 4px' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search threads…"
          style={{
            width: '100%', height: 36, padding: '0 12px',
            fontFamily: 'var(--font-body)', fontSize: 14,
            background: 'var(--card)', boxShadow: 'var(--pressed-2)',
            border: 'none',
          }}
        />
      </div>
      <MsgChips active={filter} onChange={setFilter} />
      <div style={{
        flex: 1, overflowY: 'auto', margin: '0 16px 88px',
        background: 'var(--card)',
      }}>
        {data.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)' }}>
            {query ? 'no matches' : 'inbox clear'}
          </div>
        ) : data.map((t, i) => (
          <div key={t.contactId || i} onClick={() => onSelect && onSelect(t)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <ThreadRow t={t} compact={compact} active={activeId ? t.contactId === activeId : t.active} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Thread-open split view (uses existing ContactDetail components loaded globally) */
function MessagesSplit() {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        <div style={{ width: 360, flex:'0 0 auto', borderRight:'1px solid rgba(0,0,0,.1)', display:'flex', flexDirection:'column' }}>
          <MsgChips active="all" />
          <div style={{ flex:1, overflowY:'auto' }}>
            {THREADS.map((t, i) => (
              <ThreadRow key={i} t={t} compact active={t.active} />
            ))}
          </div>
        </div>
        <div style={{ flex:1, position:'relative', display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{
            position:'absolute', left:0, top:0, bottom:0, width:4,
            background:'var(--navy)',
            boxShadow:'inset 0 2px 0 rgba(255,255,255,.15), inset 0 -2px 0 rgba(0,0,0,.3)',
          }}/>
          <div style={{ flex:1, minHeight:0 }}>
            {window.ContactDetail && <window.ContactDetail tab="MESSAGES" />}
          </div>
          <div>
            {window.BottomBar && <window.BottomBar mode="sms" thread={{ name:'Sarah M', phone:'(864) 555-0101' }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MessagesInbox, MessagesSplit, ThreadRow, MsgChips });

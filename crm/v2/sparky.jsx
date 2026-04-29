/* global React */
// Sparky — AI assistant panel
// Brand-aligned 2026-04-24: retired LCD badges, pixel chrome, chrome-label
// uppercase buttons. All components now use Outfit + Inter with pill
// CTAs and smart-chip status pills.

const SparkIcons = {
  s: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M9 1 L4 9 L7 9 L6 15 L12 6 L9 6 Z" /></svg>,
  send: <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 3 L13 8 L3 13 L5 8 Z"/></svg>,
};

function SparkSBadge({ size = 24 }) {
  return (
    <span style={{
      width: size, height: size, flex:'0 0 auto',
      background: 'var(--gold)', color: 'var(--navy)',
      display: 'inline-grid', placeItems: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 800,
      fontSize: size * .55,
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--shadow-xs)',
    }}>S</span>
  );
}

function SparkyBubble({ who, children, maxWidth = '72%' }) {
  if (who === 'key') {
    return (
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 12 }}>
        <div style={{
          maxWidth,
          background:'var(--navy)', color:'#fff',
          padding:'10px 16px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          fontFamily:'var(--font-body)', fontSize:14, lineHeight:1.5,
        }}>{children}</div>
      </div>
    );
  }
  return (
    <div style={{ display:'flex', gap:10, marginBottom: 12, alignItems:'flex-start' }}>
      <SparkSBadge size={28} />
      <div style={{
        maxWidth,
        background:'var(--card)',
        boxShadow:'var(--shadow-sm), var(--ring)',
        padding:'12px 16px',
        borderRadius: 'var(--radius-md)',
        fontFamily:'var(--font-body)', fontSize:14, lineHeight:1.5, color:'var(--text)',
      }}>{children}</div>
    </div>
  );
}

function SilentList() {
  const rows = [
    { name:'Mike J',  days:4, stage:'Quoted',    tone: 'purple' },
    { name:'Linda W', days:5, stage:'New lead',  tone: 'navy'   },
    { name:'Tom B',   days:6, stage:'Quoted',    tone: 'purple' },
    { name:'Dave H',  days:8, stage:'New lead',  tone: 'navy'   },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:10 }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display:'grid', gridTemplateColumns:'1fr 60px 120px',
          alignItems:'center', gap:10,
          padding:'10px 14px',
          background:'var(--card)',
          boxShadow:'var(--ring)',
          borderRadius:'var(--radius-sm)',
        }}>
          <span style={{ fontFamily:'var(--font-body)', fontSize:13, fontWeight:600, color:'var(--text)' }}>{r.name}</span>
          <span style={{
            padding:'2px 8px',
            background: 'color-mix(in srgb, var(--red) 10%, var(--card))',
            color: 'var(--red)',
            fontFamily:'var(--font-mono)', fontWeight: 600, fontSize: 12,
            textAlign:'center',
            borderRadius: 'var(--radius-pill)',
            fontVariantNumeric: 'tabular-nums',
          }}>{r.days}d</span>
          <span className={`smart-chip smart-chip--${r.tone}`} style={{ justifySelf: 'end' }}>
            {r.stage}
          </span>
        </div>
      ))}
    </div>
  );
}

function ConfirmCard() {
  return (
    <div style={{
      background:'var(--card)',
      margin:'14px 0 4px',
      position:'relative',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--ring)',
      borderLeft: '3px solid var(--gold)',
      overflow: 'hidden',
    }}>
      <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span className="eyebrow" style={{ fontSize: 10 }}>Confirm action</span>
          <span style={{
            fontFamily:'var(--font-display)', fontWeight: 700, fontSize: 13,
            color:'var(--text)',
          }}>Send 4 SMS · from Alex</span>
        </div>
        <div style={{
          padding:'12px 14px',
          background:'var(--sunken)',
          boxShadow:'var(--ring)',
          borderRadius: 'var(--radius-sm)',
          fontFamily:'var(--font-body)', fontSize:14, color:'var(--text)', lineHeight:1.5,
        }}>
          "Hey {'{name}'} — just checking in. Key's still holding a spot on the schedule if you want to go ahead. No pressure either way."
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {['Mike J','Linda W','Tom B','Dave H'].map((n, i) => (
            <span key={i} className="smart-chip smart-chip--muted">→ {n}</span>
          ))}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
          <button className="btn-ghost" style={{ minHeight: 44, padding: '0 20px', fontSize: 14 }}>Deny</button>
          <button className="btn-gold"  style={{ minHeight: 44, padding: '0 22px', fontSize: 14 }}>Execute</button>
        </div>
      </div>
    </div>
  );
}

function ModeSelector({ active = 'Chat', mobile = false }) {
  const modes = ['Chat','Briefing','Insight','Reply','Draft'];
  if (mobile) {
    return (
      <div style={{ padding:'10px 14px', display:'flex', gap:8 }}>
        <button style={{
          flex:1, height:36,
          background:'var(--navy)', color:'#fff',
          fontFamily:'var(--font-display)', fontWeight: 600, fontSize: 13,
          borderRadius:'var(--radius-pill)',
          boxShadow:'var(--shadow-sm)',
          border:'none', cursor:'pointer',
        }}>Mode · {active} ▼</button>
      </div>
    );
  }
  return (
    <div style={{
      display:'flex', gap:8, padding:'10px 16px',
      borderTop:'1px solid var(--divider-faint)',
      background: 'var(--card)',
    }}>
      {modes.map(m => {
        const on = m === active;
        return (
          <button key={m} style={{
            height: 32, padding: '0 14px',
            background: on ? 'var(--navy)' : 'var(--card)',
            color: on ? '#fff' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: on ? 700 : 500, fontSize: 12,
            letterSpacing: '0.01em',
            borderRadius: 'var(--radius-pill)',
            boxShadow: on ? 'var(--shadow-sm)' : 'var(--ring)',
            border: 'none', cursor: 'pointer',
            transition: 'background var(--dur) var(--ease)',
          }}>{m}</button>
        );
      })}
    </div>
  );
}

function TsDivider({ children }) {
  return (
    <div style={{ textAlign:'center', margin:'18px 0 8px' }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 11,
        color: 'var(--text-faint)',
        padding: '0 10px', letterSpacing:'0.04em',
      }}>{children}</span>
    </div>
  );
}

function SparkyChat({ mobile = false }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{
        flex:1, overflowY:'auto',
        padding: mobile ? '14px 14px 10px' : '24px 72px 10px',
        maxWidth: mobile ? 'unset' : 960, margin: '0 auto', width:'100%',
      }}>
        <TsDivider>Today · 2:12 PM</TsDivider>
        <SparkyBubble who="key">who hasn't replied in 3 days?</SparkyBubble>
        <SparkyBubble who="s">Four leads went quiet in the last 3 days:<SilentList /></SparkyBubble>
        <SparkyBubble who="key">send them all a check-in from Alex</SparkyBubble>
        <SparkyBubble who="s" maxWidth="88%">
          Sure. Here's the draft I'd send — same message to all 4. Want to customize per person or send as-is?
          <ConfirmCard />
        </SparkyBubble>
        <TsDivider>Today · 2:14 PM</TsDivider>
        <SparkyBubble who="key">execute</SparkyBubble>
        <SparkyBubble who="s">
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span className="smart-chip smart-chip--green">Done</span>
            <span>Sent 4 SMS from Alex. I'll flag anyone who replies.</span>
          </div>
        </SparkyBubble>
      </div>
    </div>
  );
}

/* Trigger pill rendered floating above other tabs */
function SparkyTriggerDesktop() {
  return (
    <button style={{
      height: 44, padding: '0 20px',
      background:'var(--gold)', color:'var(--navy)',
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:10,
      fontFamily:'var(--font-display)', fontWeight: 700, fontSize: 14,
      letterSpacing: '0.01em',
      borderRadius: 'var(--radius-pill)',
      boxShadow: 'var(--shadow-gold)',
      border: 'none', cursor: 'pointer',
      transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-hover)'; e.currentTarget.style.boxShadow = 'var(--shadow-gold-hover)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.boxShadow = 'var(--shadow-gold)' }}
    >
      <SparkSBadge size={22} />
      Ask Sparky
    </button>
  );
}

function SparkyTriggerMobile() {
  return (
    <button style={{
      width: 56, height: 56,
      background:'var(--gold)', color:'var(--navy)',
      borderRadius: '50%',
      display:'grid', placeItems:'center',
      fontFamily:'var(--font-display)', fontWeight: 800, fontSize: 24,
      boxShadow: 'var(--shadow-gold)',
      border: 'none', cursor: 'pointer',
    }}>S</button>
  );
}

Object.assign(window, { SparkyChat, SparkyTriggerDesktop, SparkyTriggerMobile });

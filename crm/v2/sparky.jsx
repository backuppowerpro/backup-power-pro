/* global React */
// Sparky — AI assistant panel

const SparkIcons = {
  s: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4 L12 4 L12 7 L4 7 L4 9 L12 9 L12 12 L4 12"/></svg>,
  send: <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 3 L13 8 L3 13 L5 8 Z"/></svg>,
};

function SparkSBadge({ size = 20 }) {
  return (
    <span style={{
      width: size, height: size, flex:'0 0 auto',
      background: 'var(--gold)', color: '#1a1a1a',
      display: 'inline-grid', placeItems: 'center',
      fontFamily: 'var(--font-pixel)', fontSize: size * .8,
      boxShadow: 'var(--shadow-xs), var(--ring)',
    }}>S</span>
  );
}

function SparkyBubble({ who, children, maxWidth = '72%' }) {
  if (who === 'key') {
    return (
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 10 }}>
        <div className="tactile-raised" style={{
          maxWidth,
          background:'var(--navy)', color:'#fff',
          padding:'10px 14px',
          fontFamily:'var(--font-body)', fontSize:14, lineHeight:1.4,
        }}>{children}</div>
      </div>
    );
  }
  return (
    <div style={{ display:'flex', gap:10, marginBottom: 10, alignItems:'flex-start' }}>
      <SparkSBadge />
      <div style={{
        maxWidth,
        background:'var(--card)',
        boxShadow:'var(--pressed-2)',
        padding:'10px 14px',
        fontFamily:'var(--font-body)', fontSize:14, lineHeight:1.4, color:'var(--text)',
      }}>{children}</div>
    </div>
  );
}

function SilentList() {
  const rows = [
    { name:'Mike J',  days:4, stage:'QUOTED',   color:'var(--ms-4)' },
    { name:'Linda W', days:5, stage:'NEW LEAD', color:'var(--ms-1)' },
    { name:'Tom B',   days:6, stage:'QUOTED',   color:'var(--ms-4)' },
    { name:'Dave H',  days:8, stage:'NEW LEAD', color:'var(--ms-1)' },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
      {rows.map((r, i) => (
        <div key={i} className="tactile-flat" style={{
          display:'grid', gridTemplateColumns:'1fr 70px 110px',
          alignItems:'center', gap:10,
          padding:'8px 10px',
          background:'var(--card)', boxShadow:'var(--pressed-2)',
        }}>
          <span style={{ fontFamily:'var(--font-body)', fontSize:13, fontWeight:600, color:'var(--text)' }}>{r.name}</span>
          <span style={{
            padding:'2px 6px', background:'var(--lcd-bg)', boxShadow:'var(--pressed-2)',
            color:'var(--lcd-red)', textShadow:'var(--lcd-glow-red)',
            fontFamily:'var(--font-pixel)', fontSize:13, textAlign:'center',
          }}>{String(r.days).padStart(2,'0')}d</span>
          <span className="chrome-label" style={{
            fontSize:9, padding:'2px 6px',
            background: r.color, color:'#fff',
            textAlign:'center',
            boxShadow:'var(--shadow-xs), var(--ring)',
          }}>{r.stage}</span>
        </div>
      ))}
    </div>
  );
}

function ConfirmCard() {
  return (
    <div className="tactile-raised" style={{
      background:'var(--card)',
      margin:'10px 0',
      position:'relative',
      paddingLeft: 4,
    }}>
      <div style={{
        position:'absolute', left:0, top:0, bottom:0, width:4,
        background:'var(--gold)',
        boxShadow:'var(--shadow-xs), var(--ring)',
      }} />
      <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span className="chrome-label" style={{ fontSize:10, color:'var(--gold)' }}>CONFIRM ACTION</span>
          <span style={{ fontFamily:'var(--font-pixel)', fontSize:14, color:'var(--text)', letterSpacing:'.04em' }}>SEND 4 SMS · FROM ALEX</span>
        </div>
        <div style={{
          padding:'10px 12px',
          background:'var(--card)', boxShadow:'var(--pressed-2)',
          fontFamily:'var(--font-body)', fontSize:14, color:'var(--text)', lineHeight:1.4,
        }}>
          "Hey {'{name}'} — just checking in. Key's still holding a spot on the schedule if you want to go ahead. No pressure either way."
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {['Mike J','Linda W','Tom B','Dave H'].map((n, i) => (
            <span key={i} className="chrome-label" style={{
              fontSize:10, padding:'4px 8px',
              background:'var(--card)', boxShadow:'var(--pressed-2)',
              color:'var(--text-muted)',
            }}>→ {n}</span>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
          <button className="tactile-raised chrome-label" style={{
            height:36, padding:'0 16px', fontSize:11,
            background:'var(--card)', color:'var(--text)',
          }}>DENY</button>
          <button className="tactile-raised chrome-label" style={{
            height:36, padding:'0 18px', fontSize:11,
            background:'var(--navy)', color:'var(--gold)',
          }}>EXECUTE</button>
        </div>
      </div>
    </div>
  );
}

function ModeSelector({ active = 'CHAT', mobile = false }) {
  const modes = ['CHAT','BRIEFING','INSIGHT','REPLY','DRAFT'];
  if (mobile) {
    return (
      <div style={{ padding:'8px 12px', display:'flex', gap:6 }}>
        <button className="tactile-raised chrome-label" style={{
          flex:1, height:32, fontSize:11,
          background:'var(--navy)', color:'var(--gold)',
        }}>MODE · {active} ▼</button>
      </div>
    );
  }
  return (
    <div style={{
      display:'flex', gap:6, padding:'8px 16px',
      borderTop:'1px solid rgba(0,0,0,.08)',
    }}>
      {modes.map(m => {
        const on = m === active;
        return (
          <button key={m} className="chrome-label" style={{
            height: 30, padding: '0 14px', fontSize: 11,
            background: on ? 'var(--navy)' : 'var(--card)',
            color: on ? 'var(--gold)' : 'var(--text)',
            boxShadow: on ? 'var(--pressed-2)' : 'var(--raised-2)',
          }}>{m}</button>
        );
      })}
    </div>
  );
}

function TsDivider({ children }) {
  return (
    <div style={{ textAlign:'center', margin:'14px 0 6px' }}>
      <span className="chrome-label" style={{
        fontSize: 10, color: 'var(--text-faint)',
        padding: '0 8px', letterSpacing:'.12em',
      }}>{children}</span>
    </div>
  );
}

function SparkyChat({ mobile = false }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{
        flex:1, overflowY:'auto',
        padding: mobile ? '12px 12px 8px' : '20px 72px 8px',
        maxWidth: mobile ? 'unset' : 960, margin: '0 auto', width:'100%',
      }}>        <TsDivider>TODAY · 2:12 PM</TsDivider>
        <SparkyBubble who="key">who hasn't replied in 3 days?</SparkyBubble>
        <SparkyBubble who="s">Four leads went quiet in the last 3 days:<SilentList /></SparkyBubble>
        <SparkyBubble who="key">send them all a check-in from Alex</SparkyBubble>
        <SparkyBubble who="s" maxWidth="88%">
          Sure. Here's the draft I'd send — same message to all 4. Want to customize per person or send as-is?
          <ConfirmCard />
        </SparkyBubble>
        <TsDivider>TODAY · 2:14 PM</TsDivider>
        <SparkyBubble who="key">execute</SparkyBubble>
        <SparkyBubble who="s">
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{
              padding:'2px 6px', background:'var(--lcd-bg)', boxShadow:'var(--pressed-2)',
              color:'var(--lcd-green)', textShadow:'var(--lcd-glow-green)',
              fontFamily:'var(--font-pixel)', fontSize:14,
            }}>◆ DONE</span>
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
    <button className="tactile-raised" style={{
      width: 120, height: 44,
      background:'var(--gold)', color:'#1a1a1a',
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
      fontFamily:'var(--font-chrome)', fontWeight:700, fontSize:13,
      letterSpacing:'.08em', textTransform:'uppercase',
    }}>
      <SparkSBadge size={18} />
      ASK SPARKY
    </button>
  );
}

function SparkyTriggerMobile() {
  return (
    <button className="tactile-raised" style={{
      width: 56, height: 56,
      background:'var(--gold)', color:'#1a1a1a',
      display:'grid', placeItems:'center',
      fontFamily:'var(--font-pixel)', fontSize: 28,
    }}>S</button>
  );
}

Object.assign(window, { SparkyChat, SparkyTriggerDesktop, SparkyTriggerMobile });

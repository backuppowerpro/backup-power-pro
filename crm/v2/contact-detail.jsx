/* global React */
// Contact Detail Panel — shared component used by desktop slide-over + mobile full-screen.

const SAFE_TOP = 47;      // iPhone 14/15 notch zone
const SAFE_BOTTOM = 34;   // home indicator zone

const STAGES = [
  { id: 'new',     label: 'NEW LEAD',         color: 'var(--ms-1)' },
  { id: 'quoted',  label: 'QUOTED',           color: 'var(--ms-4)', active: true },
  { id: 'booked',  label: 'BOOKED',           color: 'var(--ms-2)' },
  { id: 'permit',  label: 'PERMIT SUBMITTED', color: 'var(--ms-5)' },
  { id: 'pay',     label: 'READY TO PAY',     color: 'var(--ms-3)' },
  { id: 'paid',    label: 'PAID',             color: 'var(--ms-2)' },
  { id: 'rprint',  label: 'READY TO PRINT',   color: 'var(--ms-5)' },
  { id: 'printed', label: 'PRINTED',          color: 'var(--ms-6)' },
  { id: 'inspect', label: 'INSPECTION',       color: 'var(--ms-7)' },
];

/* ─── Pixel house for avatars ─── */
function HouseBlock({ size = 64 }) {
  const p = { sky: '#6b91b8', roof: '#6b3a1b', wall: '#b1552b', door: '#2c1a10', window: '#c8d8e8', ground: '#3e5d2b' };
  const map = [
    ['s','s','s','s','s','s','s','s'],
    ['s','s','r','r','r','r','s','s'],
    ['s','r','r','r','r','r','r','s'],
    ['s','w','w','w','w','w','w','s'],
    ['s','w','W','w','w','W','w','s'],
    ['s','w','w','w','d','w','w','s'],
    ['s','w','w','w','d','w','w','s'],
    ['g','g','g','g','g','g','g','g'],
  ];
  const code = { s: p.sky, r: p.roof, w: p.wall, W: p.window, d: p.door, g: p.ground };
  return (
    <div style={{
      width: size, height: size,
      display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)',
      clipPath: 'var(--avatar-clip)', background: p.sky,
    }}>
      {map.flat().map((c, i) => <div key={i} style={{ background: code[c] }} />)}
    </div>
  );
}

function Header({ mobile, onClose, showStagePicker }) {
  return (
    <div style={{
      position: 'relative',
      padding: mobile ? '16px 16px 12px' : '14px 16px 12px',
      background: 'var(--card)', boxShadow: 'var(--raised)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      <button className="tactile-raised" style={{
        position: 'absolute', top: 12, left: 12,
        width: 32, height: 32, display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 16,
      }}>{mobile ? '‹' : '×'}</button>

      <button className="tactile-raised" style={{
        position: 'absolute', top: 12, right: 12,
        height: 28, padding: '0 10px',
        fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 10,
        letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>· · ·</button>

      <HouseBlock size={64} />
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, color: 'var(--text)',
        lineHeight: 1.1, marginTop: 2,
      }}>Sarah M</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)',
        textAlign: 'center', lineHeight: 1.4, letterSpacing: '.02em',
      }}>
        (864) 555-0101<br/>
        412 Laurel Ridge Rd · Greenville SC
      </div>
    </div>
  );
}

function StageStrip() {
  return (
    <button style={{
      width: '100%', height: 40, padding: '0 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
      cursor: 'pointer', color: 'inherit',
    }}>
      <span style={{
        fontFamily: 'var(--font-pixel)', fontSize: 18, lineHeight: 1,
        color: '#a78bfa',
        textShadow: '0 0 6px rgba(167,139,250,.55)',
        letterSpacing: '.12em', textTransform: 'uppercase',
      }}>◆ QUOTED</span>
      <span style={{
        fontFamily: 'var(--font-pixel)', fontSize: 14,
        color: 'var(--lcd-amber)', textShadow: 'var(--lcd-glow-amber)',
        letterSpacing: '.08em',
      }}>07D IN STAGE ▾</span>
    </button>
  );
}

const DETAIL_TABS = ['MESSAGES', 'TIMELINE', 'QUOTE', 'PERMITS', 'NOTES'];
function DetailTabs({ active = 'MESSAGES' }) {
  return (
    <div style={{
      display: 'flex', height: 44,
      background: 'var(--card)', boxShadow: 'var(--pressed-2)',
    }}>
      {DETAIL_TABS.map(t => {
        const on = t === active;
        return (
          <button key={t} className="chrome-label" style={{
            flex: 1, minWidth: 0,
            fontSize: 11, padding: '0 6px',
            color: on ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: on ? 'inset 0 -3px 0 var(--gold)' : 'none',
          }}>{t}</button>
        );
      })}
    </div>
  );
}

/* ─── Message bubbles ─── */
function TimestampDivider({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 0',
    }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,.12)' }}/>
      <span style={{
        fontFamily: 'var(--font-pixel)', fontSize: 13,
        letterSpacing: '.1em', textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,.12)' }}/>
    </div>
  );
}

function OutboundBubble({ children, alex }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
      <div style={{
        position: 'relative',
        maxWidth: '78%', padding: '10px 12px',
        background: 'var(--navy)', color: '#fff',
        boxShadow: 'var(--raised)',
        fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.45,
      }}>
        {alex && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            width: 16, height: 16, display: 'grid', placeItems: 'center',
            background: 'var(--gold)', color: '#000',
            fontFamily: 'var(--font-pixel)', fontSize: 14, lineHeight: 1,
            boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.5), inset -1px -1px 0 rgba(0,0,0,.35)',
          }}>A</span>
        )}
        {children}
      </div>
    </div>
  );
}

function InboundBubble({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        maxWidth: '78%', padding: '10px 12px',
        background: 'var(--card)', color: 'var(--text)',
        boxShadow: 'var(--raised)',
        fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.45,
      }}>{children}</div>
    </div>
  );
}

function MediaBubble() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        maxWidth: '78%', padding: 8,
        background: 'var(--card)', boxShadow: 'var(--raised)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
          letterSpacing: '.02em',
        }}>📷 panel_photo.jpg · 1.2 MB</div>
        <div style={{
          width: 200, height: 120, padding: 8,
          background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
          display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gridTemplateRows: 'repeat(12, 1fr)',
          fontFamily: 'var(--font-mono)', fontSize: 8,
        }}>
          {/* Tiny pixel-block placeholder representing an electrical panel */}
          {Array.from({ length: 240 }, (_, i) => {
            const col = i % 20, row = Math.floor(i / 20);
            const inPanel = row >= 2 && row <= 9 && col >= 4 && col <= 15;
            const isBreaker = inPanel && (col % 2 === 0) && (row >= 3 && row <= 8);
            const c = isBreaker ? '#8b5a1a'
                   : inPanel ? '#4a2f16'
                   : '#0f0f0f';
            return <div key={i} style={{ background: c }}/>;
          })}
        </div>
      </div>
    </div>
  );
}

function StageEventRow() {
  return (
    <div style={{
      position: 'relative',
      height: 32, padding: '0 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--card)', boxShadow: 'var(--pressed-2)',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: 'var(--lcd-amber)',
      }}/>
      <span style={{
        fontFamily: 'var(--font-pixel)', fontSize: 14,
        letterSpacing: '.08em', textTransform: 'uppercase',
        color: 'var(--text)',
      }}>→ MOVED TO QUOTED · 3:12 PM</span>
    </div>
  );
}

function CallEventRow() {
  return (
    <div style={{
      height: 40, padding: '0 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--card)', boxShadow: 'var(--pressed-2)',
    }}>
      <svg viewBox="0 0 16 16" width="14" height="14" style={{stroke:'var(--text)', strokeWidth:2.5}}>
        <path d="M2 3 L6 3 L7 7 L5 8 L8 11 L9 9 L13 10 L13 14 L9 14 Q2 12 2 3 Z"/>
      </svg>
      <span style={{
        flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', fontWeight: 500,
      }}>INCOMING CALL · ALEX</span>
      <span style={{
        height: 22, padding: '0 8px',
        background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
        color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
        fontFamily: 'var(--font-pixel)', fontSize: 14,
        display: 'inline-flex', alignItems: 'center',
        letterSpacing: '.08em',
      }}>0:43</span>
    </div>
  );
}

function MessagesThread() {
  return (
    <div style={{
      padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <TimestampDivider>TUESDAY · APR 14 · 2:15 PM</TimestampDivider>
      <OutboundBubble alex>Hey Sarah — got your request about the generator inlet install. Got a minute to share a photo of your electrical panel? Just need to see the breaker layout.</OutboundBubble>
      <InboundBubble>hey sounds good sending it now</InboundBubble>
      <MediaBubble/>

      <TimestampDivider>TUESDAY · APR 14 · 2:42 PM</TimestampDivider>
      <OutboundBubble alex>Perfect, got it. Key will take a look and send you a price tomorrow.</OutboundBubble>

      <StageEventRow/>
      <CallEventRow/>

      <TimestampDivider>WEDNESDAY · APR 15 · 10:05 AM</TimestampDivider>
      <OutboundBubble alex>Hey Sarah, Key got you a quote together. Link: bpp.app/q/s8r2x9. $1,497 all-in. Valid 7 days.</OutboundBubble>
      <InboundBubble>ok I need to talk to my husband</InboundBubble>

      <TimestampDivider>TODAY · 9:18 AM</TimestampDivider>
      <OutboundBubble alex>Just checking in — Key is holding your install slot for Thursday if you want it. No pressure.</OutboundBubble>
    </div>
  );
}

/* ─── Timeline tab ─── */
const TIMELINE_EVENTS = [
  { k: 'form',   label: 'FORM SUBMITTED', when: 'APR 13 · 10:22', ico: 'doc' },
  { k: 'msg',    label: 'ALEX MESSAGED',  when: 'APR 13 · 10:22', ico: 'msg' },
  { k: 'photo',  label: 'PHOTO RECEIVED', when: 'APR 14 ·  2:33', ico: 'cam' },
  { k: 'quote',  label: 'QUOTE SENT',     when: 'APR 14 ·  4:12', ico: 'dollar' },
  { k: 'view',   label: 'VIEWED',         when: 'APR 14 ·  6:30', ico: 'eye' },
  { k: 'msg2',   label: 'ALEX FOLLOWUP',  when: 'APR 17 ·  9:18', ico: 'msg' },
];
const TIcons = {
  doc: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 2 L11 2 L13 4 L13 14 L3 14 Z"/><path d="M5 6 L11 6 M5 9 L10 9"/></svg>,
  msg: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 3 L14 3 L14 11 L9 11 L6 14 L6 11 L2 11 Z"/></svg>,
  cam: <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="4" width="12" height="9"/><rect x="6" y="2" width="4" height="2"/><rect x="6" y="6" width="4" height="5"/></svg>,
  dollar: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 2 L8 14 M11 4 L5 4 L5 8 L11 8 L11 12 L5 12"/></svg>,
  eye: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 8 L5 5 L11 5 L14 8 L11 11 L5 11 Z"/><rect x="7" y="7" width="2" height="2"/></svg>,
};

function TimelineFeed() {
  return (
    <div style={{ padding: '16px 16px 24px', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 106, top: 24, bottom: 24,
        width: 2, background: 'var(--gold)',
      }}/>
      {TIMELINE_EVENTS.map((e, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '96px 14px 1fr',
          gap: 10, alignItems: 'center',
          marginBottom: 12,
        }}>
          <span style={{
            height: 22, padding: '0 8px',
            background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
            color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)',
            fontFamily: 'var(--font-pixel)', fontSize: 13,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end',
            letterSpacing: '.04em',
          }}>{e.when}</span>
          <div style={{
            width: 14, height: 14, background: 'var(--gold)',
            boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.5), inset -1px -1px 0 rgba(0,0,0,.35)',
            justifySelf: 'center',
          }}/>
          <div style={{
            height: 40, padding: '0 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--card)', boxShadow: 'var(--pressed-2)',
            fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 12,
            letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text)',
          }}>
            <span style={{color:'var(--text-muted)'}}>{TIcons[e.ico]}</span>
            {e.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Stage picker sheet ─── */
function StagePicker() {
  return (
    <div style={{
      width: 320, padding: 8,
      background: 'var(--card)', boxShadow: 'var(--raised), 0 0 0 1px rgba(0,0,0,.4)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        padding: '6px 10px',
        fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 10,
        letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>MOVE TO STAGE</div>
      {STAGES.map(s => {
        const on = s.active;
        return (
          <button key={s.id} style={{
            height: 36, padding: '0 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            background: on ? 'var(--lcd-bg)' : 'var(--card)',
            boxShadow: on ? 'var(--pressed-2)' : 'var(--raised-2)',
          }}>
            <span style={{
              width: 10, height: 10, background: s.color,
              boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.4), inset -1px -1px 0 rgba(0,0,0,.3)',
            }}/>
            <span className="chrome-label" style={{
              flex: 1, textAlign: 'left', fontSize: 11,
              color: on ? '#a78bfa' : 'var(--text)',
              textShadow: on ? '0 0 6px rgba(167,139,250,.55)' : 'none',
            }}>{s.label}</span>
            {on && (
              <svg viewBox="0 0 16 16" width="12" height="12" style={{stroke:'var(--gold)'}}>
                <path d="M3 8 L7 12 L13 4"/>
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main panel assembly ─── */
function ContactDetail({ mobile = false, tab = 'MESSAGES' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header mobile={mobile} />
      <StageStrip />
      <DetailTabs active={tab} />
      <div style={{
        flex: 1, overflowY: 'auto',
        background: 'var(--bg)',
        boxShadow: 'inset 0 4px 0 rgba(0,0,0,.08)',
      }}>
        {tab === 'MESSAGES' ? <MessagesThread /> : null}
        {tab === 'TIMELINE' ? <TimelineFeed /> : null}
      </div>
    </div>
  );
}

Object.assign(window, { ContactDetail, StagePicker, HouseBlock, SAFE_TOP, SAFE_BOTTOM });

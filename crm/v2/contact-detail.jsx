/* global React */
// Contact Detail Panel — shared component used by desktop slide-over + mobile full-screen.

const SAFE_TOP = 47;      // iPhone 14/15 notch zone
const SAFE_BOTTOM = 34;   // home indicator zone

const STAGES = [
  { id: 'new',     label: 'New lead',         color: 'var(--navy)'   },
  { id: 'quoted',  label: 'Quoted',           color: 'var(--purple)', active: true },
  { id: 'booked',  label: 'Booked',           color: 'var(--green)'  },
  { id: 'permit',  label: 'Permit submitted', color: 'var(--gold)'   },
  { id: 'pay',     label: 'Ready to pay',     color: 'var(--red)'    },
  { id: 'paid',    label: 'Paid',             color: 'var(--green)'  },
  { id: 'rprint',  label: 'Ready to print',   color: 'var(--gold)'   },
  { id: 'printed', label: 'Printed',          color: 'var(--navy)'   },
  { id: 'inspect', label: 'Inspection',       color: 'var(--purple)' },
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
      padding: mobile ? '22px 20px 20px' : '22px 24px 22px',
      background: 'var(--navy)', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      {/* Back / close button — top-left */}
      <button
        type="button"
        onClick={onClose}
        aria-label={mobile ? 'Back to list' : 'Close contact'}
        title={mobile ? 'Back to list' : 'Close contact (Esc)'}
        style={{
          position: 'absolute', top: 14, left: 14,
          width: 34, height: 34,
          background: 'rgba(255,255,255,0.08)', color: '#fff',
          borderRadius: 'var(--radius-pill)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
          cursor: 'pointer', border: 'none',
          transition: 'background var(--dur) var(--ease)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      ><span aria-hidden="true">{mobile ? '‹' : '×'}</span></button>

      {/* Overflow menu — top-right */}
      <button
        type="button"
        aria-label="More actions"
        title="More actions"
        style={{
          position: 'absolute', top: 14, right: 14,
          width: 34, height: 34,
          background: 'rgba(255,255,255,0.08)', color: '#fff',
          borderRadius: 'var(--radius-pill)',
          display: 'grid', placeItems: 'center',
          cursor: 'pointer', border: 'none',
          transition: 'background var(--dur) var(--ease)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      ><svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="13" cy="8" r="1.3"/></svg></button>

      <HouseBlock size={68} />
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
        letterSpacing: '-0.01em',
        color: '#fff',
        lineHeight: 1.15, marginTop: 4,
      }}>Sarah M</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.65)',
        textAlign: 'center', lineHeight: 1.5, letterSpacing: '0.01em',
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
      width: '100%', height: 52, padding: '0 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--card)',
      boxShadow: '0 1px 0 var(--divider)',
      cursor: 'pointer', color: 'inherit', border: 0,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)' }} />
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
          color: 'var(--text)', letterSpacing: '0.01em',
        }}>Quoted</span>
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12,
        color: 'var(--text-muted)',
      }}>
        <span>7 days in stage</span>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6 L8 10 L12 6" /></svg>
      </span>
    </button>
  );
}

const DETAIL_TABS = [
  { id: 'MESSAGES', label: 'Messages' },
  { id: 'TIMELINE', label: 'Timeline' },
  { id: 'QUOTE',    label: 'Quote' },
  { id: 'PERMITS',  label: 'Permits' },
  { id: 'NOTES',    label: 'Notes' },
];
function DetailTabs({ active = 'MESSAGES' }) {
  return (
    <div style={{
      display: 'flex', height: 44,
      background: 'var(--card)',
      borderBottom: '1px solid var(--divider-faint)',
    }}>
      {DETAIL_TABS.map(t => {
        const on = t.id === active;
        return (
          <button key={t.id} style={{
            flex: 1, minWidth: 0, padding: '0 6px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: on ? 700 : 600,
            fontSize: 12.5, letterSpacing: '-0.005em',
            color: on ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: on ? 'inset 0 -2px 0 var(--gold)' : 'none',
            transition: 'color var(--dur) var(--ease)',
          }}>{t.label}</button>
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
            boxShadow: 'var(--shadow-xs), var(--ring)',
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
        maxWidth: '78%', padding: 10,
        background: 'var(--card)',
        boxShadow: 'var(--shadow-sm), var(--ring)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
          color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>📷</span>
          <span>panel_photo.jpg</span>
          <span style={{ color: 'var(--text-faint)' }}>· 1.2 MB</span>
        </div>
        <div style={{
          width: 200, height: 120, padding: 8,
          background: 'var(--navy-deep, #081528)',
          borderRadius: 'var(--radius-sm)',
          display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gridTemplateRows: 'repeat(12, 1fr)',
          boxShadow: 'var(--ring)',
        }}>
          {/* Tiny pixel-block placeholder representing an electrical panel */}
          {Array.from({ length: 240 }, (_, i) => {
            const col = i % 20, row = Math.floor(i / 20);
            const inPanel = row >= 2 && row <= 9 && col >= 4 && col <= 15;
            const isBreaker = inPanel && (col % 2 === 0) && (row >= 3 && row <= 8);
            const c = isBreaker ? '#8b5a1a'
                   : inPanel ? '#4a2f16'
                   : 'transparent';
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
      height: 36, padding: '0 14px 0 18px',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--sunken)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
        background: 'var(--gold)',
        borderRadius: '0 2px 2px 0',
      }}/>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
        color: 'var(--text)',
      }}>→ Moved to Quoted</span>
      <span style={{
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
      }}>3:12 PM</span>
    </div>
  );
}

function CallEventRow() {
  return (
    <div style={{
      height: 44, padding: '0 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--sunken)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <svg viewBox="0 0 16 16" width="14" height="14" style={{stroke:'var(--text-muted)', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'}}>
        <path d="M2 3 L6 3 L7 7 L5 8 L8 11 L9 9 L13 10 L13 14 L9 14 Q2 12 2 3 Z"/>
      </svg>
      <span style={{
        flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', fontWeight: 500,
      }}>Incoming call · <span style={{ color: 'var(--blue)', fontWeight: 600 }}>Alex</span></span>
      <span style={{
        padding: '2px 10px',
        background: 'var(--card)', boxShadow: 'var(--ring)',
        color: 'var(--navy)',
        fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12,
        borderRadius: 'var(--radius-sm)',
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
  { k: 'form',   label: 'Form submitted', when: 'Apr 13 · 10:22', ico: 'doc' },
  { k: 'msg',    label: 'Alex messaged',  when: 'Apr 13 · 10:22', ico: 'msg' },
  { k: 'photo',  label: 'Photo received', when: 'Apr 14 · 2:33',  ico: 'cam' },
  { k: 'quote',  label: 'Quote sent',     when: 'Apr 14 · 4:12',  ico: 'dollar' },
  { k: 'view',   label: 'Viewed',         when: 'Apr 14 · 6:30',  ico: 'eye' },
  { k: 'msg2',   label: 'Alex follow-up', when: 'Apr 17 · 9:18',  ico: 'msg' },
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
        position: 'absolute', left: 118, top: 24, bottom: 24,
        width: 2, background: 'var(--gold)',
        opacity: 0.35,
      }}/>
      {TIMELINE_EVENTS.map((e, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '104px 16px 1fr',
          gap: 12, alignItems: 'center',
          marginBottom: 10,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'right',
          }}>{e.when}</span>
          <div style={{
            width: 12, height: 12,
            background: 'var(--gold)',
            borderRadius: '50%',
            boxShadow: '0 0 0 3px var(--bg)',
            justifySelf: 'center',
          }}/>
          <div style={{
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--card)',
            boxShadow: 'var(--shadow-sm), var(--ring)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13,
            color: 'var(--text)',
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
      width: 320, padding: 10,
      background: 'var(--card)',
      boxShadow: 'var(--shadow-lg), var(--ring)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        padding: '8px 12px 6px',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--gold)',
      }}>Move to stage</div>
      {STAGES.map(s => {
        const on = s.active;
        return (
          <button key={s.id} style={{
            height: 40, padding: '0 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            background: on ? 'var(--sunken)' : 'transparent',
            color: 'var(--text)',
            boxShadow: on ? 'inset 0 0 0 1.5px var(--gold)' : 'none',
            borderRadius: 'var(--radius-sm)',
            border: 'none', cursor: 'pointer',
            transition: 'background var(--dur-fast) var(--ease)',
          }}
          onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--sunken)' }}
          onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              width: 8, height: 8, background: s.color,
              borderRadius: '50%',
              flex: '0 0 auto',
            }}/>
            <span style={{
              flex: 1, textAlign: 'left',
              fontFamily: 'var(--font-display)', fontWeight: on ? 700 : 500, fontSize: 13,
              letterSpacing: '0.01em',
              color: on ? 'var(--navy)' : 'var(--text)',
            }}>{(s.label || '').charAt(0) + (s.label || '').slice(1).toLowerCase()}</span>
            {on && (
              <svg viewBox="0 0 16 16" width="12" height="12"
                style={{stroke:'var(--gold)', strokeWidth: 2.5, fill:'none', strokeLinecap: 'round', strokeLinejoin: 'round'}}>
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

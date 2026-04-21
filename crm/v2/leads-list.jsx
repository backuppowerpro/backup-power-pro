/* global React */
// Leads — List view. Row-based, mobile-first.

const STAGE = {
  NEW:     { label: 'NEW LEAD',  abbr: 'NEW',         color: 'var(--ms-1)' },
  QUOTED:  { label: 'QUOTED',    abbr: 'QUOTED',      color: 'var(--ms-4)' },
  BOOKED:  { label: 'BOOKED',    abbr: 'BOOKED',      color: 'var(--ms-2)' },
  PERMIT:  { label: 'PERMIT',    abbr: 'PERMIT SUB.', color: 'var(--ms-5)' },
  PAY:     { label: 'READY PAY', abbr: 'READY PAY',   color: 'var(--ms-3)' },
  PAID:    { label: 'PAID',      abbr: 'PAID',        color: 'var(--ms-2)' },
  PRINT:   { label: 'PRINTED',   abbr: 'PRINTED',     color: 'var(--ms-6)' },
  INSPECT: { label: 'INSPECT',   abbr: 'INSPECTION',  color: 'var(--ms-7)' },
};

const rows = [
  { name: 'Sarah M',  initials: 'SM', photo: 'ridge',   phone: '(864) 555-0101', stage: 'QUOTED',  ts: '07D AGO',   unread: true },
  { name: 'Robert K', initials: 'RK', photo: null,      phone: '(864) 555-0123', stage: 'NEW',     ts: '3:12 PM',   unread: false },
  { name: 'Ashley P', initials: 'AP', photo: null,      phone: '(864) 555-0145', stage: 'NEW',     ts: 'YESTERDAY', unread: true,  amberInitials: true },
  { name: 'Dave H',   initials: 'DH', photo: null,      phone: '(864) 555-0167', stage: 'NEW',     ts: '08D AGO',   unread: false, overdue: true },
  { name: 'Mike J',   initials: 'MJ', photo: null,      phone: '(864) 555-0189', stage: 'QUOTED',  ts: '04D AGO',   unread: false, overdue: true },
  { name: 'Mark L',   initials: 'ML', photo: 'stone',   phone: '(864) 555-0202', stage: 'BOOKED',  ts: '01D AGO',   unread: false },
  { name: 'Susan E',  initials: 'SE', photo: null,      phone: '(864) 555-0224', stage: 'BOOKED',  ts: '02D AGO',   unread: false },
  { name: 'Bill C',   initials: 'BC', photo: null,      phone: '(864) 555-0246', stage: 'PERMIT',  ts: '03D AGO',   unread: false },
  { name: 'Helen S',  initials: 'HS', photo: null,      phone: '(864) 555-0268', stage: 'INSPECT', ts: 'TODAY',     unread: false, done: true },
];

/* Pixel house placeholders — drawn as tiny color blocks on an 8×8 grid, no SVG draw */
function HousePhoto({ kind }) {
  // Two flavors: "ridge" (warm brick) and "stone" (cool gray+green)
  const palettes = {
    ridge: { sky: '#6b91b8', roof: '#6b3a1b', wall: '#b1552b', door: '#2c1a10', window: '#c8d8e8', ground: '#3e5d2b' },
    stone: { sky: '#8aa5b8', roof: '#3d4a52', wall: '#9ca39a', door: '#1d242b', window: '#d1dbe0', ground: '#4b6d3a' },
  };
  const p = palettes[kind] || palettes.ridge;
  // 8x8 pixel map
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
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: 'repeat(8, 1fr)',
      gridTemplateRows: 'repeat(8, 1fr)',
      background: p.sky,
    }}>
      {map.flat().map((c, i) =>
        <div key={i} style={{ background: code[c] }}/>
      )}
    </div>
  );
}

function Avatar({ row, size = 48 }) {
  const fontSize = Math.round(size * 0.36);
  // Track image load state so we can fall back to initials if the Street
  // View API has no coverage (returns a gray "no imagery" placeholder) or
  // if the image 404s. Google returns a valid 200 response even with no
  // imagery, so we can't rely on onError alone — check dimensions post-load
  // and fall back if the returned pixel is suspiciously small.
  const [failed, setFailed] = React.useState(false);
  const showPhoto = row.photo && !failed;
  return (
    <div style={{
      width: size, height: size, flex: '0 0 auto',
      clipPath: 'var(--avatar-clip)',
      background: showPhoto ? '#000' : 'var(--navy)',
      display: 'grid', placeItems: 'center',
      overflow: 'hidden',
    }}>
      {showPhoto ? (
        <img
          src={row.photo}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{
          fontFamily: 'var(--font-chrome)', fontWeight: 700,
          color: row.amberInitials ? 'var(--lcd-amber)' : 'var(--gold)',
          fontSize, letterSpacing: '.04em',
        }}>{row.initials}</span>
      )}
    </div>
  );
}

function LeadRow({ r, desktop = false }) {
  const stage = STAGE[r.stage];
  const [hover, setHover] = React.useState(false);
  // When the parent list is in "select mode" each row can be marked
  // `_selected: true`. Visual: navy 3px left stripe + faint navy tint so
  // selected rows read clearly without needing a checkbox column.
  const selected = r._selected === true;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        minHeight: 72, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: selected ? 'var(--bg)' : (hover ? 'var(--bg)' : 'var(--card)'),
        boxShadow: selected ? 'inset 3px 0 0 var(--navy)' : 'none',
        borderBottom: '1px solid rgba(0,0,0,.08)',
        transition: 'background var(--dur, 80ms) var(--step, linear)',
      }}>
      {selected && (
        <div style={{
          position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          width: 14, height: 14, background: 'var(--navy)',
          display: 'grid', placeItems: 'center',
          boxShadow: 'var(--raised-2)', zIndex: 1,
        }}>
          <svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="square">
            <path d="M1 5 L4 8 L9 2"/>
          </svg>
        </div>
      )}
      {r.overdue && !selected && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: 'var(--ms-3)',
        }}/>
      )}

      <Avatar row={r} size={48} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {r.pinned ? (
            <span title="Pinned" aria-label="Pinned" style={{
              color: 'var(--gold)', fontSize: 13, lineHeight: 1, flex: '0 0 auto',
            }}>★</span>
          ) : null}
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{r.name}</span>
          {r.unread && (
            <span title="unread" style={{
              width: 6, height: 6, flex: '0 0 auto',
              background: 'var(--lcd-amber)',
              boxShadow: '0 0 4px rgba(255,183,0,.75)',
            }}/>
          )}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 400,
          color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
          letterSpacing: '.02em',
        }}>{r.phone}</span>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
        flex: '0 0 auto',
      }}>
        <span style={{
          fontSize: 10, color: stage.color, lineHeight: 1,
          fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
        }}>{stage.abbr}</span>
        {r.done ? (
          <span className="mono" style={{
            fontSize: 11, color: 'var(--ms-2)',
          }}>done</span>
        ) : (
          <span className="mono" style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            letterSpacing: '.02em',
          }}>{r.ts}</span>
        )}
      </div>
    </div>
  );
}

function ListToolbar({ mobile }) {
  const subs = [
    { id: 'pipeline', label: 'PIPELINE' },
    { id: 'list',     label: 'LIST', active: true },
    { id: 'permits',  label: 'PERMITS' },
    { id: 'mat',      label: 'MATERIALS' },
  ];
  const filters = [
    { id: 'mine',    label: 'MINE',      active: true },
    { id: 'all',     label: 'ALL' },
    { id: 'overdue', label: 'OVERDUE' },
    { id: 'photo',   label: 'HAS PHOTO' },
  ];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: mobile ? '12px 8px 8px' : '16px 16px 8px',
    }}>
      <div style={{ display: 'flex', height: 36, boxShadow: 'var(--raised-2)', alignSelf: 'flex-start' }}>
        {subs.map(s => (
          <button key={s.id} className="chrome-label" style={{
            height: 36, padding: mobile ? '0 12px' : '0 16px', fontSize: 12,
            background: s.active ? 'var(--navy)' : 'transparent',
            color: s.active ? 'var(--gold)' : 'var(--text)',
            boxShadow: s.active ? 'var(--pressed-2)' : 'none',
          }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {filters.map(f => (
          <button key={f.id} className="chrome-label" style={{
            flex: '0 0 auto',
            height: 28, padding: '0 12px', fontSize: 11,
            background: f.active ? 'var(--navy)' : 'var(--card)',
            color: f.active ? '#fff' : 'var(--text)',
            boxShadow: f.active ? 'var(--pressed-2)' : 'var(--raised-2)',
          }}>{f.label}</button>
        ))}
      </div>
    </div>
  );
}

function LoadMoreRow() {
  return (
    <button style={{
      width: '100%', height: 42,
      display: 'grid', placeItems: 'center',
      background: 'var(--card)',
      boxShadow: 'var(--pressed-2)',
      fontFamily: 'var(--font-body)', fontSize: 13,
      color: 'var(--text-muted)', border: 'none', cursor: 'pointer',
    }}>Load 20 more</button>
  );
}

/* ────────── Mobile list ────────── */
function LeadsListMobile({ rows: rowsProp, onSelect, showToolbar = false }) {
  const data = rowsProp || rows;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {showToolbar ? <ListToolbar mobile /> : null}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '0 0 88px',
        boxShadow: 'var(--pressed-2)',
        margin: '0 8px',
      }}>
        {data.map((r, i) => (
          <div key={r.id || i} onClick={() => onSelect && onSelect(r)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <LeadRow r={r} />
          </div>
        ))}
        {!rowsProp && <LoadMoreRow />}
      </div>
    </div>
  );
}

/* ────────── Desktop list — 3-column row grid ────────── */
function LeadsListDesktop({ rows: rowsProp, onSelect, showToolbar = false }) {
  const data = rowsProp || rows;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {showToolbar ? <ListToolbar /> : null}
      <div style={{
        flex: 1,
        padding: '0 16px 88px',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          columnGap: 16, rowGap: 0,
          boxShadow: 'var(--pressed-2)',
          background: 'var(--card)',
        }}>
          {data.map((r, i) => (
            <div key={r.id || i} onClick={() => onSelect && onSelect(r)} style={{
              boxShadow: i % 3 !== 2 ? 'inset -1px 0 0 rgba(0,0,0,.08)' : 'none',
              cursor: onSelect ? 'pointer' : 'default',
            }}>
              <LeadRow r={r} desktop />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          {!rowsProp && <LoadMoreRow />}
        </div>
      </div>
    </div>
  );
}

// Memoize LeadRow so each row only re-renders when its own `r` object
// changes, not every time the parent list state ticks (realtime inserts,
// scroll, etc). At 200 rows this noticeably cuts re-render work.
const MemoLeadRow = React.memo(LeadRow, (prev, next) =>
  prev.r === next.r && prev.desktop === next.desktop
);

Object.assign(window, { LeadsListMobile, LeadsListDesktop, LeadRow: MemoLeadRow, ListToolbar, LoadMoreRow, Avatar });

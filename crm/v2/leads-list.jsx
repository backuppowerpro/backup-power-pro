/* global React */
// Leads — List view. Row-based, mobile-first.

// Stage → smart-chip tone + sentence-case label. Abbreviation is what
// renders in the compressed-row slot; fullLabel is for tooltips and
// screen readers. Tone matches the design system map:
//   navy   → neutral / new    red → exit/overdue/ready-pay
//   gold   → waiting on Key   green → confirmed/done
//   purple → waiting external blue → informational
// Keys accept BOTH uppercase (legacy mock rows at bottom of this file)
// AND title-case (contactToRow sends 'New' / 'Quoted' / … after the
// 2026-04-24 STAGE_MAP rename). Lookup falls back to a navy "—" chip if
// an unexpected value slips through, so one unfamiliar stage never
// crashes the whole list (was the cause of the ErrorBoundary crash on
// the /list tab when STAGE_MAP returned 'New' but this map only had
// 'NEW').
const STAGE = {
  // Title-case (post-rename)
  'New':        { label: 'New lead',     abbr: 'New',        tone: 'navy'   },
  'Quoted':     { label: 'Quoted',       abbr: 'Quoted',     tone: 'purple' },
  'Booked':     { label: 'Booked',       abbr: 'Booked',     tone: 'green'  },
  'Permit':     { label: 'Permit',       abbr: 'Permit',     tone: 'gold'   },
  'Pay':        { label: 'Ready to pay', abbr: 'Pay',        tone: 'red'    },
  'Paid':       { label: 'Paid',         abbr: 'Paid',       tone: 'green'  },
  'Printed':    { label: 'Printed',      abbr: 'Printed',    tone: 'navy'   },
  'Inspection': { label: 'Inspection',   abbr: 'Inspection', tone: 'purple' },
  // Uppercase (mock rows + legacy)
  'NEW':        { label: 'New lead',     abbr: 'New',        tone: 'navy'   },
  'QUOTED':     { label: 'Quoted',       abbr: 'Quoted',     tone: 'purple' },
  'BOOKED':     { label: 'Booked',       abbr: 'Booked',     tone: 'green'  },
  'PERMIT':     { label: 'Permit',       abbr: 'Permit',     tone: 'gold'   },
  'PAY':        { label: 'Ready to pay', abbr: 'Pay',        tone: 'red'    },
  'PAID':       { label: 'Paid',         abbr: 'Paid',       tone: 'green'  },
  'PRINT':      { label: 'Printed',      abbr: 'Printed',    tone: 'navy'   },
  'INSPECT':    { label: 'Inspection',   abbr: 'Inspection', tone: 'purple' },
};
const STAGE_FALLBACK = { label: 'Unknown', abbr: '—', tone: 'navy' };

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

// Module-level cache of Street View coverage results. Google's Street View
// Static API returns HTTP 200 with a gray "we have no imagery" tile when the
// requested address has no coverage — onError never fires, so the ugly tile
// silently ships. The metadata endpoint (same key, free) returns
// { status: 'OK' | 'ZERO_RESULTS' | ... } so we can check coverage before
// trusting the photo URL. Cache by normalized address for the session.
const SV_COVERAGE_CACHE = new Map(); // address → 'ok' | 'none' | 'pending'
function checkStreetViewCoverage(photoUrl) {
  if (!photoUrl) return Promise.resolve(false);
  try {
    const u = new URL(photoUrl);
    const loc = u.searchParams.get('location');
    const key = u.searchParams.get('key');
    if (!loc || !key) return Promise.resolve(true); // unknown — trust the URL
    const cached = SV_COVERAGE_CACHE.get(loc);
    if (cached === 'ok') return Promise.resolve(true);
    if (cached === 'none') return Promise.resolve(false);
    if (cached === 'pending') return Promise.resolve(true); // optimistic
    SV_COVERAGE_CACHE.set(loc, 'pending');
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(loc)}&source=outdoor&key=${key}`;
    return fetch(metaUrl)
      .then(r => r.json())
      .then(m => {
        const ok = m && m.status === 'OK';
        SV_COVERAGE_CACHE.set(loc, ok ? 'ok' : 'none');
        return ok;
      })
      .catch(() => { SV_COVERAGE_CACHE.set(loc, 'ok'); return true; });
  } catch {
    return Promise.resolve(true);
  }
}

function Avatar({ row, size = 48 }) {
  const fontSize = Math.round(size * 0.36);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    if (row.photo) {
      checkStreetViewCoverage(row.photo).then(ok => {
        if (!cancelled && !ok) setFailed(true);
      });
    }
    return () => { cancelled = true; };
  }, [row.photo]);
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
  const stage = STAGE[r.stage] || STAGE_FALLBACK;
  const [hover, setHover] = React.useState(false);
  // When the parent list is in "select mode" each row can be marked
  // `_selected: true`. Visual: navy 3px left stripe + faint navy tint so
  // selected rows read clearly without needing a checkbox column.
  const selected = r._selected === true;
  // Quick-action click handlers — bubble out so the row's outer click
  // (open contact) doesn't fire. Each guarded against missing data.
  const onQuickCall = (e) => {
    e.stopPropagation();
    if (window.__bpp_dial && r.raw?.phone && !r.raw?.do_not_contact) {
      window.__bpp_dial(r.raw.phone);
    }
  };
  const onQuickSnooze = (e) => {
    e.stopPropagation();
    if (r.id && window.__bpp_snoozeContact) {
      window.__bpp_snoozeContact(r.id, 1);
    }
  };
  const showQuickActions = hover && !selected && desktop && r.id;
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
        borderBottom: '1px solid var(--divider-faint)',
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
          background: 'var(--red)',
          borderRadius: '0 2px 2px 0',
        }}/>
      )}

      <Avatar row={r} size={48} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {r.pinned ? (
            <span title="Pinned" aria-label="Pinned" style={{
              flex: '0 0 auto', display: 'inline-grid', placeItems: 'center',
              color: 'var(--gold)',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </span>
          ) : null}
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{r.name}</span>
          {r.unread && (
            <span title="unread" aria-label="Unread" style={{
              width: 8, height: 8, flex: '0 0 auto',
              background: 'var(--gold)',
              borderRadius: '50%',
            }}/>
          )}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 400,
          color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
          letterSpacing: 0,
        }}>{r.phone}</span>
      </div>

      {/* Right cluster: stage chip + timestamp by default; on desktop hover
          we slide in a tight quick-action row (Call · Snooze) over them so
          Key can act without opening the contact. */}
      {showQuickActions ? (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            display: 'flex', gap: 4, flex: '0 0 auto',
          }}>
          {r.raw?.phone && !r.raw?.do_not_contact ? (
            <button onClick={onQuickCall}
              title="Call (D)" aria-label={`Call ${r.name}`}
              style={{
                width: 32, height: 32, padding: 0,
                background: 'color-mix(in srgb, var(--green) 14%, var(--card))',
                color: 'var(--green)',
                border: 'none', cursor: 'pointer',
                borderRadius: 'var(--radius-pill)',
                display: 'grid', placeItems: 'center',
                transition: 'background var(--dur) var(--ease)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--green) 14%, var(--card))'; e.currentTarget.style.color = 'var(--green)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
          ) : null}
          <button onClick={onQuickSnooze}
            title="Snooze 1 day" aria-label={`Snooze ${r.name} 1 day`}
            style={{
              width: 32, height: 32, padding: 0,
              background: 'var(--sunken)',
              color: 'var(--text-muted)',
              border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-pill)',
              display: 'grid', placeItems: 'center',
              transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--gold) 18%, var(--sunken))'; e.currentTarget.style.color = 'var(--gold-ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--sunken)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
          flex: '0 0 auto',
        }}>
          <span className={`smart-chip smart-chip--${stage.tone}`} title={stage.label}>
            {stage.abbr}
          </span>
          {r.done ? (
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
              color: 'var(--green)',
            }}>Done</span>
          ) : (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text-faint)',
            }}>{r.ts}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ListToolbar({ mobile }) {
  const subs = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'list',     label: 'List', active: true },
    { id: 'permits',  label: 'Permits' },
    { id: 'mat',      label: 'Materials' },
  ];
  const filters = [
    { id: 'mine',    label: 'Mine',      active: true },
    { id: 'all',     label: 'All' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'photo',   label: 'Has photo' },
  ];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: mobile ? '12px 10px 8px' : '16px 16px 10px',
    }}>
      <div style={{
        display: 'flex', height: 36,
        background: 'var(--card)',
        boxShadow: 'var(--ring)',
        borderRadius: 'var(--radius-pill)',
        padding: 3,
        alignSelf: 'flex-start',
      }}>
        {subs.map(s => (
          <button key={s.id} style={{
            height: 30, padding: mobile ? '0 14px' : '0 16px',
            background: s.active ? 'var(--navy)' : 'transparent',
            color: s.active ? '#fff' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: s.active ? 700 : 500,
            fontSize: 12, letterSpacing: '0.01em',
            borderRadius: 'var(--radius-pill)',
            border: 'none', cursor: 'pointer',
            transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
          }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {filters.map(f => (
          <button key={f.id} style={{
            flex: '0 0 auto',
            height: 30, padding: '0 14px',
            background: f.active ? 'var(--navy)' : 'var(--card)',
            color: f.active ? '#fff' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600, fontSize: 12,
            letterSpacing: '0.01em',
            borderRadius: 'var(--radius-pill)',
            boxShadow: f.active ? 'var(--shadow-sm)' : 'var(--ring)',
            border: 'none', cursor: 'pointer',
            transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
          }}>{f.label}</button>
        ))}
      </div>
    </div>
  );
}

function LoadMoreRow() {
  return (
    <button style={{
      width: '100%', height: 44,
      display: 'grid', placeItems: 'center',
      background: 'var(--card)',
      boxShadow: 'var(--ring)',
      borderRadius: 'var(--radius-md)',
      fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 13,
      color: 'var(--text-muted)',
      border: 'none', cursor: 'pointer',
      transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--sunken)'; e.currentTarget.style.color = 'var(--navy)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text-muted)' }}
    >Load 20 more</button>
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

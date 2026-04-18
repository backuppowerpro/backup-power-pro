/* global React */
// Leads Pipeline — 9-column kanban

const columns = [
  { id: 'new',     label: 'NEW LEAD',         color: 'var(--ms-1)', count: 42 },
  { id: 'quoted',  label: 'QUOTED',           color: 'var(--ms-4)', count: 8 },
  { id: 'booked',  label: 'BOOKED',           color: 'var(--ms-2)', count: 3 },
  { id: 'permit',  label: 'PERMIT SUBMITTED', color: 'var(--ms-5)', count: 2 },
  { id: 'pay',     label: 'READY TO PAY',     color: 'var(--ms-3)', count: 1 },
  { id: 'paid',    label: 'PAID',             color: 'var(--ms-2)', count: 1 },
  { id: 'rprint',  label: 'READY TO PRINT',   color: 'var(--ms-5)', count: 0 },
  { id: 'printed', label: 'PRINTED',          color: 'var(--ms-6)', count: 1 },
  { id: 'inspect', label: 'INSPECTION',       color: 'var(--ms-7)', count: 1 },
];

const dots = ([photo, quote, permit]) => ({ photo, quote, permit });

const cards = {
  new: [
    { name: 'Sarah M',    initials:'SM', addr: '412 Laurel Ridge Rd · Greer',     days: 1,  dots: dots([1,0,0]) },
    { name: 'Robert K',   initials:'RK', addr: '89 Willowbrook Ln · Simpsonville', days: 3,  dots: dots([1,0,0]) },
    { name: 'Ashley P',   initials:'AP', addr: '2201 Piney Mountain · Greenville', days: 5,  dots: dots([0,0,0]) },
    { name: 'Dave H',     initials:'DH', addr: '17 Whitehall Dr · Taylors',        days: 8,  dots: dots([1,0,0]), overdue: true },
    { name: 'Linda W',    initials:'LW', addr: '305 Edgewater Way · Fountain Inn', days: 12, dots: dots([0,0,0]), overdue: true },
  ],
  quoted: [
    { name: 'Tom B',      initials:'TB', addr: '6 Oakcrest Ct · Easley',          days: 2, dots: dots([1,1,0]) },
    { name: 'Mike J',     initials:'MJ', addr: '118 Mcdaniel Ave · Greenville',    days: 4, dots: dots([1,1,0]), overdue: true },
    { name: 'Jessica T',  initials:'JT', addr: '44 Cherokee Trl · Travelers Rest', days: 1, dots: dots([1,1,0]) },
  ],
  booked: [
    { name: 'Mark L',     initials:'ML', addr: '902 Stonebrook Farm · Simpsonville', days: 1, dots: dots([1,1,1]) },
    { name: 'Susan E',    initials:'SE', addr: '73 Hollingsworth Dr · Greenville',   days: 2, dots: dots([1,1,0]) },
  ],
  permit: [
    { name: 'Bill C',     initials:'BC', addr: '12 Crescent Ave · Greenville',    days: 3, dots: dots([1,1,1]) },
    { name: 'Paul R',     initials:'PR', addr: '501 Augusta Rd · Piedmont',       days: 1, dots: dots([1,1,1]) },
  ],
  pay:  [{ name: 'Diane M',    initials:'DM', addr: '88 Hampton Grove · Mauldin',  days: 2, dots: dots([1,1,1]) }],
  paid: [{ name: 'Greg H',     initials:'GH', addr: '210 Riverbend Dr · Easley',    days: 1, dots: dots([1,1,1]) }],
  rprint: [],
  printed: [{ name: 'Carl W',  initials:'CW', addr: '54 Pelham Rd · Greenville',    days: 1, dots: dots([1,1,1]) }],
  inspect: [{ name: 'Helen S', initials:'HS', addr: '17 Knollwood Ct · Spartanburg', days: 0, dots: dots([1,1,1]) }],
};

function DaysChip({ n }) {
  let color = 'var(--lcd-green)', glow = 'var(--lcd-glow-green)';
  if (n >= 3 && n < 7) { color = 'var(--lcd-amber)'; glow = 'var(--lcd-glow-amber)'; }
  if (n >= 7)         { color = 'var(--lcd-red)';   glow = 'var(--lcd-glow-red)'; }
  return (
    <span style={{
      height: 20, padding: '0 6px',
      display: 'inline-flex', alignItems: 'center',
      background: 'var(--lcd-bg)',
      boxShadow: 'var(--pressed-2)',
      color, textShadow: glow,
      fontFamily: 'var(--font-pixel)', fontSize: 14,
      letterSpacing: '.08em',
    }}>{String(n).padStart(2, '0')}D</span>
  );
}

function Dot({ on, tone = 'var(--ms-2)' }) {
  return (
    <span title={on ? 'done' : 'pending'} style={{
      width: 8, height: 8,
      background: on ? tone : 'transparent',
      boxShadow: on
        ? 'inset 1px 1px 0 rgba(255,255,255,.4), inset -1px -1px 0 rgba(0,0,0,.3)'
        : 'var(--pressed-2)',
    }}/>
  );
}

function LeadCard({ c }) {
  return (
    <div className="tactile-raised" style={{
      position: 'relative',
      minHeight: 88, padding: '10px 12px 10px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: 'var(--raised)',
    }}>
      {c.overdue && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          background: 'var(--red)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.3), inset 0 -2px 0 rgba(0,0,0,.35)',
        }}/>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24, background: 'var(--navy)',
          clipPath: 'var(--avatar-clip)',
          display: 'grid', placeItems: 'center', flex: '0 0 auto',
        }}>
          <span style={{
            fontFamily: 'var(--font-chrome)', fontWeight: 700,
            color: 'var(--gold)', fontSize: 10, letterSpacing: '.04em',
          }}>{c.initials}</span>
        </div>
        <div style={{
          flex: 1, minWidth: 0,
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
          color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{c.name}</div>
      </div>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}>{c.addr}</div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 'auto',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <Dot on={c.dots.photo} tone="var(--ms-2)" />
          <Dot on={c.dots.quote} tone="var(--ms-1)" />
          <Dot on={c.dots.permit} tone="var(--ms-5)" />
        </div>
        <DaysChip n={c.days} />
      </div>
    </div>
  );
}

function Column({ col }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{
        height: 44, padding: '6px 10px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: 'var(--card)',
        boxShadow: 'var(--pressed-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span className="chrome-label" style={{
            fontSize: 10, color: col.color, lineHeight: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{col.label}</span>
          <span style={{
            height: 18, padding: '0 6px',
            display: 'inline-flex', alignItems: 'center', flex: '0 0 auto',
            background: 'var(--lcd-bg)',
            boxShadow: 'var(--pressed-2)',
            color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
            fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em', lineHeight: 1,
          }}>{String(col.count).padStart(2, '0')}</span>
        </div>
        <div style={{
          height: 4, background: col.color,
          boxShadow: 'inset 1px 0 0 rgba(255,255,255,.25), inset -1px 0 0 rgba(0,0,0,.3)',
        }}/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(cards[col.id] || []).map((c, i) => <LeadCard key={i} c={c} />)}
        {col.count === 0 && (
          <div style={{
            height: 72, display: 'grid', placeItems: 'center',
            background: 'var(--card)', boxShadow: 'var(--pressed-2)',
            fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 11,
            letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}>EMPTY</div>
        )}
      </div>
    </div>
  );
}

function LeadsToolbar() {
  const subs = [
    { id: 'pipeline', label: 'PIPELINE', active: true },
    { id: 'list',     label: 'LIST' },
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
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 16px 8px', gap: 16,
    }}>
      <div style={{ display: 'flex', height: 36, boxShadow: 'var(--raised-2)' }}>
        {subs.map(s => (
          <button key={s.id} className="chrome-label" style={{
            height: 36, padding: '0 16px', fontSize: 12,
            background: s.active ? 'var(--navy)' : 'transparent',
            color: s.active ? 'var(--gold)' : 'var(--text)',
            boxShadow: s.active ? 'var(--pressed-2)' : 'none',
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
          }}>{f.label}</button>
        ))}
      </div>
    </div>
  );
}

function LeadsPipeline() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <LeadsToolbar />
      <div style={{
        flex: 1,
        display: 'flex', gap: 8,
        padding: '0 16px 88px',
        overflow: 'hidden',
      }}>
        {columns.map(col => <Column key={col.id} col={col} />)}
      </div>
    </div>
  );
}

Object.assign(window, { LeadsPipeline });

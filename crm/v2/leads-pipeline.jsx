/* global React */
// Leads Pipeline — 9-column kanban

// weight: relative flex weight for this column (1 = normal, 1.5 = gets ~50%
// more horizontal space when viewport has room). Triage-heavy columns (NEW,
// QUOTED) are wider because that's where daily volume lives; quiet columns
// (RTR, PRINTED, INSPECTION) stay compact.
const columns = [
  { id: 'new',     label: 'NEW LEAD',         color: 'var(--ms-1)', count: 42, weight: 1.6 },
  { id: 'quoted',  label: 'QUOTED',           color: 'var(--ms-4)', count: 8,  weight: 1.3 },
  { id: 'booked',  label: 'BOOKED',           color: 'var(--ms-2)', count: 3,  weight: 1 },
  { id: 'permit',  label: 'PERMIT SUBMITTED', color: 'var(--ms-5)', count: 2,  weight: 1 },
  { id: 'pay',     label: 'READY TO PAY',     color: 'var(--ms-3)', count: 1,  weight: 1 },
  { id: 'paid',    label: 'PAID',             color: 'var(--ms-2)', count: 1,  weight: 1 },
  { id: 'rprint',  label: 'READY TO PRINT',   color: 'var(--ms-5)', count: 0,  weight: .8 },
  { id: 'printed', label: 'PRINTED',          color: 'var(--ms-6)', count: 1,  weight: .8 },
  { id: 'inspect', label: 'INSPECTION',       color: 'var(--ms-7)', count: 1,  weight: 1 },
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
  // Just a subtle mono number — no LCD chrome.
  // Tone shifts red past 7d, otherwise a muted gray.
  const color = n >= 7 ? 'var(--ms-3)' : 'var(--text-faint)';
  return (
    <span className="mono" style={{
      fontSize: 11, color, letterSpacing: '.02em',
    }}>{n}d</span>
  );
}

function LeadCard({ c }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        minHeight: 72, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 4,
        background: hover ? 'var(--bg)' : 'var(--card)',
        boxShadow: hover ? 'var(--raised)' : 'var(--raised-2)',
        opacity: c.dnc ? 0.55 : 1,
        transition: 'background 80ms linear, box-shadow 80ms linear',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24, background: c.dnc ? 'var(--ms-3)' : 'var(--navy)',
          clipPath: 'var(--avatar-clip)',
          display: 'grid', placeItems: 'center', flex: '0 0 auto',
        }}>
          <span style={{
            fontFamily: 'var(--font-chrome)', fontWeight: 700,
            color: 'var(--gold)', fontSize: 10, letterSpacing: '.04em',
          }}>{c.initials}</span>
        </div>
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
          color: c.overdue ? 'var(--ms-3)' : 'var(--text)',
          overflow: 'hidden',
        }}>
          {c.pinned ? <span style={{ color: 'var(--gold)', fontSize: 11, flex: '0 0 auto' }}>★</span> : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
        </div>
        <DaysChip n={c.days} />
      </div>
      {c.addr && (
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          paddingLeft: 32,
        }}>{c.addr}</div>
      )}
      {c.jurisdiction && (
        <div className="mono" style={{
          fontSize: 9, color: 'var(--text-faint)', letterSpacing: '.06em',
          paddingLeft: 32, textTransform: 'uppercase',
        }}>{c.jurisdiction}</div>
      )}
    </div>
  );
}

function Column({ col, items, count, onCardClick, onDropCard }) {
  const list = items || cards[col.id] || [];
  const displayCount = count ?? (items ? list.length : col.count);
  const [dragOver, setDragOver] = React.useState(false);
  return (
    <div
      onDragOver={e => { if (onDropCard) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        if (!onDropCard) return;
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData('text/contact-id');
        if (id) onDropCard(id, col.id);
      }}
      style={{
        // Weight-based flex: triage columns get more room when there's space,
        // but every column keeps a legible minimum so cards don't crush.
        flex: `${col.weight || 1} 1 ${col.weight && col.weight < 1 ? 140 : 200}px`,
        minWidth: col.weight && col.weight < 1 ? 140 : 200,
        display: 'flex', flexDirection: 'column', gap: 8,
        background: dragOver ? 'rgba(255,186,0,.08)' : 'transparent',
        outline: dragOver ? '2px solid var(--gold)' : 'none',
        outlineOffset: -2,
        transition: 'background var(--dur) var(--step)',
      }}>
      <div style={{
        padding: '10px 4px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        borderBottom: '1px solid rgba(0,0,0,.08)',
      }}>
        <span className="chrome-label" style={{
          fontSize: 10, color: 'var(--text-muted)', lineHeight: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          letterSpacing: '.12em',
        }}>{col.label}</span>
        <span className="mono" style={{
          fontSize: 11, color: 'var(--text-faint)', flex: '0 0 auto',
        }}>{displayCount}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingBottom: 8 }}>
        {list.map((c, i) => (
          <div
            key={c.id || i}
            draggable={!!onDropCard}
            onDragStart={e => { if (c.id && onDropCard) e.dataTransfer.setData('text/contact-id', c.id); }}
            onClick={() => onCardClick && c.id && onCardClick(c.id)}
            style={{ cursor: onCardClick ? 'pointer' : 'default' }}
          >
            <MemoLeadCard c={c} />
          </div>
        ))}
        {list.length === 0 && (
          <div style={{
            height: 56, display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-faint)',
          }}>empty</div>
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

function LeadsPipeline({ buckets, counts, onCardClick, onDropCard, toolbar }) {
  // buckets: { new: [rows], quoted: [rows], ... } OR undefined → use mock
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {toolbar || <LeadsToolbar />}
      <div style={{
        flex: 1,
        display: 'flex', gap: 8,
        padding: '0 16px 88px',
        // Let the pipeline scroll horizontally when 9 columns × minWidth can't
        // fit the viewport (common on laptops <1600px). Vertical scroll stays
        // inside each column's card list so the header stays pinned.
        overflowX: 'auto',
        overflowY: 'hidden',
      }}>
        {columns.map(col => (
          <Column
            key={col.id}
            col={col}
            items={buckets ? (buckets[col.id] || []) : undefined}
            count={counts ? counts[col.id] : undefined}
            onCardClick={onCardClick}
            onDropCard={onDropCard}
          />
        ))}
      </div>
    </div>
  );
}

// Memoize LeadCard — same card keeps rendering as the parent state churns
// (drag state, realtime fetches); keep re-renders scoped to card identity.
const MemoLeadCard = React.memo(LeadCard, (a, b) => a.c === b.c);

Object.assign(window, { LeadsPipeline, columns: columns, LeadCard: MemoLeadCard, Column });

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

// Install-date chip. Replaces DaysChip for booked contacts so the card
// answers "when am I installing this?" instead of "when did the lead come
// in?" — once you're past BOOKED the former is the actionable info.
// Renders as:
//   past-due (negative) → red
//   today (0)           → gold
//   1–6 days out        → navy
//   7+ days out         → muted gray
// Text format: "TODAY", "+1d", "+4d", "-2d", "Apr 28" (7+ days out)
function InstallChip({ n }) {
  if (typeof n !== 'number' || isNaN(n)) return null;
  let color = 'var(--text-faint)';
  let label = '';
  if (n < 0) {
    color = 'var(--ms-3)';
    label = `-${Math.abs(n)}d`;
  } else if (n === 0) {
    color = 'var(--gold)';
    label = 'TODAY';
  } else if (n <= 6) {
    color = 'var(--navy)';
    label = `+${n}d`;
  } else {
    // Show short-form date for anything a week+ out so the card still
    // gives a landmark without cluttering with "+14d".
    const d = new Date(Date.now() + n * 86400000);
    label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return (
    <span className="mono" title={`Install ${n === 0 ? 'today' : n < 0 ? `${Math.abs(n)} days ago (overdue)` : `in ${n} day${n === 1 ? '' : 's'}`}`} style={{
      fontSize: 10, color, letterSpacing: '.04em', fontWeight: 600,
      padding: '1px 5px', boxShadow: 'var(--raised-2)',
      background: 'var(--card)',
      whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function LeadCard({ c }) {
  const [hover, setHover] = React.useState(false);
  // Smart Pipeline layering: staleness flag applies a red ring, viewed-not-
  // signed quote applies a gold ring. Hover escalates normal cards to the
  // thicker raised shadow; stale/hot cards keep their smart ring so the
  // signal reads even while hovering.
  const smartRing = c.stale
    ? 'inset 0 0 0 2px var(--red)'
    : c.proposalSignal?.kind === 'viewed'
      ? 'inset 0 0 0 2px var(--gold)'
      : null;
  return (
    <div
      title={c.name + (c.addr ? '\n' + c.addr : '')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        minHeight: 72, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 4,
        background: hover ? 'var(--bg)' : 'var(--card)',
        boxShadow: smartRing
          ? `${smartRing}, ${hover ? 'var(--raised)' : 'var(--raised-2)'}`
          : (hover ? 'var(--raised)' : 'var(--raised-2)'),
        // Gold left-stripe when customer's last SMS is unreplied, matching
        // the same visual channel used on the messages inbox. Lets Key scan
        // any column and spot who's waiting on him without opening threads.
        borderLeft: c.waiting ? '3px solid var(--gold)' : '3px solid transparent',
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
          {/* Alex indicator — tiny mono tag when Alex is actively handling
              the conversation (ai_enabled + early stage). Helps Key scan and
              know "don't need to reply there, Alex has it". */}
          {c.alexActive ? (
            <span className="mono" title="Alex is handling this conversation" style={{
              padding: '1px 4px', fontSize: 8, letterSpacing: '.08em',
              color: 'var(--text-faint)', background: 'var(--bg)',
              border: '1px solid rgba(0,0,0,.15)', flex: '0 0 auto',
            }}>ALEX</span>
          ) : null}
        </div>
        {typeof c.installOffsetDays === 'number'
          ? <InstallChip n={c.installOffsetDays} />
          : <DaysChip n={c.days} />}
      </div>
      {/* Proposal "viewed but not signed" signal — peak-interest window Key
          should follow up on first. Only renders on QUOTED cards; hides once
          the customer signs and the stage jumps forward. */}
      {c.proposalSignal?.kind === 'viewed' ? (
        <div className="mono" style={{
          marginTop: 2, marginLeft: 32,
          display: 'inline-flex', alignSelf: 'flex-start',
          padding: '2px 6px',
          background: 'var(--gold)', color: 'var(--navy)',
          fontSize: 9, fontWeight: 700, letterSpacing: '.1em',
          boxShadow: 'var(--raised-2)',
        }}>
          {c.proposalSignal.age ? `VIEWED ${c.proposalSignal.age} AGO` : 'QUOTE VIEWED'}
        </div>
      ) : null}
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
  // Smart Pipeline column-level signal: average days-in-column for the
  // cards currently stacked here. Uses each card's `days` (lead age) as
  // the proxy. Stale count = cards past this column's threshold.
  const avgDays = list.length > 0
    ? Math.round(list.reduce((s, c) => s + (c.days || 0), 0) / list.length)
    : 0;
  const staleCount = list.filter(c => c.stale).length;
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
        // Weight-based flex with aggressive minWidth so all 9 columns fit
        // beside the permanent 480px right panel at 1440px viewport. At 960px
        // available width, 9 cols × 100px + gaps ≈ fits with single-word names
        // in card headers. Card contents truncate with ellipsis; full name
        // accessible by clicking into the contact.
        flex: `${col.weight || 1} 1 ${col.weight && col.weight < 1 ? 90 : 110}px`,
        minWidth: col.weight && col.weight < 1 ? 90 : 110,
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
      {/* Smart Pipeline column stats — shows average days-in-column and a
          stale badge when cards are piling up. Zero-count columns skip it. */}
      {list.length > 0 ? (
        <div style={{
          padding: '2px 4px 6px',
          display: 'flex', alignItems: 'center', gap: 6,
          borderBottom: '1px dashed rgba(0,0,0,.08)',
        }}>
          <span className="mono" title={`avg ${avgDays} days in column`} style={{
            fontSize: 9, color: 'var(--text-faint)', letterSpacing: '.04em',
          }}>avg {avgDays}d</span>
          {staleCount > 0 ? (
            <span className="smart-chip smart-chip--red" title={`${staleCount} stale card${staleCount === 1 ? '' : 's'}`}>
              {staleCount} STALE
            </span>
          ) : null}
        </div>
      ) : null}
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
        {list.length === 0 && (() => {
          // Smart pipeline empty ghost — per-column hint instead of just
          // "empty". Tells Key what the bottleneck is when a column is
          // starved.
          const GHOST = {
            new:     "No new leads — spin up an ad or chase a referral.",
            quoted:  "No quotes out — pick a NEW LEAD and press Q.",
            booked:  "Nothing booked yet — nudge the hottest quote.",
            permit:  "No permits submitted — process tomorrow's installs.",
            pay:     "Nothing waiting on payment.",
            paid:    "No paid permits today.",
            rprint:  "No permits ready to print.",
            printed: "No printed permits to pick up.",
            inspect: "No inspections scheduled.",
          };
          return (
            <div style={{
              margin: '6px 4px', padding: '12px 8px',
              display: 'flex', flexDirection: 'column', gap: 6,
              alignItems: 'center',
              border: '1px dashed rgba(0,0,0,.2)',
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-body)', fontSize: 10, lineHeight: 1.35,
              textAlign: 'center',
            }}>
              <span className="chrome-label" style={{ fontSize: 9, letterSpacing: '.1em' }}>
                empty
              </span>
              <span>{GHOST[col.id] || 'Nothing here yet.'}</span>
            </div>
          );
        })()}
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

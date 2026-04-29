/* global React */
// Leads Pipeline — 9-column kanban

// weight: relative flex weight for this column (1 = normal, 1.5 = gets ~50%
// more horizontal space when viewport has room). Triage-heavy columns (NEW,
// QUOTED) are wider because that's where daily volume lives; quiet columns
// (RTR, PRINTED, INSPECTION) stay compact.
// Pipeline columns. Label uses title case; tone maps to the brand
// status palette so every column header chip reads consistently with
// the stage chips used in leads-list, finance, permits, etc.
const columns = [
  { id: 'new',     label: 'New lead',         tone: 'navy',   color: 'var(--navy)',   count: 42, weight: 1.6 },
  { id: 'quoted',  label: 'Quoted',           tone: 'purple', color: 'var(--purple)', count: 8,  weight: 1.3 },
  { id: 'booked',  label: 'Booked',           tone: 'green',  color: 'var(--green)',  count: 3,  weight: 1 },
  { id: 'permit',  label: 'Permit submitted', tone: 'gold',   color: 'var(--gold)',   count: 2,  weight: 1 },
  { id: 'pay',     label: 'Ready to pay',     tone: 'red',    color: 'var(--red)',    count: 1,  weight: 1 },
  { id: 'paid',    label: 'Paid',             tone: 'green',  color: 'var(--green)',  count: 1,  weight: 1 },
  { id: 'rprint',  label: 'Ready to print',   tone: 'gold',   color: 'var(--gold)',   count: 0,  weight: .8 },
  { id: 'printed', label: 'Printed',          tone: 'navy',   color: 'var(--navy)',   count: 1,  weight: .8 },
  { id: 'inspect', label: 'Inspection',       tone: 'purple', color: 'var(--purple)', count: 1,  weight: 1 },
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
  const color = n >= 7 ? 'var(--red)' : 'var(--text-faint)';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color,
      fontVariantNumeric: 'tabular-nums',
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
  let tone = 'muted';
  let label = '';
  if (n < 0) { tone = 'red';    label = `-${Math.abs(n)}d`; }
  else if (n === 0) { tone = 'gold'; label = 'Today'; }
  else if (n <= 6)  { tone = 'navy'; label = `+${n}d`; }
  else {
    // Show short-form date for anything a week+ out so the card still
    // gives a landmark without cluttering with "+14d".
    const d = new Date(Date.now() + n * 86400000);
    label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    tone = 'muted';
  }
  return (
    <span className={`smart-chip smart-chip--${tone}`}
      title={`Install ${n === 0 ? 'today' : n < 0 ? `${Math.abs(n)} days ago (overdue)` : `in ${n} day${n === 1 ? '' : 's'}`}`}
      style={{ fontSize: 10, padding: '3px 8px' }}
    >{label}</span>
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
          width: 24, height: 24, background: c.dnc ? 'var(--red)' : 'var(--navy)',
          borderRadius: '50%',
          display: 'grid', placeItems: 'center', flex: '0 0 auto',
        }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontWeight: 600,
            color: '#fff', fontSize: 10, letterSpacing: '0.01em',
          }}>{c.initials}</span>
        </div>
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
          color: c.overdue ? 'var(--red)' : 'var(--text)',
          overflow: 'hidden',
        }}>
          {c.pinned ? (
            <span style={{ color: 'var(--gold)', flex: '0 0 auto', display: 'inline-grid', placeItems: 'center' }} aria-label="Pinned">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </span>
          ) : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          {/* Alex indicator — tiny pill when Alex is actively handling the
              conversation. Helps Key scan and know "don't need to reply
              there, Alex has it". */}
          {c.alexActive ? (
            <span title="Alex is handling this conversation" style={{
              padding: '1px 6px', fontSize: 9, fontWeight: 700,
              fontFamily: 'var(--font-display)', letterSpacing: '0.06em',
              color: 'var(--blue)',
              background: 'color-mix(in srgb, var(--blue) 12%, transparent)',
              borderRadius: 'var(--radius-pill)',
              flex: '0 0 auto', textTransform: 'uppercase',
            }}>Alex</span>
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
        padding: '12px 8px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        borderBottom: '2px solid ' + col.color,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--text)', lineHeight: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{col.label}</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11,
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
          padding: '1px 8px',
          background: 'var(--sunken)',
          borderRadius: 'var(--radius-pill)',
          flex: '0 0 auto',
        }}>{displayCount}</span>
      </div>
      {/* Smart Pipeline column stats — shows average days-in-column and a
          stale badge when cards are piling up. Zero-count columns skip it. */}
      {list.length > 0 ? (
        <div style={{
          padding: '2px 4px 6px',
          display: 'flex', alignItems: 'center', gap: 6,
          borderBottom: '1px dashed var(--divider)',
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
              margin: '6px 4px', padding: '14px 10px',
              display: 'flex', flexDirection: 'column', gap: 6,
              alignItems: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'var(--sunken)',
              boxShadow: 'var(--ring)',
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: 1.4,
              textAlign: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 600,
                fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>Empty</span>
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
    { id: 'pipeline', label: 'Pipeline', active: true },
    { id: 'list',     label: 'List' },
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
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 16px 10px', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{
        display: 'flex', height: 48, padding: 4,
        background: 'var(--card)',
        boxShadow: 'var(--ring)',
        borderRadius: 'var(--radius-pill)',
        maxWidth: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {subs.map(s => (
          <button key={s.id} style={{
            minHeight: 40, padding: '0 18px',
            background: s.active ? 'var(--navy)' : 'transparent',
            color: s.active ? '#fff' : 'var(--text-muted)',
            borderRadius: 'var(--radius-pill)',
            border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: s.active ? 700 : 500, fontSize: 13,
            letterSpacing: '-0.005em',
            flex: '0 0 auto',
          }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {filters.map(f => (
          <button key={f.id} style={{
            minHeight: 44, padding: '0 16px',
            background: f.active ? 'var(--navy)' : 'var(--card)',
            color: f.active ? '#fff' : 'var(--text-muted)',
            borderRadius: 'var(--radius-pill)',
            border: 'none', cursor: 'pointer',
            boxShadow: f.active ? 'none' : 'var(--ring)',
            fontFamily: 'var(--font-display)', fontWeight: f.active ? 700 : 500, fontSize: 13,
            letterSpacing: '-0.005em',
            flex: '0 0 auto',
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

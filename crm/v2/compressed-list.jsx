/* global React */
// Compressed 360px list (desktop slide-over left side) — just enough
// to show rows collapsing with Sarah M active.
// Brand-aligned 2026-04-24: pill tabs + smart-chip stage pills.

const COMPRESSED_ROWS = [
  { name: 'Sarah M',  initials: 'SM', phone: '(864) 555-0101', stage: 'QUOTED',  ts: '7d',    active: true },
  { name: 'Robert K', initials: 'RK', phone: '(864) 555-0123', stage: 'NEW',     ts: '3:12 PM' },
  { name: 'Ashley P', initials: 'AP', phone: '(864) 555-0145', stage: 'NEW',     ts: 'Yesterday' },
  { name: 'Dave H',   initials: 'DH', phone: '(864) 555-0167', stage: 'NEW',     ts: '8d',   overdue: true },
  { name: 'Mike J',   initials: 'MJ', phone: '(864) 555-0189', stage: 'QUOTED',  ts: '4d',   overdue: true },
  { name: 'Mark L',   initials: 'ML', phone: '(864) 555-0202', stage: 'BOOKED',  ts: '1d' },
  { name: 'Susan E',  initials: 'SE', phone: '(864) 555-0224', stage: 'BOOKED',  ts: '2d' },
  { name: 'Bill C',   initials: 'BC', phone: '(864) 555-0246', stage: 'PERMIT',  ts: '3d' },
  { name: 'Helen S',  initials: 'HS', phone: '(864) 555-0268', stage: 'INSPECT', ts: 'Today' },
];

// Stage short label + tone for smart-chip. Matches the system elsewhere.
const STAGE_INFO = {
  NEW:     { label: 'New',        tone: 'navy'   },
  QUOTED:  { label: 'Quoted',     tone: 'purple' },
  BOOKED:  { label: 'Booked',     tone: 'green'  },
  PERMIT:  { label: 'Permit',     tone: 'gold'   },
  PAY:     { label: 'Pay',        tone: 'red'    },
  PAID:    { label: 'Paid',       tone: 'green'  },
  PRINT:   { label: 'Printed',    tone: 'navy'   },
  INSPECT: { label: 'Inspection', tone: 'purple' },
};

function CompressedRow({ r }) {
  const info = STAGE_INFO[r.stage] || { label: r.stage, tone: 'muted' };
  return (
    <div style={{
      position: 'relative',
      minHeight: 64, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      background: r.active ? 'var(--sunken)' : 'var(--card)',
      borderBottom: '1px solid var(--divider-faint)',
      transition: 'background var(--dur) var(--ease)',
      cursor: 'pointer',
    }}
    onMouseEnter={e => { if (!r.active) e.currentTarget.style.background = 'var(--sunken)' }}
    onMouseLeave={e => { if (!r.active) e.currentTarget.style.background = 'var(--card)' }}
    >
      {r.overdue && (
        <div style={{
          position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
          background: 'var(--red)',
          borderRadius: '0 2px 2px 0',
        }}/>
      )}
      <div style={{
        width: 36, height: 36, flex: '0 0 auto',
        background: 'var(--navy)',
        borderRadius: '50%',
        display: 'grid', placeItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontWeight: 600,
          color: '#fff', fontSize: 12,
        }}>{r.initials}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
          color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{r.name}</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>{r.phone}</span>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
        flex: '0 0 auto',
      }}>
        <span className={`smart-chip smart-chip--${info.tone}`}>{info.label}</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)',
        }}>{r.ts}</span>
      </div>
    </div>
  );
}

function CompressedList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: 12,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          display: 'flex', height: 32,
          background: 'var(--card)',
          boxShadow: 'var(--ring)',
          borderRadius: 'var(--radius-pill)',
          padding: 3,
        }}>
          {['Pipeline','List','Permits','Materials'].map(s => {
            const on = s === 'List';
            return (
              <button key={s} style={{
                height: 26, padding: '0 10px',
                background: on ? 'var(--navy)' : 'transparent',
                color: on ? '#fff' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontWeight: on ? 700 : 500, fontSize: 11,
                borderRadius: 'var(--radius-pill)',
                border: 'none', cursor: 'pointer',
              }}>{s}</button>
            );
          })}
        </div>
      </div>
      <div style={{
        flex: 1, overflowY: 'auto',
        margin: '0 10px 10px',
        background: 'var(--card)',
        boxShadow: 'var(--shadow-sm), var(--ring)',
        borderRadius: 'var(--radius-md)',
        overflow: 'auto',
      }}>
        {COMPRESSED_ROWS.map((r, i) => <CompressedRow key={i} r={r} />)}
      </div>
    </div>
  );
}

Object.assign(window, { CompressedList });

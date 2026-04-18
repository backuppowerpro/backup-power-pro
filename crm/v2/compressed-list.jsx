/* global React */
// Compressed 360px list (desktop slide-over left side) — just enough
// to show rows collapsing with Sarah M active/depressed.

const COMPRESSED_ROWS = [
  { name: 'Sarah M',  initials: 'SM', phone: '(864) 555-0101', stage: 'QUOTED',  ts: '07D', active: true },
  { name: 'Robert K', initials: 'RK', phone: '(864) 555-0123', stage: 'NEW',     ts: '3:12' },
  { name: 'Ashley P', initials: 'AP', phone: '(864) 555-0145', stage: 'NEW',     ts: 'Y-DAY' },
  { name: 'Dave H',   initials: 'DH', phone: '(864) 555-0167', stage: 'NEW',     ts: '08D',  overdue: true },
  { name: 'Mike J',   initials: 'MJ', phone: '(864) 555-0189', stage: 'QUOTED',  ts: '04D',  overdue: true },
  { name: 'Mark L',   initials: 'ML', phone: '(864) 555-0202', stage: 'BOOKED',  ts: '01D' },
  { name: 'Susan E',  initials: 'SE', phone: '(864) 555-0224', stage: 'BOOKED',  ts: '02D' },
  { name: 'Bill C',   initials: 'BC', phone: '(864) 555-0246', stage: 'PERMIT',  ts: '03D' },
  { name: 'Helen S',  initials: 'HS', phone: '(864) 555-0268', stage: 'INSPECT', ts: 'TODAY' },
];

const STG = {
  NEW: 'var(--ms-1)', QUOTED: 'var(--ms-4)', BOOKED: 'var(--ms-2)',
  PERMIT: 'var(--ms-5)', PAY: 'var(--ms-3)', PAID: 'var(--ms-2)',
  PRINT: 'var(--ms-6)', INSPECT: 'var(--ms-7)',
};

function CompressedRow({ r }) {
  return (
    <div style={{
      position: 'relative',
      height: 64, padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--card)',
      boxShadow: r.active ? 'var(--pressed-2)' : 'none',
      borderBottom: '1px solid rgba(0,0,0,.08)',
    }}>
      {r.overdue && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          background: 'var(--red)',
        }}/>
      )}
      <div style={{
        width: 36, height: 36, flex: '0 0 auto',
        background: 'var(--navy)', clipPath: 'var(--avatar-clip)',
        display: 'grid', placeItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-chrome)', fontWeight: 700,
          color: 'var(--gold)', fontSize: 11, letterSpacing: '.04em',
        }}>{r.initials}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
          color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{r.name}</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>{r.phone}</span>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
        flex: '0 0 auto',
      }}>
        <span className="chrome-label" style={{
          fontSize: 9, color: STG[r.stage], lineHeight: 1,
        }}>{r.stage}</span>
        <span style={{
          fontFamily: 'var(--font-pixel)', fontSize: 13, color: 'var(--text-muted)',
          letterSpacing: '.06em',
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
        <div style={{ display: 'flex', height: 30, boxShadow: 'var(--raised-2)' }}>
          {['PIPELINE','LIST','PERMITS','MATERIALS'].map(s => {
            const on = s === 'LIST';
            return (
              <button key={s} className="chrome-label" style={{
                height: 30, padding: '0 10px', fontSize: 10,
                background: on ? 'var(--navy)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--text)',
                boxShadow: on ? 'var(--pressed-2)' : 'none',
              }}>{s}</button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', margin: '0 8px', boxShadow: 'var(--pressed-2)' }}>
        {COMPRESSED_ROWS.map((r, i) => <CompressedRow key={i} r={r} />)}
      </div>
    </div>
  );
}

Object.assign(window, { CompressedList });

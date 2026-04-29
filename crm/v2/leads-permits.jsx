/* global React */
// Leads — Permits sub-view. 7-step permit pipeline per jurisdiction.

const STEP_HEADS = ['Submit', 'Pay', 'Paid', 'Print', 'Printed', 'Inspect\u00a0sched', 'Inspect\u00a0pass'];

const PermitIcons = {
  clock: <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="3" width="10" height="10"/><path d="M8 6 L8 8 L10 10"/></svg>,
  check: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8 L7 12 L13 4"/></svg>,
  x:     <svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 4 L12 12 M12 4 L4 12"/></svg>,
};

/* ── Step cell — soft square showing progress of each permit stage ── */
function StepCell({ state, first = false, last = false }) {
  const base = {
    width: 40, height: 40,
    display: 'grid', placeItems: 'center',
    background: 'var(--card)',
    color: 'var(--text-faint)',
    borderRight: last ? 'none' : '1px solid var(--divider-faint)',
  };
  if (state === 'empty') {
    return <div style={{ ...base, background: 'var(--sunken)' }} />;
  }
  if (state === 'progress') {
    return (
      <div style={{
        ...base,
        background: 'color-mix(in srgb, var(--gold) 14%, var(--card))',
        color: 'var(--gold)',
      }}>
        {PermitIcons.clock}
      </div>
    );
  }
  if (state === 'done') {
    return (
      <div style={{
        ...base,
        background: 'color-mix(in srgb, var(--green) 14%, var(--card))',
        color: 'var(--green)',
      }}>
        {PermitIcons.check}
      </div>
    );
  }
  if (state === 'blocked') {
    return (
      <div style={{
        ...base,
        background: 'color-mix(in srgb, var(--red) 16%, var(--card))',
        color: 'var(--red)',
      }}>
        {PermitIcons.x}
      </div>
    );
  }
  return <div style={base} />;
}

function StepRow({ cells }) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--ring)',
      overflow: 'hidden',
    }}>
      {cells.map((s, i) => <StepCell key={i} state={s} last={i === cells.length - 1} first={i === 0} />)}
    </div>
  );
}

const ROWS = [
  { name: 'Sarah M',  initials:'SM', jur: null,        cells: Array(7).fill('empty'),
    action: { kind: 'amber', label: 'Set jurisdiction' } },
  { name: 'Mike J',   initials:'MJ', jur: 'Greenville County',
    cells: ['done','done','blocked','empty','empty','empty','empty'],
    action: { kind: 'blocked', label: 'Blocked — call county' } },
  { name: 'Robert K', initials:'RK', jur: 'Greenville County',
    cells: ['done','done','progress','empty','empty','empty','empty'],
    action: { kind: 'wait',  label: 'Awaiting payment' } },
  { name: 'Mark L',   initials:'ML', jur: 'Greenville County',
    cells: ['done','done','done','done','progress','empty','empty'],
    action: { kind: 'wait',  label: 'Ready to print' } },
  { name: 'Bill C',   initials:'BC', jur: 'Spartanburg County',
    cells: ['done','empty','empty','empty','empty','empty','empty'],
    action: { kind: 'wait',  label: 'Pay to Spartanburg' } },
  { name: 'Paul R',   initials:'PR', jur: 'Spartanburg County',
    cells: ['done','done','empty','empty','empty','empty','empty'],
    action: { kind: 'wait',  label: 'Pay to Spartanburg' } },
  { name: 'Carl W',   initials:'CW', jur: 'Greenville County',
    cells: ['done','done','done','done','done','done','empty'],
    action: { kind: 'wait',  label: 'Schedule inspection' } },
  { name: 'Helen S',  initials:'HS', jur: 'Pickens County',
    cells: ['done','done','done','done','done','done','progress'],
    action: { kind: 'today', label: 'Inspection today' } },
];

function JurisCell({ jur }) {
  if (!jur) {
    return <span className="smart-chip smart-chip--gold">No jurisdiction</span>;
  }
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12,
      color: 'var(--text-muted)',
    }}>{jur}</span>
  );
}

function ActionCell({ action }) {
  if (action.kind === 'amber') {
    return (
      <button style={{
        minHeight: 44, padding: '0 18px',
        background: 'var(--gold)', color: 'var(--navy)',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
        letterSpacing: '0.01em',
        borderRadius: 'var(--radius-pill)',
        boxShadow: 'var(--shadow-gold)',
        border: 'none', cursor: 'pointer',
        transition: 'background var(--dur) var(--ease)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--gold)' }}
      >{action.label}</button>
    );
  }
  if (action.kind === 'blocked') {
    return <span className="smart-chip smart-chip--red">{action.label}</span>;
  }
  if (action.kind === 'today') {
    return <span className="smart-chip smart-chip--green">{action.label}</span>;
  }
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12,
      color: 'var(--text-muted)',
    }}>{action.label}</span>
  );
}

function MiniAvatar({ initials }) {
  return (
    <div style={{
      width: 30, height: 30, flex: '0 0 auto',
      background: 'var(--navy)',
      borderRadius: '50%',
      display: 'grid', placeItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-body)', fontWeight: 600,
        color: '#fff', fontSize: 11,
      }}>{initials}</span>
    </div>
  );
}

function PermitsToolbar() {
  const subs = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'list',     label: 'List' },
    { id: 'permits',  label: 'Permits', active: true },
    { id: 'mat',      label: 'Materials' },
  ];
  const jurs = [
    { id: 'all', label: 'All', active: true },
    { id: 'gv',  label: 'Greenville' },
    { id: 'sb',  label: 'Spartanburg' },
    { id: 'pk',  label: 'Pickens' },
  ];
  const stat = [
    { id: 'ns',  label: 'Not started' },
    { id: 'ip',  label: 'In progress', active: true },
    { id: 'cp',  label: 'Complete' },
  ];
  const pillStyle = (active) => ({
    minHeight: 44, padding: '0 16px',
    background: active ? 'var(--navy)' : 'var(--card)',
    color: active ? '#fff' : 'var(--text-muted)',
    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
    letterSpacing: '0.01em',
    borderRadius: 'var(--radius-pill)',
    boxShadow: active ? 'var(--shadow-sm)' : 'var(--ring)',
    border: 'none', cursor: 'pointer',
    flex: '0 0 auto',
    transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
  });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      padding: '16px 16px 10px',
    }}>
      <div style={{
        display: 'flex', height: 52,
        background: 'var(--card)',
        boxShadow: 'var(--ring)',
        borderRadius: 'var(--radius-pill)',
        padding: 4,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {subs.map(s => (
          <button key={s.id} style={{
            ...pillStyle(s.active),
            minHeight: 44, boxShadow: s.active ? 'var(--shadow-sm)' : 'none',
            background: s.active ? 'var(--navy)' : 'transparent',
          }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {jurs.map(f => (<button key={f.id} style={pillStyle(f.active)}>{f.label}</button>))}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {stat.map(f => (<button key={f.id} style={pillStyle(f.active)}>{f.label}</button>))}
      </div>
    </div>
  );
}

function CornerBadges() {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '0 16px 8px',
      justifyContent: 'flex-end',
    }}>
      <span className="smart-chip smart-chip--green" style={{ height: 28, fontSize: 11 }}>8 active permits</span>
      <span className="smart-chip smart-chip--red"   style={{ height: 28, fontSize: 11 }}>1 blocked</span>
    </div>
  );
}

/* ────────── Desktop table ────────── */
function PermitsDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PermitsToolbar />
      <CornerBadges />
      <div style={{ padding: '0 16px 88px', flex: 1, overflow: 'auto' }}>
        <div style={{
          background: 'var(--card)',
          boxShadow: 'var(--shadow-sm), var(--ring)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '200px 200px auto 220px',
            height: 42, alignItems: 'center',
            padding: '0 18px',
            borderBottom: '1px solid var(--divider-faint)',
            background: 'var(--sunken)',
          }}>
            {['Customer','Jurisdiction'].map((h, i) => (
              <span key={i} style={{
                fontFamily: 'var(--font-display)', fontWeight: 600,
                fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>{h}</span>
            ))}
            <div style={{ display: 'flex', gap: 0, justifyContent: 'center' }}>
              {STEP_HEADS.map((s, i) => (
                <span key={i} style={{
                  width: 40,
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase',
                  color: 'var(--text-muted)', textAlign: 'center',
                }}>{s}</span>
              ))}
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 600,
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-muted)', textAlign: 'right',
            }}>Action</span>
          </div>

          {/* Data rows */}
          {ROWS.map((r, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '200px 200px auto 220px',
              minHeight: 68, alignItems: 'center',
              padding: '12px 18px',
              borderBottom: i < ROWS.length - 1 ? '1px solid var(--divider-faint)' : 'none',
              background: 'var(--card)',
              gap: 12,
              transition: 'background var(--dur) var(--ease)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--sunken)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MiniAvatar initials={r.initials} />
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                  color: 'var(--text)',
                }}>{r.name}</span>
              </div>
              <JurisCell jur={r.jur} />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <StepRow cells={r.cells} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <ActionCell action={r.action} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────── Mobile list ────────── */
function PermitsMobile() {
  const subs = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'list',     label: 'List' },
    { id: 'permits',  label: 'Permits', active: true },
    { id: 'mat',      label: 'Materials' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '14px 12px 6px' }}>
        <div style={{
          display: 'flex', height: 48,
          background: 'var(--card)',
          boxShadow: 'var(--ring)',
          borderRadius: 'var(--radius-pill)',
          padding: 4,
          alignSelf: 'flex-start',
          maxWidth: '100%',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          {subs.map(s => (
            <button key={s.id} style={{
              minHeight: 40, padding: '0 16px',
              background: s.active ? 'var(--navy)' : 'transparent',
              color: s.active ? '#fff' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)',
              fontWeight: s.active ? 700 : 500, fontSize: 13,
              borderRadius: 'var(--radius-pill)',
              border: 'none', cursor: 'pointer',
              flex: '0 0 auto',
            }}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '6px 12px', display: 'flex', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <span className="smart-chip smart-chip--green">8 active</span>
        <span className="smart-chip smart-chip--red">1 blocked</span>
      </div>
      <div style={{
        flex: 1, overflowY: 'auto',
        margin: '6px 10px calc(96px + env(safe-area-inset-bottom))',
        boxShadow: 'var(--shadow-sm), var(--ring)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--card)',
        overflow: 'auto',
      }}>
        {ROWS.map((r, i) => (
          <div key={i} style={{
            padding: '14px 14px',
            borderBottom: i < ROWS.length - 1 ? '1px solid var(--divider-faint)' : 'none',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <MiniAvatar initials={r.initials} />
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
                color: 'var(--text)', flex: 1,
              }}>{r.name}</span>
              <JurisCell jur={r.jur} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ overflowX: 'auto', flex: '0 0 auto' }}>
                <StepRow cells={r.cells} />
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <ActionCell action={r.action} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { PermitsDesktop, PermitsMobile });

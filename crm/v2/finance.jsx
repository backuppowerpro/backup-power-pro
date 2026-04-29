/* global React */
// Finance — Proposals / Invoices / Payments sub-views

const FinIcons = {
  bell: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 11 L12 11 M5 11 L5 7 A3 3 0 0 1 11 7 L11 11 M7 13 L9 13"/></svg>,
};

function KPI({ tone, big, label, mono = false }) {
  const TONES = {
    red:   { color: 'var(--red)'   },
    green: { color: 'var(--green)' },
    amber: { color: 'var(--gold)'  },
  };
  const t = TONES[tone] || { color: 'var(--text)' };
  return (
    <div style={{
      width: 240, background: 'var(--card)',
      padding: '16px 18px',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-sm), var(--ring)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}>{label}</span>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: 34, letterSpacing: '-0.02em',
        color: t.color, lineHeight: 1.05,
        fontVariantNumeric: 'tabular-nums',
      }}>{big}</div>
    </div>
  );
}

function FinBadges() {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '0 16px 8px', justifyContent: 'flex-end' }}>
      {[
        { label:'9 active proposals', tone: 'green' },
        { label:'$21,982 MTD',        tone: 'green' },
      ].map((b, i) => (
        <span key={i} className={`smart-chip smart-chip--${b.tone}`} style={{ height: 28, fontSize: 11 }}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

function SubTabs({ active = 'prop' }) {
  const subs = [
    { id: 'prop', label: 'Proposals' },
    { id: 'inv',  label: 'Invoices' },
    { id: 'pay',  label: 'Payments' },
  ];
  return (
    <div style={{ display: 'flex', padding: '0 16px', gap: 0,
      borderBottom: '1px solid var(--divider)' }}>
      {subs.map(s => {
        const on = s.id === active;
        return (
          <button key={s.id} style={{
            height: 44, padding: '0 18px',
            color: on ? 'var(--navy)' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: on ? 700 : 500,
            fontSize: 13,
            letterSpacing: '0.01em',
            boxShadow: on ? 'inset 0 -2px 0 var(--gold)' : 'none',
            background: 'transparent', border: 'none', cursor: 'pointer',
            transition: 'color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
          }}>{s.label}</button>
        );
      })}
    </div>
  );
}

function MiniAv({ initials, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, flex: '0 0 auto',
      background: 'var(--navy)',
      borderRadius: '50%',
      display: 'grid', placeItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-body)', fontWeight: 600,
        color: '#fff', fontSize: size >= 32 ? 12 : 10,
        letterSpacing: '0.01em',
      }}>
        {initials}
      </span>
    </div>
  );
}

function StatusPill({ s }) {
  // Map uppercase shorthand to the brand-aligned tone + sentence case label.
  const MAP = {
    SENT:     { tone: 'navy',   label: 'Sent' },
    VIEWED:   { tone: 'purple', label: 'Viewed' },
    APPROVED: { tone: 'green',  label: 'Approved' },
    EXPIRED:  { tone: 'gold',   label: 'Expired' },
    DECLINED: { tone: 'red',    label: 'Declined' },
    PAID:     { tone: 'green',  label: 'Paid' },
    OVERDUE:  { tone: 'red',    label: 'Overdue' },
  };
  const m = MAP[s] || { tone: 'muted', label: (s || '').charAt(0) + (s || '').slice(1).toLowerCase() };
  return <span className={`smart-chip smart-chip--${m.tone}`}>{m.label}</span>;
}

function Bell({ n }) {
  return (
    <div style={{
      width: 44, height: 44,
      display: 'grid', placeItems: 'center',
      background: 'var(--card)',
      boxShadow: 'var(--ring)',
      borderRadius: 'var(--radius-pill)',
      color: n > 0 ? 'var(--navy)' : 'var(--text-faint)',
      position: 'relative',
    }}>
      {FinIcons.bell}
      {n > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          minWidth: 16, height: 16, padding: '0 5px',
          background: 'var(--red)', color: '#fff',
          borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10,
          display: 'grid', placeItems: 'center',
          fontVariantNumeric: 'tabular-nums',
          boxShadow: 'var(--shadow-xs)',
        }}>{n}</span>
      )}
    </div>
  );
}

function ActionBtn({ label, tone = 'flat' }) {
  const TONES = {
    flat:  { bg: 'var(--card)',  fg: 'var(--text)',  shadow: 'var(--ring)',        hoverBg: 'var(--sunken)' },
    navy:  { bg: 'var(--navy)',  fg: '#fff',         shadow: 'var(--shadow-sm)',   hoverBg: '#0d2547' },
    amber: { bg: 'var(--gold)',  fg: 'var(--navy)',  shadow: 'var(--shadow-gold)', hoverBg: 'var(--gold-hover)' },
    red:   { bg: 'var(--red)',   fg: '#fff',         shadow: 'var(--shadow-sm)',   hoverBg: '#b91c1c' },
    green: { bg: 'var(--green)', fg: '#fff',         shadow: 'var(--shadow-sm)',   hoverBg: '#059669' },
  };
  const t = TONES[tone] || TONES.flat;
  // Normalize label: ALL CAPS input → Title case output so the button row
  // doesn't shout. Short enough that we can do this inline.
  const niceLabel = (label || '').length <= 2 || (label || '').match(/[a-z]/)
    ? label
    : (label || '').charAt(0) + (label || '').slice(1).toLowerCase();
  return (
    <button style={{
      minHeight: 44, padding: '0 18px',
      background: t.bg, color: t.fg,
      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
      letterSpacing: '0.01em',
      borderRadius: 'var(--radius-pill)',
      boxShadow: t.shadow,
      border: 'none', cursor: 'pointer',
      transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = t.hoverBg }}
    onMouseLeave={e => { e.currentTarget.style.background = t.bg }}
    >{niceLabel}</button>
  );
}

const PROPOSALS = [
  { name:'Sarah M',  i:'SM', sent:'APR 14', st:'VIEWED',   total:1497, bell:2, actions:[['VIEW','flat'],['RESEND','navy']] },
  { name:'Robert K', i:'RK', sent:'APR 13', st:'APPROVED', total:1197, bell:0, actions:[['VIEW','flat']] },
  { name:'Mark L',   i:'ML', sent:'APR 15', st:'SENT',     total:1497, bell:0, actions:[['VIEW','flat'],['RESEND','navy']] },
  { name:'Mike J',   i:'MJ', sent:'APR 12', st:'EXPIRED',  total:1497, bell:3, actions:[['VIEW','flat'],['RESEND','amber']] },
  { name:'Helen S',  i:'HS', sent:'APR 16', st:'APPROVED', total:1872, bell:0, actions:[['VIEW','flat']] },
  { name:'Carl W',   i:'CW', sent:'APR 14', st:'DECLINED', total:1197, bell:0, actions:[['VIEW','red']] },
];

const INVOICES = [
  { name:'Robert K', i:'RK', sent:'APR 13', st:'PAID',    total:1197, paid:true,  bell:0, actions:[['RECEIPT','flat']] },
  { name:'Helen S',  i:'HS', sent:'APR 16', st:'SENT',    total:1872, paid:false, bell:1, actions:[['VIEW','flat'],['REMIND','navy']] },
  { name:'Mark L',   i:'ML', sent:'APR 08', st:'PAID',    total:1497, paid:true,  bell:0, actions:[['RECEIPT','flat']] },
  { name:'Dave H',   i:'DH', sent:'APR 02', st:'OVERDUE', total:1497, paid:false, bell:4, actions:[['VIEW','flat'],['REMIND','amber']] },
  { name:'Susan E',  i:'SE', sent:'APR 11', st:'SENT',    total:1197, paid:false, bell:0, actions:[['VIEW','flat'],['REMIND','navy']] },
];

const PAYMENTS = [
  { date:'APR 16', name:'Robert K', method:'CARD · VISA ·· 4411', amount:1197 },
  { date:'APR 15', name:'Mark L',   method:'ACH · CHASE',          amount:1497 },
  { date:'APR 14', name:'Ashley P', method:'CARD · MC ·· 0921',    amount: 897 },
  { date:'APR 12', name:'Mary K',   method:'CASH',                 amount:1197 },
  { date:'APR 10', name:'Tom B',    method:'ACH · BOFA',           amount:1200 },
];

const money = n => '$' + n.toLocaleString('en-US');

function ProposalsTable() {
  return (
    <div style={{
      margin: 16,
      background: 'var(--card)',
      boxShadow: 'var(--shadow-sm), var(--ring)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 90px 120px 110px 60px 200px',
        height: 40, alignItems: 'center', padding: '0 18px', gap: 12,
        borderBottom: '1px solid var(--divider-faint)',
        background: 'var(--sunken)',
      }}>
        {['Customer','Sent','Status','Total','','Actions'].map((h, i) => (
          <span key={i} style={{
            fontFamily: 'var(--font-display)', fontWeight: 600,
            fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
            textAlign: i >= 3 && i !== 3 ? (i === 5 ? 'right' : 'center') : i === 3 ? 'right' : 'left',
          }}>{h}</span>
        ))}
      </div>
      {PROPOSALS.map((r, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '260px 90px 120px 110px 60px 200px',
          height: 64, alignItems: 'center', padding: '0 18px', gap: 12,
          borderBottom: i < PROPOSALS.length - 1 ? '1px solid var(--divider-faint)' : 'none',
          transition: 'background var(--dur) var(--ease)',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--sunken)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MiniAv initials={r.i} size={32} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', letterSpacing: 0 }}>{r.sent}</span>
          <StatusPill s={r.st} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
            textAlign: 'right', fontVariantNumeric: 'tabular-nums',
            color: 'var(--text)',
          }}>{money(r.total)}</span>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Bell n={r.bell} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            {r.actions.map((a, j) => <ActionBtn key={j} label={a[0]} tone={a[1]} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoicesTable() {
  return (
    <div style={{
      margin: 16,
      background: 'var(--card)',
      boxShadow: 'var(--shadow-sm), var(--ring)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 90px 120px 140px 60px 200px',
        height: 40, alignItems: 'center', padding: '0 18px', gap: 12,
        borderBottom: '1px solid var(--divider-faint)',
        background: 'var(--sunken)',
      }}>
        {['Customer','Sent','Status','Total',' ','Actions'].map((h, i) => (
          <span key={i} style={{
            fontFamily: 'var(--font-display)', fontWeight: 600,
            fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
            textAlign: i === 3 ? 'right' : i === 5 ? 'right' : 'left',
          }}>{h}</span>
        ))}
      </div>
      {INVOICES.map((r, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '260px 90px 120px 140px 60px 200px',
          height: 64, alignItems: 'center', padding: '0 18px', gap: 12,
          borderBottom: i < INVOICES.length - 1 ? '1px solid var(--divider-faint)' : 'none',
          transition: 'background var(--dur) var(--ease)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--sunken)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MiniAv initials={r.i} size={32} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{r.sent}</span>
          <StatusPill s={r.st} />
          <span style={{
            justifySelf: 'end',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
            color: r.paid ? 'var(--green)' : 'var(--text)',
          }}>{money(r.total)}</span>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Bell n={r.bell} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            {r.actions.map((a, j) => <ActionBtn key={j} label={a[0]} tone={a[1]} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentsFeed() {
  const total = PAYMENTS.reduce((s, p) => s + p.amount, 0);
  return (
    <div style={{
      margin: 16,
      background: 'var(--card)',
      boxShadow: 'var(--shadow-sm), var(--ring)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '90px 260px 1fr 160px',
        height: 40, alignItems: 'center', padding: '0 18px', gap: 12,
        borderBottom: '1px solid var(--divider-faint)',
        background: 'var(--sunken)',
      }}>
        {['Date','Customer','Method','Amount'].map((h, i) => (
          <span key={i} style={{
            fontFamily: 'var(--font-display)', fontWeight: 600,
            fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
            textAlign: i === 3 ? 'right' : 'left',
          }}>{h}</span>
        ))}
      </div>
      {PAYMENTS.map((p, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '90px 260px 1fr 160px',
          height: 60, alignItems: 'center', padding: '0 18px', gap: 12,
          borderBottom: '1px solid var(--divider-faint)',
          transition: 'background var(--dur) var(--ease)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--sunken)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{p.date}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MiniAv initials={p.name.split(' ').map(w=>w[0]).join('')} size={32} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{p.method}</span>
          <span style={{
            justifySelf: 'end',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
            color: 'var(--green)',
          }}>+{money(p.amount)}</span>
        </div>
      ))}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '90px 260px 1fr 160px',
        height: 52, alignItems: 'center', padding: '0 18px', gap: 12,
        background: 'var(--sunken)',
        borderTop: '1px solid var(--divider)',
      }}>
        <span />
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
          letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text)',
        }}>Week total</span>
        <span />
        <span style={{
          justifySelf: 'end',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
          color: 'var(--green)',
        }}>+{money(total)}</span>
      </div>
    </div>
  );
}

/* ─────────── DESKTOP shells ─────────── */
function FinanceDesktop({ view = 'prop' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 16px 8px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KPI tone="red"   big="$3,482" label="Outstanding" />
        <KPI tone="green" big="$5,988" label="Paid this week" />
        <KPI tone="amber" big="3"      label="Awaiting deposit" />
        <KPI tone="red"   big="0"      label="Overdue" />
      </div>
      <FinBadges />
      <SubTabs active={view} />
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 80 }}>
        {view === 'prop' && <ProposalsTable />}
        {view === 'inv'  && <InvoicesTable />}
        {view === 'pay'  && <PaymentsFeed />}
      </div>
    </div>
  );
}

/* ─────────── MOBILE ─────────── */
function FinanceMobile({ view = 'prop' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { tone:'red',   big:'$3.4k', label:'Outstanding' },
          { tone:'green', big:'$5.9k', label:'Paid week' },
          { tone:'amber', big:'3',     label:'Deposits' },
          { tone:'red',   big:'0',     label:'Overdue' },
        ].map((k, i) => {
          const toneColor = k.tone === 'red' ? 'var(--red)' : k.tone === 'green' ? 'var(--green)' : 'var(--gold)';
          return (
            <div key={i} style={{
              background: 'var(--card)', padding: 14,
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm), var(--ring)',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 600,
                fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>{k.label}</span>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24,
                letterSpacing: '-0.02em', lineHeight: 1.1,
                color: toneColor, fontVariantNumeric: 'tabular-nums',
              }}>{k.big}</div>
            </div>
          );
        })}
      </div>
      <SubTabs active={view} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px calc(96px + env(safe-area-inset-bottom))' }}>
        {view === 'prop' && PROPOSALS.map((r, i) => (
          <div key={i} style={{
            background: 'var(--card)', boxShadow: 'var(--shadow-sm), var(--ring)',
            borderRadius: 'var(--radius-md)',
            padding: 14, marginBottom: 10,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <MiniAv initials={r.i} size={36} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{r.name}</span>
              <Bell n={r.bell} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <StatusPill s={r.st} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{r.sent}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                color: 'var(--text)', fontVariantNumeric: 'tabular-nums',
              }}>{money(r.total)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {r.actions.map((a, j) => <ActionBtn key={j} label={a[0]} tone={a[1]} />)}
            </div>
          </div>
        ))}
        {view === 'inv' && INVOICES.map((r, i) => (
          <div key={i} style={{
            background: 'var(--card)', boxShadow: 'var(--shadow-sm), var(--ring)',
            borderRadius: 'var(--radius-md)',
            padding: 14, marginBottom: 10,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <MiniAv initials={r.i} size={36} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{r.name}</span>
              <StatusPill s={r.st} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{r.sent}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
                color: r.paid ? 'var(--green)' : 'var(--text)',
              }}>{money(r.total)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {r.actions.map((a, j) => <ActionBtn key={j} label={a[0]} tone={a[1]} />)}
            </div>
          </div>
        ))}
        {view === 'pay' && PAYMENTS.map((p, i) => (
          <div key={i} style={{
            background: 'var(--card)', boxShadow: 'var(--shadow-sm), var(--ring)',
            borderRadius: 'var(--radius-md)',
            padding: 14, marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{p.date}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{p.method}</div>
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
              fontVariantNumeric: 'tabular-nums', color: 'var(--green)',
            }}>+{money(p.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { FinanceDesktop, FinanceMobile });

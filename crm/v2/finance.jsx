/* global React */
// Finance — Proposals / Invoices / Payments sub-views

const FinIcons = {
  bell: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 11 L12 11 M5 11 L5 7 A3 3 0 0 1 11 7 L11 11 M7 13 L9 13"/></svg>,
};

function KPI({ tone, big, label, mono = false }) {
  const TONES = {
    red:   { color: 'var(--lcd-red)',   glow: 'var(--lcd-glow-red)'   },
    green: { color: 'var(--lcd-green)', glow: 'var(--lcd-glow-green)' },
    amber: { color: 'var(--lcd-amber)', glow: 'var(--lcd-glow-amber)' },
  };
  const t = TONES[tone];
  return (
    <div className="tactile-raised" style={{
      width: 240, height: 88, background: 'var(--card)',
      padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        flex: 1, background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: t.color, textShadow: t.glow,
        fontFamily: 'var(--font-pixel)', fontSize: 34, letterSpacing: '.04em',
      }}>{big}</div>
      <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{label}</span>
    </div>
  );
}

function FinBadges() {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 16px 8px', justifyContent: 'flex-end' }}>
      {[
        { label:'9 ACTIVE PROPOSALS', color:'var(--lcd-green)', glow:'var(--lcd-glow-green)' },
        { label:'$21,982 MTD',        color:'var(--lcd-green)', glow:'var(--lcd-glow-green)' },
      ].map((b, i) => (
        <span key={i} style={{
          height: 26, padding: '0 10px',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
          color: b.color, textShadow: b.glow,
          fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
        }}>◆ {b.label}</span>
      ))}
    </div>
  );
}

function SubTabs({ active = 'prop' }) {
  const subs = [
    { id: 'prop', label: 'PROPOSALS' },
    { id: 'inv',  label: 'INVOICES' },
    { id: 'pay',  label: 'PAYMENTS' },
  ];
  return (
    <div style={{ display: 'flex', padding: '0 16px', gap: 0,
      borderBottom: '1px solid rgba(0,0,0,.08)' }}>
      {subs.map(s => {
        const on = s.id === active;
        return (
          <button key={s.id} className="chrome-label" style={{
            height: 40, padding: '0 18px', fontSize: 12,
            color: on ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: on ? 'inset 0 -3px 0 var(--gold)' : 'none',
            background: 'transparent',
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
      background: 'var(--navy)', clipPath: 'var(--avatar-clip)',
      display: 'grid', placeItems: 'center',
    }}>
      <span style={{ fontFamily: 'var(--font-chrome)', fontWeight: 700, color: 'var(--gold)', fontSize: 10 }}>
        {initials}
      </span>
    </div>
  );
}

function StatusPill({ s }) {
  const MAP = {
    SENT:     { bg: 'var(--ms-1)' },
    VIEWED:   { bg: 'var(--ms-4)' },
    APPROVED: { bg: 'var(--ms-2)' },
    EXPIRED:  { bg: 'var(--ms-5)' },
    DECLINED: { bg: 'var(--ms-3)' },
    PAID:     { bg: 'var(--ms-2)' },
    OVERDUE:  { bg: 'var(--ms-3)' },
  };
  const m = MAP[s];
  return (
    <span style={{
      height: 22, padding: '0 8px',
      display: 'inline-flex', alignItems: 'center',
      background: m.bg, color: '#fff',
      fontFamily: 'var(--font-chrome)', fontWeight: 700,
      fontSize: 10, letterSpacing: '.1em',
      boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.25), inset -1px -1px 0 rgba(0,0,0,.35)',
    }}>{s}</span>
  );
}

function Bell({ n }) {
  return (
    <div className="tactile-raised" style={{
      width: 32, height: 32,
      display: 'grid', placeItems: 'center', background: 'var(--card)',
      color: n > 0 ? 'var(--text)' : 'var(--text-faint)',
      position: 'relative',
    }}>
      {FinIcons.bell}
      {n > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          minWidth: 16, height: 16, padding: '0 3px',
          background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
          color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
          fontFamily: 'var(--font-pixel)', fontSize: 12,
          display: 'grid', placeItems: 'center',
        }}>{String(n).padStart(2,'0')}</span>
      )}
    </div>
  );
}

function ActionBtn({ label, tone = 'flat' }) {
  const TONES = {
    flat:  { bg: 'var(--card)',  fg: 'var(--text)' },
    navy:  { bg: 'var(--navy)',  fg: 'var(--gold)' },
    amber: { bg: 'var(--gold)',  fg: '#1a1a1a' },
    red:   { bg: 'var(--red)',   fg: '#fff' },
    green: { bg: 'var(--green)', fg: '#06201a' },
  };
  const t = TONES[tone];
  return (
    <button className="tactile-raised" style={{
      height: 28, padding: '0 10px',
      background: t.bg, color: t.fg,
      fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
    }}>{label}</button>
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
      margin: '16px',
      background: 'var(--card)', boxShadow: 'var(--pressed-2)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 90px 120px 110px 60px 200px',
        height: 36, alignItems: 'center', padding: '0 14px', gap: 12,
        borderBottom: '1px solid rgba(0,0,0,.15)',
      }}>
        {['CUSTOMER','SENT','STATUS','TOTAL','BELL','ACTION'].map((h, i) => (
          <span key={i} className="chrome-label" style={{
            fontSize: 10, color: 'var(--text-muted)',
            textAlign: i >= 3 && i !== 3 ? (i === 5 ? 'right' : 'center') : i === 3 ? 'right' : 'left',
          }}>{h === 'BELL' ? '' : h}</span>
        ))}
      </div>
      {PROPOSALS.map((r, i) => (
        <div key={i} className="tactile-flat" style={{
          display: 'grid',
          gridTemplateColumns: '260px 90px 120px 110px 60px 200px',
          height: 60, alignItems: 'center', padding: '0 14px', gap: 12,
          borderBottom: i < PROPOSALS.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MiniAv initials={r.i} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 15, color: 'var(--text-muted)', letterSpacing: '.06em' }}>{r.sent}</span>
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
      margin: '16px',
      background: 'var(--card)', boxShadow: 'var(--pressed-2)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 90px 120px 140px 60px 200px',
        height: 36, alignItems: 'center', padding: '0 14px', gap: 12,
        borderBottom: '1px solid rgba(0,0,0,.15)',
      }}>
        {['CUSTOMER','SENT','STATUS','TOTAL',' ','ACTION'].map((h, i) => (
          <span key={i} className="chrome-label" style={{
            fontSize: 10, color: 'var(--text-muted)',
            textAlign: i === 3 ? 'right' : i === 5 ? 'right' : 'left',
          }}>{h}</span>
        ))}
      </div>
      {INVOICES.map((r, i) => (
        <div key={i} className="tactile-flat" style={{
          display: 'grid',
          gridTemplateColumns: '260px 90px 120px 140px 60px 200px',
          height: 60, alignItems: 'center', padding: '0 14px', gap: 12,
          borderBottom: i < INVOICES.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MiniAv initials={r.i} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 15, color: 'var(--text-muted)', letterSpacing: '.06em' }}>{r.sent}</span>
          <StatusPill s={r.st} />
          <span style={{
            display: 'inline-flex', justifyContent: 'flex-end', height: 28,
            padding: '0 10px', alignItems: 'center',
            background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
            color: r.paid ? 'var(--lcd-green)' : 'var(--lcd-red)',
            textShadow: r.paid ? 'var(--lcd-glow-green)' : 'var(--lcd-glow-red)',
            fontFamily: 'var(--font-pixel)', fontSize: 18,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em',
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
      margin: '16px',
      background: 'var(--card)', boxShadow: 'var(--pressed-2)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '90px 260px 1fr 160px',
        height: 36, alignItems: 'center', padding: '0 14px', gap: 12,
        borderBottom: '1px solid rgba(0,0,0,.15)',
      }}>
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>DATE</span>
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>CUSTOMER</span>
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>METHOD</span>
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>AMOUNT</span>
      </div>
      {PAYMENTS.map((p, i) => (
        <div key={i} className="tactile-flat" style={{
          display: 'grid',
          gridTemplateColumns: '90px 260px 1fr 160px',
          height: 56, alignItems: 'center', padding: '0 14px', gap: 12,
          borderBottom: '1px solid rgba(0,0,0,.08)',
        }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 15, color: 'var(--text)', letterSpacing: '.06em' }}>{p.date}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MiniAv initials={p.name.split(' ').map(w=>w[0]).join('')} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{p.method}</span>
          <span style={{
            display: 'inline-flex', justifyContent: 'flex-end', height: 28,
            padding: '0 10px', alignItems: 'center',
            background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
            color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)',
            fontFamily: 'var(--font-pixel)', fontSize: 18,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em',
          }}>+{money(p.amount)}</span>
        </div>
      ))}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '90px 260px 1fr 160px',
        height: 48, alignItems: 'center', padding: '0 14px', gap: 12,
        background: 'rgba(11,31,59,.04)',
      }}>
        <span />
        <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text)' }}>WEEK TOTAL</span>
        <span />
        <span style={{
          display: 'inline-flex', justifyContent: 'flex-end', height: 32,
          padding: '0 10px', alignItems: 'center',
          background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
          color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)',
          fontFamily: 'var(--font-pixel)', fontSize: 22,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em',
        }}>{money(total)}</span>
      </div>
    </div>
  );
}

/* ─────────── DESKTOP shells ─────────── */
function FinanceDesktop({ view = 'prop' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 16px 8px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KPI tone="red"   big="$3,482"  label="OUTSTANDING" />
        <KPI tone="green" big="$5,988"  label="PAID THIS WEEK" />
        <KPI tone="amber" big="03"      label="AWAITING DEPOSIT" />
        <KPI tone="red"   big="00"      label="OVERDUE" />
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
      <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { tone:'red',   big:'$3.4k', label:'OUTSTANDING' },
          { tone:'green', big:'$5.9k', label:'PAID WK' },
          { tone:'amber', big:'03',    label:'DEPOSITS' },
          { tone:'red',   big:'00',    label:'OVERDUE' },
        ].map((k, i) => (
          <div key={i} className="tactile-raised" style={{
            height: 72, background: 'var(--card)', padding: 8,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{
              flex: 1, background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
              display: 'grid', placeItems: 'center',
              color: k.tone==='red' ? 'var(--lcd-red)' : k.tone==='green' ? 'var(--lcd-green)' : 'var(--lcd-amber)',
              textShadow: k.tone==='red' ? 'var(--lcd-glow-red)' : k.tone==='green' ? 'var(--lcd-glow-green)' : 'var(--lcd-glow-amber)',
              fontFamily: 'var(--font-pixel)', fontSize: 24, letterSpacing: '.04em',
            }}>{k.big}</div>
            <span className="chrome-label" style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>{k.label}</span>
          </div>
        ))}
      </div>
      <SubTabs active={view} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {view === 'prop' && PROPOSALS.map((r, i) => (
          <div key={i} style={{
            background: 'var(--card)', boxShadow: 'var(--raised-2)',
            padding: 12, marginBottom: 8,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MiniAv initials={r.i} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{r.name}</span>
              <Bell n={r.bell} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <StatusPill s={r.st} />
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 15, color: 'var(--text-muted)', letterSpacing: '.06em' }}>{r.sent}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{money(r.total)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {r.actions.map((a, j) => <ActionBtn key={j} label={a[0]} tone={a[1]} />)}
            </div>
          </div>
        ))}
        {view === 'inv' && INVOICES.map((r, i) => (
          <div key={i} style={{
            background: 'var(--card)', boxShadow: 'var(--raised-2)',
            padding: 12, marginBottom: 8,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MiniAv initials={r.i} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{r.name}</span>
              <StatusPill s={r.st} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: 'var(--text-muted)' }}>{r.sent}</span>
              <span style={{
                height: 26, padding: '0 8px',
                display: 'inline-flex', alignItems: 'center',
                background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
                color: r.paid ? 'var(--lcd-green)' : 'var(--lcd-red)',
                textShadow: r.paid ? 'var(--lcd-glow-green)' : 'var(--lcd-glow-red)',
                fontFamily: 'var(--font-pixel)', fontSize: 16,
              }}>{money(r.total)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {r.actions.map((a, j) => <ActionBtn key={j} label={a[0]} tone={a[1]} />)}
            </div>
          </div>
        ))}
        {view === 'pay' && PAYMENTS.map((p, i) => (
          <div key={i} style={{
            background: 'var(--card)', boxShadow: 'var(--raised-2)',
            padding: 12, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: 'var(--text)' }}>{p.date}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.method}</div>
            </div>
            <span style={{
              height: 26, padding: '0 8px',
              display: 'inline-flex', alignItems: 'center',
              background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
              color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)',
              fontFamily: 'var(--font-pixel)', fontSize: 15,
            }}>+{money(p.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { FinanceDesktop, FinanceMobile });

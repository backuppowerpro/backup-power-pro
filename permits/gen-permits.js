const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak, UnderlineType
} = require('docx');
const fs = require('fs');

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const NODE_MODS = '/Users/keygoodson/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/e6d90d15-c557-409e-affb-6b250ed43842/342e0c25-21bc-4a9c-8eec-2d174147613d/skills/docx/node_modules';

const PAGE_W  = 10800; // 8.5" minus 0.5" margins each side = 10800 DXA
const COL8    = 1350;  // PAGE_W / 8
const COLS8   = [COL8,COL8,COL8,COL8,COL8,COL8,COL8,COL8]; // 8 equal cols

const BK = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
const NO = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' };
const ALL = { top: BK, bottom: BK, left: BK, right: BK };
const PAD = { top: 50, bottom: 50, left: 100, right: 100 };

// ─── CONTRACTOR (same on every form) ────────────────────────────────────────
const C = {
  name:    'Thomas Key Goodson',
  dba:     'Backup Power Pro',
  license: '2942',
  addr:    '22 Kimbell CT',
  city:    'Greenville',
  state:   'SC',
  zip:     '29617',
  phone:   '(864) 400-5302',
  email:   'Backuppowerpro.network@gmail.com',
};

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
const customers = [
  {
    name: 'Christian Colbert',
    addr: '198 Old Plantation Rd',
    city: 'Travelers Rest',
    state: 'SC',
    zip:  '29690',
    tms:  '',
    sub:  '',
    lot:  '',
    phone:'',
    email:'',
  },
  {
    name: 'Jim Jones',
    addr: '172 Sweetbriar Rd',
    city: 'Liberty',
    state:'SC',
    zip:  '29657',
    tms:  '4078-00-36-0920',
    sub:  'COOPERSTONE',
    lot:  '1',
    phone:'(864) 642-7817',
    email:'jjones@jjones1.com',
  },
  {
    name: 'Helen Costa',
    addr: '108 Anita Ct',
    city: 'Spartanburg',
    state:'SC',
    zip:  '',
    tms:  '',
    sub:  '',
    lot:  '',
    phone:'',
    email:'',
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function run(text, opts = {}) {
  return new TextRun({ text, font: 'Arial', size: opts.size || 18, bold: opts.bold || false, italics: opts.italics || false, underline: opts.underline });
}
function runLabel(text) { return run(text, { size: 16, italics: true }); }
function runValue(text) { return run(text, { size: 18 }); }

function para(children, opts = {}) {
  return new Paragraph({ alignment: opts.align || AlignmentType.LEFT, spacing: opts.spacing || {}, children });
}

function sectionHeader(text, colspan) {
  return new TableRow({ children: [
    new TableCell({
      columnSpan: colspan,
      borders: ALL,
      margins: PAD,
      shading: { fill: 'E0E0E0', type: ShadingType.CLEAR },
      children: [ para([run(text, { bold: true, italics: true, size: 18 })]) ]
    })
  ]});
}

function labelRow(cells, colspan8Total) {
  // cells: array of { label, value, span }  spans must sum to colspan8Total
  return new TableRow({
    children: cells.map(c => new TableCell({
      columnSpan: c.span,
      borders: ALL,
      margins: PAD,
      children: [ para([ runLabel(c.label + '  '), runValue(c.value) ]) ]
    }))
  });
}

function fullRow(children, colspan) {
  return new TableRow({ children: [
    new TableCell({ columnSpan: colspan, borders: ALL, margins: PAD, children })
  ]});
}

// ─── BUILD ONE PERMIT PAGE ───────────────────────────────────────────────────
function buildPage(cust, addPageBreak) {
  const els = [];

  // ── Header ──
  els.push(para([run('PICKENS COUNTY', { bold: true, size: 40 })], { align: AlignmentType.CENTER, spacing: { after: 0 } }));
  els.push(para([run('SOUTH CAROLINA', { bold: true, size: 22 })], { align: AlignmentType.CENTER, spacing: { after: 0 } }));
  els.push(para([run('COMMUNITY DEVELOPMENT', { bold: true, size: 26 })], { align: AlignmentType.CENTER, spacing: { after: 0 } }));
  els.push(para([run('BUILDING CODES ADMINISTRATION \u2022 STORMWATER MANAGEMENT \u2022 PLANNING', { size: 15 })], { align: AlignmentType.CENTER, spacing: { after: 0 } }));
  els.push(para([run('222 MCDANIEL AVENUE, B\u201110 \u2022 PICKENS, SC 29671 \u2022 864.898.5950 \u2022 WWW.CO.PICKENS.SC.US', { size: 14 })], { align: AlignmentType.CENTER, spacing: { after: 80 } }));

  // ── Form Title ──
  els.push(para([run('Individual Trade Permit Application', { bold: true, size: 28, underline: { type: UnderlineType.SINGLE } })], { align: AlignmentType.CENTER, spacing: { before: 40, after: 100 } }));

  // ── PROPERTY INFORMATION TABLE ──
  const propTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: COLS8,
    rows: [
      sectionHeader('Property Information', 8),
      // TMS(2) | Address(3) | Subdivision(2) | Lot(1)
      new TableRow({ children: [
        new TableCell({ columnSpan:2, borders:ALL, margins:PAD, children:[ para([runLabel('TMS#  '), runValue(cust.tms)]) ] }),
        new TableCell({ columnSpan:3, borders:ALL, margins:PAD, children:[ para([runLabel('Parcel/Lot/Site Address  '), runValue(cust.addr)]) ] }),
        new TableCell({ columnSpan:2, borders:ALL, margins:PAD, children:[ para([runLabel('Subdivision:  '), runValue(cust.sub)]) ] }),
        new TableCell({ columnSpan:1, borders:ALL, margins:PAD, children:[ para([runLabel('Lot #  '), runValue(cust.lot)]) ] }),
      ]}),
      // Owner Name — full width
      fullRow([ para([runLabel("Property Owner's Name(s)  "), runValue(cust.name)]) ], 8),
      // Mailing(4) | City(2) | State/Zip(2)
      new TableRow({ children: [
        new TableCell({ columnSpan:4, borders:ALL, margins:PAD, children:[ para([runLabel('Property Owner Mailing Address:  '), runValue(cust.addr)]) ] }),
        new TableCell({ columnSpan:2, borders:ALL, margins:PAD, children:[ para([runLabel('City  '), runValue(cust.city)]) ] }),
        new TableCell({ columnSpan:2, borders:ALL, margins:PAD, children:[ para([runLabel('State  '), runValue(cust.state + '   '), runLabel('Zip  '), runValue(cust.zip)]) ] }),
      ]}),
      // Phone(4) | Email(4)
      new TableRow({ children: [
        new TableCell({ columnSpan:4, borders:ALL, margins:PAD, children:[ para([runLabel('Property Owner Phone#  '), runValue(cust.phone)]) ] }),
        new TableCell({ columnSpan:4, borders:ALL, margins:PAD, children:[ para([runLabel('Property Owner Email  '), runValue(cust.email)]) ] }),
      ]}),
    ]
  });
  els.push(propTable);
  els.push(para([], { spacing: { after: 80 } }));

  // ── CONTRACTOR INFORMATION TABLE ──
  const contrTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: COLS8,
    rows: [
      // Header with owner/builder note
      new TableRow({ children: [
        new TableCell({
          columnSpan: 8, borders: ALL, margins: PAD,
          shading: { fill: 'E0E0E0', type: ShadingType.CLEAR },
          children: [ para([
            run('Contractor Information', { bold: true, italics: true, size: 18 }),
            run('          Is your project being constructed under the owner/builder exemption?  \u2610 Yes', { size: 15 }),
          ])]
        })
      ]},),
      // Name(3) | DBA(3) | License(2)
      new TableRow({ children: [
        new TableCell({ columnSpan:3, borders:ALL, margins:PAD, children:[ para([runLabel('Name  '), runValue(C.name)]) ] }),
        new TableCell({ columnSpan:3, borders:ALL, margins:PAD, children:[ para([runLabel('DBA  '), runValue(C.dba)]) ] }),
        new TableCell({ columnSpan:2, borders:ALL, margins:PAD, children:[ para([runLabel('SC License #  '), runValue(C.license)]) ] }),
      ]}),
      // Address(4) | City(2) | State/Zip(2)
      new TableRow({ children: [
        new TableCell({ columnSpan:4, borders:ALL, margins:PAD, children:[ para([runLabel('Mailing Address  '), runValue(C.addr)]) ] }),
        new TableCell({ columnSpan:2, borders:ALL, margins:PAD, children:[ para([runLabel('City  '), runValue(C.city)]) ] }),
        new TableCell({ columnSpan:2, borders:ALL, margins:PAD, children:[ para([runLabel('State  '), runValue(C.state + '   '), runLabel('Zip  '), runValue(C.zip)]) ] }),
      ]}),
      // Phone(3) | Email(3) | CSS(2)
      new TableRow({ children: [
        new TableCell({ columnSpan:3, borders:ALL, margins:PAD, children:[ para([runLabel('Phone#  '), runValue(C.phone)]) ] }),
        new TableCell({ columnSpan:3, borders:ALL, margins:PAD, children:[ para([runLabel('Email  '), runValue(C.email)]) ] }),
        new TableCell({ columnSpan:2, borders:ALL, margins:PAD, children:[ para([runLabel('Registered CSS User?  '), run('\u2612 Yes', { size: 18 }), run('  \u2610 No', { size: 18 })]) ] }),
      ]}),
    ]
  });
  els.push(contrTable);

  // CSS note
  els.push(para([run('If you are not a registered CSS user, please consider registering. All permit applications and inspection requests can be made via our Citizen Self Service Portal. Visit www.co.pickens.sc.us/permitting for more information.', { size: 14, italics: true })], { spacing: { before: 40, after: 80 } }));

  // ── PROJECT INFORMATION TABLE ──
  const projTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: COLS8,
    rows: [
      sectionHeader('Project Information and Permit/Project Type of Work', 8),
      // Residential / Commercial
      fullRow([ para([
        runLabel('Is the project  '),
        run('\u2612 Residential', { bold: true, size: 18 }),
        runLabel('  or  '),
        run('\u2610 Commercial', { size: 18 }),
        runLabel(' ?'),
      ])], 8),
      // Electrical row
      fullRow([
        para([
          run('Electrical:', { bold: true, italics: true, size: 18 }),
          run('  \u2610 Alteration/Remodel  \u2610 Irrigation  ', { size: 16 }),
          run('\u2612 Miscellaneous', { bold: true, size: 16 }),
          run('  \u2610 New Service  \u2610 Power to a Gate  \u2610 Power to an RV*  \u2610 Power to a Well', { size: 16 }),
        ]),
        para([
          run('  \u2610 Swimming Pool  \u2610 Repair  \u2610 Service Upgrade  \u2610 Solar\u2014Ground Mounted  \u2610 Solar\u2014Roof Mounted  \u2610 Cell Tower Co-Locate  \u2610 Cell Tower Upgrade', { size: 16 }),
        ]),
        para([run('* For a power to an RV permit, you must also provide verification of on-site septic service or public sewer service', { size: 13, italics: true })]),
      ], 8),
      // Plumbing
      fullRow([ para([
        run('Plumbing:', { bold: true, italics: true, size: 18 }),
        run('  \u2610 Alteration/Remodel  \u2610 Irrigation  \u2610 Miscellaneous  \u2610 Pool  \u2610 Repair  \u2610 Water Heater/Boiler', { size: 16 }),
      ])], 8),
      // Mechanical
      fullRow([ para([
        run('Mechanical:', { bold: true, italics: true, size: 18 }),
        run('  \u2610 Alteration/Remodel  \u2610 HVAC Change Out  \u2610 HVAC New Installation  \u2610 Miscellaneous  \u2610 Repair', { size: 16 }),
      ])], 8),
      // Work Description
      new TableRow({ children: [
        new TableCell({
          columnSpan: 8, borders: ALL,
          margins: { top: 60, bottom: 120, left: 100, right: 100 },
          children: [
            para([ run('Work Description:', { bold: true, italics: true, size: 16 }) ]),
            para([ run('Addition of an inlet and interlock for a portable generator. This is not a generator installation.', { size: 18 }) ]),
            para([ run(' ', { size: 18 }) ]),
          ]
        })
      ]}),
      // Valuation
      fullRow([ para([
        run('Project Valuation/Contract/Cost of Work:  ', { bold: true, size: 16 }),
        runValue('1497'),
      ])], 8),
      // Electrical Provider | SCDHEC
      new TableRow({ children: [
        new TableCell({ columnSpan:4, borders:ALL, margins:PAD, children:[ para([runLabel('Electrical Provider:  '), runValue('Duke Power')]) ] }),
        new TableCell({ columnSpan:4, borders:ALL, margins:PAD, children:[ para([runLabel('SCDHEC Septic Tank Permit #:  ')]) ] }),
      ]}),
      // Signature | Date
      new TableRow({ children: [
        new TableCell({ columnSpan:5, borders:ALL, margins:{ top:100, bottom:100, left:100, right:100 }, children:[
          para([ runLabel('Signature of Contractor / Owner:  '), run('_______________________________________', { size: 18 }) ])
        ]}),
        new TableCell({ columnSpan:3, borders:ALL, margins:{ top:100, bottom:100, left:100, right:100 }, children:[
          para([ runLabel('Date:  '), runValue('4/9/2026') ])
        ]}),
      ]}),
    ]
  });
  els.push(projTable);

  // Footer
  els.push(para([ run('222 MCDANIEL AVENUE, B-10 \u2022 PICKENS, SC 29671 \u2022 864.898.5950 \u2022 WWW.CO.PICKENS.SC.US', { bold: true, size: 14 }) ], { align: AlignmentType.CENTER, spacing: { before: 80, after: 0 } }));

  if (addPageBreak) {
    els.push(new Paragraph({ children: [new PageBreak()] }));
  }

  return els;
}

// ─── BUILD DOCUMENT ───────────────────────────────────────────────────────────
const allContent = [];
customers.forEach((cust, i) => {
  buildPage(cust, i < customers.length - 1).forEach(el => allContent.push(el));
});

const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 720, right: 720, bottom: 720, left: 720 }
      }
    },
    children: allContent
  }]
});

const OUT = '/Users/keygoodson/Desktop/CLAUDE/permits/permit-applications-2026-04-09.docx';
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log('✓ Written to: ' + OUT);
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

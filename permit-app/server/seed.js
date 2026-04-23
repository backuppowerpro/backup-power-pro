import { db } from './db.js'

const BASE = 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/aK159zA9fGrlOab4UPA5/pub/'

// Jurisdiction portal credentials. HARD RULE: never commit plaintext
// usernames / passwords to this file again — a previous revision exposed
// four live portal logins including a Gmail password in the public repo.
// All credentials now come from the environment. Copy .env.example → .env,
// fill in the values locally (which is gitignored), and restart the server.
// The permit app will still seed the table without them — the auth
// fields are nullable — but portal-login automation will be unavailable.
const env = (k) => (process.env[k] || null)

const JURISDICTIONS = [
  {
    name: 'Greenville County',
    portal_url: 'https://grvlc-trk.aspgov.com/eTRAKiT/dashboard.aspx',
    username: env('GVL_COUNTY_USER'),
    password: env('GVL_COUNTY_PASS'),
    phone: '8644677060',
    notes: 'Non-City Permitting',
    logo_url: BASE + 'Jn97croHlO8SiC90l0Xd.JPG',
    background_url: BASE + '6RTzemAnq84NFVpMDIps.jpg',
  },
  {
    name: 'City of Greenville',
    portal_url: 'https://greenville-buildingpermits-permits.app.transform.civicplus.com/forms/43123',
    username: null,
    password: null,
    phone: '8644674505',
    notes: 'City limit Permits\nPermit Portal: https://grvl-egov.aspgov.com/grvlc2gbp/index.html\nBuilding Info: https://www.greenvillesc.gov/656/Building-Permit-Center',
    logo_url: BASE + 'AwFwimjNrdPC0B26xv74.jpg',
    background_url: BASE + 'XuhfdkA5mMAAQGhjTkWj.jpeg',
  },
  {
    name: 'City of Simpsonville',
    portal_url: 'https://evolve-public.infovisionsoftware.com/simpsonville/',
    username: env('SIMPSONVILLE_USER'),
    password: env('SIMPSONVILLE_PASS'),
    phone: '8649679526',
    notes: 'South Greenville',
    logo_url: BASE + 'cSJbqfBWf1roFGxM5fgM.jpg',
    background_url: BASE + 'j3ehAffcqpDf3b4Zag2V.webp',
  },
  {
    name: 'City of Mauldin',
    portal_url: 'https://www4.citizenserve.com/Portal/PortalController?Action=showPermit&ctzPagePrefix=Portal_&installationID=362&original_iid=362&original_contactID=38564612',
    username: env('MAULDIN_USER'),
    password: env('MAULDIN_PASS'),
    phone: '8642898976',
    notes: 'South Greenville',
    logo_url: BASE + 'h3zBsZYuvMlyAiYJTAMe.jpg',
    background_url: BASE + 'uVQu0pQEXEYzs8Krvbsu.jpeg',
  },
  {
    name: 'Fountain Inn',
    portal_url: 'https://fountaininnsc.portal.iworq.net/portalhome/fountaininnsc',
    username: null,
    password: null,
    phone: '8645310644',
    notes: 'City Permits\nBusiness License: https://www.fountaininn.org/403/Business-License\nNew Permit: https://fountaininnsc.portal.iworq.net/FOUNTAININN/new-permit/600/1284',
    logo_url: BASE + '4cytYfiRI0aZTYnyHnw9.png',
    background_url: BASE + 'YJF38PdUr0H35zhZAIyw.jpeg',
  },
  {
    name: 'Spartanburg County',
    portal_url: null,
    username: null,
    password: null,
    phone: null,
    notes: 'Non-city permitting',
    logo_url: BASE + 'IuFHzF4757XBaig4BnOd.jpg',
    background_url: BASE + 'I9r32DJQK8xvrhGlUsCw.jpeg',
  },
  {
    name: 'City of Greer',
    portal_url: 'https://gree.csqrcloud.com/community-etrakit/',
    username: env('GREER_USER'),
    password: env('GREER_PASS'),
    phone: null,
    notes: null,
    logo_url: '/greer-logo.png',
    background_url: '/greer-bg.jpg',
  },
]

export function seedJurisdictions() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM jurisdictions').get()
  if (existing.count > 0) {
    console.log('[DB] Jurisdictions already seeded, skipping')
    return
  }
  const insert = db.prepare(
    'INSERT INTO jurisdictions (name, portal_url, username, password, phone, notes, logo_url, background_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insertMany = db.transaction((jurisdictions) => {
    for (const j of jurisdictions) {
      insert.run(j.name, j.portal_url, j.username, j.password, j.phone, j.notes, j.logo_url, j.background_url)
    }
  })
  insertMany(JURISDICTIONS)
  console.log(`[DB] Seeded ${JURISDICTIONS.length} jurisdictions`)
}

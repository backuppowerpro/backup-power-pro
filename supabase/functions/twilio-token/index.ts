/**
 * twilio-token
 *
 * Mints a short-lived Twilio Access Token (JWT) for the Voice browser SDK.
 * The browser SDK cannot use the Auth Token directly — it needs an Access
 * Token signed by an API Key. Tokens are valid for 1 hour; the CRM refreshes
 * before expiry via the SDK's `tokenWillExpire` event.
 *
 * Request:  GET  /twilio-token
 *           Authorization: Bearer <SUPABASE_ANON_KEY>
 *
 * Response: { token: "eyJhbGciOiJIUzI1NiIs...", identity: "key", expires: <unix ts> }
 *
 * Access Token JWT structure (Twilio-specific):
 *   Header:  { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" }
 *   Payload: {
 *     iss: <API_KEY_SID>,
 *     sub: <ACCOUNT_SID>,
 *     jti: <API_KEY_SID>-<iat>,
 *     iat: <now>,
 *     nbf: <now>,
 *     exp: <now + 3600>,
 *     grants: {
 *       identity: "key",
 *       voice: {
 *         incoming: { allow: true },
 *         outgoing: { application_sid: <TWIML_APP_SID> }
 *       }
 *     }
 *   }
 *   Signature: HMAC-SHA256 using API Key Secret as the HMAC key
 */

const TWILIO_ACCOUNT_SID    = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_API_KEY_SID    = Deno.env.get('TWILIO_API_KEY_SID') || ''
const TWILIO_API_KEY_SECRET = Deno.env.get('TWILIO_API_KEY_SECRET') || ''
const TWILIO_TWIML_APP_SID  = Deno.env.get('TWILIO_TWIML_APP_SID') || ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })

// Base64url encoding — standard base64 with -_ instead of +/ and no padding
function base64url(input: string | ArrayBuffer): string {
  let bin: string
  if (typeof input === 'string') {
    bin = input
  } else {
    const bytes = new Uint8Array(input)
    bin = ''
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generateAccessToken(identity: string): Promise<{ token: string; expires: number }> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 3600 // 1 hour

  const header = {
    alg: 'HS256',
    typ: 'JWT',
    cty: 'twilio-fpa;v=1',
  }

  const payload = {
    jti: `${TWILIO_API_KEY_SID}-${now}`,
    iss: TWILIO_API_KEY_SID,
    sub: TWILIO_ACCOUNT_SID,
    iat: now,
    nbf: now,
    exp,
    grants: {
      identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: TWILIO_TWIML_APP_SID },
      },
    },
  }

  const headerB64  = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  // Sign with HMAC-SHA256 using the API Key Secret
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(TWILIO_API_KEY_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput)
  )
  const sigB64 = base64url(sigBuffer)

  return { token: `${signingInput}.${sigB64}`, expires: exp }
}

import { requireAnonOrServiceRole } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  // Without this, any internet caller can mint a 1-hour Voice JWT and
  // place/receive PSTN calls on Key's Twilio account.
  const gate = requireAnonOrServiceRole(req); if (gate) return gate

  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET || !TWILIO_TWIML_APP_SID) {
    console.error('[twilio-token] missing env vars')
    return json(500, { error: 'twilio not configured' })
  }

  // The CRM only has one user (Key), so identity is hardcoded. If you ever
  // add multi-user, parse it from the auth header or request body here.
  const identity = 'key'

  try {
    const { token, expires } = await generateAccessToken(identity)
    return json(200, { token, identity, expires })
  } catch (err) {
    console.error('[twilio-token] sign failed:', err)
    return json(500, { error: 'failed to generate token' })
  }
})

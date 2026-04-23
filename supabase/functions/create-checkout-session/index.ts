import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'
import { requireAnonOrServiceRole, allowRate } from '../_shared/auth.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Require a known BPP key + rate-limit by IP so unauthenticated callers
  // can't burn Stripe API quota.
  const gate = requireAnonOrServiceRole(req); if (gate) return gate
  const clientIp = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  if (!allowRate(`checkout:${clientIp}`, 20)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: corsHeaders })
  }

  try {
    const { token, embedded, prefer_ach } = await req.json()
    if (!token) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers: corsHeaders })

    // Fetch invoice from Supabase
    const { data: inv, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !inv) return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404, headers: corsHeaders })
    if (inv.status === 'paid') return new Response(JSON.stringify({ error: 'Invoice already paid' }), { status: 400, headers: corsHeaders })

    const lineItems = (inv.line_items || []).map((li: { name: string; amount: number }) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: li.name },
        unit_amount: Math.round(li.amount * 100),
      },
      quantity: 1,
    }))

    if (!lineItems.length) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Storm-Ready Connection System' },
          unit_amount: Math.round((inv.total || 0) * 100),
        },
        quantity: 1,
      })
    }

    const baseUrl = 'https://backuppowerpro.com'

    // ACH (bank transfer) is shown first by default — saves $34/job vs card.
    // Card is always available as a fallback. prefer_ach=false forces card-only (tap-to-pay mode).
    const paymentMethods = prefer_ach === false
      ? ['card']
      : ['us_bank_account', 'card']

    if (embedded) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        customer_email: inv.contact_email || undefined,
        metadata: { invoice_token: token, contact_id: inv.contact_id || '' },
        ui_mode: 'embedded',
        return_url: `${baseUrl}/invoice.html?token=${token}&paid=1`,
        payment_method_types: paymentMethods,
        payment_method_options: {
          us_bank_account: {
            financial_connections: { permissions: ['payment'] },
          },
        },
      })

      return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        customer_email: inv.contact_email || undefined,
        metadata: { invoice_token: token, contact_id: inv.contact_id || '' },
        success_url: `${baseUrl}/invoice.html?token=${token}&paid=1`,
        cancel_url: `${baseUrl}/invoice.html?token=${token}`,
        payment_method_types: paymentMethods,
        payment_method_options: {
          us_bank_account: {
            financial_connections: { permissions: ['payment'] },
          },
        },
      })

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})

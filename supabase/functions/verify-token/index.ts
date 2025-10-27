// This endpoint checks if token is still valid + subscription active
// Merchants DON'T need this - SDK calls it automatically

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json()

    if (!token) {
      throw new Error('No token provided')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Decode token to get subscriber_id
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid token format')
    }

    const payload = JSON.parse(atob(parts[1]))
    const subscriberId = payload.subscriber_id
    const merchantId = payload.merchant_id

    // Check if subscriber is still active
    const { data: subscriber, error } = await supabase
      .from('subscribers')
      .select(`
        id,
        customer_email,
        customer_name,
        status,
        next_renewal_date,
        subscription_plans (
          name,
          features
        )
      `)
      .eq('id', subscriberId)
      .eq('merchant_id', merchantId)
      .single()

    if (error || !subscriber) {
      throw new Error('Subscriber not found')
    }

    // Check if subscription is active
    if (subscriber.status !== 'active') {
      throw new Error('Subscription is not active')
    }

    // Check if token expired (from payload)
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error('Token expired')
    }

    // Return updated subscriber info
    return new Response(
      JSON.stringify({
        valid: true,
        subscriber: {
          email: subscriber.customer_email,
          name: subscriber.customer_name,
          plan: (subscriber.subscription_plans as any)?.name,
          features: (subscriber.subscription_plans as any)?.features || [],
          status: subscriber.status,
          expiresAt: subscriber.next_renewal_date,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('❌ Token verification failed:', error.message)
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Still return 200 so SDK can handle gracefully
      }
    )
  }
})
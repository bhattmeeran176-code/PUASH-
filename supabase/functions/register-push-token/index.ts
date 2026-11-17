import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: 'Server configuration is incomplete' }, { status: 500, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Invalid session' }, { status: 401, headers: corsHeaders });
  }

  let body: { token?: unknown; platform?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const platform = body.platform;
  if (token.length < 20 || token.length > 4096 || !['android', 'ios'].includes(String(platform))) {
    return Response.json({ error: 'Invalid push token or platform' }, { status: 400, headers: corsHeaders });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: saveError } = await adminClient
    .from('push_device_tokens')
    .upsert({
      user_id: user.id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'token' });

  if (saveError) {
    console.error('Push token save failed:', saveError.message);
    return Response.json({ error: 'Could not save push token' }, { status: 500, headers: corsHeaders });
  }

  return Response.json({ ok: true }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

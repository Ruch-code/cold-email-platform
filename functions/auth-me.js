const { json, error, getSupabase } = require('./lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return json({ user: null });

  let token = event.headers.authorization?.replace('Bearer ', '');
  if (!token && event.httpMethod === 'POST') {
    try { const body = JSON.parse(event.body || '{}'); token = body.access_token; }
    catch { /* ignore */ }
  }

  if (!token) return json({ user: null });

  const { data: { user }, error: err } = await supabase.auth.getUser(token);
  if (err) return json({ user: null });

  return json({ user });
};
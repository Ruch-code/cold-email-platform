const { json, error, getSupabase } = require('./lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return error('Supabase not configured');

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON'); }

  const { access_token } = body;
  if (!access_token) return error('Access token required');

  const { error: err } = await supabase.auth.signOut({ scope: 'global' });
  if (err) return error(err.message);

  return json({ ok: true });
};
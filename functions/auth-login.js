const { json, error, getSupabase } = require('./lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return error('Supabase not configured');

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON'); }

  const { email, password } = body;
  if (!email || !password) return error('Email and password required');

  const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
  if (err) return error(err.message, 401);

  return json({ user: data.user, session: data.session });
};
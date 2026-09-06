const { json, error, getSupabase } = require('./lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return error('Supabase not configured');

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON'); }

  const { email, password, name } = body;
  if (!email || !password) return error('Email and password required');

  const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { name: name || '' } } });
  if (err) return error(err.message, 400);

  return json({ user: data.user, session: data.session });
};
const { json, error, getSupabase } = require('./lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return error('Supabase not configured');

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON'); }

  const { email, redirectTo } = body;
  if (!email) return error('Email required');

  const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo || `${event.headers.origin}/reset-password` });
  if (err) return error(err.message);

  return json({ ok: true, message: 'Reset email sent' });
};
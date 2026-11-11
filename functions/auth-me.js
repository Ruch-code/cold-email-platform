const { json, error, getSupabase } = require('./lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return json({ user: null });

  let token = event.headers.authorization?.replace('Bearer ', '');
  let refreshToken;
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      token = token || body.access_token;
      refreshToken = body.refresh_token;
    } catch { /* ignore */ }
  }

  if (token) {
    const { data, error: err } = await supabase.auth.getUser(token);
    if (!err && data?.user) return json({ user: data.user });
  }

  // Access token missing or expired: try the refresh token
  if (refreshToken) {
    const { data, error: err } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (!err && data?.user) return json({ user: data.user, session: data.session });
  }

  return json({ user: null });
};
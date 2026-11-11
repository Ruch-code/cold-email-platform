const { json, error } = require('./lib/shared');

/**
 * Per-user outreach tracking (pipeline stage, follow-up dates), stored in the
 * user's Supabase auth metadata so it syncs across devices without a new table.
 * POST { access_token, refresh_token, tracking? }
 *   - without `tracking`: returns the saved tracking
 *   - with `tracking`: merges it into the saved copy and returns the result
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return error('Supabase not configured', 503);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return error('Invalid JSON'); }
  const { access_token, refresh_token, tracking } = body;
  if (!access_token || !refresh_token) return error('Not signed in', 401);

  // Fresh client per request so one user's session never leaks into another's
  const supabase = require('@supabase/supabase-js').createClient(
    process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: sess, error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sErr || !sess?.user) return error('Session expired', 401);

  const saved = sess.user.user_metadata?.hh_tracking || {};
  if (!tracking || typeof tracking !== 'object') return json({ tracking: saved, session: sess.session });

  // Merge per email id
  const merged = { ...saved };
  for (const [id, v] of Object.entries(tracking)) {
    if (v && typeof v === 'object') merged[id] = { ...(saved[id] || {}), ...v };
  }
  const { error: uErr } = await supabase.auth.updateUser({ data: { hh_tracking: merged } });
  if (uErr) return error(uErr.message, 500);
  return json({ tracking: merged, session: sess.session });
};

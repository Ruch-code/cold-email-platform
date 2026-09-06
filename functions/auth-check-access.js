const { json, error, getSupabase } = require('./lib/shared');

/**
 * Check User Access Status
 * POST /api/auth/check-access
 * body: { email }
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return json({ hasAccess: true, status: 'no_supabase' }); // Allow if no Supabase

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON'); }

  const { email } = body;
  if (!email) return error('Email required');

  const { data, error: err } = await supabase
    .from('access_requests')
    .select('status, reviewed_at, admin_notes')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (err && err.code !== 'PGRST116') return error(err.message); // PGRST116 = no rows

  if (!data) {
    return json({ hasAccess: false, status: 'not_requested', message: 'No access request found. Please request access.' });
  }

  if (data.status === 'approved') {
    return json({ hasAccess: true, status: 'approved', reviewed_at: data.reviewed_at });
  }

  if (data.status === 'pending') {
    return json({ hasAccess: false, status: 'pending', message: 'Your access request is pending admin approval.' });
  }

  if (data.status === 'rejected') {
    return json({ hasAccess: false, status: 'rejected', message: 'Your access request was rejected.', admin_notes: data.admin_notes });
  }

  return json({ hasAccess: false, status: data.status });
};
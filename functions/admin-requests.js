const { json, error, getSupabase } = require('./lib/shared');

/**
 * List Access Requests (Admin)
 * GET /api/admin/requests
 * query: ?status=pending|approved|rejected
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'GET') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return error('Supabase not configured');

  // Verify admin token
  const auth = event.headers.authorization?.replace('Bearer ', '');
  if (!auth || !auth.startsWith('admin:')) return error('Admin authentication required', 401);

  const { searchParams } = new URL(event.rawUrl || `http://localhost${event.path}`);
  const status = searchParams.get('status');

  let query = supabase.from('access_requests').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error: err } = await query;
  if (err) return error(err.message);

  return json({ requests: data || [] });
};
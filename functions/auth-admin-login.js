const { json, error, getSupabase } = require('./lib/shared');

/**
 * Admin Login
 * POST /api/auth/admin-login
 * body: { username, password }
 * 
 * Credentials from Netlify env vars: ADMIN_USERNAME, ADMIN_PASSWORD
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'changeme123';

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON'); }

  const { username, password } = body;
  if (!username || !password) return error('Username and password required');

  if (username !== adminUser || password !== adminPass) {
    return error('Invalid credentials', 401);
  }

  // Create a simple admin token (in production, use proper JWT)
  const token = Buffer.from(`admin:${Date.now()}:${Math.random().toString(36).slice(2)}`).toString('base64');
  
  return json({ 
    admin: { username, role: 'admin' }, 
    token,
    message: 'Admin login successful'
  });
};
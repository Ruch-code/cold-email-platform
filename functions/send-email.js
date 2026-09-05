const { json, error } = require('./lib/shared');
const { Resend } = require('resend');

/**
 * Send Cold Email
 * POST /api/send-email
 * body: { to, from, subject, body, toName, apiKey }
 *
 * Uses Resend. Reads key from env RESEND_API_KEY, or the apiKey
 * passed in (stored client-side in the user's browser settings).
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const { to, subject, body: text, toName } = body;
  const from = body.from || process.env.EMAIL_FROM;
  const apiKey = process.env.RESEND_API_KEY || body.apiKey;

  if (!apiKey) return error('Resend API key missing. Set RESEND_API_KEY env var or save one in settings.');
  if (!to) return error('Recipient email (to) is required');
  if (!from) return error('Sender email (from) is required');
  if (!subject || !text) return error('subject and body are required');

  try {
    const resend = new Resend(apiKey);
    const { data, error: resendError } = await resend.emails.send({
      from,
      to: [to],
      subject,
      text,
    });
    if (resendError) throw new Error(resendError.message);
    return json({ ok: true, id: data?.id, mode: 'resend' });
  } catch (e) {
    return error('Send failed: ' + e.message);
  }
};

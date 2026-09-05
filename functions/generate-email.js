const { json, error } = require('./_shared');

/**
 * Generate Cold Email
 * POST /api/generate-email
 * body: { toName, company, role, headline, fit, senderName }
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const { toName, company, role, headline, fit, senderName } = body;
  if (!company || !role) return error('company and role are required');

  const apiKey = process.env.OPENAI_API_KEY || body.openaiKey;
  if (!apiKey) {
    return json({ body: templateEmail({ toName, company, role, headline, fit, senderName }), mode: 'template' });
  }

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        messages: [{
          role: 'user',
          content: `Write a short, warm, professional cold email to a recruiter at ${company} about the ${role} role. Greet ${toName || 'the recruiter'} by name if given. Mention ${headline || 'the candidate'} and, if provided, this relevance: "${fit}". Keep it to ~120-150 words, include a subject line on the first line prefixed "Subject: ", and end with a call to invite a quick call. Sign it ${senderName || 'the candidate'}. No markdown formatting beyond plain text.`,
        }],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'OpenAI error');
    return json({ body: data.choices?.[0]?.message?.content || templateEmail(body), mode: 'ai' });
  } catch (e) {
    return json({ body: templateEmail(body), mode: 'template', note: e.message });
  }
};

function templateEmail({ toName, company, role, headline, fit, senderName }) {
  return `Subject: Application: ${role} at ${company}

Hi ${toName || 'there'},

I hope you're doing well. I'm ${senderName || 'a candidate'}${headline ? ', ' + headline : ''}, and I'm reaching out about the ${role} opening at ${company}${fit ? ". Your description calls for exactly the kind of work I've been doing — " + fit : ''}.

I'd love to contribute to ${company}'s mission and would be glad to share my resume and portfolio at your convenience.

Thank you for your time and consideration.

Warm regards,
${senderName || 'Candidate'}`;
}

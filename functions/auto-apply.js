const { json, error } = require('./lib/shared');

/**
 * Auto-Apply / Multi-Contact Email Sender
 * POST /api/auto-apply
 * body: {
 *   job: { id, title, company, location, url, description, contacts: [{email, name, role}] },
 *   resume, cover_letter, sender: { name, email, headline },
 *   options: { dry_run, delay_ms }
 * }
 *
 * Sends personalized emails to multiple contacts at a company.
 * In dry_run mode, returns the emails that would be sent.
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const { job, resume, cover_letter, sender, options = {} } = body;
  if (!job || !sender?.email || !sender?.name) return error('job, sender.email, sender.name required');

  const contacts = job.contacts || [];
  if (!contacts.length) {
    // Generate likely contacts
    const domain = extractDomain(job.url || job.company);
    contacts.push(
      { email: `hiring@${domain}`, name: 'Hiring Team', role: 'Recruiting' },
      { email: `recruiting@${domain}`, name: 'Recruiting Team', role: 'Talent Acquisition' },
      { email: `jobs@${domain}`, name: 'Jobs', role: 'HR' },
      { email: `talent@${domain}`, name: 'Talent Acquisition', role: 'TA' }
    );
  }

  const apiKey = process.env.RESEND_API_KEY || body.resendKey;
  if (!apiKey && !options.dry_run) return error('Resend API key required for sending');

  const { Resend } = require('resend');
  const resend = apiKey ? new Resend(apiKey) : null;

  const results = [];
  const delay = options.delay_ms || 1000;

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const personalizedEmail = generatePersonalizedEmail(job, contact, sender, resume, cover_letter);
    const subject = `Application: ${job.title} at ${job.company} - ${sender.name}`;

    if (options.dry_run) {
      results.push({ contact, subject, body: personalizedEmail, status: 'dry_run' });
      continue;
    }

    try {
      const { data, error: err } = await resend.emails.send({
        from: sender.email,
        to: [contact.email],
        subject,
        text: personalizedEmail,
        reply_to: sender.email,
      });
      if (err) throw err;
      results.push({ contact, subject, status: 'sent', message_id: data?.id });
    } catch (e) {
      results.push({ contact, subject, status: 'failed', error: e.message });
    }

    // Rate limiting
    if (i < contacts.length - 1) await new Promise(r => setTimeout(r, delay));
  }

  return json({ results, total: contacts.length, sent: results.filter(r => r.status === 'sent').length });
};

function generatePersonalizedEmail(job, contact, sender, resume, cover_letter) {
  const skills = extractTopSkills(resume).slice(0, 5).join(', ');
  const achievement = extractTopAchievement(resume);
  const companyResearch = extractCompanyHook(job.description || '');

  return `Subject: Application: ${job.title} at ${job.company} - ${sender.name}

Hi ${contact.name || 'there'},

I hope you're doing well. I'm ${sender.name}${sender.headline ? ', ' + sender.headline : ''}, and I'm writing to express my strong interest in the ${job.title} position at ${job.company}.${companyResearch ? ' ' + companyResearch : ''}

${cover_letter ? `\n${cover_letter}\n` : ''}

My background in ${skills} aligns well with what you're looking for. ${achievement ? `In my recent work, ${achievement}` : ''}

I've attached my resume and would welcome the opportunity to discuss how I can contribute to ${job.company}'s mission. Available for a brief call at your convenience.

Thank you for your time and consideration.

Warm regards,
${sender.name}
${sender.email}
${sender.linkedin ? 'LinkedIn: ' + sender.linkedin : ''}
${sender.portfolio ? 'Portfolio: ' + sender.portfolio : ''}
`;
}

function extractDomain(urlOrCompany) {
  if (!urlOrCompany) return 'company.com';
  const cleaned = urlOrCompany.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return cleaned.includes('.') ? cleaned : cleaned.toLowerCase().replace(/\s+/g, '') + '.com';
}

function extractTopSkills(resume) {
  const skills = ['React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB', 'GraphQL', 'REST API', 'CI/CD', 'Microservices', 'System Design', 'Agile', 'Testing', 'Java', 'Go', 'Rust', 'C++', 'Next.js', 'Vue', 'Angular', 'Redis', 'Kafka', 'Terraform'];
  return skills.filter(s => resume.toLowerCase().includes(s.toLowerCase()));
}

function extractTopAchievement(resume) {
  const lines = resume.split('\n').filter(l => /\d+%|\$\d+|\d+\s*(years?|months?|users?|customers?|requests?)/i.test(l));
  return lines[0]?.replace(/^[-•\s]+/, '').trim() || '';
}

function extractCompanyHook(description) {
  if (!description) return '';
  const hooks = [
    /mission\s+is\s+([^.]+)/i,
    /building\s+([^.]+)/i,
    /transforming\s+([^.]+)/i,
    /innovating\s+([^.]+)/i,
  ];
  for (const h of hooks) {
    const m = description.match(h);
    if (m) return `I admire your mission to ${m[1].trim()}.`;
  }
  return '';
}
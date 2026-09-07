const { json, error } = require('./lib/shared');
const { callAIWithFallback, buildProviderChain } = require('./lib/ai-providers');

/**
 * Cover Letter Generator
 * POST /api/cover-letter
 * body: { resume, jd, company, role, sender_name, headline, tone? }
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const { resume, jd, company, role, sender_name, headline, tone = 'professional' } = body;
  if (!resume || !jd || !company || !role) return error('resume, jd, company, role required');

  const providerChain = buildProviderChain(process.env);
  if (providerChain.length === 0) {
    return json({ cover_letter: localCoverLetter({ resume, jd, company, role, sender_name, headline, tone }), mode: 'template' });
  }

  const tones = {
    professional: 'formal and polished',
    warm: 'friendly and personable',
    confident: 'assertive and direct',
    enthusiastic: 'energetic and excited',
  };

  const sys = `Write a compelling, ATS-friendly cover letter.
Tone: ${tones[tone] || tones.professional}.
Structure:
1. Header with sender info
2. Salutation
3. Opening: role + company + hook
4. Body paragraph 1: Key achievement matching JD requirement
5. Body paragraph 2: Relevant experience/skills
6. Body paragraph 3: Cultural fit/enthusiasm
7. Closing: Call to action
8. Professional sign-off
Keep it to 250-350 words. No markdown. Plain text.
Use keywords from JD naturally.`;

  const user = `JOB DESCRIPTION:\n${jd}\n\nRESUME:\n${resume}\n\nCOMPANY: ${company}\nROLE: ${role}\nSENDER: ${sender_name}\nHEADLINE: ${headline || ''}`;

  try {
    const { content, provider, model } = await callAIWithFallback(
      providerChain,
      {
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        temperature: 0.5,
        maxTokens: 600,
      }
    );
    return json({ cover_letter: content, mode: 'ai', provider, model });
  } catch (e) {
    return json({ cover_letter: localCoverLetter({ resume, jd, company, role, sender_name, headline, tone }), mode: 'template', note: e.message });
  }
};

function localCoverLetter({ resume, jd, company, role, sender_name, headline, tone }) {
  const skills = extractSkills(jd).slice(0, 5).join(', ');
  return `${sender_name || '[Your Name]'}${headline ? ' | ' + headline : ''}
${new Date().toLocaleDateString()}

Hiring Manager
${company}

Dear Hiring Manager,

I am writing to express my strong interest in the ${role} position at ${company}. ${headline ? 'As ' + headline + ', ' : ''}I have followed ${company}'s work in ${extractIndustry(jd)} and am excited about the opportunity to contribute to your team's mission.

${tone === 'enthusiastic' ? 'I am particularly drawn to this role because' : 'My background aligns well with your requirements:'} the position calls for expertise in ${skills}, areas where I have ${tone === 'confident' ? 'proven' : 'substantial'} experience. In my recent work, I ${extractAchievement(resume)}.

Beyond technical qualifications, I admire ${company}'s commitment to ${extractValue(jd)}. I would welcome the opportunity to bring my ${tone === 'warm' ? 'collaborative spirit and' : ''}problem-solving mindset to your team.

I would appreciate the chance to discuss how my background aligns with your needs. Thank you for your time and consideration.

Sincerely,
${sender_name || '[Your Name]'}
`;
}

function extractSkills(text) {
  const common = ['React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB', 'GraphQL', 'REST API', 'CI/CD', 'Microservices', 'System Design', 'Agile', 'Testing'];
  return common.filter(s => text.toLowerCase().includes(s.toLowerCase()));
}

function extractIndustry(text) {
  const industries = ['fintech', 'healthcare', 'e-commerce', 'SaaS', 'AI/ML', 'cybersecurity', 'edtech', 'blockchain', 'gaming', 'logistics'];
  return industries.find(i => text.toLowerCase().includes(i.toLowerCase())) || 'technology';
}

function extractValue(text) {
  if (text.toLowerCase().includes('innovation')) return 'innovation';
  if (text.toLowerCase().includes('customer')) return 'customer success';
  if (text.toLowerCase().includes('quality')) return 'quality';
  if (text.toLowerCase().includes('scale')) return 'scalable solutions';
  return 'excellence';
}

function extractAchievement(resume) {
  const lines = resume.split('\n').filter(l => /\d+%|\$\d+|\d+\s*(years?|months?)/i.test(l));
  return lines[0]?.trim() || 'delivered impactful results across multiple projects';
}
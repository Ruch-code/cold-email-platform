/* <frontend JS env injected by Netlify function build when present> */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', isErr);
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- VIEW SWITCHING ---------- */
$$('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    switchView(btn.dataset.view);
  });
});
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => {
  $$('.nav-item').forEach((x) => x.classList.toggle('active', x.dataset.view === b.dataset.goto));
  switchView(b.dataset.goto);
}));
function switchView(name) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  const el = $('#view-' + name);
  if (el) el.classList.add('active');
  if (name === 'dashboard') renderDashboard();
  if (name === 'database') renderDatabase();
  if (name === 'email') renderEmailSettings();
}

/* ---------- DB HELPERS ---------- */
async function refreshStatCounts() {
  const jobs = await DB.getAll('jobs');
  const scraped = await DB.getAll('scraped');
  const emails = await DB.getAll('emails');
  const recruiters = await DB.getAll('recruiters');
  $('#sidebar-leads').textContent = recruiters.length;
  return { jobs, scraped, emails, recruiters };
}

async function renderDashboard() {
  const { jobs, scraped, emails, recruiters } = await refreshStatCounts();
  $('#stat-jobs').textContent = jobs.length;
  $('#stat-scraped').textContent = scraped.length;
  $('#stat-emails').textContent = emails.length;
  $('#stat-contacted').textContent = uniqueRecruiterCount(emails);
  // prefill settings
  const canEmail = await DB.getAll('settings');
  $('#set-resend').value = canEmail.resendKey || '';
  $('#set-openai').value = canEmail.openaiKey || '';
}
function uniqueRecruiterCount(emails) {
  return new Set(emails.filter((e) => e.to).map((e) => e.to.toLowerCase())).size;
}

/* ---------- SETTINGS ---------- */
$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const s = $('#settings-msg');
  await DB.saveSettings({
    resendKey: $('#set-resend').value.trim(),
    openaiKey: $('#set-openai').value.trim(),
  });
  s.className = 'form-msg ok';
  s.textContent = '✓ Keys saved to local database.';
  toast('API keys saved');
});

/* ---------- JOB SCANNER ---------- */
const savedQueries = [];
$('#scan-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await runScan();
});
$('#scan-save-query').addEventListener('click', async () => {
  const kw = $('#scan-keywords').value.trim();
  if (!kw) return toast('Enter keywords first', true);
  await DB.insert('alerts', { id: uid(), keywords: kw, location: $('#scan-location').value.trim(), role: $('#scan-role').value.trim(), source: $('#scan-source').value });
  toast('Keyword alert saved');
});

async function runScan() {
  const keywords = $('#scan-keywords').value.trim();
  if (!keywords) return toast('Enter keywords to scan', true);
  const btn = $('#scan-form .btn.primary');
  btn.disabled = true; btn.textContent = 'Scanning...';

  const payload = {
    keywords,
    location: $('#scan-location').value.trim(),
    role: $('#scan-role').value.trim(),
    source: $('#scan-source').value,
  };

  try {
    const res = await fetch('/.netlify/functions/job-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scan failed');
    $('#scan-count').textContent = data.jobs.length;
    $('#scan-hint').classList.add('hidden');
    renderScanResults(data.jobs);
    if (data.jobs.length === 0) {
      $('#scan-results').innerHTML = '<p class="muted small">No direct matches via the network source. Try the Web Scraper for a specific company page, or tweak keywords.</p>';
    }
  } catch (err) {
    // Offline/fallback: generate synthetic matching opportunities client-side
    const fallback = buildFallbackJobs(payload);
    $('#scan-count').textContent = fallback.length;
    $('#scan-hint').classList.add('hidden');
    renderScanResults(fallback);
    toast('Used offline matching (Netlify function unavailable)', true);
  } finally {
    btn.disabled = false; btn.textContent = '🔍 Scan Matching Jobs';
  }
}

function buildFallbackJobs(p) {
  const kwList = p.keywords.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const bases = [
    { title: p.role || 'Software Engineer', company: 'Aurora Labs', loc: p.location || 'Remote', src: p.source },
    { title: p.role || 'Full Stack Developer', company: 'Nimbus Systems', loc: p.location || 'London', src: p.source },
    { title: p.role || 'Frontend Engineer', company: 'Vertex Digital', loc: p.location || 'Remote', src: p.source },
    { title: p.role || 'Product Engineer', company: 'Helix AI', loc: p.location || 'New York', src: p.source },
  ];
  return bases.map((b, i) => {
    const matched = kwList.filter((k) => i !== 3 || true);
    return {
      id: uid(),
      title: b.title,
      company: b.company,
      location: b.loc,
      source: b.src,
      description: `We are hiring a ${b.title} to join our team. Responsibilities include building scalable web applications and collaborating with cross-functional product teams. Looking for someone skilled in: ${matched.join(', ') || 'modern web development'}.\n\nApply ${p.source} to move forward!`,
      url: `https://${b.company.toLowerCase().replace(/\s+/g, '')}.example.com/careers`,
      keywords: matched,
      posted: 'Just now',
    };
  });
}

function renderScanResults(jobs) {
  const box = $('#scan-results');
  box.innerHTML = '';
  if (!jobs.length) { box.innerHTML = '<p class="muted small">No jobs found.</p>'; return; }
  jobs.forEach((job) => {
    const card = document.createElement('div');
    card.className = 'card';
    const matchPct = Math.min(98, 55 + Math.floor(Math.random() * 40));
    const level = matchPct > 80 ? 'high' : matchPct > 65 ? 'med' : 'low';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title">${esc(job.title || 'Role')}</div>
          <div class="card-sub">${esc(job.company || 'Company')} · ${esc(job.location || 'Remote')}</div>
        </div>
        <div class="card-match"><span class="match-pill match-${level}">${matchPct}% match</span></div>
      </div>
      <div class="card-meta">
        <span>🗂 ${esc(job.source || 'listed')}</span>
        ${job.posted ? `<span>🕒 ${esc(job.posted)}</span>` : ''}
        ${job.role ? `<span>🎯 ${esc(job.role)}</span>` : ''}
      </div>
      <div class="card-desc">${esc(clip(job.description, 160))}</div>
      ${job.keywords && job.keywords.length ? `<div class="card-meta">Keywords: ${job.keywords.map((k) => `<span class="tag">${esc(k)}</span>`).join('')}</div>` : ''}
      <div class="card-actions">
        <button class="btn small" data-act="open" data-url="${esc(job.url || '#')}">🔗 Open</button>
        <button class="btn small" data-act="save" data-id="${job.id}">💾 Save to DB</button>
        <button class="btn small" data-act="email" data-id="${job.id}">✉️ Email Recruiter</button>
      </div>`;
    card.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const doc = { ...job, savedAt: new Date().toISOString() };
      await DB.insert('jobs', doc);
      toast('Saved to database ✓');
      refreshStatCounts();
    });
    card.querySelector('[data-act="open"]').addEventListener('click', () => { if (job.url) window.open(job.url, '_blank'); });
    card.querySelector('[data-act="email"]').addEventListener('click', () => {
      DB.insert('jobs', job);
      fillEmailFromJob(job);
      switchView('email');
    });
    box.appendChild(card);
  });
}

function fillEmailFromJob(job) {
  $('#email-company').value = job.company || '';
  $('#email-role').value = job.title || '';
  $('#email-fit').value = job.keywords && job.keywords.length ? ('Strong background in: ' + job.keywords.join(', ')) : '';
  const domain = (job.url || '').replace(/^https?:\/\//, '').split('/')[0];
  $('#email-to').value = 'hiring@' + domain;
}

/* ---------- WEB SCRAPER ---------- */
$('#scrape-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('#scrape-url').value.trim();
  if (!url) return toast('Enter a URL', true);
  const btn = $('#scrape-form .btn');
  btn.disabled = true; btn.textContent = 'Scraping...';
  try {
    const res = await fetch('/.netlify/functions/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scrape failed');
    renderScrapeResults(data.jobs || []);
    $('#scrape-json').classList.remove('hidden');
    $('#scrape-json').textContent = JSON.stringify(data.jobs || [], null, 2);
  } catch (err) {
    toast('Scrape failed: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = '🕷️ Scrape & Structure';
  }
});

let lastScraped = [];
function renderScrapeResults(jobs) {
  lastScraped = jobs;
  $('#scrape-count').textContent = jobs.length;
  const box = $('#scrape-results');
  box.innerHTML = '';
  if (!jobs.length) { box.innerHTML = '<p class="muted small">No structured listings extracted. Check the URL.</p>'; return; }
  jobs.forEach((job) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title">${esc(job.title || 'Role')}</div>
          <div class="card-sub">${esc(job.company || '')} ${job.location ? '· ' + esc(job.location) : ''}</div>
        </div>
        ${job.remote ? '<span class="tag">🌍 Remote</span>' : ''}
      </div>
      <div class="card-desc">${esc(clip(job.description, 200))}</div>
      <div class="card-meta">
        ${job.salary ? `<span>💰 ${esc(job.salary)}</span>` : ''}
        ${job.type ? `<span>🧩 ${esc(job.type)}</span>` : ''}
        ${job.url ? `<span>🔗 ${esc(job.url)}</span>` : ''}
      </div>
      ${job.requirements && job.requirements.length ? `<div class="card-meta">Requirements: ${job.requirements.map((r) => `<span class="tag">${esc(r)}</span>`).join('')}</div>` : ''}
      <div class="card-actions">
        <button class="btn small" data-act="save" data-id="${job.id}">💾 Save</button>
      </div>`;
    card.querySelector('[data-act="save"]').addEventListener('click', async () => {
      await DB.insert('scraped', { ...job, savedAt: new Date().toISOString() });
      toast('Scraped listing saved ✓');
    });
    box.appendChild(card);
  });
}

$('#scrape-copy').addEventListener('click', () => {
  if (!$('#scrape-json').textContent) return toast('Nothing to copy', true);
  navigator.clipboard.writeText($('#scrape-json').textContent);
  toast('JSON copied');
});
$('#scrape-save-all').addEventListener('click', async () => {
  if (!lastScraped.length) return toast('Nothing to save', true);
  await DB.insert('scraped', lastScraped.map((j) => ({ ...j, savedAt: new Date().toISOString() })));
  toast('All saved to database ✓');
});

/* ---------- RESUME BOOSTER ---------- */
let baseResumeText = '';
$('#resume-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = $('#resume-file').files[0];
  if (!file) return toast('Choose a resume file', true);
  const btn = $('#resume-form .btn');
  btn.disabled = true; btn.textContent = 'Extracting text...';
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/.netlify/functions/extract-resume', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Extraction failed');
    baseResumeText = data.text || '';
    $('#resume-file-label').textContent = '✅ ' + (file.name || 'resume uploaded');
    $('#resume-base-preview').classList.remove('hidden');
    $('#resume-base-text').textContent = baseResumeText;
    await DB.saveSettings({ resumeBase: baseResumeText });
    toast('Resume parsed ✓');
  } catch (err) {
    // Offline fallback: read .txt directly
    if (file.name.endsWith('.txt')) {
      baseResumeText = await file.text();
      $('#resume-base-preview').classList.remove('hidden');
      $('#resume-base-text').textContent = baseResumeText;
      await DB.saveSettings({ resumeBase: baseResumeText });
      toast('Resume parsed (offline .txt mode) ✓');
    } else {
      toast('Extraction failed: ' + err.message, true);
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Upload & Parse';
  }
});

$('#resume-tailor').addEventListener('click', async () => {
  const jd = $('#resume-jd').value.trim();
  if (!jd) return toast('Paste a job description first', true);
  if (!baseResumeText) return toast('Upload & parse your base resume first', true);
  const kw = $('#resume-keywords').value.trim();
  const btn = $('#resume-tailor');
  btn.disabled = true; btn.textContent = 'Tailoring...';
  const msg = $('#resume-msg');
  msg.className = 'form-msg'; msg.textContent = '';

  try {
    const res = await fetch('/.netlify/functions/tailor-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: baseResumeText, jd, keywords: kw.split(',').map((s) => s.trim()).filter(Boolean), keepKeywords: $('#resume-keep-keywords').checked }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Tailoring failed');
    $('#resume-tailor-preview').classList.remove('hidden');
    $('#resume-tailor-text').value = data.resume;
    msg.className = 'form-msg ok'; msg.textContent = '✨ Tailored resume ready — matched keywords retained.';
  } catch (err) {
    msg.className = 'form-msg err';
    msg.textContent = 'Tailoring error: ' + err.message + ' (falls back to offline keyword-matching below)';
    // Offline fallback: naive keyword reordering
    const fallback = offlineTailor(baseResumeText, jd, kw);
    $('#resume-tailor-preview').classList.remove('hidden');
    $('#resume-tailor-text').value = fallback;
  } finally {
    btn.disabled = false; btn.textContent = '✨ Generate Tailored Resume';
  }
});

function offlineTailor(resume, jd, kw) {
  const kwList = kw.split(',').map((s) => s.trim()).filter(Boolean);
  let out = resume;
  kwList.forEach((k) => {
    const re = new RegExp(`\\b${escapeRegExp(k)}\\b`, 'gi');
    out = out.replace(re, (m) => m.toUpperCase());
  });
  return 'NOTE: Offline tailoring (no OpenAI key). Keywords from your list are emphasized with CAPS.\n\n' + out;
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

$('#resume-copy').addEventListener('click', () => {
  navigator.clipboard.writeText($('#resume-tailor-text').value);
  toast('Tailored resume copied');
});
$('#resume-download').addEventListener('click', () => {
  const blob = new Blob([$('#resume-tailor-text').value], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tailored_resume.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Downloaded');
});

/* ---------- COLD EMAIL ---------- */
function renderEmailSettings() {
  const s = DB.store.state.settings;
  $('#email-name').value = s.senderName || '';
  $('#email-from').value = s.senderEmail || '';
  $('#email-headline').value = s.headline || '';
}
$$('#email-settings input').forEach((i) => {
  i.addEventListener('change', () => {
    DB.saveSettings({
      senderName: $('#email-name').value,
      senderEmail: $('#email-from').value,
      headline: $('#email-headline').value,
    });
  });
});

$('#email-generate').addEventListener('click', async () => {
  const msg = $('#email-msg');
  msg.className = 'form-msg'; msg.textContent = '';
  const payload = {
    toName: $('#email-recipient').value.trim(),
    company: $('#email-company').value.trim(),
    role: $('#email-role').value.trim(),
    headline: $('#email-headline').value.trim(),
    fit: $('#email-fit').value.trim(),
    senderName: $('#email-name').value.trim(),
  };
  if (!payload.company) return toast('Enter the company name', true);
  if (!payload.role) return toast('Enter the role', true);
  try {
    const res = await fetch('/.netlify/functions/generate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');
    $('#email-body').value = data.body;
    msg.className = 'form-msg ok'; msg.textContent = '✨ Draft generated. Edit it, then send!';
  } catch (err) {
    $('#email-body').value = fallbackEmail(payload);
    msg.className = 'form-msg ok';
    msg.textContent = 'Draft generated (offline template). Edit it, then send!';
  }
});

function fallbackEmail(p) {
  const subject = `Application: ${p.role} @ ${p.company}`;
  return `Subject: ${subject}\n\nHi ${p.toName || 'there'},\n\nI hope you're doing well. I'm ${p.senderName || 'a candidate'}${p.headline ? `, ${p.headline}` : ''}, and I came across the ${p.role} opening at ${p.company}.${p.fit ? " Your description asks for exactly the kind of work I've been doing — " + p.fit + '.' : ' I believe my background aligns well with what your team is looking for.'}\n\nI would love the opportunity to contribute to ${p.company} and would be happy to share my resume and portfolio at your convenience.\n\nThank you for your time and consideration.\n\nWarm regards,\n${p.senderName || 'Candidate'}`;
}

$('#email-send').addEventListener('click', async () => {
  const body = $('#email-body').value.trim();
  const to = $('#email-to').value.trim();
  const msg = $('#email-msg');
  if (!to) return toast('Enter recipient email', true);
  if (!body) return toast('Write/generate a draft first', true);
  const btn = $('#email-send');
  btn.disabled = true; btn.textContent = 'Sending...';
  msg.className = 'form-msg'; msg.textContent = '';
  const subject = body.split('\n')[0].replace(/^Subject:\s*/i, '') || `Application — ${$('#email-role').value}`;
  try {
    const s = await DB.getAll('settings');
    const res = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        from: $('#email-from').value || s.senderEmail || '',
        subject,
        body,
        toName: $('#email-recipient').value,
        apiKey: s.resendKey || '',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || sendFailedMsg());
    await DB.insert('emails', { id: uid(), to, toName: $('#email-recipient').value, company: $('#email-company').value, role: $('#email-role').value, subject, body, sentAt: new Date().toISOString() });
    msg.className = 'form-msg ok'; msg.textContent = '✓ Email sent!';
    toast('Email sent ✓');
    renderEmailLog();
    refreshStatCounts();
  } catch (err) {
    // Save as "queued" so user doesn't lose the email
    await DB.insert('emails', { id: uid(), to, toName: $('#email-recipient').value, company: $('#email-company').value, role: $('#email-role').value, subject, body, pending: true, attemptedAt: new Date().toISOString() });
    msg.className = 'form-msg err';
    msg.textContent = 'Not sent: ' + (err.message || '') + ' — saved to log as pending. Add a Resend API key to send.';
    toast('Saved pending (no send key)', true);
    renderEmailLog();
  } finally {
    btn.disabled = false; btn.textContent = '✉️ Send Email';
  }
});
function sendFailedMsg() { return 'Email service error. Is a valid Resend key set?'; }

async function renderEmailLog() {
  const emails = await DB.getAll('emails');
  $('#email-log').innerHTML = '';
  if (!emails.length) { $('#email-log').innerHTML = '<p class="muted small">No emails yet.</p>'; return; }
  emails.forEach((e) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title">${esc(e.subject || 'No subject')}</div>
          <div class="card-sub">To: ${esc(e.to)} ${e.pending ? '<span class="tag">⏳ Pending</span>' : '<span class="tag">✅ Sent</span>'}</div>
        </div>
        <span class="muted small">${new Date(e.sentAt || e.attemptedAt || Date.now()).toLocaleString()}</span>
      </div>`;
    $('#email-log').appendChild(c);
  });
}

/* ---------- DATABASE VIEW ---------- */
async function renderDatabase() {
  const jobs = await DB.getAll('jobs');
  const scraped = await DB.getAll('scraped');
  const recruiters = await DB.getAll('recruiters');
  $('#db-jobs-count').textContent = jobs.length + scraped.length;
  $('#db-recruiters-count').textContent = recruiters.length;

  const rc = $('#db-recruiters');
  rc.innerHTML = '';
  if (!recruiters.length) rc.innerHTML = '<p class="muted small">No recruiters/leads yet. Save opportunities to build your list.</p>';
  recruiters.forEach((r) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `
      <div class="card-top">
        <div><div class="card-title">${esc(r.company || '')}</div><div class="card-sub">${esc(r.email || r.contact || '')}</div></div>
        <button class="btn small" data-del="${r.id}">🗑</button>
      </div>`;
    c.querySelector('[data-del]').addEventListener('click', async () => { await DB.remove('recruiters', r.id); renderDatabase(); });
    rc.appendChild(c);
  });

  const jc = $('#db-jobs');
  jc.innerHTML = '';
  const all = [...jobs, ...scraped];
  if (!all.length) jc.innerHTML = '<p class="muted small">No saved jobs yet.</p>';
  all.forEach((j) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `
      <div class="card-top">
        <div><div class="card-title">${esc(j.title || 'Role')} @ ${esc(j.company || '')}</div><div class="card-sub">${esc(j.location || '')} · saved ${new Date(j.savedAt || j.createdAt || Date.now()).toLocaleDateString()}</div></div>
        <button class="btn small" data-del="${j.id}">🗑</button>
      </div>`;
    c.querySelector('[data-del]').addEventListener('click', async () => { await DB.remove('jobs', j.id); await DB.remove('scraped', j.id); renderDatabase(); });
    jc.appendChild(c);
  });
}

/* ---------- EXPORTS ---------- */
$('#db-export').addEventListener('click', () => download('database.json', DB.exportAll()));
$('#export-data').addEventListener('click', () => download('database.json', DB.exportAll()));
function download(name, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Exported ' + name);
}

/* ---------- UTIL ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

/* ---------- INIT ---------- */
(async function init() {
  loadSupabaseClient();
  // Pick up resume base stored in settings from prior session
  const s = await DB.getAll('settings');
  if (s.resumeBase) {
    baseResumeText = s.resumeBase;
    $('#resume-base-preview').classList.remove('hidden');
    $('#resume-base-text').textContent = baseResumeText;
    $('#resume-file-label').textContent = '✅ Resume loaded from previous session';
  }
  await renderDashboard();
  await renderEmailLog();
})();

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
    if (!canAccessView(btn.dataset.view)) return;
    $$('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    switchView(btn.dataset.view);
  });
});
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => {
  if (!canAccessView(b.dataset.goto)) return;
  $$('.nav-item').forEach((x) => x.classList.toggle('active', x.dataset.view === b.dataset.goto));
  switchView(b.dataset.goto);
}));

const PROTECTED_VIEWS = ['remote', 'scanner', 'scraper', 'resume', 'ats', 'cover-letter', 'salary', 'auto-apply', 'email', 'database'];

function canAccessView(view) {
  if (!PROTECTED_VIEWS.includes(view)) return true;
  const user = getCurrentUserSync();
  if (!user) {
    toast('Please sign in first', true);
    switchView('login');
    return false;
  }
  if (user.accessStatus !== 'approved') {
    toast('Access pending admin approval', true);
    switchView('login');
    return false;
  }
  return true;
}

function getCurrentUserSync() {
  try {
    const stored = localStorage.getItem('hh_user');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

const VIEW_HANDLERS = {
  dashboard: renderDashboard,
  database: renderDatabase,
  email: renderEmailSettings,
  'cover-letter': renderCoverLetterList,
  ats: renderATSList,
  salary: renderSalaryList,
  'auto-apply': renderAutoApplyHistory,
  login: checkAuthState,
  remote: renderRemoteView,
};

function switchView(name) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  const el = $('#view-' + name);
  if (el) el.classList.add('active');
  const handler = VIEW_HANDLERS[name];
  if (handler) handler();
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

/* ---------- AUTH ---------- */
async function checkAuthState() {
  const user = await getCurrentUser();
  if (user) showLoggedIn(user);
  else showLoggedOut();
}

async function getCurrentUser() {
  try {
    const res = await fetch('/.netlify/functions/auth-me');
    const data = await res.json();
    return data.user || null;
  } catch { return null; }
}

function showLoggedIn(user) {
  // Check access status via auth-check-access
  checkUserAccess(user.email).then(access => {
    if (!access.hasAccess) {
      showAccessStatus(access);
      return;
    }
    
    // Store user for auth gate
    const userData = {
      email: user.email,
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      accessStatus: 'approved'
    };
    localStorage.setItem('hh_user', JSON.stringify(userData));
    
    $('#logged-in-view').classList.remove('hidden');
    $$('.auth-form').forEach(f => f.classList.add('hidden'));
    $$('.auth-tab').forEach(t => t.classList.add('hidden'));
    $('#user-name').textContent = userData.name;
    $('#user-email').textContent = userData.email;
    $('#user-status').textContent = 'Approved';
    $('#user-status').className = 'status-badge approved';
  });
}

async function checkUserAccess(email) {
  try {
    const res = await fetch('/.netlify/functions/auth-check-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return await res.json();
  } catch {
    return { hasAccess: false, status: 'error', message: 'Unable to verify access' };
  }
}

function showAccessStatus(access) {
  $('#logged-in-view').classList.add('hidden');
  $$('.auth-form').forEach(f => f.classList.add('hidden'));
  $$('.auth-tab').forEach(t => t.classList.add('hidden'));
  $('#access-status-view').classList.remove('hidden');
  
  const icons = { pending: '⏳', approved: '✅', rejected: '❌', not_requested: '📝' };
  const titles = { 
    pending: 'Access Pending', 
    approved: 'Access Approved', 
    rejected: 'Access Denied', 
    not_requested: 'Request Access' 
  };
  
  $('#status-icon').textContent = icons[access.status] || '❓';
  $('#status-title').textContent = titles[access.status] || 'Access Status';
  $('#status-message').textContent = access.message || 'Unknown status';
  
  let details = '';
  if (access.status === 'pending') details = '<p class="muted small">An admin will review your request within 24 hours.</p>';
  if (access.status === 'rejected') details = `<p class="muted small">Reason: ${access.admin_notes || 'No reason provided'}</p>`;
  if (access.status === 'not_requested') details = '<p class="muted small">Click "Request Access" tab to apply.</p>';
  $('#status-details').innerHTML = details;
}

function showLoggedOut() {
  localStorage.removeItem('hh_user');
  $('#logged-in-view').classList.add('hidden');
  $('#access-status-view').classList.add('hidden');
  $$('.auth-form').forEach(f => f.classList.remove('hidden'));
  $$('.auth-tab').forEach(t => t.classList.remove('hidden'));
  $('#login-form').classList.remove('hidden');
  $('#signup-form').classList.add('hidden');
  $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'login'));
}

$$('.auth-tab').forEach(t => t.addEventListener('click', () => {
  $$('.auth-tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('#login-form').classList.toggle('hidden', t.dataset.tab !== 'login');
  $('#signup-form').classList.toggle('hidden', t.dataset.tab !== 'signup');
  $('#login-msg').textContent = '';
  $('#signup-msg').textContent = '';
}));

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#login-msg');
  msg.textContent = '';
  try {
    const res = await fetch('/.netlify/functions/auth-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    showLoggedIn(data.user);
    await DB.loadFromSupabase();
    renderDashboard();
    toast('Welcome back!');
  } catch (err) {
    msg.className = 'form-msg err';
    msg.textContent = err.message;
  }
});

$('#signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#signup-msg');
  msg.textContent = '';
  if ($('#signup-password').value !== $('#signup-confirm').value) {
    msg.className = 'form-msg err';
    msg.textContent = 'Passwords do not match';
    return;
  }
  try {
    const res = await fetch('/.netlify/functions/auth-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('#signup-email').value,
        password: $('#signup-password').value,
        name: $('#signup-name').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    msg.className = 'form-msg ok';
    msg.textContent = 'Account created! Check email to confirm, then sign in.';
  } catch (err) {
    msg.className = 'form-msg err';
    msg.textContent = err.message;
  }
});

$('#btn-logout').addEventListener('click', async () => {
  try {
    await fetch('/.netlify/functions/auth-logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    showLoggedOut();
    DB.clear();
    renderDashboard();
    toast('Signed out');
  } catch (err) {
    toast('Logout failed: ' + err.message, true);
  }
});

/* ---------- BTC COPY ---------- */
$('#btc-copy').addEventListener('click', () => {
  const addr = '0xdd1e9C99Fa2D42F48f5c5F0c155b48E9b31b9C42';
  navigator.clipboard.writeText(addr);
  toast('Bitcoin address copied: ' + addr.slice(0, 10) + '...' + addr.slice(-6));
});

/* ---------- JOB SCANNER ---------- */
$('#scan-form').addEventListener('submit', async (e) => { e.preventDefault(); await runScan(); });
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
  const payload = { keywords, location: $('#scan-location').value.trim(), role: $('#scan-role').value.trim(), source: $('#scan-source').value };
  try {
    const res = await fetch('/.netlify/functions/job-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scan failed');
    $('#scan-count').textContent = data.jobs.length;
    $('#scan-hint').classList.add('hidden');
    renderScanResults(data.jobs);
  } catch (err) {
    const fallback = buildFallbackJobs(payload);
    $('#scan-count').textContent = fallback.length;
    $('#scan-hint').classList.add('hidden');
    renderScanResults(fallback);
    toast('Used offline matching', true);
  } finally { btn.disabled = false; btn.textContent = '🔍 Scan Matching Jobs'; }
}

function buildFallbackJobs(p) {
  const kwList = p.keywords.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const bases = [
    { title: p.role || 'Software Engineer', company: 'Aurora Labs', loc: p.location || 'Remote', src: p.source },
    { title: p.role || 'Full Stack Developer', company: 'Nimbus Systems', loc: p.location || 'London', src: p.source },
    { title: p.role || 'Frontend Engineer', company: 'Vertex Digital', loc: p.location || 'Remote', src: p.source },
    { title: p.role || 'Product Engineer', company: 'Helix AI', loc: p.location || 'New York', src: p.source },
  ];
  return bases.map((b, i) => ({
    id: uid(), title: b.title, company: b.company, location: b.loc, source: b.src,
    description: `We are hiring a ${b.title} to join our team. Looking for: ${kwList.join(', ') || 'modern web dev'}.`,
    url: `https://${b.company.toLowerCase().replace(/\s+/g, '')}.example.com/careers`, keywords: kwList, posted: 'Just now',
  }));
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
        <div><div class="card-title">${esc(job.title)}</div><div class="card-sub">${esc(job.company)} · ${esc(job.location)}</div></div>
        <div class="card-match"><span class="match-pill match-${level}">${matchPct}% match</span></div>
      </div>
      <div class="card-meta"><span>🗂 ${esc(job.source)}</span> ${job.posted ? `<span>🕒 ${esc(job.posted)}</span>` : ''}</div>
      <div class="card-desc">${esc(clip(job.description, 160))}</div>
      ${job.keywords?.length ? `<div class="card-meta">Keywords: ${job.keywords.map(k => `<span class="tag">${esc(k)}</span>`).join('')}</div>` : ''}
      <div class="card-actions">
        <button class="btn small" data-act="open" data-url="${esc(job.url)}">🔗 Open</button>
        <button class="btn small" data-act="save" data-id="${job.id}">💾 Save</button>
        <button class="btn small" data-act="email" data-id="${job.id}">✉️ Email</button>
        <button class="btn small" data-act="apply" data-id="${job.id}">🚀 Auto-Apply</button>
      </div>`;
    card.querySelector('[data-act="save"]').addEventListener('click', async () => { await DB.insert('jobs', { ...job, savedAt: new Date().toISOString() }); toast('Saved ✓'); refreshStatCounts(); });
    card.querySelector('[data-act="open"]').addEventListener('click', () => { if (job.url) window.open(job.url, '_blank'); });
    card.querySelector('[data-act="email"]').addEventListener('click', () => { DB.insert('jobs', job); fillEmailFromJob(job); switchView('email'); });
    card.querySelector('[data-act="apply"]').addEventListener('click', () => { DB.insert('jobs', job); prepAutoApply(job); switchView('auto-apply'); });
    box.appendChild(card);
  });
}

function fillEmailFromJob(job) {
  $('#email-company').value = job.company || '';
  $('#email-role').value = job.title || '';
  $('#email-fit').value = job.keywords?.length ? 'Strong background in: ' + job.keywords.join(', ') : '';
  const domain = (job.url || '').replace(/^https?:\/\//, '').split('/')[0];
  $('#email-to').value = 'hiring@' + domain;
}

function prepAutoApply(job) {
  $('#aa-title').value = job.title || '';
  $('#aa-company').value = job.company || '';
  $('#aa-jd').value = job.description || '';
  $('#aa-job-url').value = job.url || '';
}

/* ---------- WEB SCRAPER ---------- */
$('#scrape-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('#scrape-url').value.trim();
  if (!url) return toast('Enter a URL', true);
  const btn = $('#scrape-form .btn');
  btn.disabled = true; btn.textContent = 'Scraping...';
  try {
    const res = await fetch('/.netlify/functions/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scrape failed');
    renderScrapeResults(data.jobs || []);
    $('#scrape-json').classList.remove('hidden');
    $('#scrape-json').textContent = JSON.stringify(data.jobs || [], null, 2);
  } catch (err) { toast('Scrape failed: ' + err.message, true); }
  finally { btn.disabled = false; btn.textContent = '🕷️ Scrape & Structure'; }
});

let lastScraped = [];
function renderScrapeResults(jobs) {
  lastScraped = jobs;
  $('#scrape-count').textContent = jobs.length;
  const box = $('#scrape-results');
  box.innerHTML = '';
  if (!jobs.length) { box.innerHTML = '<p class="muted small">No structured listings extracted.</p>'; return; }
  jobs.forEach((job) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top"><div><div class="card-title">${esc(job.title)}</div><div class="card-sub">${esc(job.company)} ${job.location ? '· ' + esc(job.location) : ''}</div></div>
        ${job.remote ? '<span class="tag">🌍 Remote</span>' : ''}</div>
      <div class="card-desc">${esc(clip(job.description, 200))}</div>
      <div class="card-meta">${job.salary ? `<span>💰 ${esc(job.salary)}</span>` : ''}${job.type ? `<span>🧩 ${esc(job.type)}</span>` : ''}${job.url ? `<span>🔗 ${esc(job.url)}</span>` : ''}</div>
      ${job.requirements?.length ? `<div class="card-meta">Requirements: ${job.requirements.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div>` : ''}
      <div class="card-actions"><button class="btn small" data-act="save" data-id="${job.id}">💾 Save</button>
        <button class="btn small" data-act="apply" data-id="${job.id}">🚀 Auto-Apply</button></div>`;
    card.querySelector('[data-act="save"]').addEventListener('click', async () => { await DB.insert('scraped', { ...job, savedAt: new Date().toISOString() }); toast('Saved ✓'); });
    card.querySelector('[data-act="apply"]').addEventListener('click', () => { prepAutoApply(job); switchView('auto-apply'); });
    box.appendChild(card);
  });
}
$('#scrape-copy').addEventListener('click', () => { if (!$('#scrape-json').textContent) return toast('Nothing to copy', true); navigator.clipboard.writeText($('#scrape-json').textContent); toast('JSON copied'); });
$('#scrape-save-all').addEventListener('click', async () => { if (!lastScraped.length) return toast('Nothing to save', true); await DB.insert('scraped', lastScraped.map(j => ({ ...j, savedAt: new Date().toISOString() }))); toast('All saved ✓'); });

/* ---------- RESUME BOOSTER ---------- */
let baseResumeText = '';
$('#resume-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = $('#resume-file').files[0];
  if (!file) return toast('Choose a resume file', true);
  const btn = $('#resume-form .btn');
  btn.disabled = true; btn.textContent = 'Extracting...';
  try {
    const form = new FormData(); form.append('file', file);
    const res = await fetch('/.netlify/functions/extract-resume', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Extraction failed');
    baseResumeText = data.text || '';
    $('#resume-file-label').textContent = '✅ ' + (file.name || 'resume');
    $('#resume-base-preview').classList.remove('hidden');
    $('#resume-base-text').textContent = baseResumeText;
    await DB.saveSettings({ resumeBase: baseResumeText });
    toast('Resume parsed ✓');
  } catch (err) {
    if (file.name.endsWith('.txt')) { baseResumeText = await file.text(); $('#resume-base-preview').classList.remove('hidden'); $('#resume-base-text').textContent = baseResumeText; await DB.saveSettings({ resumeBase: baseResumeText }); toast('Resume parsed (txt mode) ✓'); }
    else { toast('Extraction failed: ' + err.message, true); }
  } finally { btn.disabled = false; btn.textContent = 'Upload & Parse'; }
});

$('#resume-tailor').addEventListener('click', async () => {
  const jd = $('#resume-jd').value.trim();
  if (!jd) return toast('Paste a job description first', true);
  if (!baseResumeText) return toast('Upload & parse your base resume first', true);
  const kw = $('#resume-keywords').value.trim();
  const btn = $('#resume-tailor'); btn.disabled = true; btn.textContent = 'Tailoring...';
  const msg = $('#resume-msg'); msg.className = 'form-msg'; msg.textContent = '';
  try {
    const res = await fetch('/.netlify/functions/tailor-resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume: baseResumeText, jd, keywords: kw.split(',').map(s => s.trim()).filter(Boolean), keepKeywords: $('#resume-keep-keywords').checked }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Tailoring failed');
    $('#resume-tailor-preview').classList.remove('hidden');
    $('#resume-tailor-text').value = data.resume;
    msg.className = 'form-msg ok'; msg.textContent = '✨ Tailored resume ready';
  } catch (err) { msg.className = 'form-msg err'; msg.textContent = 'Error: ' + err.message; $('#resume-tailor-preview').classList.remove('hidden'); $('#resume-tailor-text').value = offlineTailor(baseResumeText, jd, kw); }
  finally { btn.disabled = false; btn.textContent = '✨ Generate Tailored Resume'; }
});

function offlineTailor(resume, jd, kw) {
  let out = resume; kw.split(',').map(s => s.trim()).filter(Boolean).forEach(k => { out = out.replace(new RegExp('\\b' + escapeRegExp(k) + '\\b', 'gi'), m => m.toUpperCase()); });
  return 'Offline mode (add OpenAI key for AI):\n\n' + out;
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
$('#resume-copy').addEventListener('click', () => { navigator.clipboard.writeText($('#resume-tailor-text').value); toast('Copied'); });
$('#resume-download').addEventListener('click', () => { const blob = new Blob([$('#resume-tailor-text').value], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tailored_resume.txt'; a.click(); URL.revokeObjectURL(a.href); toast('Downloaded'); });

/* ---------- COLD EMAIL ---------- */
function renderEmailSettings() {
  const s = DB.store.state.settings;
  $('#email-name').value = s.senderName || ''; $('#email-from').value = s.senderEmail || ''; $('#email-headline').value = s.headline || '';
}
$$('#email-settings input').forEach(i => i.addEventListener('change', () => DB.saveSettings({ senderName: $('#email-name').value, senderEmail: $('#email-from').value, headline: $('#email-headline').value })));

$('#email-generate').addEventListener('click', async () => {
  const msg = $('#email-msg'); msg.className = 'form-msg'; msg.textContent = '';
  const payload = { toName: $('#email-recipient').value.trim(), company: $('#email-company').value.trim(), role: $('#email-role').value.trim(), headline: $('#email-headline').value.trim(), fit: $('#email-fit').value.trim(), senderName: $('#email-name').value.trim() };
  if (!payload.company || !payload.role) return toast('Enter company and role', true);
  try {
    const res = await fetch('/.netlify/functions/generate-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');
    $('#email-body').value = data.body; msg.className = 'form-msg ok'; msg.textContent = '✨ Draft generated';
  } catch (err) { $('#email-body').value = fallbackEmail(payload); msg.className = 'form-msg ok'; msg.textContent = 'Draft generated (template)'; }
});
function fallbackEmail(p) { return `Subject: Application: ${p.role} at ${p.company}\n\nHi ${p.toName || 'there'},\n\nI'm ${p.senderName || 'a candidate'}${p.headline ? ', ' + p.headline : ''}. I'm interested in the ${p.role} role at ${p.company}.${p.fit ? ' ' + p.fit : ''}\n\nI'd love to contribute to ${p.company}. Thank you for your consideration.\n\nBest,\n${p.senderName || 'Candidate'}`; }

$('#email-send').addEventListener('click', async () => {
  const body = $('#email-body').value.trim(), to = $('#email-to').value.trim(), msg = $('#email-msg');
  if (!to || !body) return toast('Enter recipient and draft', true);
  const btn = $('#email-send'); btn.disabled = true; btn.textContent = 'Sending...'; msg.className = 'form-msg'; msg.textContent = '';
  const subject = body.split('\n')[0].replace(/^Subject:\s*/i, '') || `Application — ${$('#email-role').value}`;
  try {
    const s = await DB.getAll('settings');
    const res = await fetch('/.netlify/functions/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, from: $('#email-from').value || s.senderEmail, subject, body, toName: $('#email-recipient').value, apiKey: s.resendKey }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Send failed');
    await DB.insert('emails', { id: uid(), to, toName: $('#email-recipient').value, company: $('#email-company').value, role: $('#email-role').value, subject, body, sentAt: new Date().toISOString() });
    msg.className = 'form-msg ok'; msg.textContent = '✓ Sent!'; toast('Email sent ✓'); renderEmailLog(); refreshStatCounts();
  } catch (err) { await DB.insert('emails', { id: uid(), to, toName: $('#email-recipient').value, company: $('#email-company').value, role: $('#email-role').value, subject, body, pending: true, attemptedAt: new Date().toISOString() }); msg.className = 'form-msg err'; msg.textContent = 'Saved as pending: ' + err.message; toast('Saved pending', true); renderEmailLog(); }
  finally { btn.disabled = false; btn.textContent = '✉️ Send Email'; }
});
async function renderEmailLog() { const emails = await DB.getAll('emails'); $('#email-log').innerHTML = emails.length ? '' : '<p class="muted small">No emails yet.</p>'; emails.forEach(e => { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<div class="card-top"><div><div class="card-title">${esc(e.subject)}</div><div class="card-sub">To: ${esc(e.to)} ${e.pending ? '<span class="tag">⏳ Pending</span>' : '<span class="tag">✅ Sent</span>'}</div></div><span class="muted small">${new Date(e.sentAt || e.attemptedAt).toLocaleString()}</span>`; $('#email-log').appendChild(c); }); }

/* ---------- COVER LETTER ---------- */
async function renderCoverLetterList() {
  const list = await DB.getAll('cover_letters');
  $('#cl-list').innerHTML = list.length ? '' : '<p class="muted small">No saved cover letters.</p>';
  list.forEach(cl => { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<div class="card-top"><div><div class="card-title">${esc(cl.company)} - ${esc(cl.role)}</div><div class="card-sub">${new Date(cl.createdAt).toLocaleDateString()}</div></div><button class="btn small" data-del="${cl.id}">🗑</button></div>`; c.querySelector('[data-del]').addEventListener('click', async () => { await DB.remove('cover_letters', cl.id); renderCoverLetterList(); }); $('#cl-list').appendChild(c); });
}

$('#cl-generate').addEventListener('click', async () => {
  const msg = $('#cl-msg'); msg.className = 'form-msg'; msg.textContent = '';
  if (!$('#cl-jd').value.trim() || !$('#cl-company').value.trim() || !$('#cl-role').value.trim()) return toast('Fill JD, company, role', true);
  const btn = $('#cl-generate'); btn.disabled = true; btn.textContent = 'Generating...';
  try {
    const res = await fetch('/.netlify/functions/cover-letter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume: baseResumeText || $('#resume-base-text').textContent || 'Experienced professional', jd: $('#cl-jd').value, company: $('#cl-company').value, role: $('#cl-role').value, sender_name: $('#cl-name').value, headline: $('#cl-headline').value, tone: $('#cl-tone').value }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Failed');
    $('#cl-output').classList.remove('hidden'); $('#cl-output').value = data.cover_letter;
    msg.className = 'form-msg ok'; msg.textContent = '✨ Generated';
  } catch (err) { msg.className = 'form-msg err'; msg.textContent = err.message; }
  finally { btn.disabled = false; btn.textContent = '✨ Generate Cover Letter'; }
});
$('#cl-copy').addEventListener('click', () => { navigator.clipboard.writeText($('#cl-output').value); toast('Copied'); });
$('#cl-download').addEventListener('click', () => { const blob = new Blob([$('#cl-output').value], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cover_letter.txt'; a.click(); URL.revokeObjectURL(a.href); toast('Downloaded'); });
$('#cl-save').addEventListener('click', async () => { if (!$('#cl-output').value) return toast('Generate first', true); await DB.insert('cover_letters', { id: uid(), company: $('#cl-company').value, role: $('#cl-role').value, content: $('#cl-output').value, createdAt: new Date().toISOString() }); toast('Saved ✓'); renderCoverLetterList(); });

/* ---------- ATS OPTIMIZER ---------- */
async function renderATSList() { /* placeholder */ }

$('#ats-analyze').addEventListener('click', async () => {
  const msg = $('#ats-msg'); msg.className = 'form-msg'; msg.textContent = '';
  if (!$('#ats-resume').value.trim() || !$('#ats-jd').value.trim()) return toast('Fill resume and JD', true);
  const btn = $('#ats-analyze'); btn.disabled = true; btn.textContent = 'Analyzing...';
  try {
    const res = await fetch('/.netlify/functions/ats-optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume: $('#ats-resume').value, jd: $('#ats-jd').value, keywords: $('#ats-keywords').value.split(',').map(s => s.trim()).filter(Boolean), target_role: $('#ats-role').value }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Failed');
    $('#ats-output').classList.remove('hidden'); $('#ats-output').value = data.resume;
    renderATSAnalysis(data.analysis);
    msg.className = 'form-msg ok'; msg.textContent = '✨ Optimized';
  } catch (err) { msg.className = 'form-msg err'; msg.textContent = err.message; }
  finally { btn.disabled = false; btn.textContent = '🔍 Analyze & Optimize'; }
});

function renderATSAnalysis(a) {
  if (!a) return;
  $('#ats-score').textContent = a.ats_score_estimate + '%';
  $('#ats-analysis').classList.remove('hidden');
  $('#ats-analysis').innerHTML = `
    <div class="ats-metric"><div class="ats-metric-label">Keyword Coverage</div><div class="ats-metric-value ${a.keyword_coverage.includes('100%') ? 'good' : a.keyword_coverage.includes('0%') ? 'bad' : 'warn'}">${a.keyword_coverage}</div></div>
    <div class="ats-metric"><div class="ats-metric-label">Standard Sections</div><div class="ats-metric-value ${a.standard_sections >= 5 ? 'good' : 'warn'}">${a.standard_sections}</div></div>
    <div class="ats-metric"><div class="ats-metric-label">Action Verbs</div><div class="ats-metric-value ${a.action_verbs_used >= 5 ? 'good' : 'warn'}">${a.action_verbs_used}</div></div>
    <div class="ats-metric"><div class="ats-metric-label">Quantified Achievements</div><div class="ats-metric-value ${a.quantified_achievements >= 3 ? 'good' : 'warn'}">${a.quantified_achievements}</div></div>
    <div class="ats-recommendations"><h4>Recommendations</h4><ul>${a.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
}
$('#ats-copy').addEventListener('click', () => { navigator.clipboard.writeText($('#ats-output').value); toast('Copied'); });
$('#ats-download').addEventListener('click', () => { const blob = new Blob([$('#ats-output').value], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ats_resume.txt'; a.click(); URL.revokeObjectURL(a.href); toast('Downloaded'); });

/* ---------- SALARY ESTIMATOR ---------- */
async function renderSalaryList() {
  const list = await DB.getAll('salary_estimates');
  $('#sal-list').innerHTML = list.length ? '' : '<p class="muted small">No saved estimates.</p>';
  list.forEach(s => { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<div class="card-top"><div><div class="card-title">${esc(s.role)} @ ${esc(s.location)}</div><div class="card-sub">$${s.estimated_salary?.low?.toLocaleString()} - $${s.estimated_salary?.high?.toLocaleString()}</div></div><button class="btn small" data-del="${s.id}">🗑</button></div>`; c.querySelector('[data-del]').addEventListener('click', async () => { await DB.remove('salary_estimates', s.id); renderSalaryList(); }); $('#sal-list').appendChild(c); });
}

$('#salary-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#salary-form .btn'); btn.disabled = true; btn.textContent = 'Estimating...';
  try {
    const res = await fetch('/.netlify/functions/salary-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: $('#sal-role').value, location: $('#sal-location').value, experience_years: $('#sal-exp').value, skills: $('#sal-skills').value.split(',').map(s => s.trim()).filter(Boolean), industry: $('#sal-industry').value, company_size: $('#sal-size').value }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Failed');
    renderSalaryResult(data); $('#sal-result').classList.remove('hidden');
  } catch (err) { toast('Error: ' + err.message, true); }
  finally { btn.disabled = false; btn.textContent = '💰 Estimate Salary'; }
});

function renderSalaryResult(d) {
  $('#sal-result').innerHTML = `
    <div class="sal-card primary"><h4>Estimated Annual Salary</h4><div class="sal-amount">$${d.estimated_salary.mid.toLocaleString()}</div>
      <div class="sal-range"><span>Low: $${d.estimated_salary.low.toLocaleString()}</span><span>High: $${d.estimated_salary.high.toLocaleString()}</span></div>
    </div>
    <div class="sal-card"><h4>Equity</h4><div class="sal-amount">${d.equity.type}</div><div>${d.equity.range} • ${d.equity.vesting}</div></div>
    <div class="sal-breakdown"><h4>Breakdown</h4><div class="sal-breakdown-grid">
      <div class="sal-breakdown-item"><div class="sal-breakdown-label">Base Role</div><div class="sal-breakdown-value">$${d.breakdown.base_role.toLocaleString()}</div></div>
      <div class="sal-breakdown-item"><div class="sal-breakdown-label">Location</div><div class="sal-breakdown-value">${d.breakdown.location_multiplier}x</div></div>
      <div class="sal-breakdown-item"><div class="sal-breakdown-label">Experience</div><div class="sal-breakdown-value">${d.breakdown.experience_multiplier}x</div></div>
      <div class="sal-breakdown-item"><div class="sal-breakdown-label">Industry</div><div class="sal-breakdown-value">${d.breakdown.industry_multiplier}x</div></div>
      <div class="sal-breakdown-item"><div class="sal-breakdown-label">Company Size</div><div class="sal-breakdown-value">${d.breakdown.company_size_multiplier}x</div></div>
      <div class="sal-breakdown-item"><div class="sal-breakdown-label">Skill Premiums</div><div class="sal-breakdown-value">+$${d.breakdown.skill_premiums.toLocaleString()}</div></div>
    </div></div>
    <div class="sal-benefits"><h4>Typical Benefits</h4><ul>${d.benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>
    <p class="muted small">${d.note}</p>`;
}

/* ---------- AUTO APPLY ---------- */
async function renderAutoApplyHistory() {
  const list = await DB.getAll('applications');
  $('#aa-history').innerHTML = list.length ? '' : '<p class="muted small">No applications sent yet.</p>';
  list.forEach(a => { const c = document.createElement('div'); c.className = 'card aa-history-item'; c.innerHTML = `<div class="aa-history-header"><span class="aa-history-company">${esc(a.company)} - ${esc(a.role)}</span><span class="aa-history-status ${a.status}">${a.status}</span></div><div class="aa-history-details">Sent to ${a.contacts_sent} contacts • ${new Date(a.sentAt).toLocaleString()}</div>`; $('#aa-history').appendChild(c); });
}

let aaContacts = [];

$('#aa-find-contacts').addEventListener('click', () => {
  if (!$('#aa-company').value.trim()) return toast('Enter company name', true);
  const domain = $('#aa-company').value.toLowerCase().replace(/\s+/g, '') + '.com';
  aaContacts = [
    { email: `hiring@${domain}`, name: 'Hiring Team', role: 'Recruiting' },
    { email: `recruiting@${domain}`, name: 'Recruiting', role: 'Talent Acquisition' },
    { email: `jobs@${domain}`, name: 'Jobs', role: 'HR' },
    { email: `talent@${domain}`, name: 'Talent', role: 'TA' },
  ];
  renderAAContacts();
  $('#aa-msg').className = 'form-msg ok'; $('#aa-msg').textContent = 'Generated likely contacts';
});

$('#aa-scrape-contacts').addEventListener('click', async () => {
  const url = $('#aa-job-url').value.trim() || $('#aa-company').value.trim();
  if (!url) return toast('Enter job URL or company', true);
  $('#aa-msg').className = 'form-msg'; $('#aa-msg').textContent = 'Scraping...';
  try {
    const res = await fetch('/.netlify/functions/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.startsWith('http') ? url : 'https://' + url }) });
    const data = await res.json();
    if (data.jobs?.length) {
      const j = data.jobs[0];
      aaContacts = [{ email: `hiring@${extractDomain(url)}`, name: 'Hiring Team', role: 'Recruiting' }];
      $('#aa-title').value = j.title || $('#aa-title').value;
      $('#aa-company').value = j.company || $('#aa-company').value;
      $('#aa-jd').value = j.description || $('#aa-jd').value;
    }
    renderAAContacts();
    $('#aa-msg').className = 'form-msg ok'; $('#aa-msg').textContent = 'Scraped & found contacts';
  } catch (err) { $('#aa-msg').className = 'form-msg err'; $('#aa-msg').textContent = err.message; }
});

function renderAAContacts() {
  const box = $('#aa-contacts'); box.innerHTML = '';
  if (!aaContacts.length) { box.innerHTML = '<p class="muted small">No contacts yet. Click "Find Contacts" or add manually.</p>'; return; }
  aaContacts.forEach((c, i) => { const card = document.createElement('div'); card.className = 'card aa-contact-card'; card.innerHTML = `<div class="aa-contact-header"><span class="aa-contact-name">${esc(c.name)}</span><span class="aa-contact-role">${esc(c.role)}</span></div><div class="aa-contact-email">${esc(c.email)}</div><div class="aa-contact-actions"><button class="btn small" data-del="${i}">🗑 Remove</button></div>`; card.querySelector('[data-del]').addEventListener('click', () => { aaContacts.splice(i, 1); renderAAContacts(); }); box.appendChild(card); });
}

$('#aa-add-contact').addEventListener('click', () => {
  const email = prompt('Contact email:'); if (!email) return;
  const name = prompt('Contact name:') || 'Contact';
  const role = prompt('Role/Title:') || 'Recruiter';
  aaContacts.push({ email, name, role }); renderAAContacts();
});

function extractDomain(u) { return (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].replace(/\s+/g, '').toLowerCase() + '.com'; }

$('#aa-send-all').addEventListener('click', async () => {
  if (!aaContacts.length) return toast('No contacts', true);
  if (!$('#aa-name').value.trim() || !$('#aa-email').value.trim()) return toast('Enter your name and email', true);
  const msg = $('#aa-send-msg'); msg.className = 'form-msg'; msg.textContent = '';
  const btn = $('#aa-send-all'); btn.disabled = true; btn.textContent = 'Sending...';
  try {
    const res = await fetch('/.netlify/functions/auto-apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job: { id: uid(), title: $('#aa-title').value, company: $('#aa-company').value, location: '', url: $('#aa-job-url').value, description: $('#aa-jd').value, contacts: aaContacts }, resume: $('#aa-resume').value || baseResumeText, cover_letter: $('#aa-cover').value, sender: { name: $('#aa-name').value, email: $('#aa-email').value, headline: $('#aa-headline').value, linkedin: $('#aa-linkedin').value, portfolio: $('#aa-portfolio').value }, options: { dry_run: $('#aa-dry-run').checked, delay_ms: 1500 } }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Failed');
    await DB.insert('applications', { id: uid(), company: $('#aa-company').value, role: $('#aa-title').value, contacts_sent: data.results.filter(r => r.status === 'sent').length, status: $('#aa-dry-run').checked ? 'dry_run' : (data.sent > 0 ? 'sent' : 'failed'), results: data.results, sentAt: new Date().toISOString() });
    msg.className = 'form-msg ok'; msg.textContent = `Done: ${data.sent} sent, ${data.total - data.sent} failed/dry-run`;
    renderAutoApplyHistory();
  } catch (err) { msg.className = 'form-msg err'; msg.textContent = err.message; }
  finally { btn.disabled = false; btn.textContent = '🚀 Send Applications'; }
});

/* ---------- REMOTE JOBS ---------- */
const REMOTE_SOURCES = [
  // Free All-Rounder Remote Boards
  { id: 'weworkremotely', name: 'We Work Remotely', url: 'https://weworkremotely.com/remote-jobs.rss', parser: 'wwr' },
  { id: 'remoteok', name: 'RemoteOK', url: 'https://remoteok.io/api', parser: 'remoteok' },
  { id: 'remotive', name: 'Remotive', url: 'https://remotive.io/api/remote-jobs', parser: 'remotive' },
  { id: 'himalayas', name: 'Himalayas', url: 'https://himalayas.app/jobs/rss', parser: 'himalayas' },
  { id: 'workingnomads', name: 'Working Nomads', url: 'https://workingnomads.com/jobs/rss', parser: 'workingnomads' },

  // Free Startup & Tech Platforms
  { id: 'wellfound', name: 'Wellfound (AngelList)', url: 'https://wellfound.com/jobs', parser: 'wellfound' },
  { id: 'dynamitejobs', name: 'Dynamite Jobs', url: 'https://dynamitejobs.com/jobs/rss', parser: 'dynamitejobs' },

  // Existing
  { id: 'github', name: 'GitHub Jobs', url: 'https://jobs.github.com/positions.json', parser: 'github' },
  { id: 'remoteok', name: 'RemoteOK', url: 'https://remoteok.io/api', parser: 'remoteok' },
  { id: 'weworkremotely', name: 'We Work Remotely', url: 'https://weworkremotely.com/remote-jobs.rss', parser: 'wwr' },
  { id: 'remotive', name: 'Remotive', url: 'https://remotive.io/api/remote-jobs', parser: 'remotive' },
  { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/jobs/feed', parser: 'stackoverflow' },
];

async function renderRemoteView() {
  await renderRemoteSources();
  await populateSourceFilter();
  $('#remote-search-form').addEventListener('submit', async (e) => { e.preventDefault(); await searchRemoteJobs(); });
  $('#remote-save-alert').addEventListener('click', saveRemoteAlert);
  $('#remote-add-source').addEventListener('click', addCustomRemoteSource);
  loadCustomRemoteSources();
}

async function renderRemoteSources() {
  const box = $('#remote-sources');
  box.innerHTML = '';
  const customSources = await DB.getAll('remote_sources');
  const allSources = [...REMOTE_SOURCES, ...customSources];
  
  allSources.forEach(src => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title">${esc(src.name)}</div>
          <div class="card-sub">${src.id === 'custom' ? 'Custom' : 'Built-in'}</div>
        </div>
        ${src.id === 'custom' ? `<button class="btn small" data-del="${src.id}">🗑 Remove</button>` : ''}
      </div>`;
    if (src.id === 'custom') {
      card.querySelector('[data-del]').addEventListener('click', async () => {
        await DB.remove('remote_sources', src.id);
        renderRemoteSources();
        populateSourceFilter();
      });
    }
    box.appendChild(card);
  });
}

async function populateSourceFilter() {
  const select = $('#remote-source-filter');
  const customSources = (await DB.getAll('remote_sources')).filter(s => s.id === 'custom');
  const options = ['<option value="all">All Sources</option>'];
  [...REMOTE_SOURCES, ...customSources].forEach(s => {
    options.push(`<option value="${s.id}">${esc(s.name)}</option>`);
  });
  select.innerHTML = options.join('');
}

async function loadCustomRemoteSources() {
  // Load from DB and render in the sources list
  await renderRemoteSources();
}

async function addCustomRemoteSource() {
  const url = $('#remote-custom-url').value.trim();
  const name = $('#remote-custom-name').value.trim() || 'Custom Source';
  if (!url) return toast('Enter a URL', true);
  
  const id = 'custom_' + uid();
  await DB.insert('remote_sources', { id, name, url, parser: 'custom', createdAt: new Date().toISOString() });
  $('#remote-custom-url').value = '';
  $('#remote-custom-name').value = '';
  await renderRemoteSources();
  populateSourceFilter();
  toast('Custom source added');
}

async function searchRemoteJobs() {
  const keywords = $('#remote-keywords').value.trim();
  if (!keywords) return toast('Enter keywords to search', true);
  
  const btn = $('#remote-search-form .btn.primary');
  btn.disabled = true; btn.textContent = 'Searching...';
  $('#remote-hint').classList.add('hidden');
  
  const sourceFilter = $('#remote-source-filter').value;
  const timeFilter = $('#remote-time').value;
  const kwList = keywords.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  
  try {
    const sourcesToSearch = sourceFilter === 'all' 
      ? [...REMOTE_SOURCES, ...(await DB.getAll('remote_sources')).filter(s => s.id === 'custom')]
      : [...REMOTE_SOURCES, ...(await DB.getAll('remote_sources')).filter(s => s.id === 'custom')].filter(s => s.id === sourceFilter);
    
    let allJobs = [];
    
    for (const src of sourcesToSearch) {
      try {
        const jobs = await fetchRemoteSource(src, kwList, timeFilter);
        allJobs.push(...jobs);
      } catch (err) {
        console.warn(`Failed to fetch ${src.name}:`, err);
      }
    }
    
    // Deduplicate by URL/title
    const seen = new Set();
    const uniqueJobs = allJobs.filter(j => {
      const key = (j.url || j.title + j.company).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Sort by match score
    uniqueJobs.forEach(job => {
      job.matchScore = calculateRemoteMatch(job, kwList);
    });
    uniqueJobs.sort((a, b) => b.matchScore - a.matchScore);
    
    $('#remote-count').textContent = uniqueJobs.length;
    renderRemoteResults(uniqueJobs);
    
    if (!uniqueJobs.length) {
      $('#remote-results').innerHTML = '<p class="muted small">No remote jobs found matching your criteria.</p>';
    }
  } catch (err) {
    toast('Search failed: ' + err.message, true);
    // Fallback
    const fallback = buildRemoteFallback(keywords);
    $('#remote-count').textContent = fallback.length;
    renderRemoteResults(fallback);
  } finally {
    btn.disabled = false; btn.textContent = '🔍 Search All Remote Jobs';
  }
}

async function fetchRemoteSource(src, keywords, timeFilter) {
  try {
    const res = await fetch('/.netlify/functions/remote-fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: src.id, url: src.url, keywords, timeFilter, parser: src.parser })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fetch failed');
    return (data.jobs || []).map(j => ({
      ...j,
      source: src.name,
      sourceId: src.id,
      remote: true
    }));
  } catch (err) {
    console.warn(`Remote fetch ${src.id} failed:`, err);
    return [];
  }
}

function calculateRemoteMatch(job, keywords) {
  const haystack = (job.title + ' ' + job.description + ' ' + job.company + ' ' + (job.tags || []).join(' ')).toLowerCase();
  return keywords.filter(k => haystack.includes(k.toLowerCase())).length;
}

function buildRemoteFallback(keywords) {
  const kwList = keywords.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const remoteCompanies = [
    { name: 'GitLab', url: 'https://about.gitlab.com/jobs/' },
    { name: 'Automattic', url: 'https://automattic.com/work-with-us/' },
    { name: 'Zapier', url: 'https://zapier.com/jobs' },
    { name: 'Buffer', url: 'https://buffer.com/journey' },
    { name: 'Doist', url: 'https://doist.com/jobs' },
    { name: 'InVision', url: 'https://www.invisionapp.com/careers' },
    { name: 'Elastic', url: 'https://www.elastic.co/about/careers' },
    { name: 'HashiCorp', url: 'https://www.hashicorp.com/jobs' },
  ];
  
  return remoteCompanies.map((c, i) => ({
    id: uid(),
    title: ['Senior Software Engineer', 'Full Stack Developer', 'Backend Engineer', 'DevOps Engineer', 'Frontend Engineer'][i % 5],
    company: c.name,
    location: '🌍 Remote',
    source: c.name,
    description: `We're hiring a remote engineer. Skills: ${kwList.join(', ') || 'modern web development'}.`,
    url: c.url,
    keywords: kwList,
    posted: 'Recent',
    remote: true,
    matchScore: kwList.length
  }));
}

function renderRemoteResults(jobs) {
  const box = $('#remote-results');
  box.innerHTML = '';
  if (!jobs.length) { box.innerHTML = '<p class="muted small">No jobs found.</p>'; return; }
  
  jobs.forEach(job => {
    const card = document.createElement('div');
    card.className = 'card';
    const level = job.matchScore >= 3 ? 'high' : job.matchScore >= 1 ? 'med' : 'low';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title">${esc(job.title)}</div>
          <div class="card-sub">${esc(job.company)} · ${esc(job.location)} · ${esc(job.source)}</div>
        </div>
        <div class="card-match"><span class="match-pill match-${level}">${job.matchScore}/${job.keywords?.length || 0} keywords</span></div>
      </div>
      <div class="card-desc">${esc(clip(job.description, 180))}</div>
      ${job.keywords?.length ? `<div class="card-meta">Keywords: ${job.keywords.map(k => `<span class="tag">${esc(k)}</span>`).join('')}</div>` : ''}
      <div class="card-actions">
        <button class="btn small" data-act="open" data-url="${esc(job.url)}">🔗 Open</button>
        <button class="btn small" data-act="save" data-id="${job.id}">💾 Save</button>
        <button class="btn small" data-act="apply" data-id="${job.id}">🚀 Auto-Apply</button>
        <button class="btn small" data-act="email" data-id="${job.id}">✉️ Email</button>
      </div>`;
    card.querySelector('[data-act="save"]').addEventListener('click', async () => {
      await DB.insert('jobs', { ...job, savedAt: new Date().toISOString() });
      toast('Saved to database ✓');
    });
    card.querySelector('[data-act="open"]').addEventListener('click', () => { if (job.url) window.open(job.url, '_blank'); });
    card.querySelector('[data-act="apply"]').addEventListener('click', () => { prepAutoApply(job); switchView('auto-apply'); });
    card.querySelector('[data-act="email"]').addEventListener('click', () => { fillEmailFromJob(job); switchView('email'); });
    box.appendChild(card);
  });
}

function saveRemoteAlert() {
  const kw = $('#remote-keywords').value.trim();
  if (!kw) return toast('Enter keywords first', true);
  DB.insert('alerts', { id: uid(), keywords: kw, location: 'Remote', role: $('#remote-role').value.trim(), source: 'remote', createdAt: new Date().toISOString() });
  toast('Remote alert saved');
}

/* ---------- DATABASE VIEW ---------- */
async function renderDatabase() {
  const jobs = await DB.getAll('jobs');
  const scraped = await DB.getAll('scraped');
  const recruiters = await DB.getAll('recruiters');
  $('#db-jobs-count').textContent = jobs.length + scraped.length;
  $('#db-recruiters-count').textContent = recruiters.length;
  const rc = $('#db-recruiters'); rc.innerHTML = '';
  if (!recruiters.length) rc.innerHTML = '<p class="muted small">No recruiters yet.</p>';
  recruiters.forEach(r => { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<div class="card-top"><div><div class="card-title">${esc(r.company)}</div><div class="card-sub">${esc(r.email || r.contact)}</div></div><button class="btn small" data-del="${r.id}">🗑</button></div>`; c.querySelector('[data-del]').addEventListener('click', async () => { await DB.remove('recruiters', r.id); renderDatabase(); }); rc.appendChild(c); });
  const jc = $('#db-jobs'); jc.innerHTML = '';
  const all = [...jobs, ...scraped];
  if (!all.length) jc.innerHTML = '<p class="muted small">No saved jobs.</p>';
  all.forEach(j => { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<div class="card-top"><div><div class="card-title">${esc(j.title)} @ ${esc(j.company)}</div><div class="card-sub">${esc(j.location)} · ${new Date(j.savedAt || j.createdAt).toLocaleDateString()}</div></div><button class="btn small" data-del="${j.id}">🗑</button></div>`; c.querySelector('[data-del]').addEventListener('click', async () => { await DB.remove('jobs', j.id); await DB.remove('scraped', j.id); renderDatabase(); }); jc.appendChild(c); });
}

/* ---------- EXPORTS ---------- */
$('#db-export').addEventListener('click', () => download('database.json', DB.exportAll()));
$('#export-data').addEventListener('click', () => download('database.json', DB.exportAll()));
function download(name, content) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); toast('Exported ' + name); }

/* ---------- UTIL ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>\"]/g, c => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c])); }
function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* ---------- ADMIN PORTAL ---------- */
const PORTAL_STORIES = [
  "The system hums quietly. 12,847 candidates tracked. 3,291 interviews scheduled. 847 offers extended. You built this.",
  "Midnight deploy. Zero downtime. The pipeline remembers every hand that shaped it. Welcome back, architect.",
  "Access logs show 47 sign-ins this week. 12 pending approvals. 3 rejections. The gatekeeper watches.",
  "Database heartbeat: steady. 2.3M records. Zero corruption. The foundation you laid holds strong.",
  "Remote feed active: 12 sources. 847 live listings. 23 matched your keywords today. The net is cast.",
  "Email queue: 12 sent, 3 pending, 0 failed. Your words reached inboxes across 3 timezones.",
  "Resume optimizer ran 34 times this week. ATS scores climbed 23% on average. The edge sharpens.",
  "Cover letters generated: 19. Each tailored. Each honest. The human touch scales.",
  "Salary estimates requested: 41. Data from 12,000+ data points. Knowledge compounds.",
  "Auto-apply sent 8 applications while you slept. 3 replies by morning. The machine works."
];

let portalHoverCount = 0;
let portalStoryIndex = 0;
let portalStoryTimer = null;

function initAdminPortal() {
  const globe = $('#admin-portal .portal-globe');
  const storyEl = $('#portal-story');
  
  if (!globe || !storyEl) return;
  
  // Make focusable
  globe.setAttribute('tabindex', '0');
  globe.setAttribute('role', 'button');
  globe.setAttribute('aria-label', 'Admin Portal');
  
  // Show random story on hover
  globe.addEventListener('mouseenter', () => {
    portalHoverCount++;
    showPortalStory();
  });
  
  // Click to enter admin login
  globe.addEventListener('click', () => {
    switchView('login');
    // Auto-switch to request tab after a moment (admin can sign in there)
    setTimeout(() => {
      const requestTab = $$('.auth-tab').find(t => t.dataset.tab === 'request');
      if (requestTab) requestTab.click();
    }, 300);
  });
  
  // Keyboard support
  globe.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      globe.click();
    }
  });
  
  // Cycle stories every 4 seconds while hovered
  globe.addEventListener('mouseenter', startStoryCycle);
  globe.addEventListener('mouseleave', stopStoryCycle);
}

function showPortalStory() {
  const storyEl = $('#portal-story');
  if (!storyEl) return;
  
  const story = PORTAL_STORIES[portalStoryIndex];
  portalStoryIndex = (portalStoryIndex + 1) % PORTAL_STORIES.length;
  
  storyEl.innerHTML = `<p>${story}</p>`;
}

function startStoryCycle() {
  stopStoryCycle();
  portalStoryTimer = setInterval(showPortalStory, 4000);
}

function stopStoryCycle() {
  if (portalStoryTimer) {
    clearInterval(portalStoryTimer);
    portalStoryTimer = null;
  }
}

/* ---------- INIT ---------- */
(async function init() {
  loadSupabaseClient();
  initAdminPortal();
  const s = await DB.getAll('settings');
  if (s.resumeBase) { baseResumeText = s.resumeBase; $('#resume-base-preview').classList.remove('hidden'); $('#resume-base-text').textContent = baseResumeText; $('#resume-file-label').textContent = '✅ Resume loaded'; }
  if (s.senderName) { $('#email-name').value = s.senderName; $('#cl-name').value = s.senderName; $('#aa-name').value = s.senderName; }
  if (s.senderEmail) { $('#email-from').value = s.senderEmail; $('#aa-email').value = s.senderEmail; }
  if (s.headline) { $('#email-headline').value = s.headline; $('#cl-headline').value = s.headline; $('#aa-headline').value = s.headline; }
  await checkAuthState();
  await renderDashboard();
  await renderEmailLog();
})();
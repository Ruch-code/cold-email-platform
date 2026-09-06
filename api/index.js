import { createHandler } from '@netlify/functions';
import * as adminDecision from '../functions/admin-decision.js';
import * as adminRequests from '../functions/admin-requests.js';
import * as atsOptimize from '../functions/ats-optimize.js';
import * as authAdminLogin from '../functions/auth-admin-login.js';
import * as authCheckAccess from '../functions/auth-check-access.js';
import * as authLogin from '../functions/auth-login.js';
import * as authLogout from '../functions/auth-logout.js';
import * as authMe from '../functions/auth-me.js';
import * as authRequestAccess from '../functions/auth-request-access.js';
import * as authReset from '../functions/auth-reset.js';
import * as authSignup from '../functions/auth-signup.js';
import * as autoApply from '../functions/auto-apply.js';
import * as coverLetter from '../functions/cover-letter.js';
import * as extractResume from '../functions/extract-resume.js';
import * as generateEmail from '../functions/generate-email.js';
import * as jobScan from '../functions/job-scan.js';
import * as remoteFetch from '../functions/remote-fetch.js';
import * as salaryEstimate from '../functions/salary-estimate.js';
import * as scrape from '../functions/scrape.js';
import * as sendEmail from '../functions/send-email.js';
import * as tailorResume from '../functions/tailor-resume.js';

const handlers = {
  'admin-decision': adminDecision.handler,
  'admin-requests': adminRequests.handler,
  'ats-optimize': atsOptimize.handler,
  'auth-admin-login': authAdminLogin.handler,
  'auth-check-access': authCheckAccess.handler,
  'auth-login': authLogin.handler,
  'auth-logout': authLogout.handler,
  'auth-me': authMe.handler,
  'auth-request-access': authRequestAccess.handler,
  'auth-reset': authReset.handler,
  'auth-signup': authSignup.handler,
  'auto-apply': autoApply.handler,
  'cover-letter': coverLetter.handler,
  'extract-resume': extractResume.handler,
  'generate-email': generateEmail.handler,
  'job-scan': jobScan.handler,
  'remote-fetch': remoteFetch.handler,
  'salary-estimate': salaryEstimate.handler,
  'scrape': scrape.handler,
  'send-email': sendEmail.handler,
  'tailor-resume': tailorResume.handler,
};

function getHandler(path) {
  const name = path.replace('/api/', '').replace(/\/$/, '');
  return handlers[name];
}

export default async function handler(req, res) {
  const fnName = req.url.replace('/api/', '').replace(/\/$/, '').split('?')[0];
  const fn = getHandler(fnName);
  
  if (!fn) {
    return res.status(404).json({ error: `Function not found: ${fnName}` });
  }
  
  const netlifyEvent = {
    httpMethod: req.method,
    headers: req.headers,
    queryStringParameters: req.query,
    body: req.body ? JSON.stringify(req.body) : null,
    path: req.url,
  };
  
  try {
    const result = await fn(netlifyEvent, {});
    res.status(result.statusCode || 200)
       .set(result.headers || {})
       .send(result.body);
  } catch (err) {
    console.error('Function error:', err);
    res.status(500).json({ error: err.message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
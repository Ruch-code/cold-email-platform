const { json, error } = require('./lib/shared');
const mammoth = require('mammoth');

/**
 * Extract Resume Text
 * POST /api/extract-resume  (multipart/form-data with `file`)
 *
 * Extracts plain text from:
 *   - .txt  -> read directly
 *   - .docx -> parsed locally with mammoth
 *   - .pdf  -> crudely extracted (best-effort)
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  try {
    const file = await parseMultipart(event, event.headers['content-type'] || '');
    if (!file) return error('No file provided in upload');
    const { fileBuffer, fileName } = file;
    let text = '';

    if (/\.txt$/i.test(fileName) || /text\/plain/i.test((fileName))) {
      text = fileBuffer.toString('utf8');
    } else if (/\.docx$/i.test(fileName)) {
      const r = await mammoth.extractRawText({ buffer: fileBuffer });
      text = r.value || '';
    } else if (/\.pdf$/i.test(fileName)) {
      text = crudePdfText(fileBuffer);
    } else {
      text = fileBuffer.toString('utf8'); // fallback
    }

    return json({ text: text.slice(0, 40000), length: text.length, fileName });
  } catch (e) {
    return error('Extraction error: ' + e.message);
  }
};

function parseMultipart(event, contentType) {
  // Netlify base64-encodes the raw multipart body when a real upload happens.
  const isB64 = event.isBase64Encoded;
  const rawBody = event.body || '';
  const raw = isB64 ? Buffer.from(rawBody, 'base64') : Buffer.from(rawBody, 'utf8');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return { fileBuffer: raw, fileName: 'upload.bin' };

  const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]);
  const parts = raw.toString('latin1').split(boundary).filter((p) => p.includes('filename'));
  if (!parts.length) return { fileBuffer: raw, fileName: 'upload.bin' };

  const part = parts[0];
  const fn = (part.match(/filename="([^"]+)"/i) || [])[1] || 'upload.bin';
  const headerEnd = part.indexOf('\r\n\r\n');
  let bodyBytes;
  if (headerEnd >= 0) {
    bodyBytes = Buffer.from(part.slice(headerEnd + 4), 'latin1');
    bodyBytes = bodyBytes.subarray(0, Math.max(0, bodyBytes.length - 2));
  } else {
    bodyBytes = Buffer.from(part, 'latin1');
  }
  return { fileBuffer: bodyBytes, fileName: fn };
}

function crudePdfText(buf) {
  // Very naive PDF text extraction (for .txt-embedded streams / plain PDFs)
  let s = buf.toString('latin1');
  const out = [];
  const re = /\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ/g;
  let m;
  while ((m = re.exec(s))) {
    out.push((m[1] || m[2] || '').replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\'));
  }
  return out.join(' ') || 'PDF text extraction limited — please upload .txt or .docx for full parsing.';
}

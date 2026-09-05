const { json, error } = require('./_shared');
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
    const { fileBuffer, fileName } = await parseMultipart(event.body, event.headers['content-type'] || '');
    let text = '';

    if (!fileBuffer || !fileBuffer.length) {
      return error('No file provided');
    }

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

function parseMultipart(rawBody, contentType) {
  // Netlify sends the raw multipart body base64-encoded
  const isB64 = contentType.includes('multipart/form-data');
  const raw = isB64 ? Buffer.from(rawBody, 'base64') : Buffer.from(rawBody || '', 'utf8');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return { fileBuffer: raw, fileName: 'upload.bin' };

  const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]);
  const parts = raw.toString('latin1').split(boundary).filter((p) => p.includes('filename'));
  if (!parts.length) return { fileBuffer: raw, fileName: 'upload.bin' };

  const part = parts[0];
  const fn = (part.match(/filename="([^"]+)"/i) || [])[1] || 'upload.bin';
  // bytes between the header block and the closing boundary
  const headerEnd = part.indexOf('\r\n\r\n');
  let bodyBytes;
  if (headerEnd >= 0) {
    bodyBytes = Buffer.from(part.slice(headerEnd + 4), 'latin1');
    // trim trailing \r\n--...\r\n
    bodyBytes = bodyBytes.subarray(0, bodyBytes.length - 2);
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

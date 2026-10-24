// Netlify Serverless Function for Google Gemini Web
// Ported from bot-hamza-amirni-v2-master/lib/gemini.js by Hamza Amirni

function isValidReply(txt) {
  if (!txt || typeof txt !== 'string') return false;
  const clean = txt.trim();
  if (clean.length < 2) return false;
  const bad = [
    'missing text parameter',
    'missing parameter',
    'bad request',
    'rate limit',
    'too many requests',
    'internal server error',
    'undefined',
    'null',
    '<html>',
    '<!doctype',
    'quota exceeded'
  ];
  const lower = clean.toLowerCase();
  return !bad.some(b => lower === b || lower.startsWith(b + ':'));
}

// 1. Google Gemini Web StreamGenerate RPC (Keyless & Unlimited)
async function askGeminiWeb(prompt, systemPrompt = '', history = [], timeoutMs = 14000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    let histContext = '';
    if (Array.isArray(history) && history.length > 0) {
      histContext = '\n\n[Historique de discussion]:\n' +
        history.slice(-4).map(m => `${m.role === 'user' ? 'Client' : 'Assistant'}: ${m.content}`).join('\n') +
        '\n\n';
    }

    const fullPrompt = systemPrompt
      ? `${systemPrompt}${histContext}\nQuestion utilisateur: ${prompt}`
      : `${histContext}${prompt}`;

    const initHeaders = {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };

    const initRes = await fetch(
      'https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=fr&_reqid=173780&rt=c',
      {
        method: 'POST',
        headers: initHeaders,
        body: 'f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&',
        signal: ctrl.signal
      }
    );

    const cookie = (initRes.headers.get('set-cookie') || '').split(';')[0];

    const b = [[fullPrompt], ['fr'], null];
    const a = [null, JSON.stringify(b)];
    const body = new URLSearchParams({ 'f.req': JSON.stringify(a) }).toString();

    const genRes = await fetch(
      'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=fr&_reqid=2813378&rt=c',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'x-goog-ext-525001261-jspb': '[1,null,null,null,"9ec249fc9ad08861",null,null,null,[4]]',
          cookie: cookie,
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        body: body,
        signal: ctrl.signal
      }
    );

    if (!genRes.ok) throw new Error(`Gemini Web HTTP ${genRes.status}`);

    const text = await genRes.text();
    const chunks = [...text.matchAll(/^\d+\n(.+?)\n/gm)].map(m => m[1]);

    for (const chunk of chunks.reverse()) {
      try {
        const realArr = JSON.parse(chunk);
        const parse1 = JSON.parse(realArr[0][2]);
        if (parse1 && parse1.length > 4 && parse1[4] && parse1[4].length > 0) {
          const textVal = parse1[4][0][1][0];
          if (isValidReply(textVal)) {
            return textVal.trim();
          }
        }
      } catch (_) {}
    }
    throw new Error('Gemini Web parsing failed');
  } finally {
    clearTimeout(tid);
  }
}

// 2. Pollinations AI Fallback
async function askPollinations(prompt, systemPrompt = '', history = [], timeoutMs = 8000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...(Array.isArray(history) ? history.slice(-4) : []),
          { role: 'user', content: prompt }
        ],
        model: 'openai',
        temperature: 0.7
      }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error('Pollinations HTTP error');
    const txt = await res.text();
    if (isValidReply(txt)) return txt.trim();
    throw new Error('Invalid reply');
  } finally {
    clearTimeout(tid);
  }
}

// Netlify Function Handler
export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let prompt = '';
  let systemPrompt = '';
  let history = [];

  try {
    const body = JSON.parse(event.body || '{}');
    prompt = body.prompt || body.content || '';
    systemPrompt = body.systemPrompt || '';
    history = body.history || [];
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!prompt.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt is required' }) };
  }

  try {
    const reply = await Promise.any([
      askGeminiWeb(prompt, systemPrompt, history, 14000),
      askPollinations(prompt, systemPrompt, history, 8000)
    ]);

    if (isValidReply(reply)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply, success: true })
      };
    }
  } catch (err) {
    console.warn('AI resolution error:', err);
  }

  return {
    statusCode: 502,
    headers,
    body: JSON.stringify({ error: 'AI unavailable', success: false })
  };
};

export default handler;

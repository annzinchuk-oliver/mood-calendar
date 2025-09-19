// api/chat.js — Vercel Serverless Function (Node 18, CommonJS)

module.exports = async function handler(req, res) {
  // --- CORS ---
  const ALLOWED_ORIGINS = [
    'https://annzinchuk-oliver.github.io',      // GitHub Pages
    'https://mood-calendar-omega.vercel.app'    // прод-домен Vercel
  ];
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')  return res.status(405).json({ error: 'Method not allowed' });

  // --- конфиг Groq ---
  const API_KEY = (process.env.GROQ_API_KEY || '').trim();
  const MODEL  = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  if (!API_KEY) return res.status(500).json({ error: 'Missing GROQ_API_KEY' });

  try {
    // --- читаем JSON- тело запроса надёжно ---
    const body = await readJson(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];

    // --- вызов Groq (OpenAI-совместимый endpoint) ---
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: MODEL, temperature: 0.7, messages })
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      // Вернём оригинальную ошибку Groq как JSON, если это JSON.
      console.error('Groq upstream error:', upstream.status, text);
      return res.status(upstream.status).json(safeJson(text));
    }

    const data  = safeJson(text);
    const reply = data?.choices?.[0]?.message?.content?.trim()
               || 'Извини, сейчас не получается ответить.';
    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }

  // --- helpers ---
  function readJson(req) {
    if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
    return new Promise((resolve) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); }
      });
    });
  }
  function safeJson(s) {
    try { return JSON.parse(s); } catch { return { error: s }; }
  }
};

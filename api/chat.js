// api/chat.js — Vercel Serverless Function (Node 18, CommonJS)

module.exports = async function handler(req, res) {
  const API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!API_KEY) {
    console.error('Missing API key (GROQ_API_KEY / OPENAI_API_KEY)');
    return res.status(500).json({ error: 'Server is misconfigured: API key is missing' });
  }
  // --- CORS ---
  const ALLOWED_ORIGINS = [
    'https://annzinchuk-oliver.github.io',      // витрина GitHub Pages
    'https://mood-calendar-omega.vercel.app'    // прод Vercel
  ];
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // --- читаем тело запроса ---
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const { messages = [] } = body;
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: 'messages must be an array' });
      return;
    }

    // --- вызов провайдера (Groq или OpenAI) ---
    const useGroq = !!process.env.GROQ_API_KEY;
    const apiKey = useGroq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
    const model =
      (useGroq ? process.env.GROQ_MODEL : process.env.OPENAI_MODEL) ||
      (useGroq ? 'llama-3.1-8b-instant' : 'gpt-4o-mini');

    const endpoint = useGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, temperature: 0.7, messages })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Upstream error:', upstream.status, data);
      res.status(upstream.status).json(data);
      return;
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      'Извини, сейчас не получается ответить.';

    res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ reply: 'Извини, сейчас не получается ответить.' });
  }
};

// /api/chat.js — Vercel Serverless Function (Node 18, CommonJS)
module.exports = async function handler(req, res) {
  // CORS (разрешаем наши витрины)
  const ALLOWED_ORIGINS = [
    'https://annzinchuk-oliver.github.io',
    'https://mood-calendar-omega.vercel.app'
  ];
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // читаем тело
  const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  const { messages = [] } = body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

  // --- ключ и модель Groq ---
  const apiKey = process.env.GROQ_API_KEY;                // <-- одно имя, без вариантов
  const model  = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  if (!apiKey) return res.status(500).json({ error: 'Missing GROQ_API_KEY' });

  try {
    // вызов Groq (OpenAI-совместимый endpoint)
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, temperature: 0.7, messages })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Groq upstream error:', upstream.status, data);
      return res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' });
    }

    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      'Извини, сейчас не получается ответить.';

    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
};

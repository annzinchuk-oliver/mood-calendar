// /api/chat.js — Vercel Serverless Function (Node 18+)
module.exports = async function handler(req, res) {
  const ALLOWED_ORIGINS = [
    'https://annzinchuk-oliver.github.io',            // GitHub Pages (твоя витрина)
    'https://mood-calendar-omega.vercel.app'          // Vercel-прод
  ];
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // кэшируем preflight
  if (req.method === 'OPTIONS') return res.status(204).end();
  // ---- /CORS ----

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

  try {
    // читаем тело запроса (frontend шлет { messages: [...] })
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const { messages = [] } = body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages must be an array' });
    }

    // >>> ЭТО ГЛАВНАЯ ЗАМЕНА: идем в Groq OpenAI-совместимый endpoint
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        temperature: 0.7,
        messages
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      // пробрасываем код/сообщение вверх, чтобы видеть причину в логах Vercel
      console.error('Groq upstream error:', upstream.status, data);
      return res.status(upstream.status).json(data);
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      'Извини, не удалось сформировать ответ.';

    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}

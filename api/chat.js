// /api/chat.js  — Vercel Serverless Function (Node 18)
export default async function handler(req, res) {
  // CORS не нужен, если фронт и API на одном домене Vercel.
  // Если вдруг останешься на GitHub Pages — раскомментируй и укажи свой домен.
// const ORIGIN = process.env.CORS_ORIGIN || 'https://annzinchuk-oliver.github.io';
// res.setHeader('Access-Control-Allow-Origin', ORIGIN);
// if (req.method === 'OPTIONS') {
//   res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
//   return res.status(204).end();
// }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = typeof req.body === 'object' ? req.body : await new Promise(r => {
      let data = ''; req.on('data', c => data += c); req.on('end', () => r(JSON.parse(data||'{}')));
    });
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

    // Вызов OpenAI (замени модель при желании)
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.7, messages })
    });

    if (!r.ok) throw new Error(`Upstream ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? 'Извини, ответ не сформировался.';

    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ reply: 'Извини, сейчас не получается ответить.' });
  }
}

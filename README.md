## Деплой и переменные окружения

Проект хостится на **Vercel**, фронт (статический) + serverless-функция `/api/chat`.

### Переменные окружения

Провайдер ИИ выбирается автоматически:
- если задан `GROQ_API_KEY` → используется Groq (`https://api.groq.com/openai/v1/chat/completions`);
- иначе, если задан `OPENAI_API_KEY` → используется OpenAI (`https://api.openai.com/v1/chat/completions`).

Список переменных:
```env
GROQ_API_KEY=...            # обязательный для Groq
GROQ_MODEL=llama-3.1-8b-instant

OPENAI_API_KEY=             # опционально, если вернёмся к OpenAI
OPENAI_MODEL=gpt-4o-mini

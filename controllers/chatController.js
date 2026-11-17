const { GoogleGenAI } = require('@google/genai');
const { asyncHandler, httpError } = require('../middleware/errorMiddleware');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const SYSTEM_PROMPT =
  'You are SalesDesk Assistant, a helpful assistant inside a sales management dashboard. ' +
  'Answer concisely and clearly. Help with sales, products, categories, reports and general questions.';

let client;
const getClient = () => {
  if (!process.env.GEMINI_API_KEY) throw httpError(500, 'GEMINI_API_KEY is not configured');
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
};

// POST /api/chat  { message: string, history?: [{ role: 'user'|'model', text: string }] }
const chat = asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;

  const contents = [
    ...history.slice(-20).map((h) => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(h.text) }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const call = () =>
    getClient().models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: SYSTEM_PROMPT },
    });

  try {
    let response;
    for (let attempt = 1; ; attempt++) {
      try {
        response = await call();
        break;
      } catch (err) {
        // Retry transient overload/rate-limit errors a couple of times.
        if (![429, 503].includes(err.status) || attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    res.json({ success: true, reply: response.text || 'Sorry, I could not generate a response.' });
  } catch (err) {
    if (err.statusCode) throw err;
    console.error('Gemini error:', err.status, err.message);
    const busy = [429, 503].includes(err.status);
    throw httpError(502, busy ? 'The AI is busy right now. Please try again in a moment.' : 'AI service error. Please try again.');
  }
});

module.exports = { chat };

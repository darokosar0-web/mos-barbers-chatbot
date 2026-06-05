const SYSTEM_PROMPT = `You are a friendly AI assistant for Mos Barbers, a top-rated barbershop in Swansea, Wales. Keep responses short and helpful.

SERVICES & PRICES:
- Haircut: £20 (30 mins)
- Beard Trim: £15 (20 mins)
- Haircut & Beard: £30 (45 mins)
- Nose Wax: £6 (15 mins)

LOCATIONS:
- High Street, Swansea SA1 1NZ
- Craddock Street, Swansea SA1 3EN

OPENING HOURS:
Monday - Friday: 8:00am - 7:00pm

BOOKING:
When customers ask about booking, tell them to tap the Book Appointment button below. Never say 'head to' or 'click here' or reference a URL.

Always end with a helpful follow up or offer to help with something else.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid messages array' });
  }

  const sanitised = messages
    .slice(-20)
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: sanitised,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await response.json();
    const reply = data?.content?.[0]?.text ?? '';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Function error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

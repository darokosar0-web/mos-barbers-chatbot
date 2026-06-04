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
Send customers to: cal.com/mosbarbers.swansea

Always end with a helpful follow up or offer to help with something else.`;

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY environment variable is not set");
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }

  let messages;
  try {
    ({ messages } = JSON.parse(event.body));
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Invalid messages array");
    }
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Invalid request body" }),
    };
  }

  // Sanitise: only pass role + content, cap history at 20 turns to limit cost
  const sanitised = messages
    .slice(-20)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: sanitised,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      return {
        statusCode: 502,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Upstream API error" }),
      };
    }

    const data = await response.json();
    const reply = data?.content?.[0]?.text ?? "";

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

import { Redis } from '@upstash/redis';
import Anthropic from '@anthropic-ai/sdk';
import { SCHOOLS as schools } from '../../../../lib/schools';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HISTORY_TTL = 60 * 60 * 24 * 7;
const MAX_TURNS = 20;

const CAPTURE_LEAD_TOOL = {
  name: 'capture_lead',
  description:
    "Call this as soon as you know the parent's name AND phone number. " +
    "Child's age or grade is optional — include it if you have it, omit it if not; " +
    "never wait on it. Call this even if you are also answering another question " +
    "or asking about campus in the same turn — capturing the lead and continuing " +
    "the conversation are not in conflict.",
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The parent's name" },
      phone: { type: 'string', description: "The parent's phone or contact number" },
      grade: { type: 'string', description: "The child's age or grade level, if known" },
    },
    required: ['name', 'phone'],
  },
};

export async function POST(req, { params }) {
  const sid = params.schoolId;
  const school = schools[sid];
  if (!school) return Response.json({ ok: false, error: 'unknown school' }, { status: 404 });

  const botToken = process.env[school.telegramBotTokenEnv];
  if (!botToken) {
    console.error(`Missing env var ${school.telegramBotTokenEnv} for school "${sid}"`);
    return Response.json({ ok: false, error: 'bot not configured' }, { status: 500 });
  }

  async function sendTelegram(chatId, text) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }

  const update = await req.json();
  const msg = update.message;
  if (!msg?.text) return Response.json({ ok: true });

  const chatId = msg.chat.id;
  const userText = msg.text;

  let campaign = 'organic';
  if (userText.startsWith('/start')) {
    const payload = userText.split(' ')[1];
    if (payload) {
      campaign = payload;
      await redis.set(`tg:${sid}:campaign:${chatId}`, campaign, { ex: HISTORY_TTL });
    }
    const welcome = school.welcomeMessage || `Welcome to ${school.name}! How can I help?`;
    await sendTelegram(chatId, welcome);

    // Log a lightweight "chat opened" event — separate from full lead capture,
    // captures Telegram identity even if the parent never completes the conversation
    fetch(school.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: String(chatId), // lets this row be found and updated later
        parentName: msg.from.username ? `@${msg.from.username}` : (msg.from.first_name || 'Unknown'),
        grade: '',
        phoneNumber: '',
        firstMessage: '/start',
        source: `telegram_${campaign}`,
        status: 'CHAT_OPENED',
      }),
    }).catch(() => {});

    return Response.json({ ok: true });
  }

  const historyKey = `tg:${sid}:history:${chatId}`;
  const history = (await redis.get(historyKey)) || [];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    // Override shared prompt LEAD-tag instructions — website chat still uses those tags
    system:
      school.systemPrompt +
      '\n\nLEAD CAPTURE — TELEGRAM OVERRIDE (replaces any [LEAD:...] tag instructions above):\n' +
      'Do NOT append [LEAD:...] tags. Instead, call the capture_lead tool as soon as you know ' +
      "the parent's name AND phone number. Child's age or grade is optional — include it if you " +
      'have it, omit it if not; never wait on it. Call the tool even if you are also answering ' +
      'another question or asking about campus in the same turn.',
    messages: [...history, { role: 'user', content: userText }],
    tools: [CAPTURE_LEAD_TOOL],
  });

  // Text blocks are what the parent actually sees on Telegram
  let reply = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!reply) {
    // Model called the tool but produced no visible text — shouldn't
    // normally happen, but never leave the parent with a blank message
    reply = "Thanks! Let me get that sorted for you — I'll have our team follow up shortly.";
  }

  // Tool call is separate from the reply text entirely — no more
  // competing for space inside one string, no more regex
  const leadCall = response.content.find(
    (block) => block.type === 'tool_use' && block.name === 'capture_lead'
  );

  if (leadCall) {
    const { name, phone, grade } = leadCall.input;
    const storedCampaign =
      (await redis.get(`tg:${sid}:campaign:${chatId}`)) || campaign;

    await fetch(school.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: String(chatId),
        parentName: name,
        grade: grade || '',
        phoneNumber: phone,
        firstMessage: history[0]?.content || userText,
        source: `telegram_${storedCampaign}`,
        status: 'LEAD_CAPTURED',
      }),
    }).catch(() => {});
  }

  // Persist text-only — never store raw tool_use blocks without a matching tool_result
  const newHistory = [...history, { role: 'user', content: userText }, { role: 'assistant', content: reply }].slice(-MAX_TURNS);
  await redis.set(historyKey, newHistory, { ex: HISTORY_TTL });

  await sendTelegram(chatId, reply);
  return Response.json({ ok: true });
}

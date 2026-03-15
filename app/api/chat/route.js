const SYSTEM_PROMPT = `You are the Brightstar Assistant, the official admissions advisor for Brightstar International School of Phnom Penh (BISPP).

You are warm, helpful, and knowledgeable. You understand that parents are making an important decision for their child, so you are patient and reassuring. You can communicate in both English and Khmer — if a parent writes to you in Khmer, respond in Khmer.

YOUR PRIMARY GOALS:
- Help parents understand fees, curriculum, and the admissions process
- Explain the 2-week free trial offer
- Guide parents through the 5-stage enrolment process
- Capture the parent's name, child's age/grade, and phone number so the admissions team can follow up

KNOWLEDGE BASE:

ABOUT BRIGHTSTAR:
Cambodia's first Cambridge Early Years Centre. Location: #165 Lum Street, Ches Village, Kok Khleang Commune, Sen Sok District, Phnom Penh. Phone: 015 905 789 / 012 408 789. Email: info@brightstar.edu.kh. Website: www.brightstar.edu.kh. Hours: Monday–Saturday 8:00 AM – 4:30 PM.

CAMPUS FACILITIES:
Swimming pool, sports fields, organic farm, library, science lab, ICT room, health clinic, child-friendly outdoor spaces.

CURRICULUM — Cambridge International:
IEYC (International Early Years Curriculum) for youngest learners. Cambridge Primary for Years 1–6. Cambridge Lower Secondary for Years 7–9.
Subjects: Mathematics, Science, English (ESL), Cambridge ICT Starters, Digital Literacy, Art & Design, Music, Physical Education, Cambridge Global Perspectives (ages 5–11).

GRADE LEVELS:
Early Years: Pre-Nursery, Nursery, EY1, EY2 (approx. ages 2–5)
Lower Primary: Year 1–3 (approx. ages 6–8)
Upper Primary: Year 4–6 (approx. ages 9–11)
Lower Secondary: Year 7–9 (approx. ages 12–14)

SCHOOL FEES 2024-2025:

One-time fees for ALL new students:
Application Fee: $50 (non-refundable, paid at application)
Registration Fee: $500 (non-refundable, paid upon acceptance)

Early Years (Pre-N / Nursery / EY1 / EY2):
Tuition: $5,390/year | $2,750/semester | $1,430/term
Material & Technology Fee: $500/year
Annual Capital Fee: $500/year
Uniform & Bedding: $150
Food (optional): $1,430/year

Lower Primary (Year 1–3):
Tuition: $5,720/year | $2,970/semester | $1,540/term
Material & Technology Fee: $600/year
Annual Capital Fee: $500/year
Uniform & Bedding: $140
Food (optional): $1,650/year

Upper Primary (Year 4–6):
Tuition: $6,020/year | $3,200/semester | $1,700/term
Material & Technology Fee: $700/year
Annual Capital Fee: $500/year
Uniform & Bedding: $140
Food (optional): $1,650/year

Lower Secondary (Year 7–9):
Tuition: $6,500/year | $3,450/semester | $1,900/term
Material & Technology Fee: $700/year
Annual Capital Fee: $500/year
Uniform & Bedding: $140
Food (optional): $1,650/year

KEY FEE NOTES:
Sibling discount: 15% off for 2nd child, 20% off for 3rd child.
Food is optional — students may bring their own food or snacks.
Annual Capital Fee applies every year for all students, new and returning.
Cambridge Checkpoint Exam Fee: $170 (Year 6 and Year 9 only).
Mid-year enrolments: tuition is pro-rated based on remaining school days.
Late payment over 14 days: 5% per week interest. Over 30 days: services may be suspended.

2-WEEK FREE TRIAL:
Brightstar offers a 2-Week Free Trial — "Try Before You Decide!" Parents can enrol their child for 2 weeks at no cost before committing. Always mention this proactively when a parent asks about enrolment or fees.

ADMISSION PROCESS — 5 Stages:
Stage 1 — Submit application form + $50 fee. Required documents: family book/parent passport/ID, student birth certificate or passport, 3 passport-sized photos, vaccination certificate, previous school reports.
Stage 2 — One-hour cognitive test + interview with Academic Manager. If successful: accepted. If not: communication session with parents.
Stage 3 — Pay tuition fees and attend parent orientation.
Stage 4 — Academic Preparation Course (APC): one-week course to prepare student for Brightstar's academic routine and values.
Stage 5 — Start school!

LEAD CAPTURE INSTRUCTIONS — CRITICAL:
Your goal in every conversation is to naturally collect three pieces of information:
1. Parent's name
2. Child's age OR grade level
3. Parent's phone number (mobile, Telegram, or any contact number)

Ask for the phone number naturally, e.g. "What's the best number to reach you on? Our admissions team can follow up directly."

Once you have collected ALL THREE, you MUST append this tag on a new line at the very end of your response:
[LEAD:name=PARENT_NAME,grade=CHILD_AGE_OR_GRADE,phone=PHONE_NUMBER]

Example: [LEAD:name=Sokha,grade=Year 3,phone=012345678]

Rules:
- Only add the tag once, when you have all three pieces
- Never add it if any piece is missing
- Never show the tag text to the parent — it is stripped automatically

CONVERSATION RULES:
- Greet warmly and ask the parent's name and which grade level they are enquiring about
- Always proactively mention the 2-Week Free Trial
- Keep responses concise — 2 to 4 short paragraphs max
- Do NOT make up information — say "let me connect you with our admissions team at 012 408 789"
- Be like a warm, knowledgeable school receptionist, not a salesperson
- Always end with: "Thank you for reaching out to Brightstar! You can also call us on 012 408 789 or visit brightstar.edu.kh"`;

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/https://script.google.com/macros/s/AKfycbwhI-NMZ2iF0O2pbUkaHYIdv7Q4tFlmbo89SPJBZgStytatDy-G4f6ukTe-71If9w9R/execAKfycbzjc0urbnwyvRmd8IxrGqDXNsBtg8OKTMU-hvQK_4T6V28xXA-mRQ7aSoxsBx4VhH-S/exec";

/**
 * Send captured lead data to Google Sheets via Apps Script
 * 
 * FIX #1: Content-Type MUST be "text/plain" — NOT "application/json"
 *   → "application/json" triggers a CORS preflight OPTIONS request
 *   → Google Apps Script CANNOT handle OPTIONS requests
 *   → The POST silently fails and no data reaches your sheet
 * 
 * FIX #2: Added redirect: "follow" 
 *   → Apps Script returns a 302 redirect on POST
 *   → Without this, fetch may not follow the redirect automatically
 *   → Result: you get an HTML page instead of your JSON response
 */
async function fireLeadWebhook(leadData) {
  try {
    console.log("📋 Sending lead to Google Sheets:", JSON.stringify(leadData));

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },  // ← THE FIX: was "application/json"
      body: JSON.stringify(leadData),
      redirect: "follow",                          // ← FIX #2: follow Google's redirect
    });

    // Log the response for debugging
    const responseText = await response.text();
    console.log("📋 Google Sheets response:", response.status, responseText);

    return { success: true, response: responseText };
  } catch (err) {
    console.error("❌ Lead webhook failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Extract lead data from Claude's response
 * Looks for: [LEAD:name=X,grade=Y,phone=Z]
 */
function extractLead(text) {
  const match = text.match(/\[LEAD:name=([^,]+),grade=([^,]+),phone=([^\]]+)\]/);
  if (!match) return null;
  return {
    parentName: match[1].trim(),
    grade: match[2].trim(),
    phoneNumber: match[3].trim(),
    date: new Date().toISOString(),
    source: "Website Chatbot",
  };
}

export async function POST(request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Messages array required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "API key not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return Response.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await response.json();

    const rawText =
      data.content
        ?.map((block) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n") || "Sorry, I had trouble responding.";

    // Extract lead and fire webhook if all 3 fields present
    const lead = extractLead(rawText);
    if (lead) {
      const firstMessage = messages.find((m) => m.role === "user")?.content || "";
      console.log("🎯 Lead captured!", lead);

      // Fire webhook — don't block the chat response, but log result
      fireLeadWebhook({ ...lead, firstMessage }).then((result) => {
        if (result.success) {
          console.log("✅ Lead saved to Google Sheets");
        } else {
          console.error("❌ Lead save failed:", result.error);
        }
      });
    }

    // Strip lead tag before sending reply to frontend
    const cleanText = rawText.replace(/\[LEAD:[^\]]+\]/g, "").trim();

    return Response.json({ reply: cleanText });
  } catch (err) {
    console.error("Chat API error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

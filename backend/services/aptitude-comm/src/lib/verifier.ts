import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are a certificate verification assistant for a college aptitude and communication program (Parameter 7).

APPROVED APTITUDE ASSESSMENTS:
- TCS iON NQT
- AMCAT
- CoCubes
- eLitmus pH Test
- Wheebox
- Other approved externally proctored employability tests

APPROVED COMMUNICATION ASSESSMENTS:
- Pearson Versant
- Cambridge Linguaskill / Cambridge Linguaskill Business
- Cambridge BEC (Business English Certificate)
- Recognised company-derived proctored communication assessments on the Central Equivalence List

EXCLUDED — belong to Parameter 9, do NOT count here:
- GRE, TOEFL, IELTS, PTE, GMAT, and other admissions/visa examinations

NOT ACCEPTED:
- College, coaching, or practice tests
- Generic aptitude site results (HackerRank, Testbook, etc. unless explicitly approved)
- Unproctored mock screenshots or self-entered scores
- Course completion, participation, or attendance certificates
- Expired or unverifiable links

PARAMETER 7 SCORING (for reference only):
- Aptitude: 3 marks for completing + percentile marks (60–69 = 6, 70–79 = 9, 80–89 = 12, 90+ = 15)
- Communication: 3 marks for valid score + 5 if Central Equivalence threshold is met
- Maximum total: 20 marks (15 aptitude + 5 communication)

Your task: Analyse the uploaded certificate/document and return ONLY valid JSON in this exact structure:

{
  "classification": "aptitude" | "communication" | "excluded" | "not_approved" | "unclear",
  "provider": "the test provider name as seen on document",
  "assessment_name": "the specific test name",
  "approved": true | false,
  "exclusion_reason": "why excluded/not approved, or null",
  "candidate_name": "name exactly as on document, or null",
  "roll_number_on_doc": "roll number / registration ID found on document, or null",
  "score": "score/percentile/level as shown, or null",
  "test_date": "date as shown, or null",
  "credential_id": "certificate or report ID if visible, or null",
  "proctoring_evidence": "delivery/proctoring details visible, or null",
  "url_found": "any URL printed on the document, or null",
  "qr_decoded_url": "URL decoded from visible QR code if you can read it, or null",
  "name_match": "match" | "mismatch" | "unverified",
  "name_match_note": "explanation of the name comparison",
  "roll_match": "match" | "mismatch" | "unverified" | "not_provided",
  "roll_match_note": "explanation of roll number comparison, or null",
  "potential_score": "estimated Parameter 7 marks this could earn, or null",
  "decision": "approved_verified" | "approved_incomplete" | "refer_to_mentor" | "excluded" | "not_approved",
  "reason": "clear explanation of the decision",
  "mentor_checklist": ["array of specific things mentor should verify"]
}

DECISION RULES:
1. Not in approved list → "not_approved" or "refer_to_mentor"
2. GRE/TOEFL/IELTS/PTE → "excluded"
3. Approved + all details visible + name matches → "approved_verified"
4. Approved + name mismatch or missing details → "approved_incomplete"
5. When in doubt → "refer_to_mentor"

Return ONLY the JSON object. No markdown, no explanation.`;

const OFFICIAL_DOMAINS: Record<string, string[]> = {
  "TCS iON NQT": ["tcsion.com", "tcs.com"],
  "AMCAT": ["myamcat.com", "aspiringminds.com"],
  "CoCubes": ["cocubes.com", "aon.com"],
  "eLitmus pH Test": ["elitmus.com"],
  "Wheebox": ["wheebox.com"],
  "Pearson Versant": ["versanttest.com", "pearson.com"],
  "Cambridge Linguaskill": ["cambridgeenglish.org", "cambridge.org"],
  "Cambridge Linguaskill Business": ["cambridgeenglish.org", "cambridge.org"],
  "Cambridge BEC": ["cambridgeenglish.org", "cambridge.org"],
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export interface UrlVerification {
  url: string;
  reachable: boolean;
  domain_check: string;
  final_url: string | null;
  status_code: number | null;
  page_title: string | null;
  is_official_domain: boolean;
  domain_note: string;
}

export interface VerificationResult {
  classification: string;
  provider: string;
  assessment_name: string;
  approved: boolean;
  exclusion_reason: string | null;
  candidate_name: string | null;
  roll_number_on_doc: string | null;
  score: string | null;
  test_date: string | null;
  credential_id: string | null;
  proctoring_evidence: string | null;
  url_found: string | null;
  qr_decoded_url: string | null;
  name_match: "match" | "mismatch" | "unverified";
  name_match_note: string;
  roll_match: "match" | "mismatch" | "unverified" | "not_provided";
  roll_match_note: string | null;
  potential_score: string | null;
  decision: string;
  reason: string;
  mentor_checklist: string[];
  url_verification?: UrlVerification;
  provider_used?: string;
}

async function verifyUrl(url: string, provider: string): Promise<UrlVerification> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CertVerifier/1.0 (educational)" },
    });

    clearTimeout(timer);

    const finalUrl = response.url;
    let finalDomain = "";
    try {
      finalDomain = new URL(finalUrl).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      finalDomain = "unknown";
    }

    const officialDomains = OFFICIAL_DOMAINS[provider] ?? [];
    const isOfficial = officialDomains.some(
      (d) => finalDomain === d || finalDomain.endsWith("." + d)
    );

    let pageTitle: string | null = null;
    try {
      const text = await response.text();
      const match = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match) pageTitle = match[1].trim().substring(0, 200);
    } catch {}

    return {
      url,
      reachable: response.status < 400,
      domain_check: finalDomain,
      final_url: finalUrl !== url ? finalUrl : null,
      status_code: response.status,
      page_title: pageTitle,
      is_official_domain: isOfficial,
      domain_note: isOfficial
        ? `Domain "${finalDomain}" matches a known official domain for ${provider}.`
        : `Domain "${finalDomain}" is NOT a known official domain for ${provider} — manual verification required.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      url,
      reachable: false,
      domain_check: "unreachable",
      final_url: null,
      status_code: null,
      page_title: null,
      is_official_domain: false,
      domain_note: `Could not reach URL: ${msg}`,
    };
  }
}

function parseJson(raw: string): VerificationResult {
  const json = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(json);
  } catch {
    // Try extracting a JSON object from anywhere in the text
    const match = json.match(/\{[\s\S]+\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse AI response as JSON: " + raw.substring(0, 300));
  }
}

async function callClaude(
  fileBase64: string,
  mediaType: string,
  userText: string
): Promise<VerificationResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileBlock: any = IMAGE_TYPES.has(mediaType)
    ? { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } };

  const msg = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [fileBlock, { type: "text", text: userText }] }],
  });

  const block = msg.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return parseJson(block.text);
}

async function callGemini(
  fileBase64: string,
  mediaType: string,
  userText: string
): Promise<VerificationResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent([
    { inlineData: { data: fileBase64, mimeType: mediaType } },
    userText,
  ]);

  return parseJson(result.response.text());
}

// Groq free vision models (tried in order)
const GROQ_VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.2-90b-vision-preview",
  "llama-3.2-11b-vision-preview",
];

async function callGroq(
  fileBase64: string,
  mediaType: string,
  userText: string
): Promise<VerificationResult> {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const dataUrl = `data:${mediaType};base64,${fileBase64}`;
  let lastErr: unknown;

  for (const model of GROQ_VISION_MODELS) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: userText },
            ] as any,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1024,
      });
      return parseJson(response.choices[0]?.message?.content ?? "");
    } catch (err: unknown) {
      const msg = String(err);
      if (msg.includes("403") || msg.includes("404") || msg.includes("not found") || msg.includes("Access denied")) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("All Groq models failed");
}

const OPENROUTER_MODELS = [
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3.8-27b:free",
];

async function callOpenRouter(
  fileBase64: string,
  mediaType: string,
  userText: string
): Promise<VerificationResult> {
  let lastErr: unknown;

  for (const model of OPENROUTER_MODELS) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Certificate Verifier",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${fileBase64}` } },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });

    if (res.status === 400 || res.status === 403 || res.status === 404 || res.status === 503 || res.status === 429) {
      lastErr = new Error(`OpenRouter ${res.status} on ${model}`);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${body}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) { lastErr = new Error(`Empty response from ${model}`); continue; }
    return parseJson(content);
  }

  throw lastErr ?? new Error("All OpenRouter models failed");
}

export async function verifyCertificate(
  fileBase64: string,
  mediaType: string,
  userName: string,
  rollNumber: string
): Promise<VerificationResult> {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

  if (!hasAnthropic && !hasGemini && !hasGroq && !hasOpenRouter) {
    throw new Error(
      "No API key configured. Add OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY to .env.local and restart."
    );
  }

  const rollLine = rollNumber
    ? `Roll number / registration ID: "${rollNumber}"`
    : `Roll number: not provided`;
  const userText = `Student's registered name: "${userName}"\n${rollLine}\n\nPlease analyse this certificate and return the JSON.`;

  // Priority order: explicit PREFER_PROVIDER → OpenRouter → Groq → Gemini → Claude
  const prefer = process.env.PREFER_PROVIDER ?? (
    hasOpenRouter ? "openrouter" : hasGroq ? "groq" : hasGemini ? "gemini" : "claude"
  );

  let result: VerificationResult;
  if (prefer === "openrouter" && hasOpenRouter) {
    result = await callOpenRouter(fileBase64, mediaType, userText);
    result.provider_used = "llama-3.2-11b (OpenRouter)";
  } else if (prefer === "groq" && hasGroq) {
    result = await callGroq(fileBase64, mediaType, userText);
    result.provider_used = "llama-4-scout (Groq)";
  } else if (prefer === "gemini" && hasGemini) {
    result = await callGemini(fileBase64, mediaType, userText);
    result.provider_used = "gemini-1.5-flash (Google)";
  } else if (hasAnthropic) {
    result = await callClaude(fileBase64, mediaType, userText);
    result.provider_used = "claude-sonnet-5 (Anthropic)";
  } else if (hasOpenRouter) {
    result = await callOpenRouter(fileBase64, mediaType, userText);
    result.provider_used = "llama-3.2-11b (OpenRouter)";
  } else if (hasGroq) {
    result = await callGroq(fileBase64, mediaType, userText);
    result.provider_used = "llama-4-scout (Groq)";
  } else {
    result = await callGemini(fileBase64, mediaType, userText);
    result.provider_used = "gemini-1.5-flash (Google)";
  }

  // Verify URL if found and certificate is approved
  const urlToCheck = result.qr_decoded_url ?? result.url_found;
  if (urlToCheck && result.approved) {
    result.url_verification = await verifyUrl(urlToCheck, result.provider);

    if (result.decision === "approved_verified" && !result.url_verification.is_official_domain) {
      result.decision = "approved_incomplete";
      result.reason += ` URL domain check: ${result.url_verification.domain_note}`;
    }
  }

  return result;
}


import { GoogleGenAI } from '@google/genai';
import type { IncomingMessage, ServerResponse } from 'http';

// ─── FDA Guidelines Context ───────────────────────────────────────────────────

const FDA_GUIDELINES_CONTEXT = `
You are an expert FDA Label Compliance Officer specializing in reviewing food product labels for export from India to the USA.
Your task is to analyze the provided image.

STEP 1: VALIDITY CHECK (CRITICAL)
Before checking for compliance, determine if the image is a valid food product label.
- INVALID: If the image is a random object (person, scenery, animal), a non-food product (shampoo, electronics, chemical), or completely unreadable/blurry.
- VALID: If the image clearly shows packaging text for a food or dietary supplement product.

If INVALID:
- Set "validity" to "NOT_A_LABEL", "NON_FOOD_LABEL", or "UNREADABLE".
- Provide a polite, helpful "executiveSummary" explaining why the analysis cannot proceed.
- Return empty arrays for violations and mandatoryElements.

If VALID:
- Set "validity" to "VALID".
- Proceed with the full FDA compliance check below.

REFERENCE GUIDELINES (Use these rules strictly for VALID labels):

1. MANDATORY ELEMENTS & TYPE SIZE:
   - Statement of Identity (21 CFR 101.3): Must be on PDP, bold, parallel to base, >50% size of largest text.
   - Net Quantity (21 CFR 101.105): Bottom 30% of PDP. Metric AND US Customary units required.
     * CRITICAL: Verify minimum type size based on estimated PDP area (e.g., 1/16" for <5 sq in, 1/8" for 5-25 sq in).
   - Ingredient List (21 CFR 101.4): Descending order by weight. Common names. Sub-ingredients in parentheses. English required.
     * Note: You cannot verify weight order visually, but flag if order seems illogical (e.g., salt listed before flour).
   - Nutrition Facts Panel (21 CFR 101.9): Specific 2016 format.
     * Bold "Calories" (largest type).
     * Serving size: "X servings per container" and "Serving size Xcup (Xg)".
     * Mandatory Nutrients: Total Fat, Saturated Fat, Trans Fat, Cholesterol, Sodium, Total Carb, Fiber, Total Sugars, Added Sugars, Protein, Vit D, Calcium, Iron, Potassium.
   - Name/Address (21 CFR 101.5): "Manufactured for/by" + City, State, ZIP. US Address required for imported products.
   - Country of Origin (19 CFR Part 134): "Product of India". Conspicuous.

2. DETAILED ALLERGEN CHECK (FALCPA/FASTER):
   - Check strictly for the 9 Major Allergens: Milk, Eggs, Fish, Shellfish, Tree Nuts, Peanuts, Wheat, Soybeans, Sesame.
   - TREE NUTS: Must specify type (e.g., Almond, Cashew, Walnut, Coconut, Pistachio). "Tree Nuts" alone is invalid.
   - FISH/SHELLFISH: Must specify species (e.g., Cod, Shrimp).
   - DERIVATIVES: Flag undeclared derivatives if specific allergen is not listed:
     * Milk: Whey, Casein, Ghee, Lactose.
     * Soy: Lecithin, Tofu, Edamame.
     * Wheat: Semolina, Durum, Spelt.

3. CLAIMS & MISC:
   - Health Claims: Only authorized claims allowed (e.g., Calcium/Osteoporosis). Unqualified claims like "Cures Diabetes" are CRITICAL violations.
   - "Vegetarian" Green Dot: Irrelevant for FDA.
   - RACC: Serving sizes must align with Reference Amounts Customarily Consumed (e.g., Cookies ~30g). Flag as INFO if distinct mismatch.

OUTPUT INSTRUCTIONS:
Analyze the image and return a pure JSON object. Do not include markdown code blocks.
`;

const JSON_SCHEMA_PROMPT = `
{
  "validity": "VALID" | "NOT_A_LABEL" | "NON_FOOD_LABEL" | "UNREADABLE",
  "executiveSummary": "A concise 2-sentence summary of the label's compliance status OR a polite error message if invalid.",
  "status": "PASS" | "MINOR_ISSUES" | "POTENTIAL_WARNING" | "FAIL",
  "violations": [
    {
      "ruleName": "Name of the rule violated",
      "description": "Specific detail of what is wrong.",
      "citation": "Regulatory citation (e.g., 21 CFR 101.3)",
      "severity": "CRITICAL" | "WARNING" | "INFO",
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "recommendation": "Actionable advice on how to fix it.",
      "originalText": "The specific text causing violation.",
      "suggestedText": "The corrected text.",
      "boundingBox2d": [ymin, xmin, ymax, xmax]
    }
  ],
  "mandatoryElements": [
    {
      "element": "Statement of Identity",
      "present": true,
      "notes": "Found on PDP"
    }
  ]
}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Analysis Logic ───────────────────────────────────────────────────────────

async function analyzeLabel(base64Image: string, mimeType: string, attempt = 1): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `${FDA_GUIDELINES_CONTEXT}\n\nReview the attached food label image.\n\nResponse Format:\n${JSON_SCHEMA_PROMPT}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    let text = response.text;
    if (!text) throw new Error('No response from Gemini');

    // Sanitize any accidental markdown wrapping
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

    const raw = JSON.parse(text);

    // ── Manual validation + safe defaults ─────────────────────────────────────
    const validity = ['VALID', 'NOT_A_LABEL', 'NON_FOOD_LABEL', 'UNREADABLE'].includes(raw.validity)
      ? raw.validity : 'UNREADABLE';

    const result: Record<string, unknown> = {
      validity,
      executiveSummary: typeof raw.executiveSummary === 'string' ? raw.executiveSummary : 'Analysis complete.',
      status: raw.status || 'PASS',
      violations: Array.isArray(raw.violations) ? raw.violations.map((v: Record<string, unknown>) => ({
        ruleName: v.ruleName || 'Unknown Rule',
        description: v.description || '',
        citation: v.citation || '',
        severity: ['CRITICAL', 'WARNING', 'INFO'].includes(v.severity as string) ? v.severity : 'INFO',
        confidence: ['HIGH', 'MEDIUM', 'LOW'].includes(v.confidence as string) ? v.confidence : 'MEDIUM',
        recommendation: v.recommendation || '',
        ...(v.originalText ? { originalText: v.originalText } : {}),
        ...(v.suggestedText ? { suggestedText: v.suggestedText } : {}),
        ...(Array.isArray(v.boundingBox2d) && v.boundingBox2d.length === 4 ? { boundingBox2d: v.boundingBox2d } : {}),
      })) : [],
      mandatoryElements: Array.isArray(raw.mandatoryElements) ? raw.mandatoryElements.map((e: Record<string, unknown>) => ({
        element: e.element || '',
        present: !!e.present,
        notes: e.notes || '',
      })) : [],
    };

    // ── Logic overrides ───────────────────────────────────────────────────────
    if (validity !== 'VALID') {
      result.status = 'INVALID_INPUT';
      return result;
    }

    const violations = result.violations as Array<{ severity: string }>;
    const hasCritical = violations.some(v => v.severity === 'CRITICAL');
    const hasWarning  = violations.some(v => v.severity === 'WARNING');

    if (hasCritical)        result.status = 'FAIL';
    else if (hasWarning)    result.status = 'MINOR_ISSUES';
    else if (violations.length > 0) result.status = 'POTENTIAL_WARNING';
    else                    result.status = 'PASS';

    return result;

  } catch (err: unknown) {
    if (attempt < 3) {
      console.warn(`[LabelGuard] Attempt ${attempt} failed, retrying...`);
      await delay(1000 * attempt);
      return analyzeLabel(base64Image, mimeType, attempt + 1);
    }
    throw err;
  }
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────

export async function handleLabelAnalyzeRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readBody(req);
    const { base64, mimeType } = JSON.parse(body);

    if (!base64 || !mimeType) {
      return sendJson(res, 400, { error: 'base64 and mimeType are required' });
    }

    const result = await analyzeLabel(base64, mimeType);
    sendJson(res, 200, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Label analysis failed';
    console.error('[LabelGuard] Error:', message);
    sendJson(res, 500, { error: message });
  }
}

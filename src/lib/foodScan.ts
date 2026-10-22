/**
 * Food photo scanning: a photo in, a list of foods with portions and macros out.
 *
 * Gemini does the looking, through Firebase AI Logic, so there is no server and
 * no API key in the bundle — the call is authorised by the Firebase project and
 * App Check. The model returns nutrition PER 100 g plus a portion in grams, and
 * the app does the multiplication. That keeps the numbers consistent when the
 * user corrects a portion: change the grams and every macro follows.
 *
 * Everything that talks to the network is in `scanFoodPhoto`. The parsing and
 * scaling around it are plain functions so they can be tested without a model.
 */

export type ScanConfidence = 'high' | 'medium' | 'low';

/** Nutrition for 100 g of a food. */
export interface Per100g {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

/** One food the model saw on the plate. */
export interface ScanItem {
  name: string;
  grams: number;
  per100g: Per100g;
  confidence: ScanConfidence;
}

export interface ScanResult {
  items: ScanItem[];
  /** A short remark from the model, e.g. "Oil in the curry is a guess". */
  note?: string;
}

/** The macros for an item at its current portion, rounded the way the log shows them. */
export function itemMacros(item: Pick<ScanItem, 'grams' | 'per100g'>) {
  const f = Math.max(0, item.grams) / 100;
  const r1 = (n: number) => Math.round(n * f * 10) / 10;
  return {
    calories: Math.round(item.per100g.calories * f),
    proteinG: r1(item.per100g.proteinG),
    carbsG: r1(item.per100g.carbsG),
    fatG: r1(item.per100g.fatG),
    fiberG: r1(item.per100g.fiberG),
  };
}

/** Plate total across the items. */
export function totalMacros(items: Pick<ScanItem, 'grams' | 'per100g'>[]) {
  return items.map(itemMacros).reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
      fiberG: acc.fiberG + m.fiberG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function clampNum(value: unknown, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/**
 * Turns whatever the model sent back into items the UI can trust.
 *
 * A model can return a malformed number, a negative portion or 4,000 kcal per
 * 100 g. Nothing here throws: bad fields become zero, an item with no name is
 * dropped, and per-100 g figures are capped at what is physically possible
 * (pure fat is 900 kcal per 100 g; nothing is 100 g of protein in 100 g).
 */
export function parseScan(raw: unknown): ScanResult {
  const data = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!isRecord(data) || !Array.isArray(data.items)) return { items: [] };

  const items: ScanItem[] = [];
  for (const entry of data.items.slice(0, 20)) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 80) : '';
    if (!name) continue;
    const per = isRecord(entry.per100g) ? entry.per100g : {};
    const confidence = entry.confidence;
    items.push({
      name,
      grams: Math.round(clampNum(entry.grams, 3_000)),
      per100g: {
        calories: clampNum(per.calories, 900),
        proteinG: clampNum(per.proteinG, 100),
        carbsG: clampNum(per.carbsG, 100),
        fatG: clampNum(per.fatG, 100),
        fiberG: clampNum(per.fiberG, 100),
      },
      confidence:
        confidence === 'high' || confidence === 'medium' || confidence === 'low'
          ? confidence
          : 'low',
    });
  }
  const note =
    typeof data.note === 'string' && data.note.trim() ? data.note.trim().slice(0, 240) : undefined;
  return note ? { items, note } : { items };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Some models wrap JSON in a ```json fence even when asked not to.
    const fenced = text.match(/\{[\s\S]*\}/);
    if (!fenced) return null;
    try {
      return JSON.parse(fenced[0]);
    } catch {
      return null;
    }
  }
}

/** Longest side of the image sent to the model. Enough to tell rice from quinoa. */
const MAX_SIDE = 1024;

/**
 * Shrinks a phone photo (often 4,000 px and 3–5 MB) to a JPEG of a few hundred
 * KB. Smaller uploads are faster on mobile data and cost fewer tokens, and the
 * model reads a 1024 px plate as well as a 4,000 px one.
 */
export async function prepareImage(file: Blob): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot read the photo.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
}

const PROMPT = `You are a nutrition assistant. Identify every distinct food or drink in this photo.
For each one, estimate the portion in grams as served, and give typical nutrition PER 100 g
for that food as prepared (cooked weight for cooked foods, including typical cooking oil).
Use standard food-composition values (USDA / IFCT style). Name foods plainly and specifically,
e.g. "Basmati rice, cooked", "Chicken curry", "Chapati". Split a plate into its components.
Set confidence to "low" when the food or the portion is hard to judge from the photo.
If there is no food in the photo, return an empty items list and say so in note.
Use note (one short sentence, optional) for anything the user should double-check.`;

/** Default model. Override with VITE_GEMINI_MODEL without a code change. */
export const DEFAULT_SCAN_MODEL = 'gemini-3.8-flash';

/**
 * Sends the photo to Gemini and returns the parsed foods.
 *
 * `firebase/ai` is imported on first use so the ~40 KB SDK is only downloaded
 * by people who actually scan something.
 */
export async function scanFoodPhoto(
  image: { base64: string; mimeType: string },
  hint?: string,
): Promise<ScanResult> {
  const [{ getAI, getGenerativeModel, GoogleAIBackend, Schema }, { aiApp }] = await Promise.all([
    import('firebase/ai'),
    import('./firebase'),
  ]);

  const num = (description: string) => Schema.number({ description });
  const schema = Schema.object({
    properties: {
      items: Schema.array({
        items: Schema.object({
          properties: {
            name: Schema.string({ description: 'Plain food name' }),
            grams: num('Estimated portion in grams'),
            per100g: Schema.object({
              properties: {
                calories: num('kcal per 100 g'),
                proteinG: num('Protein g per 100 g'),
                carbsG: num('Carbohydrate g per 100 g'),
                fatG: num('Fat g per 100 g'),
                fiberG: num('Dietary fiber g per 100 g'),
              },
            }),
            confidence: Schema.enumString({ enum: ['high', 'medium', 'low'] }),
          },
        }),
      }),
      note: Schema.string(),
    },
    optionalProperties: ['note'],
  });

  const ai = getAI(await aiApp(), { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: import.meta.env.VITE_GEMINI_MODEL?.trim() || DEFAULT_SCAN_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.2,
    },
  });

  const extra = hint?.trim()
    ? `\nThe user adds this about the meal; trust it over the photo: "${hint.trim().slice(0, 300)}"`
    : '';
  const result = await model.generateContent([
    PROMPT + extra,
    { inlineData: { data: image.base64, mimeType: image.mimeType } },
  ]);
  return parseScan(result.response.text());
}

/** A message a person can act on, from whatever the SDK threw. */
export function scanErrorMessage(error: unknown): string {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/quota|429|RESOURCE_EXHAUSTED|rate/i.test(text))
    return 'The free scanning limit was reached. Try again in a minute.';
  if (/app.?check|attestation|401|403|PERMISSION_DENIED|API has not been used|disabled/i.test(text))
    return 'Photo scanning is not switched on for this app yet (Firebase AI Logic or App Check).';
  if (/network|fetch|offline|Failed to fetch/i.test(text))
    return 'No connection. Check your signal and try again.';
  if (/decode|createImageBitmap|InvalidStateError|cannot read the photo/i.test(text))
    return 'That file could not be read as a photo. Try a JPEG or PNG.';
  return 'The scan did not work. Try again, or add the food by hand below.';
}

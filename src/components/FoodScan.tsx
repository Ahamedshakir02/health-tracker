import { useEffect, useRef, useState } from 'react';
import { Card, Pill } from './ui';
import {
  itemMacros,
  prepareImage,
  scanErrorMessage,
  scanFoodPhoto,
  totalMacros,
  type ScanItem,
} from '../lib/foodScan';
import type { MealEntry, MealSlot } from '../types';

type Draft = Omit<MealEntry, 'id' | 'date'>;

type Phase =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'review'; items: ScanItem[]; note?: string }
  | { kind: 'error'; message: string };

/**
 * "Scan a photo": the camera (or a file) in, an editable list of foods out.
 *
 * Nothing reaches the log until the person presses Add. The model's numbers
 * are a starting point — portions from a photo are rough, and hidden oil or
 * sugar is invisible — so every name and portion stays editable, and a
 * low-confidence guess says so. The photo is never stored; it lives in memory
 * for the preview and is dropped when the review closes.
 */
export function FoodScan({
  available,
  slot,
  slots,
  onSlotChange,
  onLog,
}: {
  /** False in local-only mode, where there is no Firebase project to call. */
  available: boolean;
  slot: MealSlot;
  slots: { value: MealSlot; label: string }[];
  onSlotChange: (slot: MealSlot) => void;
  onLog: (entries: Draft[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [hint, setHint] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Release the preview's object URL when it is replaced or the card unmounts.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function scan(file: File) {
    setPreview(URL.createObjectURL(file));
    setPhase({ kind: 'scanning' });
    try {
      const image = await prepareImage(file);
      const result = await scanFoodPhoto(image, hint);
      if (!result.items.length) {
        setPhase({
          kind: 'error',
          message: result.note || 'No food found in that photo. Try a closer, brighter shot.',
        });
        return;
      }
      setPhase({ kind: 'review', items: result.items, note: result.note });
    } catch (error) {
      console.warn('[food-scan]', error);
      setPhase({ kind: 'error', message: scanErrorMessage(error) });
    }
  }

  function reset() {
    setPhase({ kind: 'idle' });
    setPreview(null);
    setHint('');
    if (fileInput.current) fileInput.current.value = '';
  }

  function editItem(index: number, patch: Partial<ScanItem>) {
    setPhase((p) =>
      p.kind === 'review'
        ? { ...p, items: p.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }
        : p,
    );
  }

  function removeItem(index: number) {
    setPhase((p) =>
      p.kind === 'review' ? { ...p, items: p.items.filter((_, i) => i !== index) } : p,
    );
  }

  function log(items: ScanItem[]) {
    onLog(
      items
        .filter((it) => it.name.trim() && it.grams > 0)
        .map((it) => ({
          name: `${it.name.trim()} · ${Math.round(it.grams)} g`,
          slot,
          ...itemMacros(it),
        })),
    );
    reset();
  }

  const slotLabel = slots.find((s) => s.value === slot)?.label.toLowerCase() ?? 'meal';

  if (!available) {
    return (
      <Card title="Scan a photo">
        <p className="hint">
          Photo scanning needs the synced version of Vitals. Sign in with Firebase to use it.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Scan a photo"
      note="Snap your plate and Gemini estimates each food. Check the numbers before adding."
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void scan(file);
        }}
      />

      {(phase.kind === 'idle' || phase.kind === 'error') && (
        <div className="scan-start">
          <label className="field">
            <span className="label">Anything the photo can't show? (optional)</span>
            <input
              type="text"
              placeholder="2 chapatis, cooked in ghee"
              maxLength={300}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInput.current?.click()}
          >
            Take or choose a photo
          </button>
          {phase.kind === 'error' && (
            <p className="banner error" role="alert">
              {phase.message}
            </p>
          )}
        </div>
      )}

      {phase.kind === 'scanning' && (
        <div className="scan-busy" role="status">
          {preview && <img className="scan-thumb" src={preview} alt="" />}
          <span>Looking at your plate…</span>
        </div>
      )}

      {phase.kind === 'review' && (
        <div className="scan-review">
          <div className="scan-busy">
            {preview && <img className="scan-thumb" src={preview} alt="Your photo" />}
            <span>
              Found {phase.items.length} {phase.items.length === 1 ? 'item' : 'items'}. Fix any
              name or portion, then add.
            </span>
          </div>
          {phase.note && <p className="hint">{phase.note}</p>}

          <ul className="scan-items">
            {phase.items.map((item, i) => {
              const m = itemMacros(item);
              return (
                <li key={i}>
                  <div className="scan-item-top">
                    <input
                      type="text"
                      aria-label={`Food ${i + 1} name`}
                      value={item.name}
                      maxLength={80}
                      onChange={(e) => editItem(i, { name: e.target.value })}
                    />
                    <label className="scan-grams">
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        aria-label={`${item.name} portion in grams`}
                        value={item.grams || ''}
                        onChange={(e) => editItem(i, { grams: Number(e.target.value) || 0 })}
                      />
                      <span>g</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-icon"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(i)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="scan-item-macros">
                    <strong>{m.calories} kcal</strong>
                    <span>P {Math.round(m.proteinG)}</span>
                    <span>C {Math.round(m.carbsG)}</span>
                    <span>F {Math.round(m.fatG)}</span>
                    <span>Fiber {Math.round(m.fiberG)}</span>
                    {item.confidence === 'low' && <Pill status="warning">Check this</Pill>}
                  </div>
                </li>
              );
            })}
          </ul>

          {phase.items.length > 0 && <PlateTotal items={phase.items} />}

          <div className="scan-actions">
            <select
              aria-label="Meal"
              value={slot}
              onChange={(e) => onSlotChange(e.target.value as MealSlot)}
            >
              {slots.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!phase.items.some((it) => it.name.trim() && it.grams > 0)}
              onClick={() => log(phase.items)}
            >
              Add to {slotLabel}
            </button>
            <button type="button" className="btn" onClick={reset}>
              Discard
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function PlateTotal({ items }: { items: ScanItem[] }) {
  const t = totalMacros(items);
  return (
    <dl className="scan-total" aria-label="Plate total">
      <div>
        <dt>Calories</dt>
        <dd>{Math.round(t.calories)}</dd>
      </div>
      <div>
        <dt>Protein</dt>
        <dd>{Math.round(t.proteinG)} g</dd>
      </div>
      <div>
        <dt>Carbs</dt>
        <dd>{Math.round(t.carbsG)} g</dd>
      </div>
      <div>
        <dt>Fat</dt>
        <dd>{Math.round(t.fatG)} g</dd>
      </div>
      <div>
        <dt>Fiber</dt>
        <dd>{Math.round(t.fiberG)} g</dd>
      </div>
    </dl>
  );
}

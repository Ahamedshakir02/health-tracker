import { useState } from 'react';
import { Segmented } from './ui';
import { PORTIONS } from '../lib/foods';
import type { SavedFood } from '../types';

/**
 * Saved foods as one row of buttons: pick a portion, tap a food, it is logged
 * to the meal the form is aimed at. Removing is behind an "Edit" switch so a
 * mis-tap while logging cannot delete a food.
 */
export function MyFoods({
  foods,
  slotLabel,
  onLog,
  onRemove,
}: {
  foods: SavedFood[];
  slotLabel: string;
  onLog: (food: SavedFood, portion: number) => void;
  onRemove: (id: string) => void;
}) {
  const [portion, setPortion] = useState<number>(1);
  const [editing, setEditing] = useState(false);

  if (!foods.length) {
    return (
      <p className="hint">
        Tick "Save to my foods" when you add something you eat often, and it will be one tap
        here next time.
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Segmented
          options={PORTIONS.map((p) => ({ value: p.value as number, label: `${p.label}×` }))}
          value={portion}
          onChange={setPortion}
          ariaLabel="Portion"
        />
        <button
          type="button"
          className="btn btn-sm"
          aria-pressed={editing}
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      <div className="row">
        {foods.map((food) =>
          editing ? (
            <button
              key={food.id}
              type="button"
              className="btn btn-sm"
              aria-label={`Remove ${food.name} from my foods`}
              onClick={() => onRemove(food.id)}
            >
              {food.name} ✕
            </button>
          ) : (
            <button
              key={food.id}
              type="button"
              className="btn btn-sm"
              title={`Add to ${slotLabel.toLowerCase()}`}
              onClick={() => onLog(food, portion)}
            >
              {food.name}
              {food.portion ? ` (${food.portion})` : ''} ·{' '}
              {Math.round(food.calories * portion)} kcal
            </button>
          ),
        )}
      </div>
    </div>
  );
}

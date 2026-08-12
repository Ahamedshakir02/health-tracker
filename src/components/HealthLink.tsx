import { useRef, useState } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Card, Pill, Segmented } from './ui';
import { relativeLabel } from '../lib/dates';
import {
  mergeImport,
  readHealthExport,
  type ImportPreview,
  type MergeMode,
} from '../lib/healthImport';

const MODES: { value: MergeMode; label: string }[] = [
  { value: 'fill-gaps', label: 'Fill gaps only' },
  { value: 'overwrite', label: 'Let the file win' },
];

export default function HealthLink() {
  const { data, replaceAll } = useHealth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<MergeMode>('fill-gaps');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    setResult(null);
    setPreview(null);
    setBusy(true);
    try {
      setPreview(await readHealthExport(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const merged = mergeImport(data, preview, mode);
      await replaceAll(merged.data);
      const { added, keptExisting } = merged;
      setResult(
        `Merged ${added.days} day${added.days === 1 ? '' : 's'}, ${added.weights} weight reading${
          added.weights === 1 ? '' : 's'
        } and ${added.workouts} session${added.workouts === 1 ? '' : 's'}.` +
          (keptExisting > 0 ? ` ${keptExisting} existing value${keptExisting === 1 ? '' : 's'} left untouched.` : ''),
      );
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const total = preview
    ? preview.days.length + preview.weights.length + preview.workouts.length
    : 0;

  return (
    <Card
      title="Connect health data"
      note="Bring in history from Google Fit, Health Connect, Apple Health, Fitbit or Garmin."
    >
      <div className="stack">
        <p className="hint">
          There is no live sync to offer here, and it is worth being straight about why: Google has
          retired the Fit API, and its replacement — Health Connect — stores everything on the phone
          with no web-facing API at all. Apple Health is the same. A page in a browser has nothing
          to connect to. What every one of them <em>does</em> support is an export file, so that is
          what this reads.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>App</th>
                <th>Where to get the file</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="cell-main">Google Fit</td>
                <td>
                  <a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer">
                    Google Takeout
                  </a>{' '}
                  → Fit → unzip → <code>Daily activity metrics.csv</code>
                </td>
              </tr>
              <tr>
                <td className="cell-main">Apple Health</td>
                <td>
                  Health app → profile photo → Export All Health Data → unzip → <code>export.xml</code>
                </td>
              </tr>
              <tr>
                <td className="cell-main">Health Connect</td>
                <td>
                  Its own backup is an encrypted archive this cannot read — export a CSV from the
                  app that writes to it (Fitbit, Garmin, Samsung Health) instead
                </td>
              </tr>
              <tr>
                <td className="cell-main">Anything else</td>
                <td>Any CSV with a date column — the importer reads the headers to find the rest</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? 'Reading…' : 'Choose export file'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xml,text/csv,text/xml,application/xml"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void pick(file);
            }}
          />
          {preview && (
            <button type="button" className="btn btn-sm" onClick={() => setPreview(null)}>
              Cancel
            </button>
          )}
        </div>

        {error && (
          <div className="banner error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="banner" role="status">
            <span aria-hidden="true">✓</span>
            <span>{result}</span>
          </div>
        )}

        {preview && (
          <div className="stack import-preview">
            <div className="row">
              <Pill status={total > 0 ? 'good' : 'warning'}>
                {preview.source === 'apple-health' ? 'Apple Health export' : 'CSV export'}
              </Pill>
              {preview.firstDate && preview.lastDate && (
                <span className="hint">
                  {relativeLabel(preview.firstDate)} → {relativeLabel(preview.lastDate)}
                </span>
              )}
            </div>

            {total === 0 ? (
              <p className="hint">
                Nothing usable was found in that file. Check you picked the daily metrics export
                rather than an index or a settings file.
              </p>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Found</th>
                        <th className="num">Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.found.map((f) => (
                        <tr key={f.label}>
                          <td className="cell-main">{f.label}</td>
                          <td className="num">{f.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="field">
                  <span className="label">When the file and your own entries disagree</span>
                  <Segmented
                    options={MODES}
                    value={mode}
                    onChange={setMode}
                    ariaLabel="Merge strategy"
                  />
                  <span className="hint">
                    {mode === 'fill-gaps'
                      ? 'Anything you typed in by hand is kept; the file only fills empty fields.'
                      : 'The file replaces what you have logged for the same day and metric.'}
                  </span>
                </div>

                <div className="row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void apply()}
                  >
                    {busy ? 'Merging…' : 'Merge into my data'}
                  </button>
                </div>
              </>
            )}

            {preview.skipped.length > 0 && (
              <p className="hint">
                Ignored (nothing in this app maps to them): {preview.skipped.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

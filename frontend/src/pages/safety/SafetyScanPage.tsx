import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { scanQrPayload } from '../../api/pulse';
import { searchSafetyAssets } from '../../api/safety';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface AssetMatch {
  id: string;
  asset_no: string;
  name: string;
  status: string;
}

export function SafetyScanPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<AssetMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setMatches([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      searchSafetyAssets(term)
        .then((rows) => {
          setMatches(rows);
          setOpen(rows.length > 0);
        })
        .catch(() => setMatches([]))
        .finally(() => setSearching(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const openWorkspace = (assetId: string) => {
    setOpen(false);
    navigate(`/assets/${assetId}/workspace`);
  };

  const onSubmit = async () => {
    const term = query.trim();
    if (!term) return;

    if (matches.length === 1) {
      openWorkspace(matches[0].id);
      return;
    }
    if (matches.length > 1) {
      setError('Multiple matches — pick one from the list.');
      setOpen(true);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await scanQrPayload(term);
      navigate(result.workspace_url);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Scan Asset</h1>
      <p className="mb-6 text-sm text-slate-500">
        Search by asset code, name, or UUID — pick a match to open the workspace.
      </p>
      <Card title="Find Asset">
        <div className="mb-4 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
          Camera scanning — use search below for demo
        </div>

        <label className="block text-sm font-medium text-slate-700">Search asset</label>
        <div className="relative mt-1" ref={wrapRef}>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-3 text-base"
            placeholder="e.g. IAF, IAF-01, or UUID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => matches.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
              }
            }}
            autoComplete="off"
            enterKeyHint="search"
          />
          {searching && (
            <p className="absolute right-3 top-3.5 text-xs text-slate-400">Searching…</p>
          )}
          {open && matches.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="flex min-h-[48px] w-full flex-col justify-center px-3 py-3 text-left text-sm hover:bg-brand-50"
                    onClick={() => openWorkspace(m.id)}
                  >
                    <span className="font-medium text-slate-900">
                      {m.asset_no} — {m.name}
                    </span>
                    <span className="text-xs text-slate-500">{m.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && !searching && query.trim() && matches.length === 0 && (
            <p className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
              No matching assets
            </p>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button className="mt-4 w-full" size="lg" disabled={loading || !query.trim()} onClick={onSubmit}>
          {loading ? 'Opening…' : 'Open Asset Workspace'}
        </Button>
      </Card>
    </div>
  );
}

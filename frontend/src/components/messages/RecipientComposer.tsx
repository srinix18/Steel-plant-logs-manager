import { useMemo, useRef, useState } from 'react';
import type { Department, User } from '../../types';
import {
  buildRecipientSuggestions,
  type RecipientSuggestion,
  type RecipientToken,
  suggestionToToken,
  tokenKey,
} from '../../utils/messageRecipients';

type Props = {
  eligible: User[];
  departments: Department[];
  tokens: RecipientToken[];
  onChange: (tokens: RecipientToken[]) => void;
};

export function RecipientComposer({ eligible, departments, tokens, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => buildRecipientSuggestions(query, eligible, departments, tokens),
    [query, eligible, departments, tokens],
  );

  const showNoMatch = query.trim().length > 0 && suggestions.length === 0;

  const addToken = (s: RecipientSuggestion) => {
    const next = suggestionToToken(s);
    if (tokens.some((t) => tokenKey(t) === tokenKey(next))) return;
    if (next.kind === 'all') {
      onChange([next]);
    } else if (tokens.some((t) => t.kind === 'all')) {
      onChange([next]);
    } else {
      onChange([...tokens, next]);
    }
    setQuery('');
    setHighlight(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeToken = (key: string) => {
    onChange(tokens.filter((t) => tokenKey(t) !== key));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !query && tokens.length > 0) {
      onChange(tokens.slice(0, -1));
      return;
    }
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addToken(suggestions[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-sm text-slate-600">To</p>
      <p className="mb-2 text-xs text-slate-500">
        Type a name or email. Use <span className="font-mono">@all</span> or{' '}
        <span className="font-mono">@DEPT_CODE</span> (e.g. <span className="font-mono">@SMS</span>,{' '}
        <span className="font-mono">@ROLLING</span>).
      </p>
      <div
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-200"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {tokens.map((t) => (
            <span
              key={tokenKey(t)}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-sm text-brand-800"
            >
              {t.label}
              <button
                type="button"
                className="text-brand-600 hover:text-brand-900"
                onClick={(e) => {
                  e.stopPropagation();
                  removeToken(tokenKey(t));
                }}
                aria-label={`Remove ${t.label}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-sm outline-none"
            placeholder={tokens.length === 0 ? 'Search recipients…' : ''}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>

      {open && query.trim() && suggestions.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          {suggestions.map((s, i) => (
            <li key={s.kind === 'user' ? s.id : s.kind === 'dept' ? s.id : 'all'}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  i === highlight ? 'bg-brand-50' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addToken(s)}
              >
                <span className="font-medium text-slate-900">{s.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{s.sublabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showNoMatch && <p className="mt-1 text-sm text-slate-500">No one matched.</p>}
    </div>
  );
}

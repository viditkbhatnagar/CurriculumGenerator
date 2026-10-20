'use client';

import { useEffect, useState } from 'react';
import {
  Concept,
  ConceptDetail,
  getConcept,
  getConcepts,
  Importance,
  OntologyDomain,
} from '@/lib/libraryApi';

const IMPORTANCE: Record<Importance, { label: string; tone: string; hint: string }> = {
  core: {
    label: 'Core',
    tone: 'bg-teal-700 text-white',
    hint: 'Most of the domain’s books teach it in depth',
  },
  supporting: {
    label: 'Supporting',
    tone: 'bg-teal-100 text-teal-800',
    hint: 'Taught properly in some books',
  },
  advanced: {
    label: 'Advanced',
    tone: 'bg-violet-100 text-violet-800',
    hint: 'Taught at an advanced level',
  },
  optional: {
    label: 'Optional',
    tone: 'bg-slate-100 text-slate-600',
    hint: 'Mentioned rather than taught',
  },
};

const ROLE_TONE: Record<string, string> = {
  primary: 'text-teal-700',
  supplementary: 'text-slate-600',
  critical: 'text-amber-700',
  additional: 'text-slate-500',
};

function ConceptDrawer({ code, onClose }: { code: string; onClose: () => void }) {
  const [c, setC] = useState<ConceptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getConcept(code)
      .then(setC)
      .catch((e) => setError(e.message));
  }, [code]);
  const list = (title: string, items?: string[]) =>
    items?.length ? (
      <section className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Concept"
    >
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="float-right text-sm text-slate-500 hover:text-slate-900"
        >
          Close
        </button>
        {error && <p className="text-red-600">{error}</p>}
        {!c && !error && <p className="text-slate-500">Loading…</p>}
        {c && (
          <>
            <p className="font-mono text-xs text-teal-700">
              {c.code} · {c.area}
              {c.subArea ? ` › ${c.subArea}` : ''}
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-900">{c.name}</h3>
            {c.aliases.length > 0 && (
              <p className="mt-1 text-sm text-slate-500">Also: {c.aliases.join(', ')}</p>
            )}
            <p className="mt-2 text-sm text-slate-500">
              {c.conceptType} · {c.level} · taught in {c.bookCount} book
              {c.bookCount === 1 ? '' : 's'} ·{' '}
              <span title={IMPORTANCE[c.importance].hint}>{IMPORTANCE[c.importance].label}</span>
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-800">{c.definition}</p>
            {list('Components', c.components)}
            {c.formulae?.length > 0 && (
              <section className="mt-5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Formulae
                </h4>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {c.formulae.map((f) => (
                    <li key={f.expression}>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5">{f.expression}</code>{' '}
                      <span className="text-slate-600">{f.meaning}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {list('Applications', c.applications)}
            {list('Common misconceptions', c.misconceptions)}
            {list('Prerequisites', c.prerequisites)}
            {list('Skills it enables', c.skillsEnabled)}
            {list('How it can be assessed', c.assessmentPossibilities)}
            <section className="mt-8">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Where the books teach it
              </h4>
              <ol className="mt-2 space-y-4">
                {c.evidence.map((e, i) => (
                  <li key={i} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm">
                      <span
                        className={`mr-2 text-xs font-semibold uppercase ${ROLE_TONE[e.role] || ''}`}
                      >
                        {e.role}
                      </span>
                      <span className="text-slate-800">{e.citation}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {e.treatment === 'extended'
                        ? 'Developed at length'
                        : e.treatment === 'treatment'
                          ? 'Explained'
                          : 'Mentioned'}
                    </p>
                    {e.passages[0] && (
                      <blockquote className="mt-2 border-l-2 border-teal-300 pl-3 text-sm italic text-slate-600">
                        {e.passages[0].excerpt}…{' '}
                        <span className="not-italic text-slate-400">
                          (pp. {e.passages[0].pages})
                        </span>
                      </blockquote>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

/** Browse or search the library's concepts; open one to see where each book teaches it. */
export function ConceptsPanel({ domains }: { domains: OntologyDomain[] }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('');
  const [area, setArea] = useState('');
  const [importance, setImportance] = useState<Importance[]>([]);
  const [items, setItems] = useState<Concept[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    getConcepts({
      q: query || undefined,
      domain: domain || undefined,
      area: area || undefined,
      importance,
      limit: 80,
    })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [query, domain, area, importance]);

  const areas = domains.find((d) => d.key === domain)?.areas || domains.flatMap((d) => d.areas);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="min-w-[16rem] flex-1">
          <label
            htmlFor="kb-q"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1"
          >
            Search by meaning
          </label>
          <input
            id="kb-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. how to value an investment"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <select
          aria-label="Domain"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setArea('');
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d.key} value={d.key}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a.code} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Search
        </button>
        {query && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setQuery('');
            }}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Clear
          </button>
        )}
        <div className="flex w-full flex-wrap gap-2">
          {(Object.keys(IMPORTANCE) as Importance[]).map((k) => (
            <button
              key={k}
              type="button"
              title={IMPORTANCE[k].hint}
              aria-pressed={importance.includes(k)}
              onClick={() =>
                setImportance((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
              }
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${importance.includes(k) ? `${IMPORTANCE[k].tone} ring-transparent` : 'bg-white text-slate-600 ring-slate-300 hover:ring-teal-400'}`}
            >
              {IMPORTANCE[k].label}
            </button>
          ))}
        </div>
      </form>

      {error && <p className="mt-4 text-red-600">{error}</p>}
      {!items && !error && <p className="mt-6 text-slate-500">Loading concepts…</p>}
      {items && items.length === 0 && <p className="mt-6 text-slate-500">No concepts match.</p>}
      {items && items.length > 0 && (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {items.map((c) => (
            <li key={c.code}>
              <button
                onClick={() => setOpen(c.code)}
                className="block h-full w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-teal-700">
                      {c.code} · {c.area}
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-900">{c.name}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${IMPORTANCE[c.importance].tone}`}
                  >
                    {IMPORTANCE[c.importance].label}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.definition}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {c.conceptType} · {c.bookCount} book{c.bookCount === 1 ? '' : 's'}
                  {c.sources?.[0] && <> · {c.sources[0].citation}</>}
                  {typeof c.similarity === 'number' && (
                    <> · match {Math.round(c.similarity * 100)}%</>
                  )}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <ConceptDrawer code={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

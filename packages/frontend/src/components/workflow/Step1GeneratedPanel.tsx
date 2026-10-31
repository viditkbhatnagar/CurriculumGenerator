'use client';

/**
 * What Step 1 generated from the form: the provisional executive summary, aims, entry
 * requirements and career pathways. They were stored and exported but never shown on the page,
 * so the author approved Step 1 without seeing them (Logan's test run, 28 October 2026).
 */
export default function Step1GeneratedPanel({ step1 }: { step1: any }) {
  const aims: string[] = Array.isArray(step1?.programAims) ? step1.programAims : [];
  const pathways: string[] = Array.isArray(step1?.careerPathways) ? step1.careerPathways : [];
  const summary: string = typeof step1?.executiveSummary === 'string' ? step1.executiveSummary : '';
  const entry: string = typeof step1?.entryRequirements === 'string' ? step1.entryRequirements : '';
  if (!summary && !aims.length && !entry && !pathways.length) return null;

  const text = (s: unknown) => (typeof s === 'string' ? s : JSON.stringify(s));

  return (
    <section
      aria-labelledby="step1-generated"
      className="rounded-xl border border-teal-200 bg-white p-6 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-600">
        Generated from your inputs
      </p>
      <h3 id="step1-generated" className="mt-1 text-lg font-semibold text-teal-950">
        Programme foundation (provisional)
      </h3>
      <p className="mt-1 text-sm text-teal-700">
        Review this before approving. Change the form and generate again to revise it.
      </p>

      {summary && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-teal-900">Executive summary</h4>
          <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-800">
            {summary
              .split(/\n{2,}/)
              .filter((p) => p.trim())
              .map((p, i) => (
                <p key={i}>{p.trim()}</p>
              ))}
          </div>
        </div>
      )}

      {aims.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-teal-900">Programme aims</h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-800">
            {aims.map((a, i) => (
              <li key={i}>{text(a)}</li>
            ))}
          </ol>
        </div>
      )}

      {entry && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-teal-900">Entry requirements (proposal)</h4>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{entry}</p>
        </div>
      )}

      {pathways.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-teal-900">Career pathways (proposals)</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {pathways.map((p, i) => (
              <li key={i}>{text(p)}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

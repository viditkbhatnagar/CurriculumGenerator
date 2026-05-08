'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthContext';
import UserMenu from '@/components/auth/UserMenu';

interface PackageSummary {
  modules: number;
  learningOutcomes: number;
  glossary: number;
  caseStudies: number;
  references: number;
  hasProgramOverview: boolean;
  hasCompetencyFramework: boolean;
  hasReadingList: boolean;
  hasAssessments: boolean;
}

interface ArchiveProject {
  id: string;
  projectName: string;
  courseCode: string | null;
  status: string;
  currentStage: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  hasPackage: boolean;
  summary: PackageSummary | null;
}

interface ArchiveDetail {
  project: ArchiveProject;
  package: any | null;
}

export default function ArchivePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ArchiveProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<string, ArchiveDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || user?.role !== 'administrator') return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get('/api/v3/archive');
        if (!cancelled) setProjects(resp.data?.data || []);
      } catch (err: any) {
        if (!cancelled)
          setError(err?.response?.data?.error || err.message || 'Failed to load archive');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.role]);

  const loadDetail = async (id: string) => {
    if (openDetail[id]) return;
    setDetailLoading(id);
    try {
      const resp = await api.get(`/api/v3/archive/${id}`);
      setOpenDetail((cur) => ({ ...cur, [id]: resp.data?.data }));
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to load detail');
    } finally {
      setDetailLoading(null);
    }
  };

  const toggle = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    await loadDetail(id);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-9 h-9 rounded-full border-2 border-stone-300 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  if (user?.role !== 'administrator') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-2">
          <h1 className="text-lg font-semibold text-stone-900">Administrator only</h1>
          <p className="text-sm text-stone-600">
            The archive holds legacy curricula and is restricted to administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between border-b border-stone-200/70">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-2 h-2 rounded-full bg-teal-600 ring-4 ring-teal-100"
          />
          <span className="text-[11px] uppercase tracking-[0.16em] text-stone-500 font-medium">
            AGCQ · Archive
          </span>
        </div>
        <UserMenu />
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-12 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.65, 0.3, 1] }}
          className="space-y-1.5"
        >
          <h1 className="font-display text-[32px] sm:text-[36px] leading-[1.05] font-semibold tracking-[-0.02em] text-stone-900">
            Curriculum Archive
          </h1>
          <p className="text-[15px] text-stone-600 leading-relaxed max-w-[64ch]">
            Legacy curricula generated under earlier versions of the system. Read-only — these
            records aren't editable in the current workflow, but they're preserved here so you can
            review them, copy text out, or use them as reference material for new programmes.
          </p>
        </motion.div>

        {error && (
          <div
            role="alert"
            className="text-sm text-rose-700 bg-rose-50 border border-rose-200/70 rounded-lg px-3.5 py-2.5"
          >
            {String(error)}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 text-sm text-stone-500 text-center">
            Loading…
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center">
            <p className="text-sm text-stone-700">No archived curricula found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                expanded={openId === p.id}
                detail={openDetail[p.id]}
                detailLoading={detailLoading === p.id}
                onToggle={() => toggle(p.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProjectRow({
  project,
  expanded,
  detail,
  detailLoading,
  onToggle,
}: {
  project: ArchiveProject;
  expanded: boolean;
  detail: ArchiveDetail | undefined;
  detailLoading: boolean;
  onToggle: () => void;
}) {
  const dateLabel = (s?: string | null) =>
    s
      ? new Date(s).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—';

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 sm:px-6 py-4 flex items-center justify-between gap-4 hover:bg-stone-50/80 transition-colors text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-stone-900 truncate">{project.projectName}</h3>
            <StatusBadge status={project.status} />
          </div>
          <div className="text-[12px] text-stone-500 mt-1 flex items-center gap-3 flex-wrap">
            {project.courseCode && (
              <span className="font-mono text-stone-600">{project.courseCode}</span>
            )}
            <span>Created {dateLabel(project.createdAt)}</span>
            {project.publishedAt && <span>Published {dateLabel(project.publishedAt)}</span>}
            {project.summary && (
              <span className="text-stone-400">
                {project.summary.modules} modules · {project.summary.learningOutcomes} outcomes ·{' '}
                {project.summary.glossary} terms
              </span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-stone-400 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-5 sm:px-6 py-5 space-y-5 text-sm">
          {detailLoading || !detail ? (
            <div className="text-stone-500">Loading curriculum…</div>
          ) : !detail.package ? (
            <div className="text-stone-500">This project has no preliminary package stored.</div>
          ) : (
            <PackageDetail pkg={detail.package} />
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-800',
    final_review: 'bg-amber-100 text-amber-800',
    research: 'bg-stone-100 text-stone-700',
    cancelled: 'bg-rose-100 text-rose-800',
  };
  const cls = palette[status] || 'bg-stone-100 text-stone-700';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight uppercase ${cls}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function PackageDetail({ pkg }: { pkg: any }) {
  const program = pkg.programOverview;
  const modules = pkg.courseFramework?.modules;

  return (
    <div className="space-y-5">
      {program && (
        <Section title="Program overview">
          <KeyValue label="Title" value={program.programTitle} />
          <KeyValue label="Aim" value={program.aim} multiline />
          <KeyValue label="Qualification" value={program.qualificationType} />
          <KeyValue label="Industry need" value={program.industryNeed} multiline />
          <KeyValue label="Target audience" value={program.targetAudience} multiline />
          <KeyValue label="Entry requirements" value={program.entryRequirements} multiline />
          <KeyValue label="Duration" value={program.duration} />
          <KeyValue
            label="Career outcomes"
            value={
              Array.isArray(program.careerOutcomes)
                ? program.careerOutcomes.join(', ')
                : program.careerOutcomes
            }
            multiline
          />
        </Section>
      )}

      {Array.isArray(pkg.learningOutcomes) && pkg.learningOutcomes.length > 0 && (
        <Section title={`Learning outcomes (${pkg.learningOutcomes.length})`}>
          <ol className="list-decimal pl-5 space-y-1.5 text-stone-800">
            {pkg.learningOutcomes.map((o: any, i: number) => (
              <li key={i}>
                {typeof o === 'string' ? o : o.statement || o.text || JSON.stringify(o)}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {Array.isArray(modules) && modules.length > 0 && (
        <Section title={`Modules (${modules.length})`}>
          <ol className="space-y-2.5 list-decimal pl-5">
            {modules.map((m: any, i: number) => (
              <li key={i} className="text-stone-800">
                <p className="font-medium">{m.title || m.name || `Module ${i + 1}`}</p>
                {m.description && (
                  <p className="text-stone-600 text-[13px] mt-0.5 leading-relaxed">
                    {m.description}
                  </p>
                )}
                {m.duration && (
                  <p className="text-stone-500 text-[12px] mt-0.5">Duration: {m.duration}</p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {Array.isArray(pkg.caseStudies) && pkg.caseStudies.length > 0 && (
        <Section title={`Case studies (${pkg.caseStudies.length})`}>
          <ul className="space-y-2.5">
            {pkg.caseStudies.map((c: any, i: number) => (
              <li key={i} className="text-stone-800">
                <p className="font-medium">{c.title || `Case ${i + 1}`}</p>
                {c.scenario && (
                  <p className="text-stone-600 text-[13px] mt-0.5 leading-relaxed line-clamp-3">
                    {c.scenario}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Array.isArray(pkg.glossary) && pkg.glossary.length > 0 && (
        <Section title={`Glossary (${pkg.glossary.length} terms)`}>
          <details>
            <summary className="cursor-pointer text-teal-700 text-[13px] hover:text-teal-900">
              Show all terms
            </summary>
            <dl className="mt-3 space-y-2">
              {pkg.glossary.map((g: any, i: number) => (
                <div key={i}>
                  <dt className="font-medium text-stone-900">{g.term || g.name}</dt>
                  <dd className="text-stone-600 text-[13px] leading-relaxed mt-0.5">
                    {g.definition}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </Section>
      )}

      {Array.isArray(pkg.references) && pkg.references.length > 0 && (
        <Section title={`References (${pkg.references.length})`}>
          <details>
            <summary className="cursor-pointer text-teal-700 text-[13px] hover:text-teal-900">
              Show all references
            </summary>
            <ul className="mt-3 space-y-1.5 text-[13px] text-stone-700">
              {pkg.references.map((r: any, i: number) => (
                <li key={i}>{typeof r === 'string' ? r : r.citation || JSON.stringify(r)}</li>
              ))}
            </ul>
          </details>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] uppercase tracking-[0.08em] font-medium text-stone-500">
        {title}
      </h4>
      <div className="text-stone-800 leading-relaxed">{children}</div>
    </section>
  );
}

function KeyValue({ label, value, multiline }: { label: string; value: any; multiline?: boolean }) {
  if (!value) return null;
  return (
    <div className="text-[13px] mb-1.5">
      <span className="text-stone-500">{label}: </span>
      {multiline ? (
        <p className="text-stone-800 mt-0.5 leading-relaxed">{String(value)}</p>
      ) : (
        <span className="text-stone-800">{String(value)}</span>
      )}
    </div>
  );
}

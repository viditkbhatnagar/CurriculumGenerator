'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthContext';
import { CurriculumHero } from '@/components/ui/prisma-hero';
import {
  ArrowRight,
  Sparkles,
  Layers,
  Target,
  Shield,
  Clock,
  Globe2,
  BookOpen,
  Zap,
} from 'lucide-react';

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const STATS = [
  { value: '13', label: 'Workflow steps', icon: Layers },
  { value: '~2h', label: 'Programme draft', icon: Clock },
  { value: '100%', label: 'Auto-gradable', icon: Shield },
  { value: '3', label: 'Credit systems', icon: Globe2 },
];

const PILLARS = [
  {
    icon: Target,
    eyebrow: 'Pedagogy',
    title: 'Outcome-led, not template-led',
    body: 'Every artefact — PLOs, MLOs, assessments, lessons — is traced back to a single competency framework and stays consistent across the whole programme.',
    accent: 'from-teal-500/30 via-teal-400/20 to-transparent',
  },
  {
    icon: BookOpen,
    eyebrow: 'Standards',
    title: 'AGI-compliant sources, by default',
    body: 'Peer-reviewed journals under five years old, structured APA citations, semantic deduping. Drift-prone references are caught before they reach the page.',
    accent: 'from-violet-500/30 via-violet-400/20 to-transparent',
  },
  {
    icon: Zap,
    eyebrow: 'Velocity',
    title: 'Hours, not months',
    body: 'A GPT-5 RAG pipeline drafts each section while you keep approval at every checkpoint. Faculty edits, AI redrafts — the loop is fast and visible.',
    accent: 'from-rose-500/25 via-rose-400/15 to-transparent',
  },
  {
    icon: Sparkles,
    eyebrow: 'Composition',
    title: 'One workbench, every artefact',
    body: 'Programme spec, unit specs, reading lists, case studies, glossaries, lesson plans, slides, assignments and the summative exam — all in one place.',
    accent: 'from-amber-500/25 via-amber-400/15 to-transparent',
  },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Authenticated users have no business on the marketing homepage —
  // they need the workflow list (which also has the UserMenu so admins
  // can reach Faculty management).
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/workflow');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-background">
      {/* Cinematic hero */}
      <CurriculumHero ctaHref="/login" ctaLabel="Sign in" />

      {/* Eyebrow strip — anchors the reader after the hero */}
      <section className="px-4 pt-20 pb-10 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              How AGCQ works
            </span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium text-foreground text-center tracking-tight leading-[1.05]">
            A workbench, not a wizard.
          </h2>
          <p className="text-base sm:text-lg text-foreground-muted text-center mt-5 max-w-2xl mx-auto leading-relaxed">
            Drafting a programme is a long conversation between framework, faculty, and evidence.
            AGCQ keeps all three in one room.
          </p>
        </motion.div>
      </section>

      {/* Stats — rich gradient cards */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-center group hover:shadow-card-hover transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.04] pointer-events-none" />
              <stat.icon className="relative w-5 h-5 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <div className="relative font-display text-3xl font-medium text-foreground tracking-tight">
                {stat.value}
              </div>
              <div className="relative text-xs text-foreground-muted mt-1 tracking-wide">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Pillars — large editorial cards with subtle jewel-tone accents */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.title}
                  variants={staggerItem}
                  custom={i}
                  className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 group hover:border-primary/30 hover:shadow-card-hover transition-all"
                >
                  <div
                    className={`absolute -top-24 -right-24 w-64 h-64 rounded-full bg-gradient-radial ${p.accent} blur-2xl opacity-80 pointer-events-none`}
                    style={{
                      background: `radial-gradient(circle, ${
                        i === 0
                          ? 'rgba(15,118,110,0.22)'
                          : i === 1
                            ? 'rgba(124,58,237,0.22)'
                            : i === 2
                              ? 'rgba(244,63,94,0.18)'
                              : 'rgba(245,158,11,0.18)'
                      } 0%, transparent 70%)`,
                    }}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-[10px] tracking-[0.2em] uppercase text-foreground-muted font-medium">
                        {p.eyebrow}
                      </span>
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl font-medium text-foreground leading-tight mb-3 tracking-tight">
                      {p.title}
                    </h3>
                    <p className="text-sm sm:text-base text-foreground-muted leading-relaxed">
                      {p.body}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* CTA — full-width rich gradient panel */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div
            className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center"
            style={{
              background:
                'radial-gradient(at 20% 20%, rgba(15,118,110,0.55) 0%, transparent 55%), ' +
                'radial-gradient(at 80% 30%, rgba(124,58,237,0.45) 0%, transparent 55%), ' +
                'radial-gradient(at 50% 100%, rgba(244,114,182,0.30) 0%, transparent 60%), ' +
                'linear-gradient(135deg, rgb(15 19 42) 0%, rgb(10 13 28) 100%)',
            }}
          >
            <div className="noise-overlay absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none" />
            <div className="relative">
              <p
                className="text-xs tracking-[0.25em] uppercase mb-4 font-medium"
                style={{ color: 'rgba(225,224,204,0.7)' }}
              >
                Ready when you are
              </p>
              <h2
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight leading-[1.05] mb-5"
                style={{ color: '#E1E0CC' }}
              >
                Begin a programme, not a project.
              </h2>
              <p
                className="text-sm sm:text-base max-w-xl mx-auto mb-8 leading-relaxed"
                style={{ color: 'rgba(225,224,204,0.78)' }}
              >
                Sign in to draft your first programme spec. Faculty invites, archive of legacy
                curricula, and full analytics are one click away.
              </p>
              <motion.button
                onClick={() => router.push('/login')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex items-center gap-2 self-start rounded-full py-2.5 pl-7 pr-2 text-sm font-medium transition-all hover:gap-3 sm:text-base"
                style={{ background: '#E1E0CC', color: '#0a0a18' }}
              >
                Sign in to AGCQ
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black transition-transform group-hover:scale-110 sm:h-10 sm:w-10">
                  <ArrowRight className="h-4 w-4" style={{ color: '#E1E0CC' }} />
                </span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

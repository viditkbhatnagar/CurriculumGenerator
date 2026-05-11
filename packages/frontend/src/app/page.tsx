'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthContext';
import {
  ArrowRight,
  Sparkles,
  BookOpen,
  Zap,
  Target,
  Layers,
  FileText,
  Lightbulb,
  GraduationCap,
  Search,
  BookMarked,
  CheckSquare,
  Building2,
  Book,
  FileEdit,
  Presentation,
  Clock,
  Shield,
  Globe2,
} from 'lucide-react';

const WORKFLOW_STEPS = [
  {
    step: 1,
    name: 'Program Foundation',
    time: '15-20 min',
    icon: FileText,
    color: 'from-teal-500 to-emerald-500',
  },
  {
    step: 2,
    name: 'Competency Framework',
    time: '10-15 min',
    icon: Target,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    step: 3,
    name: 'Learning Outcomes',
    time: '15-20 min',
    icon: Lightbulb,
    color: 'from-amber-500 to-orange-500',
  },
  {
    step: 4,
    name: 'Course Framework',
    time: '25-30 min',
    icon: GraduationCap,
    color: 'from-purple-500 to-violet-500',
  },
  {
    step: 5,
    name: 'Topic Sources',
    time: '10 min',
    icon: Search,
    color: 'from-rose-500 to-pink-500',
  },
  {
    step: 6,
    name: 'Reading Lists',
    time: '8 min',
    icon: BookMarked,
    color: 'from-indigo-500 to-blue-500',
  },
  {
    step: 7,
    name: 'Assessments',
    time: '15-20 min',
    icon: CheckSquare,
    color: 'from-emerald-500 to-teal-500',
  },
  {
    step: 8,
    name: 'Case Studies',
    time: '10-15 min',
    icon: Building2,
    color: 'from-cyan-500 to-sky-500',
  },
  { step: 9, name: 'Glossary', time: '5 min', icon: Book, color: 'from-violet-500 to-purple-500' },
  {
    step: 10,
    name: 'Lesson Plans',
    time: '10-15 min',
    icon: FileEdit,
    color: 'from-orange-500 to-red-500',
  },
  {
    step: 11,
    name: 'PPT Generation',
    time: '10-15 min',
    icon: Presentation,
    color: 'from-sky-500 to-indigo-500',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.2 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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
    <div className="min-h-screen gradient-mesh-hero">
      {/* Nav Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-teal-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-foreground tracking-tight">AGCQ</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-ghost px-4 py-2 text-sm rounded-lg"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push('/workflow')}
              className="btn-primary px-4 py-2 text-sm rounded-lg"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium mb-8 border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              AI-Powered Workflow v2.2
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground mb-6 tracking-tight leading-[1.1]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Build Complete{' '}
            <span className="bg-gradient-to-r from-primary via-teal-400 to-accent bg-clip-text text-transparent">
              Curricula
            </span>
            <br />
            in Hours, Not Months
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-foreground-muted mb-10 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            11-step AI workflow with SME checkpoints, auto-gradable assessments, and full credit
            system support. AGI-compliant from start to finish.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={() => router.push('/workflow')}
              className="group btn-primary px-7 py-3.5 text-base rounded-xl inline-flex items-center justify-center gap-2"
            >
              Start New Curriculum
              <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/standalone')}
              className="btn-secondary px-7 py-3.5 text-base rounded-xl inline-flex items-center justify-center gap-2"
            >
              <Layers className="w-4.5 h-4.5" />
              Standalone Step
            </button>
          </motion.div>
        </div>
      </section>

      {/* Stats Row */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {[
            { value: '11', label: 'Steps', icon: Layers },
            { value: '~2h', label: 'Total Time', icon: Clock },
            { value: '100%', label: 'Auto-Gradable', icon: Shield },
            { value: '3', label: 'Credit Systems', icon: Globe2 },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              className="card p-5 text-center group hover:shadow-card-hover transition-all"
            >
              <stat.icon className="w-5 h-5 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-foreground-muted mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Workflow Steps Grid */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-foreground mb-3 tracking-tight">
              11-Step Workflow
            </h2>
            <p className="text-foreground-muted max-w-lg mx-auto">
              Each step builds on the last, with AI generation and human review at every checkpoint.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {WORKFLOW_STEPS.map((step) => {
              const IconComponent = step.icon;
              return (
                <motion.div
                  key={step.step}
                  variants={staggerItem}
                  className="card-interactive group p-4 cursor-default"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow`}
                    >
                      <IconComponent className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground-muted">Step {step.step}</p>
                      <p className="text-sm font-semibold text-foreground leading-tight mt-0.5 truncate">
                        {step.name}
                      </p>
                      <p className="text-xs text-foreground-muted mt-1">{step.time}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* CTA Card */}
            <motion.div
              variants={staggerItem}
              onClick={() => router.push('/workflow')}
              className="card-interactive group p-4 cursor-pointer flex items-center justify-center"
            >
              <div className="text-center">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/20 transition-colors">
                  <ArrowRight className="w-4.5 h-4.5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-primary">Get Started</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            <motion.div
              variants={staggerItem}
              onClick={() => router.push('/standalone')}
              className="card-interactive group p-6 cursor-pointer lg:col-span-2"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <Layers className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">Standalone Steps</h3>
              <p className="text-sm text-foreground-muted leading-relaxed">
                Generate individual curriculum components without a full workflow. Quick, flexible,
                and perfect for iterating on specific sections.
              </p>
            </motion.div>

            <motion.div variants={staggerItem} className="card p-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">MCQ-First</h3>
              <p className="text-sm text-foreground-muted leading-relaxed">
                Auto-gradable only. MCQ with optional Cloze. Zero manual grading.
              </p>
            </motion.div>

            <motion.div variants={staggerItem} className="card p-6">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                <BookOpen className="w-5 h-5 text-success" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">AGI Standards</h3>
              <p className="text-sm text-foreground-muted leading-relaxed">
                Strict source validation. Peer-reviewed journals &lt;5 years.
              </p>
            </motion.div>

            <motion.div variants={staggerItem} className="card p-6 lg:col-span-2">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mb-4">
                <Target className="w-5 h-5 text-warning" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">
                Multi-Credit Systems
              </h3>
              <p className="text-sm text-foreground-muted leading-relaxed">
                UK Credits, ECTS, US Semester Hours. Automatic contact hour calculations with full
                compliance verification.
              </p>
            </motion.div>

            <motion.div variants={staggerItem} className="card p-6 lg:col-span-2">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-info" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">AI-Powered</h3>
              <p className="text-sm text-foreground-muted leading-relaxed">
                GPT-5 with RAG-enhanced generation, semantic search across your knowledge base, and
                intelligent content validation at every step.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="card p-8 sm:p-10 text-center relative overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 tracking-tight">
                Ready to Start?
              </h2>
              <p className="text-foreground-muted mb-6 max-w-md mx-auto">
                Create your first curriculum in about 2 hours with AI assistance at every step.
              </p>
              <button
                onClick={() => router.push('/workflow')}
                className="group btn-primary px-8 py-3.5 text-base rounded-xl inline-flex items-center gap-2"
              >
                Create New Curriculum
                <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  ArrowRight, 
  Sparkles, 
  BookOpen, 
  Zap, 
  Target, 
  Layers, 
  Clock, 
  CheckCircle2, 
  Award, 
  GraduationCap,
  FileText,
  Crosshair,
  Lightbulb,
  LayoutGrid,
  Search,
  Library,
  ClipboardCheck,
  Briefcase,
  BookMarked,
  Presentation,
  BarChart3,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThemeStore } from '@/stores/themeStore';
import { useEffect, useState } from 'react';

// Dynamically import the HeroGeometric component
const HeroGeometric = dynamic(
  () => import('@/components/landing/HeroGeometric').then((mod) => mod.HeroGeometric),
  { ssr: false, loading: () => <HeroSkeleton /> }
);

// Loading skeleton for the hero section
function HeroSkeleton() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-teal-50">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-200/30 via-transparent to-teal-300/20 blur-3xl" />
      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-300/20 border border-teal-300/40 mb-8 md:mb-12 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-teal-400"></span>
            <span className="text-sm text-teal-600 tracking-wide font-medium">Loading...</span>
          </div>
          <div className="h-24 md:h-32 bg-teal-300/20 rounded-lg mb-8 animate-pulse" />
          <div className="h-6 bg-teal-300/20 rounded-lg max-w-2xl mx-auto mb-10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

interface WorkflowStep {
  step: number;
  name: string;
  time: string;
  icon: LucideIcon;
  lightColor: string;
  darkColor: string;
  iconColor: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { 
    step: 1, 
    name: 'Program Foundation', 
    time: '15-20 min', 
    icon: FileText,
    lightColor: 'from-teal-100 to-teal-50',
    darkColor: 'from-teal-600/30 to-teal-700/20',
    iconColor: 'text-teal-600'
  },
  { 
    step: 2, 
    name: 'Competency Framework', 
    time: '10-15 min', 
    icon: Crosshair,
    lightColor: 'from-sage-100 to-sage-50',
    darkColor: 'from-sage-600/30 to-sage-700/20',
    iconColor: 'text-sage-500'
  },
  { 
    step: 3, 
    name: 'Learning Outcomes', 
    time: '15-20 min', 
    icon: Lightbulb,
    lightColor: 'from-mint-100 to-mint-50',
    darkColor: 'from-mint-600/30 to-mint-700/20',
    iconColor: 'text-mint-600'
  },
  { 
    step: 4, 
    name: 'Course Framework', 
    time: '25-30 min', 
    icon: LayoutGrid,
    lightColor: 'from-teal-200/60 to-teal-100/40',
    darkColor: 'from-teal-500/30 to-teal-600/20',
    iconColor: 'text-teal-500'
  },
  { 
    step: 5, 
    name: 'Topic Sources', 
    time: '10 min', 
    icon: Search,
    lightColor: 'from-amber-50 to-orange-50',
    darkColor: 'from-amber-600/20 to-amber-700/10',
    iconColor: 'text-amber-600'
  },
  { 
    step: 6, 
    name: 'Reading Lists', 
    time: '8 min', 
    icon: Library,
    lightColor: 'from-rose-50 to-pink-50',
    darkColor: 'from-rose-600/20 to-rose-700/10',
    iconColor: 'text-rose-500'
  },
  { 
    step: 7, 
    name: 'MCQ Assessments', 
    time: '15-20 min', 
    icon: ClipboardCheck,
    lightColor: 'from-teal-100 to-cyan-50',
    darkColor: 'from-cyan-600/20 to-cyan-700/10',
    iconColor: 'text-teal-600'
  },
  { 
    step: 8, 
    name: 'Case Studies', 
    time: '10-15 min', 
    icon: Briefcase,
    lightColor: 'from-orange-50 to-amber-50',
    darkColor: 'from-orange-600/20 to-orange-700/10',
    iconColor: 'text-orange-500'
  },
  { 
    step: 9, 
    name: 'Glossary', 
    time: '5 min', 
    icon: BookMarked,
    lightColor: 'from-violet-50 to-purple-50',
    darkColor: 'from-violet-600/20 to-violet-700/10',
    iconColor: 'text-violet-500'
  },
  { 
    step: 10, 
    name: 'Lesson Plans & PPT', 
    time: '20-30 min', 
    icon: Presentation,
    lightColor: 'from-sky-50 to-blue-50',
    darkColor: 'from-sky-600/20 to-sky-700/10',
    iconColor: 'text-sky-500'
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: 'Standalone Steps',
    description: 'Generate individual curriculum components without a full workflow. Quick and flexible.',
    gradient: 'from-teal-400 to-teal-300',
    bgGlow: 'bg-teal-300/20',
    link: '/standalone',
  },
  {
    icon: Zap,
    title: 'MCQ-First Assessments',
    description: 'Auto-gradable only. MCQ with optional Cloze. No manual grading required.',
    gradient: 'from-teal-300 to-sage-300',
    bgGlow: 'bg-sage-300/20',
  },
  {
    icon: BookOpen,
    title: 'AGI Academic Standards',
    description: 'Strict source validation. Peer-reviewed journals <5 years, textbooks <10 years.',
    gradient: 'from-sage-400 to-mint-400',
    bgGlow: 'bg-mint-300/20',
  },
  {
    icon: Target,
    title: 'Multi-Credit Systems',
    description: 'UK Credits, ECTS, US Semester Hours. Automatic contact hour calculations.',
    gradient: 'from-amber-400 to-orange-400',
    bgGlow: 'bg-amber-200/20',
  },
];

const STATS = [
  { value: '10', label: 'Steps', icon: CheckCircle2, color: 'text-teal-500' },
  { value: '~2h', label: 'Total Time', icon: Clock, color: 'text-sage-500' },
  { value: '100%', label: 'Auto-Gradable', icon: Award, color: 'text-mint-600' },
  { value: '3', label: 'Credit Systems', icon: GraduationCap, color: 'text-amber-600' },
];

export default function Home() {
  const router = useRouter();
  const theme = useThemeStore((state) => state.theme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? theme === 'dark' : false;

  return (
    <div className={cn(
      "min-h-screen overflow-x-hidden transition-colors duration-300",
      isDark ? "bg-teal-900" : "bg-teal-50"
    )}>
      {/* Fixed Header with Dashboard and Theme Toggle */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
        <button
          onClick={() => router.push('/workflow/admin')}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all",
            "hover:scale-[1.02] active:scale-[0.98]",
            isDark
              ? "bg-teal-800 hover:bg-teal-700 text-teal-100 border border-teal-700"
              : "bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 shadow-teal-md"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Dashboard
        </button>
        <ThemeToggle />
      </div>

      {/* Hero Section with Geometric Background */}
      <HeroGeometric
        badge="NEW: 10-Step AI-Powered Workflow v2.2"
        title1="AI-Integrated Curriculum"
        title2="Generator"
        description="Generate complete, AGI-compliant curricula in ~2 hours. 10-step workflow with SME checkpoints, auto-gradable MCQ assessments, lesson plans, PPTs, and full credit system support (UK/ECTS/US)."
      >
          {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/workflow')}
            className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white overflow-hidden rounded-xl transition-all hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
            >
            <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-teal-500 transition-all duration-300 group-hover:from-teal-300 group-hover:to-teal-400" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_50%)]" />
            <span className="relative flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Start New Curriculum
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            </button>

            <button
              onClick={() => router.push('/standalone')}
            className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white overflow-hidden rounded-xl transition-all hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
            >
            <div className="absolute inset-0 bg-gradient-to-r from-sage-400 to-teal-400 transition-all duration-300 group-hover:from-sage-300 group-hover:to-teal-300" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_50%)]" />
            <span className="relative flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Standalone Step
            </span>
            </button>

            <button
              onClick={() => router.push('/workflow')}
            className={cn(
              "group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium overflow-hidden rounded-xl transition-all hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]",
              isDark 
                ? "text-teal-100 border border-teal-700 bg-teal-800/50 backdrop-blur-sm hover:bg-teal-700/50"
                : "text-teal-700 border border-teal-300 bg-white hover:bg-teal-50"
            )}
          >
            <span className="relative flex items-center gap-2">
              View My Workflows
            </span>
            </button>
          </div>
      </HeroGeometric>

      {/* Content Sections */}
      <div className={cn(
        "relative transition-colors duration-300",
        isDark 
          ? "bg-gradient-to-b from-teal-900 via-teal-800 to-teal-900"
          : "bg-gradient-to-b from-teal-50 via-white to-teal-50"
      )}>
        {/* Subtle pattern overlay */}
        <div className={cn(
          "absolute inset-0 opacity-30",
          isDark 
            ? "bg-[radial-gradient(circle_at_50%_50%,rgba(128,163,162,0.1),transparent_50%)]"
            : "bg-[radial-gradient(circle_at_50%_50%,rgba(128,163,162,0.15),transparent_60%)]"
        )} />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          {/* 10-Step Workflow Section */}
          <section className="mb-32">
            <div className="text-center mb-12 animate-fade-in">
              <span className={cn(
                "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm mb-6",
                isDark 
                  ? "bg-teal-800/50 border border-teal-700 text-teal-200"
                  : "bg-white border border-teal-200 text-teal-600 shadow-teal-sm"
              )}>
                <Clock className="w-4 h-4 text-teal-400" />
                Complete in ~2 hours
              </span>
              <h2 className={cn(
                "text-3xl sm:text-4xl md:text-5xl font-bold mb-4",
                isDark ? "text-teal-50" : "text-teal-800"
              )}>
                10-Step <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-sage-400">Workflow</span>
              </h2>
              <p className={cn(
                "text-lg max-w-2xl mx-auto",
                isDark ? "text-teal-200/70" : "text-teal-600"
              )}>
                A systematic approach to curriculum development with AI assistance at every stage
              </p>
            </div>

            {/* Workflow Steps Grid - 5 columns on large screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {WORKFLOW_STEPS.map((step, index) => {
                const IconComponent = step.icon;
                return (
                <div
                  key={step.step}
                    className={cn(
                      "group relative p-5 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300",
                      "bg-gradient-to-br",
                      isDark ? step.darkColor : step.lightColor,
                      isDark 
                        ? "border border-teal-700/50 hover:border-teal-600 hover:shadow-xl hover:shadow-teal-900/30"
                        : "border border-teal-200/80 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-200/50",
                      "hover:scale-[1.02] hover:-translate-y-1"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Step number badge */}
                    <div className={cn(
                      "absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center",
                      isDark 
                        ? "bg-teal-800/50 border border-teal-700"
                        : "bg-white border border-teal-200"
                    )}>
                      <span className={cn(
                        "text-xs font-semibold",
                        isDark ? "text-teal-300" : "text-teal-600"
                      )}>{step.step}</span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Icon */}
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center",
                        isDark 
                          ? "bg-teal-800/50 border border-teal-700"
                          : "bg-white border border-teal-200 shadow-teal-sm"
                      )}>
                        <IconComponent className={cn("w-5 h-5", step.iconColor)} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          "font-semibold text-sm mb-1.5 leading-tight pr-6",
                          isDark ? "text-teal-50" : "text-teal-800"
                        )}>
                          {step.name}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          <Clock className={cn(
                            "w-3 h-3",
                            isDark ? "text-teal-400" : "text-teal-500"
                          )} />
                          <span className={cn(
                            "text-xs",
                            isDark ? "text-teal-300" : "text-teal-600"
                          )}>{step.time}</span>
                </div>
            </div>
          </div>

                    {/* Hover glow effect */}
                    <div className={cn(
                      "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                      isDark 
                        ? "bg-gradient-to-r from-transparent via-teal-600/10 to-transparent"
                        : "bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    )} />
              </div>
                );
              })}
            </div>
          </section>

          {/* Features Section */}
          <section className="mb-32">
            <div className="text-center mb-12">
              <h2 className={cn(
                "text-3xl sm:text-4xl md:text-5xl font-bold mb-4",
                isDark ? "text-teal-50" : "text-teal-800"
              )}>
                Powerful <span className="bg-clip-text text-transparent bg-gradient-to-r from-sage-400 to-mint-400">Features</span>
              </h2>
              <p className={cn(
                "text-lg max-w-2xl mx-auto",
                isDark ? "text-teal-200/70" : "text-teal-600"
              )}>
                Everything you need to create professional, standards-compliant curricula
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {FEATURES.map((feature, index) => (
                <div
                  key={feature.title}
                  onClick={() => feature.link && router.push(feature.link)}
                  className={cn(
                    "group relative p-6 rounded-2xl overflow-hidden transition-all duration-300",
                    isDark
                      ? "bg-teal-800/30 border border-teal-700/50 hover:border-teal-600 hover:shadow-2xl hover:shadow-teal-900/30"
                      : "bg-white border border-teal-200 hover:border-teal-300 hover:shadow-2xl hover:shadow-teal-200/50",
                    "hover:scale-[1.02] hover:-translate-y-1",
                    feature.link && "cursor-pointer"
                  )}
                >
                  {/* Background glow */}
                  <div className={cn(
                    "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                    feature.bgGlow
                  )} />

                  <div className="relative z-10">
                    {/* Icon */}
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center mb-5",
                      "bg-gradient-to-br",
                      feature.gradient,
                      "shadow-teal-lg"
                    )}>
                      <feature.icon className="w-7 h-7 text-white" />
              </div>

                    <h3 className={cn(
                      "text-xl font-semibold mb-3",
                      isDark ? "text-teal-50" : "text-teal-800"
                    )}>
                      {feature.title}
                    </h3>
                    <p className={cn(
                      "text-sm leading-relaxed",
                      isDark ? "text-teal-200/70" : "text-teal-600"
                    )}>
                      {feature.description}
              </p>
            </div>

                  {/* Arrow indicator for clickable cards */}
                  {feature.link && (
                    <div className={cn(
                      "absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0",
                      isDark ? "text-teal-300" : "text-teal-500"
                    )}>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
              </div>
              ))}
            </div>
          </section>

          {/* Stats Section */}
          <section className="mb-32">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {STATS.map((stat, index) => (
                <div
                  key={stat.label}
                  className={cn(
                    "relative p-6 md:p-8 rounded-2xl text-center group transition-all hover:scale-[1.02]",
                    isDark
                      ? "bg-teal-800/30 border border-teal-700/50 hover:border-teal-600"
                      : "bg-white border border-teal-200 hover:border-teal-300 hover:shadow-teal-lg"
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl",
                    isDark 
                      ? "bg-gradient-to-b from-teal-700/20 to-transparent"
                      : "bg-gradient-to-b from-teal-50 to-transparent"
                  )} />
                  <stat.icon className={cn("w-8 h-8 mx-auto mb-4 opacity-70", stat.color)} />
                  <div className={cn("text-4xl md:text-5xl font-bold mb-2", stat.color)}>
                    {stat.value}
            </div>
                  <div className={cn(
                    "text-sm uppercase tracking-wider",
                    isDark ? "text-teal-200/70" : "text-teal-600"
                  )}>
                    {stat.label}
            </div>
            </div>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section>
            <div className={cn(
              "relative overflow-hidden rounded-3xl",
              isDark 
                ? "border border-teal-700"
                : "border border-teal-200"
            )}>
              {/* Background gradient */}
              <div className={cn(
                "absolute inset-0",
                isDark
                  ? "bg-gradient-to-r from-teal-800/50 via-sage-800/30 to-teal-800/50"
                  : "bg-gradient-to-r from-teal-100 via-sage-50 to-teal-100"
              )} />
              <div className={cn(
                "absolute inset-0",
                isDark
                  ? "bg-gradient-to-b from-transparent via-transparent to-teal-900/50"
                  : "bg-gradient-to-b from-transparent via-transparent to-white/50"
              )} />
              
              <div className="relative z-10 p-8 md:p-12 lg:p-16 text-center">
                <div className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8",
                  isDark
                    ? "bg-teal-800/50 border border-teal-700"
                    : "bg-white border border-teal-200"
                )}>
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span className={cn(
                    "text-sm",
                    isDark ? "text-teal-200" : "text-teal-600"
                  )}>Ready to Transform Curriculum Development?</span>
          </div>

                <h2 className={cn(
                  "text-3xl sm:text-4xl md:text-5xl font-bold mb-6",
                  isDark ? "text-teal-50" : "text-teal-800"
                )}>
                  Create Your First <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-sage-400 to-mint-400">AI-Powered Curriculum</span>
                </h2>
                
                <p className={cn(
                  "text-lg max-w-2xl mx-auto mb-10",
                  isDark ? "text-teal-200/70" : "text-teal-600"
                )}>
                  Join educators worldwide using AI to create comprehensive, standards-compliant curricula in a fraction of the time.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/workflow')}
                    className="group relative inline-flex items-center justify-center px-10 py-5 text-lg font-semibold text-white overflow-hidden rounded-xl transition-all hover:scale-[1.05] hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-400 via-sage-400 to-teal-300 transition-all duration-300" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.25),transparent_50%)]" />
                    <span className="relative flex items-center gap-2">
                      Get Started Now
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
            </button>
          </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer gradient */}
        <div className={cn(
          "h-32",
          isDark 
            ? "bg-gradient-to-t from-teal-900 to-transparent"
            : "bg-gradient-to-t from-white to-transparent"
        )} />
      </div>
    </div>
  );
}

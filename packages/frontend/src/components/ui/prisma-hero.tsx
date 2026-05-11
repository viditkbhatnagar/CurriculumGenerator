'use client';

import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';

/* ---------------- WordsPullUp ---------------- */
interface WordsPullUpProps {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  style?: React.CSSProperties;
}

export const WordsPullUp = ({
  text,
  className = '',
  showAsterisk = false,
  style,
}: WordsPullUpProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const words = text.split(' ');

  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`} style={style}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <motion.span
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block relative"
            style={{ marginRight: isLast ? 0 : '0.25em' }}
          >
            {word}
            {showAsterisk && isLast && (
              <span className="absolute top-[0.65em] -right-[0.3em] text-[0.31em]">*</span>
            )}
          </motion.span>
        );
      })}
    </div>
  );
};

/* ---------------- WordsPullUpMultiStyle ---------------- */
interface Segment {
  text: string;
  className?: string;
}

interface WordsPullUpMultiStyleProps {
  segments: Segment[];
  className?: string;
  style?: React.CSSProperties;
}

export const WordsPullUpMultiStyle = ({
  segments,
  className = '',
  style,
}: WordsPullUpMultiStyleProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const words: { word: string; className?: string }[] = [];
  segments.forEach((seg) => {
    seg.text.split(' ').forEach((w) => {
      if (w) words.push({ word: w, className: seg.className });
    });
  });

  return (
    <div ref={ref} className={`inline-flex flex-wrap justify-center ${className}`} style={style}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className={`inline-block ${w.className ?? ''}`}
          style={{ marginRight: '0.25em' }}
        >
          {w.word}
        </motion.span>
      ))}
    </div>
  );
};

/* ---------------- Hero ---------------- */
const navItems: { label: string; href: string }[] = [
  { label: 'Workflows', href: '/workflow' },
  { label: 'Standalone', href: '/standalone' },
  { label: 'Archive', href: '/admin/archive' },
  { label: 'Faculty', href: '/admin/faculty' },
  { label: 'Sign in', href: '/login' },
];

interface CurriculumHeroProps {
  /** Primary CTA target. Defaults to /login. */
  ctaHref?: string;
  ctaLabel?: string;
}

const CurriculumHero = ({ ctaHref = '/login', ctaLabel = 'Sign in' }: CurriculumHeroProps) => {
  const router = useRouter();

  return (
    <section className="h-screen w-full p-2 sm:p-3">
      <div className="relative h-full w-full overflow-hidden rounded-2xl md:rounded-[2rem]">
        {/* Deep jewel-tone gradient base — replaces the demo video.
            Layered radial gradients evoke a stage-lit auditorium. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(at 22% 28%, rgb(76 29 99) 0%, transparent 55%), ' +
              'radial-gradient(at 82% 18%, rgb(11 78 79) 0%, transparent 50%), ' +
              'radial-gradient(at 78% 82%, rgb(120 38 78) 0%, transparent 55%), ' +
              'radial-gradient(at 14% 88%, rgb(8 38 62) 0%, transparent 50%), ' +
              'linear-gradient(135deg, rgb(7 8 24) 0%, rgb(11 13 32) 50%, rgb(6 7 20) 100%)',
          }}
        />

        {/* Soft animated bloom */}
        <motion.div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 60%, rgba(168, 85, 247, 0.18) 0%, transparent 45%)',
          }}
          animate={{ opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Noise overlay (defined in globals.css) */}
        <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.5] mix-blend-overlay" />

        {/* Gradient vignette */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

        {/* Navbar */}
        <nav className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-b-2xl bg-black/85 px-4 py-2 backdrop-blur sm:gap-6 md:gap-10 md:rounded-b-3xl md:px-8 lg:gap-12">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => router.push(item.href)}
                className="text-[10px] tracking-wide transition-colors sm:text-xs md:text-sm"
                style={{ color: 'rgba(225, 224, 204, 0.8)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#E1E0CC')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(225, 224, 204, 0.8)')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Brand mark — top-left */}
        <div className="absolute left-5 top-5 z-20 flex items-center gap-2 sm:left-8 sm:top-8">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{
              background: 'linear-gradient(135deg, #E1E0CC 0%, rgba(225,224,204,0.7) 100%)',
            }}
          >
            <span className="text-[11px] font-bold tracking-tight text-black">A</span>
          </div>
          <span
            className="text-xs font-semibold tracking-[0.25em]"
            style={{ color: 'rgba(225, 224, 204, 0.85)' }}
          >
            AGCQ
          </span>
        </div>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 sm:px-6 md:px-10">
          <div className="grid grid-cols-12 items-end gap-4">
            <div className="col-span-12 lg:col-span-8">
              <h1
                className="font-display font-medium leading-[0.85] tracking-[-0.07em] text-[24vw] sm:text-[22vw] md:text-[20vw] lg:text-[18vw] xl:text-[17vw] 2xl:text-[18vw]"
                style={{ color: '#E1E0CC' }}
              >
                <WordsPullUp text="Curricula" showAsterisk />
              </h1>
            </div>

            <div className="col-span-12 flex flex-col gap-5 pb-6 lg:col-span-4 lg:pb-10">
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-xs sm:text-sm md:text-base"
                style={{ color: 'rgba(225, 224, 204, 0.78)', lineHeight: 1.35 }}
              >
                AGCQ is the curriculum atelier for serious institutions — a 13-step AI workflow with
                SME checkpoints, AGI-compliant source validation, and complete programme
                specifications drafted in hours, not months.
              </motion.p>

              <motion.button
                type="button"
                onClick={() => router.push(ctaHref)}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="group inline-flex items-center gap-2 self-start rounded-full py-1 pl-5 pr-1 text-sm font-medium transition-all hover:gap-3 sm:text-base"
                style={{ background: '#E1E0CC', color: '#0a0a18' }}
              >
                {ctaLabel}
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black transition-transform group-hover:scale-110 sm:h-10 sm:w-10">
                  <ArrowRight className="h-4 w-4" style={{ color: '#E1E0CC' }} />
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { CurriculumHero };

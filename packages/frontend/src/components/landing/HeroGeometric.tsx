"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  darkGradient = "from-teal-400/[0.15]",
  lightGradient = "from-teal-300/[0.3]",
  isDark = false,
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  darkGradient?: string;
  lightGradient?: string;
  isDark?: boolean;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate,
      }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{
          y: [0, 15, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          width,
          height,
        }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            isDark ? darkGradient : lightGradient,
            "backdrop-blur-[2px]",
            isDark 
              ? "border-2 border-teal-500/[0.2] shadow-[0_8px_32px_0_rgba(128,163,162,0.15)]"
              : "border-2 border-teal-300/50 shadow-[0_8px_32px_0_rgba(128,163,162,0.2)]",
            "after:absolute after:inset-0 after:rounded-full",
            isDark
              ? "after:bg-[radial-gradient(circle_at_50%_50%,rgba(128,163,162,0.3),transparent_70%)]"
              : "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.8),transparent_70%)]"
          )}
        />
      </motion.div>
    </motion.div>
  );
}

interface HeroGeometricProps {
  badge?: string;
  title1?: string;
  title2?: string;
  description?: string;
  children?: React.ReactNode;
}

function HeroGeometric({
  badge = "AI-Powered Curriculum",
  title1 = "AI-Integrated Curriculum",
  title2 = "Generator",
  description = "Generate complete, AGI-compliant curricula in ~2 hours. 10-step workflow with SME checkpoints, auto-gradable MCQ assessments, and full credit system support.",
  children,
}: HeroGeometricProps) {
  const [isMounted, setIsMounted] = useState(false);
  const theme = useThemeStore((state) => state.theme);
  const isDark = isMounted ? theme === 'dark' : false;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  return (
    <div className={cn(
      "relative min-h-screen w-full flex items-center justify-center overflow-hidden transition-colors duration-500",
      isDark ? "bg-teal-900" : "bg-teal-50"
    )}>
      {/* Gradient overlay */}
      <div className={cn(
        "absolute inset-0 blur-3xl",
        isDark 
          ? "bg-gradient-to-br from-teal-700/[0.15] via-transparent to-sage-700/[0.15]"
          : "bg-gradient-to-br from-teal-200/50 via-transparent to-sage-200/40"
      )} />

      {/* Floating shapes - only render after mount to avoid hydration issues */}
      <AnimatePresence>
        {isMounted && (
          <div className="absolute inset-0 overflow-hidden">
            <ElegantShape
              delay={0.3}
              width={600}
              height={140}
              rotate={12}
              darkGradient="from-teal-500/[0.2]"
              lightGradient="from-teal-300/[0.4]"
              isDark={isDark}
              className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
            />

            <ElegantShape
              delay={0.5}
              width={500}
              height={120}
              rotate={-15}
              darkGradient="from-sage-500/[0.2]"
              lightGradient="from-sage-300/[0.4]"
              isDark={isDark}
              className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
            />

            <ElegantShape
              delay={0.4}
              width={300}
              height={80}
              rotate={-8}
              darkGradient="from-mint-500/[0.2]"
              lightGradient="from-mint-200/[0.4]"
              isDark={isDark}
              className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
            />

            <ElegantShape
              delay={0.6}
              width={200}
              height={60}
              rotate={20}
              darkGradient="from-teal-400/[0.2]"
              lightGradient="from-teal-200/[0.4]"
              isDark={isDark}
              className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
            />

            <ElegantShape
              delay={0.7}
              width={150}
              height={40}
              rotate={-25}
              darkGradient="from-sage-400/[0.2]"
              lightGradient="from-sage-200/[0.4]"
              isDark={isDark}
              className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
            />
          </div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate={isMounted ? "visible" : "hidden"}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 md:mb-12",
              isDark
                ? "bg-teal-700/30 border border-teal-600/50"
                : "bg-white border border-teal-300 shadow-teal-sm"
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            <span className={cn(
              "text-sm tracking-wide font-medium",
              isDark ? "text-teal-200" : "text-teal-600"
            )}>
              {badge}
            </span>
          </motion.div>

          {/* Title */}
          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate={isMounted ? "visible" : "hidden"}
          >
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-8 tracking-tight">
              <span className={cn(
                "bg-clip-text text-transparent",
                isDark
                  ? "bg-gradient-to-b from-teal-100 to-teal-200/90"
                  : "bg-gradient-to-b from-teal-800 to-teal-600"
              )}>
                {title1}
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-500 via-sage-400 to-mint-400">
                {title2}
              </span>
            </h1>
          </motion.div>

          {/* Description */}
          <motion.div
            custom={2}
            variants={fadeUpVariants}
            initial="hidden"
            animate={isMounted ? "visible" : "hidden"}
          >
            <p className={cn(
              "text-base sm:text-lg md:text-xl mb-10 leading-relaxed font-light tracking-wide max-w-2xl mx-auto px-4",
              isDark ? "text-teal-200/70" : "text-teal-700"
            )}>
              {description}
            </p>
          </motion.div>

          {/* Children - CTA buttons, etc. */}
          <motion.div
            custom={3}
            variants={fadeUpVariants}
            initial="hidden"
            animate={isMounted ? "visible" : "hidden"}
          >
            {children}
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className={cn(
        "absolute inset-0 pointer-events-none",
        isDark
          ? "bg-gradient-to-t from-teal-900 via-transparent to-teal-900/80"
          : "bg-gradient-to-t from-teal-50 via-transparent to-teal-50/80"
      )} />
    </div>
  );
}

export { HeroGeometric, ElegantShape };

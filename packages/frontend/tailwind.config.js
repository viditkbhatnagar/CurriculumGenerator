/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/contexts/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Display face for headings — humanistic grotesque, warmer than
        // a default sans without tipping into novelty.
        display: ['"Bricolage Grotesque"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
      },
      colors: {
        // Semantic tokens from CSS variables
        background: {
          DEFAULT: 'rgb(var(--background) / <alpha-value>)',
          secondary: 'rgb(var(--background-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--background-tertiary) / <alpha-value>)',
        },
        foreground: {
          DEFAULT: 'rgb(var(--foreground) / <alpha-value>)',
          muted: 'rgb(var(--foreground-muted) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          hover: 'rgb(var(--card-hover) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
          muted: 'rgb(var(--primary-muted))',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
          muted: 'rgb(var(--accent-muted))',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          muted: 'rgb(var(--success-muted))',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          muted: 'rgb(var(--warning-muted))',
        },
        error: {
          DEFAULT: 'rgb(var(--error) / <alpha-value>)',
          muted: 'rgb(var(--error-muted))',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          muted: 'rgb(var(--info-muted))',
        },
        sidebar: {
          bg: 'rgb(var(--sidebar-bg) / <alpha-value>)',
          hover: 'rgb(var(--sidebar-hover) / <alpha-value>)',
          active: 'rgb(var(--sidebar-active) / <alpha-value>)',
          text: 'rgb(var(--sidebar-text) / <alpha-value>)',
          'text-active': 'rgb(var(--sidebar-text-active) / <alpha-value>)',
          border: 'rgb(var(--sidebar-border) / <alpha-value>)',
        },
        // Keep teal/mint/sage for backward compat with step components
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        mint: {
          50: '#f0fafa',
          100: '#ccfbf1',
          200: '#c8eef0',
          300: '#a8e0e2',
          400: '#80c8ca',
          500: '#5ab0b2',
          600: '#459698',
          700: '#3a7d7f',
          800: '#336668',
          900: '#2d5557',
        },
        sage: {
          50: '#f5f8f8',
          100: '#e8f0f0',
          200: '#d4e2e2',
          300: '#b0cccc',
          400: '#80a3a2',
          500: '#6b8f8e',
          600: '#5a7776',
          700: '#4c6362',
          800: '#415352',
          900: '#384646',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'calc(var(--radius) - 0.25rem)',
        md: 'calc(var(--radius) - 0.125rem)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 0.25rem)',
        '2xl': 'calc(var(--radius) + 0.5rem)',
        '3xl': 'calc(var(--radius) + 0.75rem)',
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'slide-up': 'fade-in-up 0.5s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.4s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.4s ease-out forwards',
        'scale-in': 'scale-in 0.3s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s infinite',
        float: 'float 3s ease-in-out infinite',
        'count-up': 'count-up 0.5s ease-out forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--primary) / 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgb(var(--primary) / 0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgb(var(--primary) / 0.15)',
        glow: '0 0 20px rgb(var(--primary) / 0.2)',
        'glow-lg': '0 0 40px rgb(var(--primary) / 0.25)',
        'inner-glow': 'inset 0 1px 0 rgb(255 255 255 / 0.1)',
        card: '0 1px 3px rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.02)',
        'card-hover': '0 4px 12px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.04)',
        elevated: '0 8px 24px rgb(0 0 0 / 0.08), 0 2px 8px rgb(0 0 0 / 0.04)',
        modal: '0 24px 48px rgb(0 0 0 / 0.16), 0 8px 16px rgb(0 0 0 / 0.08)',
        // Keep old teal shadows for backward compat
        'teal-sm': '0 1px 3px rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.02)',
        teal: '0 1px 3px rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.02)',
        'teal-md': '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
        'teal-lg': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -2px rgb(0 0 0 / 0.04)',
        'teal-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
        'teal-glow': '0 0 20px rgb(var(--primary) / 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary':
          'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--primary-hover)))',
        'gradient-accent': 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-hover)))',
        // Keep old gradients for backward compat
        'gradient-teal': 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 50%, #99f6e4 100%)',
        'gradient-teal-soft': 'linear-gradient(135deg, #99f6e4 0%, #ccfbf1 50%, #f0fdfa 100%)',
        'gradient-teal-vertical': 'linear-gradient(180deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%)',
        'gradient-radial-teal': 'radial-gradient(circle, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%)',
      },
    },
  },
  plugins: [],
};

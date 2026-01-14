/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/contexts/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Custom color palette based on provided colors
      colors: {
        // Primary teal palette
        teal: {
          50: '#DAF4F5',   // Lightest mint
          100: '#C4DCE0',  // Pale teal
          200: '#ABCECF',  // Light teal
          300: '#80A3A2',  // Primary teal (main color)
          400: '#6B8F8E',  // Slightly darker
          500: '#5A7A79',  // Medium teal
          600: '#4A6667',  // Dark teal
          700: '#3A5254',  // Darker
          800: '#2D4142',  // Very dark
          900: '#233234',  // Darkest
        },
        // Mint variations
        mint: {
          50: '#f0fafa',
          100: '#DAF4F5',
          200: '#c8eef0',
          300: '#a8e0e2',
          400: '#80c8ca',
          500: '#5ab0b2',
          600: '#459698',
          700: '#3a7d7f',
          800: '#336668',
          900: '#2d5557',
        },
        // Sage variations
        sage: {
          50: '#f5f8f8',
          100: '#e8f0f0',
          200: '#d4e2e2',
          300: '#ABCECF',
          400: '#80A3A2',
          500: '#6b8f8e',
          600: '#5a7776',
          700: '#4c6362',
          800: '#415352',
          900: '#384646',
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-teal': 'linear-gradient(135deg, #80A3A2 0%, #ABCECF 50%, #C4DCE0 100%)',
        'gradient-teal-soft': 'linear-gradient(135deg, #ABCECF 0%, #C4DCE0 50%, #DAF4F5 100%)',
        'gradient-teal-vertical': 'linear-gradient(180deg, #DAF4F5 0%, #C4DCE0 50%, #ABCECF 100%)',
        'gradient-radial-teal': 'radial-gradient(circle, #DAF4F5 0%, #C4DCE0 50%, #ABCECF 100%)',
      },
      boxShadow: {
        'teal-sm': '0 1px 2px 0 rgba(128, 163, 162, 0.05)',
        'teal': '0 1px 3px 0 rgba(128, 163, 162, 0.1), 0 1px 2px 0 rgba(128, 163, 162, 0.06)',
        'teal-md': '0 4px 6px -1px rgba(128, 163, 162, 0.1), 0 2px 4px -1px rgba(128, 163, 162, 0.06)',
        'teal-lg': '0 10px 15px -3px rgba(128, 163, 162, 0.1), 0 4px 6px -2px rgba(128, 163, 162, 0.05)',
        'teal-xl': '0 20px 25px -5px rgba(128, 163, 162, 0.1), 0 10px 10px -5px rgba(128, 163, 162, 0.04)',
        'teal-glow': '0 0 20px rgba(128, 163, 162, 0.3)',
      },
    },
  },
  plugins: [],
};

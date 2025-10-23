/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Adaptive dark theme colors
        charcoal: {
          50: '#f6f6f7',
          100: '#e1e2e5',
          200: '#c4c6cc',
          300: '#9fa2ab',
          400: '#7c7f8a',
          500: '#63666f',
          600: '#4f5158',
          700: '#414349',
          800: '#38393e',
          900: '#18181b',
          950: '#0a0a0c',
        },
        midnight: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a5bcfc',
          400: '#8198f8',
          500: '#6474f2',
          600: '#4f52e6',
          700: '#4340cb',
          800: '#3835a4',
          900: '#1e1b48',
          950: '#0f0d24',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1rem",
        '2xl': "1.5rem",
        '3xl': "2rem",
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
        '4xl': '128px',
      },
      letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
      },
      fontSize: {
        '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        '8xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        '9xl': ['8rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(99, 102, 241, 0.6)' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '104': '26rem',
        '108': '27rem',
        '112': '28rem',
        '128': '32rem',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        // Scrollbar utilities
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
        },
        '.scrollbar-thumb-neutral-600': {
          'scrollbar-color': '#525252 transparent',
        },
        '.scrollbar-track-neutral-800': {
          'scrollbar-color': '#262626 transparent',
        },
        '.scrollbar-thin::-webkit-scrollbar': {
          width: '8px',
        },
        '.scrollbar-thin::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '.scrollbar-thin::-webkit-scrollbar-thumb': {
          'background-color': '#525252',
          'border-radius': '4px',
        },
        '.scrollbar-thin::-webkit-scrollbar-thumb:hover': {
          'background-color': '#737373',
        },
        // Glassmorphism utilities
        '.glass': {
          'background': 'rgba(255, 255, 255, 0.05)',
          'backdrop-filter': 'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
          'border': '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.glass-strong': {
          'background': 'rgba(255, 255, 255, 0.1)',
          'backdrop-filter': 'blur(40px)',
          '-webkit-backdrop-filter': 'blur(40px)',
          'border': '1px solid rgba(255, 255, 255, 0.15)',
        },
        '.glass-subtle': {
          'background': 'rgba(255, 255, 255, 0.02)',
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.05)',
        },
        '.glass-card': {
          'background': 'rgba(24, 24, 27, 0.6)',
          'backdrop-filter': 'blur(20px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(20px) saturate(180%)',
          'border': '1px solid rgba(255, 255, 255, 0.08)',
        },
        // Glow effects
        '.glow-green': {
          'box-shadow': '0 0 8px rgba(34, 197, 94, 0.15), 0 0 16px rgba(34, 197, 94, 0.05)',
        },
        '.glow-red': {
          'box-shadow': '0 0 8px rgba(239, 68, 68, 0.15), 0 0 16px rgba(239, 68, 68, 0.05)',
        },
        '.glow-blue': {
          'box-shadow': '0 0 8px rgba(59, 130, 246, 0.15), 0 0 16px rgba(59, 130, 246, 0.05)',
        },
      })
    },
  ],
}
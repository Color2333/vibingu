/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS variables
        background: 'var(--bg-primary)',
        foreground: 'var(--text-primary)',
        card: 'var(--bg-card)',
        'card-foreground': 'var(--text-primary)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-glow': 'var(--accent-glow)',
        muted: 'var(--text-secondary)',
        'muted-foreground': 'var(--text-tertiary)',
        // Legacy vibe colors
        vibe: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          accent: '#f59e0b',
          dark: '#1e1b4b',
          light: '#f5f3ff',
        },
      },
      backgroundColor: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        card: 'var(--bg-card)',
        glass: 'var(--glass-bg)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        glass: 'var(--glass-border)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
};

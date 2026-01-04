/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'Fira Code', 'Consolas', 'monospace'],
        display: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
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
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Status colors for Mission Control
        status: {
          critical: "hsl(var(--status-critical))",
          error: "hsl(var(--status-error))",
          warn: "hsl(var(--status-warn))",
          info: "hsl(var(--status-info))",
          success: "hsl(var(--status-success))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'glow-sm': '0 0 8px var(--tw-shadow-color)',
        'glow': '0 0 15px var(--tw-shadow-color)',
        'glow-lg': '0 0 25px var(--tw-shadow-color)',
        'glow-cyan': '0 0 15px hsl(185 75% 50% / 0.4)',
        'glow-red': '0 0 12px hsl(0 90% 55% / 0.4)',
        'glow-green': '0 0 12px hsl(142 76% 50% / 0.4)',
        'glow-amber': '0 0 12px hsl(38 92% 50% / 0.4)',
        'inner-glow': 'inset 0 0 20px hsl(185 75% 50% / 0.1)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'breathe': 'breathe 3s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
        'data-stream': 'data-stream 1.5s linear infinite',
        'radar-sweep': 'radar-sweep 4s linear infinite',
        'tick-up': 'tick-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px currentColor, 0 0 12px currentColor' },
          '50%': { opacity: '0.7', boxShadow: '0 0 4px currentColor' },
        },
        'breathe': {
          '0%, 100%': { opacity: '0.85' },
          '50%': { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'data-stream': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'radar-sweep': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'tick-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px),
          linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)
        `,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '32px 32px',
        'grid-sm': '16px 16px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

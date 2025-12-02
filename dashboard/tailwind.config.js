/**
 * @type {import('tailwindcss').Config}
 *
 * =============================================================================
 * OMEGA PLATFORM - DASHBOARD TAILWIND CSS CONFIGURATION
 * =============================================================================
 *
 * This file defines the design system for the Omega Command Dashboard. It uses
 * Tailwind's powerful theming capabilities to create a bespoke, consistent, and
 * scalable visual language. The configuration is dark-mode-first and highly
 * customized to the specific needs of a data-intensive C2 interface.
 *
 */
const plugin = require('tailwindcss/plugin');

module.exports = {
  // --- Core Configuration ---

  // Globs for all files that may contain Tailwind class names.
  // This is crucial for the JIT engine to generate the correct CSS.
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './stories/**/*.{js,ts,jsx,tsx}',
  ],

  // Enable dark mode using the 'class' strategy for manual toggling.
  darkMode: 'class',

  // --- Design System Theming ---

  theme: {
    // Override and extend Tailwind's default theme.
    extend: {
      // -- Colors: A bespoke palette designed for clarity and a tech aesthetic. --
      colors: {
        // Semantic and brand colors
        primary: {
          DEFAULT: '#3b82f6', // blue-500
          light: '#60a5fa',   // blue-400
          dark: '#2563eb',    // blue-600
        },
        secondary: {
          DEFAULT: '#8b5cf6', // violet-500
          light: '#a78bfa',   // violet-400
          dark: '#7c3aed',    // violet-600
        },
        accent: {
          DEFAULT: '#10b981', // emerald-500
          dark: '#059669',    // emerald-600
        },

        // Status indicators
        success: '#22c55e', // green-500
        warning: '#f97316', // orange-500
        danger: '#ef4444',  // red-500
        info: '#0ea5e9',    // sky-500

        // UI surfaces and text (dark mode-first)
        background: '#020617', // slate-950
        surface: '#0f172a',    // slate-900
        panel: '#1e293b',      // slate-800
        border: '#334155',      // slate-700
        
        text: {
          DEFAULT: '#e2e8f0', // slate-200
          primary: '#ffffff',
          secondary: '#94a3b8', // slate-400
          disabled: '#64748b', // slate-500
        },
      },

      // -- Typography: Using fonts defined in index.html for a clean, modern feel. --
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },

      // -- Animations & Keyframes: Custom effects for a dynamic UI. --
      keyframes: {
        pulseLive: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.85, transform: 'scale(1.05)' },
        },
        fadeIn: {
          from: { opacity: 0, transform: 'translateY(-10px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pulse-live': 'pulseLive 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      
      // -- Box Shadow: A custom elevation system for layering UI elements. --
      boxShadow: {
        'low': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'medium': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'high': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'inner-glow': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },

  // --- Plugins ---

  plugins: [
    // Official Tailwind plugins
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),

    // Custom inline plugin for adding non-standard utilities
    plugin(function({ addUtilities }) {
      const newUtilities = {
        // For custom text gradients
        '.text-gradient-primary': {
          'background-image': 'linear-gradient(to right, #3b82f6, #8b5cf6)',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          'color': 'transparent',
        },
        // For performance on animated elements
        '.will-change-transform': {
          'will-change': 'transform',
        },
      }
      addUtilities(newUtilities, ['responsive', 'hover'])
    })
  ],
};
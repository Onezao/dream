/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        calendar: {
          orange: '#f97316',
          yellow: '#eab308',
          blue: '#3b82f6',
          purple: '#a855f7',
          gray: '#9ca3af',
          green: '#22c55e',
          red: '#ef4444',
        },
        workspace: {
          admin: '#0f172a',
          monitor: '#1e1b4b',
          parent: '#f8fafc',
          teacher: '#f1f5f9',
        },
      },
    },
  },
  plugins: [],
};

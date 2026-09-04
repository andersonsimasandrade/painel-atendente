import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tema verde do painel. Tokens em CSS vars: o modo claro troca os
        // valores em globals.css ([data-theme="light"]) sem tocar componente.
        // Padrão canal-RGB + <alpha-value>: preserva os modificadores de
        // opacidade (bg-base/70, bg-surface-2/60…) nos DOIS temas.
        base: "rgb(var(--c-base-rgb) / <alpha-value>)",
        elevated: "rgb(var(--c-elevated-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--c-surface-rgb) / <alpha-value>)",
          2: "rgb(var(--c-surface2-rgb) / <alpha-value>)",
          3: "rgb(var(--c-surface3-rgb) / <alpha-value>)",
        },
        // line carrega alpha próprio (não aceita modificador — border-line/50
        // cai na regra global de borda, diferença imperceptível).
        line: {
          DEFAULT: "var(--c-line)",
          strong: "var(--c-line-strong)",
        },
        ink: {
          DEFAULT: "rgb(var(--c-ink-rgb) / <alpha-value>)",
          muted: "rgb(var(--c-ink-muted-rgb) / <alpha-value>)",
          faint: "rgb(var(--c-ink-faint-rgb) / <alpha-value>)",
        },
        // Verde da marca — >>> ADAPTE ao seu hue (#2f9e5e é o padrão),
        // levemente clareado no DEFAULT p/ legibilidade no fundo escuro.
        brand: {
          DEFAULT: "#35B06E",
          bright: "#52C98A",
          dim: "#2F9E5E",
          deep: "#14603D",
        },
        // Acento terracota da marca (aviso/destaque quente). É um OBJETO de
        // propósito: como string, `extend.colors.amber` SUBSTITUI a escala
        // amber do Tailwind inteira e `amber-300`/`amber-400` somem do CSS —
        // sem erro e sem aviso. Com `{ DEFAULT }` a escala sobrevive ao merge.
        amber: { DEFAULT: "rgb(var(--c-warn-rgb) / <alpha-value>)" },
        // Falha crítica: erro de gravação, prejuízo no ROI, WhatsApp fora do ar.
        danger: "rgb(var(--c-danger-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        "2xl": "1.1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        glow: "0 0 0 1px rgba(53,176,110,0.18), 0 12px 40px -12px rgba(53,176,110,0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(2.2)", opacity: "0" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        grow: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        grow: "grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;

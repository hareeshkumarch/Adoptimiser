const scale = (name) =>
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, `var(--${name}-${i + 1})`]));

module.exports = {
  blocklist: ["overline"],
  content: ["./src/**/*.{ts,tsx}", "./public/index.html"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      slate: scale("slate"),
      iris: scale("iris"),
      jade: scale("jade"),
      amber: scale("amber"),
      ruby: scale("ruby"),
    },
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "sans-serif"],
        serif: ['"Newsreader"', "ui-serif", "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
      },
      animation: {
        "fade-up": "fade-up 360ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "slide-in": "slide-in 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        "accordion-down": "accordion-down 200ms ease-out",
        "accordion-up": "accordion-up 200ms ease-out",
        blink: "blink 1s step-end infinite",
      },
    },
  },
  plugins: [],
};

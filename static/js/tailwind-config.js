/* Tailwind CDN theme: bright cream + green + brown palette.
   Token names are unchanged, so existing classes (bg-primary, text-secondary, ...) keep working. */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* surfaces: warm cream, light to deeper */
        background: "#fbf6ec",
        surface: "#fbf6ec",
        "surface-bright": "#fffaf0",
        "surface-dim": "#efe5cf",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f7f0e0",
        "surface-container": "#f2e9d5",
        "surface-container-high": "#ece0c6",
        "surface-container-highest": "#e6d8bb",
        "surface-variant": "#e6d8bb",
        "surface-tint": "#2a7d4f",

        /* text: deep brown */
        "on-background": "#3b2a1c",
        "on-surface": "#3b2a1c",
        "on-surface-variant": "#6b5640",
        outline: "#9a8468",
        "outline-variant": "#dccdac",
        "inverse-surface": "#3b2a1c",
        "inverse-on-surface": "#fbf6ec",

        /* primary: fresh green */
        primary: "#2a7d4f",
        "on-primary": "#ffffff",
        "primary-container": "#a6e0b8",
        "on-primary-container": "#0d3b22",
        "primary-fixed": "#cdf0d9",
        "primary-fixed-dim": "#8fd4a4",
        "on-primary-fixed": "#052e17",
        "on-primary-fixed-variant": "#14582f",
        "inverse-primary": "#7fd39a",

        /* secondary: warm brown */
        secondary: "#8b5a2b",
        "on-secondary": "#ffffff",
        "secondary-container": "#ecd2ad",
        "on-secondary-container": "#4a2c10",
        "secondary-fixed": "#f6e4c8",
        "secondary-fixed-dim": "#dcb98a",
        "on-secondary-fixed": "#2e1a08",
        "on-secondary-fixed-variant": "#6b4220",

        /* tertiary: success green */
        tertiary: "#1f8a4c",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#aee7c1",
        "on-tertiary-container": "#06301a",
        "tertiary-fixed": "#b9efcb",
        "tertiary-fixed-dim": "#8fd9ae",
        "on-tertiary-fixed": "#052e17",
        "on-tertiary-fixed-variant": "#14582f",

        /* error: rust */
        error: "#b3402a",
        "on-error": "#ffffff",
        "error-container": "#f8d6cb",
        "on-error-container": "#5a1608"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-lg": "1.5rem",
        "space-md": "1rem",
        "margin-tablet": "1.5rem",
        margin: "1rem",
        gutter: "1rem",
        "space-sm": "0.5rem",
        "gutter-sm": "0.75rem",
        "space-xl": "2rem"
      },
      fontFamily: {
        "body-sm": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "headline-lg": ["Plus Jakarta Sans", "sans-serif"],
        "headline-md": ["Plus Jakarta Sans", "sans-serif"],
        "headline-sm": ["Plus Jakarta Sans", "sans-serif"],
        "headline-xl": ["Plus Jakarta Sans", "sans-serif"],
        "headline-xl-mobile": ["Plus Jakarta Sans", "sans-serif"],
        "label-sm": ["Plus Jakarta Sans", "sans-serif"],
        "label-md": ["Plus Jakarta Sans", "sans-serif"],
        "label-lg": ["Plus Jakarta Sans", "sans-serif"]
      },
      fontSize: {
        "body-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "headline-lg": ["24px", { lineHeight: "32px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-sm": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "headline-xl": ["36px", { lineHeight: "44px", letterSpacing: "-0.025em", fontWeight: "700" }],
        "headline-xl-mobile": ["28px", { lineHeight: "34px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "label-sm": ["10px", { lineHeight: "14px", letterSpacing: "0.05em", fontWeight: "700" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "600" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }]
      }
    }
  }
};
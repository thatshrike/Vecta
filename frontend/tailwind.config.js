export default {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f9fafb",
        "surface-container": "#f3f4f6",
        "surface-container-high": "#e5e7eb",
        "surface-container-highest": "#d1d5db",
        "surface-bright": "#ffffff",
        "surface-dim": "#e5e7eb",
        "surface": "#ffffff",
        "on-surface": "#111827",
        "on-surface-variant": "#4b5563",
        "outline": "#d1d5db",
        "outline-variant": "#e5e7eb",
        "inverse-surface": "#111827",
        "inverse-on-surface": "#ffffff",
        
        "primary": "#000000",
        "on-primary": "#ffffff",
        "primary-container": "#f3f4f6",
        "on-primary-container": "#111827",
        
        "secondary": "#374151",
        "on-secondary": "#ffffff",
        "secondary-container": "#f3f4f6",
        "on-secondary-container": "#111827",
        
        "tertiary": "#2563eb",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#dbeafe",
        "on-tertiary-container": "#1e40af",
        
        "error": "#ef4444",
        "on-error": "#ffffff",
        "error-container": "#fef2f2",
        "on-error-container": "#991b1b",
        
        "background": "#f9fafb",
        "on-background": "#111827",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.375rem",
        xl: "0.5rem",
        full: "9999px"
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2rem",
        "gutter": "1.5rem",
        "gutter-split": "0.75rem",
        "margin": "2rem",
      },
      fontFamily: {
        "label-caps": ["Inter", "sans-serif"],
        "headline-sm": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "mono-data": ["JetBrains Mono", "monospace"],
        "mono-data-sm": ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "label-caps": ["11px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
        "headline-sm": ["16px", { lineHeight: "24px", fontWeight: "600", letterSpacing: "-0.01em" }],
        "headline-md": ["20px", { lineHeight: "28px", fontWeight: "600", letterSpacing: "-0.015em" }],
        "headline-lg": ["24px", { lineHeight: "32px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "body-sm": ["13px", { lineHeight: "20px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "mono-data-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "mono-data": ["13px", { lineHeight: "20px", fontWeight: "500" }],
      }
    }
  }
}

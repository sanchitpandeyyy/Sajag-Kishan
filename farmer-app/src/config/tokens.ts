/**
 * Krishi Drishti (कृषि दृष्टि) design tokens. Same system as officer-web (CEE Mentor layout,
 * Krishi Drishti logo colours). Pure white surfaces and cool neutral grays; no tinted whites.
 * Keep officer-web/src/config/tokens.ts and officer-web globals.css in sync.
 */
export const colors = {
  // neutrals
  white: "#FFFFFF",
  surface: "#FFFFFF",
  page: "#F5F6F8", // app background behind cards
  surfaceMuted: "#F5F6F8",
  fill: "#ECEEF2", // tracks, pressed states
  line: "#E1E4EA", // borders, dividers
  inputBorder: "#B9BEC8",
  ink: "#12151C", // headings
  body: "#3A4150", // body text
  inkMuted: "#5C6473", // secondary text
  // brand (logo)
  brand: {
    900: "#04381A",
    800: "#075426", // logo: farmer, dark fields
    700: "#0B6B30",
    500: "#4A9F1E", // logo: light fields, leaf
    300: "#8CC96A",
    100: "#E1E4EA", // neutral on purpose
  },
  accent: "#FDB103", // logo: sun. Primary actions only
  accentStrong: "#E8A000",
  // signals
  danger: "#C9243F",
  warning: "#B26B00",
  info: "#1D5FA8",
  soil: "#8A5A3B",
} as const;

export const darkColors = {
  surface: "#0B1A10",
  surfaceMuted: "#13291A",
  ink: "#E6F2EA",
  inkMuted: "#A7BDB0",
  brand: colors.brand[500],
  accent: colors.accent,
} as const;

export const gradients = {
  brand: ["#075426", "#0B6B30"] as const,
  brandCss: "linear-gradient(160deg, #075426 0%, #0B6B30 100%)",
} as const;

export const fonts = {
  heading: "Anek Devanagari",
  body: "Mukta",
} as const;

/** Radii: control 12, card 16, panel 24 (same as web). */
export const radii = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Type scale (size / line height), same as web. */
export const type = {
  display: { fontSize: 32, lineHeight: 40 },
  h1: { fontSize: 26, lineHeight: 34 },
  h2: { fontSize: 22, lineHeight: 30 },
  h3: { fontSize: 18, lineHeight: 26 },
  body: { fontSize: 17, lineHeight: 26 }, // a little larger on phones for farmers
  small: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
} as const;

/** 4-point spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const brand = {
  nameNe: "कृषि दृष्टि",
  nameEn: "Krishi Drishti",
} as const;

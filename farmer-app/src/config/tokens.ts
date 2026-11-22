export const colors = {
  white: "#FFFFFF",
  surface: "#FFFFFF",
  page: "#F5F6F8",
  surfaceMuted: "#F5F6F8",
  fill: "#ECEEF2",
  line: "#E1E4EA",
  inputBorder: "#B9BEC8",
  ink: "#12151C",
  body: "#3A4150",
  inkMuted: "#5C6473",
  brand: {
    900: "#04381A",
    800: "#075426",
    700: "#0B6B30",
    500: "#4A9F1E",
    300: "#8CC96A",
    100: "#E1E4EA",
  },
  accent: "#FDB103",
  accentStrong: "#E8A000",
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

export const radii = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const type = {
  display: { fontSize: 32, lineHeight: 40 },
  h1: { fontSize: 26, lineHeight: 34 },
  h2: { fontSize: 22, lineHeight: 30 },
  h3: { fontSize: 18, lineHeight: 26 },
  body: { fontSize: 17, lineHeight: 26 },
  small: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const brand = {
  nameNe: "कृषि दृष्टि",
  nameEn: "Krishi Drishti",
} as const;

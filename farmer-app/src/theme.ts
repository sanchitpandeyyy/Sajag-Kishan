import { colors, gradients, radii, space, type } from "@/config/tokens";

export const theme = {
  colors,
  gradient: gradients.brand,
  radii,
  space,
  type,
  font: {
    heading: "AnekDevanagari_700Bold",
    headingMedium: "AnekDevanagari_600SemiBold",
    body: "Mukta_400Regular",
    bodyBold: "Mukta_600SemiBold",
  },
  shadow: {
    shadowColor: "#12151C",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  touch: 56,
} as const;

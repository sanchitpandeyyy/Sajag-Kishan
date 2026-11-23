export * from "./land-units";
export * from "./validation";

export const ROLES = ["FARMER", "AGRICULTURE_OFFICER", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL_NE: Record<Role, string> = {
  FARMER: "कृषक",
  AGRICULTURE_OFFICER: "कृषि अधिकृत",
  SUPER_ADMIN: "सुपर एडमिन",
};

export const SEASONS = ["BARSHE", "HIUDE", "CHAITE"] as const;
export type Season = (typeof SEASONS)[number];
export const SEASON_LABEL_NE: Record<Season, string> = {
  BARSHE: "बर्खे (मनसुन)",
  HIUDE: "हिउँदे",
  CHAITE: "चैते",
};

export const BS_MONTHS_NE = [
  "बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कार्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत",
] as const;

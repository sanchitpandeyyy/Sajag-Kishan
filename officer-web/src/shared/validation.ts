/**
 * zod schemas shared by the farmer app, officer web and API.
 * Field rules mirror the government farmer-registration portal (docs/04-gov-integration.md).
 */
import { z } from "zod";
import { toAsciiDigits } from "./land-units";

const DEVANAGARI = /^[ऀ-ॿ\s.]+$/;
const LATIN = /^[A-Za-z\s.'-]+$/;

/** 10 digits, starting with 98 / 97 / 96. Accepts Devanagari digits. */
export const mobileSchema = z
  .string()
  .transform((s) => toAsciiDigits(s.trim()))
  .pipe(z.string().regex(/^9[678]\d{8}$/, "मोबाइल नम्बर ९८/९७/९६ बाट सुरु हुने १० अङ्कको हुनुपर्छ"));

export const passwordSchema = z.string().min(8, "पासवर्ड कम्तीमा ८ अक्षर वा अङ्कको हुनुपर्छ");

/** Citizenship number: slashes are normalized to dashes, as the portal requires. */
export const citizenshipNoSchema = z
  .string()
  .transform((s) => toAsciiDigits(s.trim()).replace(/\//g, "-").replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[0-9-]{3,30}$/, "नागरिकता नम्बर मिलेन"));

/** Bikram Sambat date as yyyy-mm-dd. */
export const bsDateSchema = z
  .string()
  .transform((s) => toAsciiDigits(s.trim()))
  .pipe(z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[0-2])$/, "मिति ढाँचा: yyyy-mm-dd"));

export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);

export const loginSchema = z.object({
  mobile: mobileSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const addressSchema = z.object({
  wardId: z.number().int().positive(),
  tole: z.string().min(1).max(120),
});

/** One farmer record as it arrives from the government registry. */
export const registryFarmerSchema = z.object({
  externalId: z.string().optional(),
  mobile: mobileSchema,
  firstNameNe: z.string().regex(DEVANAGARI, "देवनागरीमा टाइप गर्नुहोस्"),
  middleNameNe: z.string().regex(DEVANAGARI).optional(),
  lastNameNe: z.string().regex(DEVANAGARI).optional(),
  firstNameEn: z.string().regex(LATIN).optional(),
  middleNameEn: z.string().regex(LATIN).optional(),
  lastNameEn: z.string().regex(LATIN).optional(),
  gender: genderSchema,
  dobBs: bsDateSchema,
  education: z.string().min(1),
  permanentAddress: addressSchema,
  farmingSameAsPermanent: z.boolean(),
  farmingAddress: addressSchema.optional(),
  citizenshipNo: citizenshipNoSchema,
  citizenshipDistrictId: z.number().int().positive(),
  nationalId: z.string().optional(),
  farmingSectors: z.array(z.string()).min(1),
  farmingMonthsPerYear: z.number().int().min(1).max(12),
});
export type RegistryFarmerRecord = z.infer<typeof registryFarmerSchema>;

export const geoPointSchema = z.object({
  lat: z.number().min(26.3).max(30.5),
  lng: z.number().min(80.0).max(88.3),
});

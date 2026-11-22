import { CROPS } from "../src/engine";
import { toSquareMetres } from "../src/shared";
import { createPrismaClient } from "../src/db";
import { ensurePhoneUser, placeholderEmail, setPassword } from "../src/lib/accounts";
import { currentFiscalYearBs, currentSeason } from "../src/scope";

const prisma = createPrismaClient();
const PASSWORD = process.env.SEED_PASSWORD ?? "krishi1234";

const PILOT = {
  province: { id: 7, nameNe: "सुदूरपश्चिम प्रदेश", nameEn: "Sudurpashchim Province" },
  district: { id: 71, nameNe: "कञ्चनपुर", nameEn: "Kanchanpur" },
  localLevel: { id: 7101, nameNe: "भीमदत्त नगरपालिका", nameEn: "Bhimdatta Municipality", type: "MUNICIPALITY" as const },
  wards: 19,
  lat: { min: 28.94, max: 29.01 },
  lng: { min: 80.13, max: 80.245 },
};

const DEMO_FIELDS: [number, number][] = [
  [28.9387, 80.232], [28.9621, 80.1316], [28.9402, 80.248], [29.008, 80.1914], [28.9804, 80.2222],
  [28.9419, 80.2186], [28.9692, 80.1385], [28.9436, 80.2027], [28.993, 80.1356], [28.9804, 80.2408],
  [28.9549, 80.1988], [28.9734, 80.214], [29.0006, 80.2032], [28.954, 80.2401], [28.9791, 80.1866],
  [28.9484, 80.1253], [28.9459, 80.1929], [28.9507, 80.1315], [28.992, 80.1513], [28.9732, 80.2195],
];

function nearestWard(wards: WardRow[], lat: number, lng: number): WardRow {
  return wards.reduce((best, w) => (Math.hypot((w.centroidLat ?? 0) - lat, (w.centroidLng ?? 0) - lng) < Math.hypot((best.centroidLat ?? 0) - lat, (best.centroidLng ?? 0) - lng) ? w : best), wards[0]!);
}

const samePoint = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) < 1e-6;

const TOLES = ["पूर्वी टोल", "पश्चिमी टोल", "बजार टोल", "खोला किनार", "चोक टोल", "नयाँ बस्ती"];
const FIRST = ["राम", "सीता", "हरि", "गीता", "कृष्ण", "माया", "बिष्णु", "सरिता", "दिल", "कमला"];
const LAST = ["भट्ट", "जोशी", "चौधरी", "बिष्ट", "राना", "अवस्थी"];

type Season = ReturnType<typeof currentSeason>;
type WardRow = { id: number; centroidLat: number | null; centroidLng: number | null; elevationM: number | null };

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

async function main() {
  const rand = rng(42);
  const fiscalYearBs = currentFiscalYearBs();
  const season = currentSeason();

  await prisma.province.upsert({ where: { id: PILOT.province.id }, update: {}, create: PILOT.province });
  await prisma.district.upsert({ where: { id: PILOT.district.id }, update: {}, create: { ...PILOT.district, provinceId: PILOT.province.id } });
  const ll = await prisma.localLevel.upsert({ where: { id: PILOT.localLevel.id }, update: {}, create: { ...PILOT.localLevel, districtId: PILOT.district.id } });

  const wards: WardRow[] = [];
  const cols = 5;
  const rows = Math.ceil(PILOT.wards / cols);
  const centroid = (r: number, c: number) => ({
    lat: PILOT.lat.max - ((r + 0.5) / rows) * (PILOT.lat.max - PILOT.lat.min),
    lng: PILOT.lng.min + ((c + 0.5) / cols) * (PILOT.lng.max - PILOT.lng.min),
  });
  for (let n = 1; n <= PILOT.wards; n++) {
    const r = Math.floor((n - 1) / cols);
    const c = (n - 1) % cols;
    wards.push(
      await prisma.ward.upsert({
        where: { localLevelId_number: { localLevelId: ll.id, number: n } },
        update: { centroidLat: centroid(r, c).lat, centroidLng: centroid(r, c).lng },
        create: { localLevelId: ll.id, number: n, centroidLat: centroid(r, c).lat, centroidLng: centroid(r, c).lng, elevationM: 200 + n * 2 },
      }),
    );
  }

  for (const c of CROPS) {
    await prisma.crop.upsert({
      where: { code: c.code },
      update: { params: { temp: c.temp, rain: c.rain, soilPh: c.soilPh, gddBase: c.gddBase, durationDays: c.durationDays } },
      create: {
        code: c.code,
        nameNe: c.nameNe,
        nameEn: c.nameEn,
        category: ["lentil"].includes(c.code) ? "pulse" : ["mustard"].includes(c.code) ? "oilseed" : ["potato"].includes(c.code) ? "vegetable" : "cereal",
        params: { temp: c.temp, rain: c.rain, soilPh: c.soilPh, gddBase: c.gddBase, durationDays: c.durationDays },
      },
    });
  }

  const officers = [
    { mobile: "9800000002", name: "Super Admin", role: "SUPER_ADMIN" as const, profile: { fullName: "सुपर एडमिन (डेमो)", designation: "Super Admin", localLevelId: ll.id } },
    { mobile: "9800000001", name: "Agriculture Officer", role: "AGRICULTURE_OFFICER" as const, profile: { fullName: "कृषि अधिकृत (डेमो)", designation: "कृषि शाखा प्रमुख", localLevelId: ll.id } },
  ];
  await moveOldSuperAdmin();
  for (const o of officers) {
    const userId = await ensurePhoneUser(prisma, { mobile: o.mobile, name: o.name, role: o.role, password: PASSWORD, phoneVerified: true });
    await prisma.officerProfile.upsert({ where: { userId }, update: o.profile, create: { userId, ...o.profile } });
  }

  const paddy = await prisma.crop.findUniqueOrThrow({ where: { code: "paddy" } });
  const maize = await prisma.crop.findUniqueOrThrow({ where: { code: "maize" } });
  const winterCrops = await Promise.all(["wheat", "potato", "mustard"].map((code) => prisma.crop.findUniqueOrThrow({ where: { code } })));

  for (let i = 1; i <= 20; i++) {
    const mobile = `98000001${String(i).padStart(2, "0")}`;
    const [lat, lng] = DEMO_FIELDS[i - 1]!;
    const ward = nearestWard(wards, lat, lng);
    const tole = TOLES[Math.floor(rand() * TOLES.length)]!;
    const area = { bigha: Math.floor(rand() * 2), kattha: 2 + Math.floor(rand() * 15) };
    const areaM2 = toSquareMetres(area);
    const mapped = i % 4 !== 0;

    const firstNameNe = FIRST[i % FIRST.length]!;
    const lastNameNe = LAST[i % LAST.length]!;
    const userId = await ensurePhoneUser(prisma, {
      mobile,
      name: `Farmer ${i}`,
      role: "FARMER",
      password: i === 20 ? undefined : PASSWORD,
      phoneVerified: i !== 20,
    });

    const existing = await prisma.farmer.findUnique({ where: { userId }, select: { id: true, parcels: { select: { id: true, centroidLat: true, centroidLng: true } } } });
    if (existing) {
      const p = existing.parcels[0];
      const target = mapped ? { lat, lng } : { lat: null, lng: null };
      const moved = p && (mapped ? !(samePoint(p.centroidLat, lat) && samePoint(p.centroidLng, lng)) : p.centroidLat != null);
      if (moved) {
        await prisma.farmer.update({ where: { id: existing.id }, data: { permanentWardId: ward.id, permanentTole: tole, farmingWardId: ward.id, farmingTole: tole, lastNameNe, citizenshipDistrictId: PILOT.district.id } });
        await relocateParcel(p.id, { wardId: ward.id, tole, ...target, elevationM: ward.elevationM });
      }
      continue;
    }

    const farmer = await prisma.farmer.create({
      data: {
        userId,
        externalRegistryId: `DEMO-${i}`,
        firstNameNe,
        lastNameNe,
        gender: i % 2 ? "MALE" : "FEMALE",
        dobBs: `20${30 + (i % 25)}-0${1 + (i % 9)}-1${i % 9}`,
        education: "माध्यमिक",
        permanentWardId: ward.id,
        permanentTole: tole,
        farmingWardId: ward.id,
        farmingTole: tole,
        citizenshipNo: `71-01-${70000 + i}`,
        citizenshipDistrictId: PILOT.district.id,
        farmingSectors: ["अन्नबाली"],
        farmingMonthsPerYear: 6 + (i % 7),
        consentAt: new Date(),
        parcels: {
          create: {
            wardId: ward.id,
            tole,
            areaM2,
            areaOriginal: area,
            ownershipType: i % 5 === 0 ? "SHARECROPPED" : "OWNED",
            irrigation: i % 3 === 0 ? "TUBEWELL" : "RAINFED",
            geometry: mapped ? { type: "Point", coordinates: [lng, lat] } : undefined,
            centroidLat: mapped ? lat : null,
            centroidLng: mapped ? lng : null,
            elevationM: ward.elevationM,
            source: mapped ? "FARMER" : "REGISTRY",
            verification: i % 3 === 0 ? "VERIFIED" : "UNVERIFIED",
          },
        },
      },
      include: { parcels: true },
    });
    const parcel = farmer.parcels[0]!;
    if (i % 6 === 0) continue;
    await prisma.seasonDeclaration.create({
      data: {
        parcelId: parcel.id,
        farmerId: farmer.id,
        cropId: i % 3 === 0 ? maize.id : paddy.id,
        fiscalYearBs,
        season: "BARSHE",
        sownAreaM2: parcel.areaM2 * (0.7 + rand() * 0.3),
        inputs: i % 2 === 0 ? { create: [{ kind: "FERTILIZER", product: "Urea", quantityKg: Math.round((parcel.areaM2 / 10000) * 100) }] } : undefined,
      },
    });
    if (season !== "BARSHE" && i % 5 !== 0) {
      const crop = winterCrops[i % winterCrops.length]!;
      await prisma.seasonDeclaration.create({
        data: {
          parcelId: parcel.id,
          farmerId: farmer.id,
          cropId: crop.id,
          fiscalYearBs,
          season,
          sownAreaM2: parcel.areaM2 * (0.6 + rand() * 0.4),
          inputs: i % 3 !== 0 ? { create: [{ kind: "FERTILIZER", product: "DAP", quantityKg: Math.round((parcel.areaM2 / 10000) * 80) }] } : undefined,
        },
      });
    }
  }

  await seedOwnerAccounts(ll.id, wards, fiscalYearBs, season);

  console.log("Seed complete: %s, %d wards, %d crops, 2 super admins, 1 agriculture officer, 21 farmers (season %s, FY %s).", PILOT.localLevel.nameEn, PILOT.wards, CROPS.length, season, fiscalYearBs);
}

async function moveOldSuperAdmin() {
  const old = await prisma.user.findUnique({ where: { phoneNumber: "9800000000" }, select: { id: true, role: true } });
  if (old && old.role !== "FARMER" && !(await prisma.user.findUnique({ where: { phoneNumber: "9800000002" } }))) {
    await prisma.user.update({ where: { id: old.id }, data: { phoneNumber: "9800000002", email: placeholderEmail("9800000002") } });
  }
}

async function relocateParcel(parcelId: string, to: { wardId: number; tole: string; lat: number | null; lng: number | null; elevationM: number | null }) {
  await prisma.satelliteObservation.deleteMany({ where: { parcelId } });
  await prisma.modelPrediction.deleteMany({ where: { parcelId } });
  await prisma.parcel.update({
    where: { id: parcelId },
    data: {
      wardId: to.wardId,
      tole: to.tole,
      geometry: to.lat != null && to.lng != null ? { type: "Point", coordinates: [to.lng, to.lat] } : undefined,
      centroidLat: to.lat,
      centroidLng: to.lng,
      elevationM: to.elevationM,
      slopeDeg: null,
      aspectDeg: null,
    },
  });
}

async function seedOwnerAccounts(localLevelId: number, wards: WardRow[], fiscalYearBs: string, season: Season) {
  const officerPhone = process.env.OWNER_OFFICER_PHONE ?? "9841148149";
  const farmerPhone = process.env.OWNER_FARMER_PHONE ?? "9800000000";
  const password = process.env.OWNER_PASSWORD ?? "admin@123";

  const officerId = await ensurePhoneUser(prisma, { mobile: officerPhone, name: "Sanchit Pandey", role: "SUPER_ADMIN", password, phoneVerified: true });
  await prisma.user.update({ where: { id: officerId }, data: { role: "SUPER_ADMIN" } });
  await setPassword(prisma, officerId, password);
  const officerProfile = { fullName: "सन्चित पाण्डे", designation: "कृषि अधिकृत (एडमिन)", localLevelId };
  await prisma.officerProfile.upsert({ where: { userId: officerId }, update: officerProfile, create: { userId: officerId, ...officerProfile } });

  const farmerUserId = await ensurePhoneUser(prisma, { mobile: farmerPhone, name: "Sanchit Pandey", role: "FARMER", password, phoneVerified: true });
  await setPassword(prisma, farmerUserId, password);
  await prisma.user.update({ where: { id: farmerUserId }, data: { email: placeholderEmail(farmerPhone), emailVerified: false } });

  const [w1, w2, w3] = [nearestWard(wards, 28.995, 80.17), nearestWard(wards, 28.951, 80.23), nearestWard(wards, 28.955, 80.135)];
  const fields = [
    { ward: w1, tole: "बजार टोल", localName: "घर अगाडिको खेत", lat: 28.995, lng: 80.17, area: { bigha: 1, kattha: 5 }, irrigation: "CANAL" as const, verification: "VERIFIED" as const },
    { ward: w2, tole: "खोला किनार", localName: "खोला छेउको खेत", lat: 28.951, lng: 80.23, area: { bigha: 0, kattha: 12 }, irrigation: "TUBEWELL" as const, verification: "UNVERIFIED" as const },
    { ward: w3, tole: "पश्चिमी टोल", localName: "माथिल्लो बारी", lat: 28.955, lng: 80.135, area: { bigha: 0, kattha: 8 }, irrigation: "RAINFED" as const, verification: "UNVERIFIED" as const },
  ];

  const existing = await prisma.farmer.findUnique({ where: { userId: farmerUserId }, select: { id: true, farmingWardId: true, parcels: { select: { id: true, localName: true, wardId: true, centroidLat: true, centroidLng: true } } } });
  if (existing) {
    const wardIds = new Set(wards.map((w) => w.id));
    if (!wardIds.has(existing.farmingWardId)) {
      await prisma.farmer.update({ where: { id: existing.id }, data: { permanentWardId: w1.id, permanentTole: fields[0]!.tole, farmingWardId: w1.id, farmingTole: fields[0]!.tole, citizenshipNo: "71-01-99001", citizenshipDistrictId: PILOT.district.id } });
    }
    for (const f of fields) {
      const p = existing.parcels.find((x) => x.localName === f.localName);
      if (p && !(samePoint(p.centroidLat, f.lat) && samePoint(p.centroidLng, f.lng))) await relocateParcel(p.id, { wardId: f.ward.id, tole: f.tole, lat: f.lat, lng: f.lng, elevationM: f.ward.elevationM });
    }
    return;
  }

  const farmer = await prisma.farmer.create({
    data: {
      userId: farmerUserId,
      externalRegistryId: "DEMO-OWNER",
      source: "FARMER",
      firstNameNe: "सन्चित",
      lastNameNe: "पाण्डे",
      firstNameEn: "Sanchit",
      lastNameEn: "Pandey",
      gender: "MALE",
      dobBs: "2058-04-12",
      education: "स्नातक",
      permanentWardId: w1.id,
      permanentTole: fields[0]!.tole,
      farmingWardId: w1.id,
      farmingTole: fields[0]!.tole,
      citizenshipNo: "71-01-99001",
      citizenshipDistrictId: PILOT.district.id,
      farmingSectors: ["अन्नबाली", "तरकारी"],
      farmingMonthsPerYear: 12,
      consentAt: new Date(),
      parcels: {
        create: fields.map((f) => ({
          wardId: f.ward.id,
          tole: f.tole,
          localName: f.localName,
          areaM2: toSquareMetres(f.area),
          areaOriginal: f.area,
          ownershipType: "OWNED" as const,
          irrigation: f.irrigation,
          geometry: { type: "Point", coordinates: [f.lng, f.lat] },
          centroidLat: f.lat,
          centroidLng: f.lng,
          elevationM: f.ward.elevationM,
          source: "FARMER" as const,
          verification: f.verification,
        })),
      },
    },
    include: { parcels: true },
  });

  const crop = (code: string) => prisma.crop.findUniqueOrThrow({ where: { code } });
  const [paddy, maize, wheat, mustard, potato] = await Promise.all(["paddy", "maize", "wheat", "mustard", "potato"].map(crop));
  const [p1, p2, p3] = farmer.parcels;
  const monsoon = [
    { parcel: p1!, crop: paddy!, urea: 120, dap: 60 },
    { parcel: p2!, crop: paddy!, urea: 60, dap: 30 },
    { parcel: p3!, crop: maize!, urea: 40, dap: 25 },
  ];
  for (const d of monsoon) {
    await prisma.seasonDeclaration.create({
      data: {
        parcelId: d.parcel.id,
        farmerId: farmer.id,
        cropId: d.crop.id,
        fiscalYearBs,
        season: "BARSHE",
        sownAreaM2: d.parcel.areaM2 * 0.95,
        inputs: { create: [{ kind: "FERTILIZER", product: "Urea", quantityKg: d.urea }, { kind: "FERTILIZER", product: "DAP", quantityKg: d.dap }] },
      },
    });
  }
  if (season !== "BARSHE") {
    const now = [
      { parcel: p1!, crop: wheat!, dap: 50 },
      { parcel: p2!, crop: potato!, dap: 40 },
      { parcel: p3!, crop: mustard!, dap: 15 },
    ];
    for (const d of now) {
      await prisma.seasonDeclaration.create({
        data: {
          parcelId: d.parcel.id,
          farmerId: farmer.id,
          cropId: d.crop.id,
          fiscalYearBs,
          season,
          sownAreaM2: d.parcel.areaM2 * 0.9,
          inputs: { create: [{ kind: "FERTILIZER", product: "DAP", quantityKg: d.dap }] },
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

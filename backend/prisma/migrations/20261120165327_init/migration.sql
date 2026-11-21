-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('REGISTRY', 'FARMER', 'OFFICER', 'SATELLITE', 'MODEL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "LocalLevelType" AS ENUM ('METROPOLITAN', 'SUB_METROPOLITAN', 'MUNICIPALITY', 'RURAL_MUNICIPALITY');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('OWNED', 'LEASED', 'SHARECROPPED', 'OTHER');

-- CreateEnum
CREATE TYPE "IrrigationSource" AS ENUM ('RAINFED', 'CANAL', 'TUBEWELL', 'POND', 'RIVER_LIFT', 'DRIP_SPRINKLER', 'OTHER');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('BARSHE', 'HIUDE', 'CHAITE');

-- CreateEnum
CREATE TYPE "InputKind" AS ENUM ('FERTILIZER', 'PESTICIDE', 'SEED', 'MACHINERY', 'OTHER');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PLANNED', 'APPROVED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'SEVERE');

-- CreateEnum
CREATE TYPE "CalendarTask" AS ENUM ('LAND_PREP', 'NURSERY', 'SOWING', 'TRANSPLANTING', 'FERTILIZING', 'IRRIGATION', 'WEEDING', 'PEST_SCOUTING', 'HARVEST', 'STORAGE');

-- CreateTable
CREATE TABLE "Province" (
    "id" INTEGER NOT NULL,
    "nameNe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" INTEGER NOT NULL,
    "provinceId" INTEGER NOT NULL,
    "nameNe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalLevel" (
    "id" INTEGER NOT NULL,
    "districtId" INTEGER NOT NULL,
    "nameNe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "type" "LocalLevelType" NOT NULL,

    CONSTRAINT "LocalLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" SERIAL NOT NULL,
    "localLevelId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "centroidLat" DOUBLE PRECISION,
    "centroidLng" DOUBLE PRECISION,
    "elevationM" DOUBLE PRECISION,
    "boundary" JSONB,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "phoneNumber" TEXT,
    "phoneNumberVerified" BOOLEAN DEFAULT false,
    "role" TEXT DEFAULT 'FARMER',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "designation" TEXT,
    "localLevelId" INTEGER NOT NULL,

    CONSTRAINT "OfficerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farmer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalRegistryId" TEXT,
    "source" "DataSource" NOT NULL DEFAULT 'REGISTRY',
    "firstNameNe" TEXT NOT NULL,
    "middleNameNe" TEXT,
    "lastNameNe" TEXT,
    "firstNameEn" TEXT,
    "middleNameEn" TEXT,
    "lastNameEn" TEXT,
    "gender" "Gender" NOT NULL,
    "dobBs" TEXT NOT NULL,
    "dobAd" TIMESTAMP(3),
    "education" TEXT NOT NULL,
    "permanentWardId" INTEGER NOT NULL,
    "permanentTole" TEXT NOT NULL,
    "farmingSameAsPermanent" BOOLEAN NOT NULL DEFAULT true,
    "farmingWardId" INTEGER NOT NULL,
    "farmingTole" TEXT NOT NULL,
    "citizenshipNo" TEXT NOT NULL,
    "citizenshipDistrictId" INTEGER NOT NULL,
    "nationalId" TEXT,
    "farmingSectors" TEXT[],
    "farmingMonthsPerYear" INTEGER NOT NULL,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "wardId" INTEGER NOT NULL,
    "tole" TEXT NOT NULL,
    "localName" TEXT,
    "kittaNo" TEXT,
    "mapSheetNo" TEXT,
    "areaM2" DOUBLE PRECISION NOT NULL,
    "areaOriginal" JSONB,
    "ownershipType" "OwnershipType" NOT NULL DEFAULT 'OWNED',
    "irrigation" "IrrigationSource" NOT NULL DEFAULT 'RAINFED',
    "geometry" JSONB,
    "centroidLat" DOUBLE PRECISION,
    "centroidLng" DOUBLE PRECISION,
    "elevationM" DOUBLE PRECISION,
    "soilPh" DOUBLE PRECISION,
    "source" "DataSource" NOT NULL DEFAULT 'REGISTRY',
    "verification" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameNe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "fertilizerDose" JSONB,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropVariety" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER,
    "notes" TEXT,

    CONSTRAINT "CropVariety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropCalendarTemplate" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "season" "Season" NOT NULL,
    "stages" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v0',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "CropCalendarTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonDeclaration" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "fiscalYearBs" TEXT NOT NULL,
    "season" "Season" NOT NULL,
    "sownAreaM2" DOUBLE PRECISION NOT NULL,
    "sowingDate" TIMESTAMP(3),
    "expectedHarvest" TIMESTAMP(3),
    "actualYieldKg" DOUBLE PRECISION,
    "isFallow" BOOLEAN NOT NULL DEFAULT false,
    "source" "DataSource" NOT NULL DEFAULT 'FARMER',
    "verification" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputApplication" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "kind" "InputKind" NOT NULL,
    "product" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "source" "DataSource" NOT NULL DEFAULT 'FARMER',

    CONSTRAINT "InputApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubsidyScheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "InputKind" NOT NULL,
    "fiscalYearBs" TEXT NOT NULL,
    "localLevelId" INTEGER,
    "unit" TEXT NOT NULL,
    "totalBudget" DOUBLE PRECISION,
    "totalStock" DOUBLE PRECISION,
    "criteria" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubsidyScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubsidyAllocation" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "needQty" DOUBLE PRECISION NOT NULL,
    "allocatedQty" DOUBLE PRECISION NOT NULL,
    "deliveredQty" DOUBLE PRECISION,
    "status" "AllocationStatus" NOT NULL DEFAULT 'PLANNED',
    "priorityScore" DOUBLE PRECISION,
    "flags" TEXT[],
    "officerId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubsidyAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "cropCode" TEXT NOT NULL,
    "task" "CalendarTask" NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "titleNe" TEXT NOT NULL,
    "noteNe" TEXT,
    "reason" JSONB,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "generatedBy" TEXT NOT NULL DEFAULT 'calendar-v0',

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "wardId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "titleNe" TEXT NOT NULL,
    "messageNe" TEXT NOT NULL,
    "cropCodes" TEXT[],
    "evidence" JSONB,
    "ruleVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advisory" (
    "id" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "wardId" INTEGER,
    "localLevelId" INTEGER,
    "titleNe" TEXT NOT NULL,
    "bodyNe" TEXT NOT NULL,
    "cropCodes" TEXT[],
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Advisory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "wardId" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL DEFAULT 'open-meteo',
    "daily" JSONB NOT NULL,
    "hourly" JSONB,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatelliteObservation" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT,
    "wardId" INTEGER,
    "observedOn" TIMESTAMP(3) NOT NULL,
    "sensor" TEXT NOT NULL,
    "ndvi" DOUBLE PRECISION,
    "vhDb" DOUBLE PRECISION,
    "fallowFlag" BOOLEAN,
    "cloudPct" DOUBLE PRECISION,
    "meta" JSONB,

    CONSTRAINT "SatelliteObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'assets',
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "District_provinceId_idx" ON "District"("provinceId");

-- CreateIndex
CREATE INDEX "LocalLevel_districtId_idx" ON "LocalLevel"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_localLevelId_number_key" ON "Ward"("localLevelId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_phoneNumber_key" ON "user"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "OfficerProfile_userId_key" ON "OfficerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_userId_key" ON "Farmer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_externalRegistryId_key" ON "Farmer"("externalRegistryId");

-- CreateIndex
CREATE INDEX "Farmer_farmingWardId_idx" ON "Farmer"("farmingWardId");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_citizenshipNo_citizenshipDistrictId_key" ON "Farmer"("citizenshipNo", "citizenshipDistrictId");

-- CreateIndex
CREATE INDEX "Parcel_wardId_idx" ON "Parcel"("wardId");

-- CreateIndex
CREATE INDEX "Parcel_farmerId_idx" ON "Parcel"("farmerId");

-- CreateIndex
CREATE INDEX "Parcel_kittaNo_idx" ON "Parcel"("kittaNo");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_code_key" ON "Crop"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CropCalendarTemplate_cropId_zone_season_version_key" ON "CropCalendarTemplate"("cropId", "zone", "season", "version");

-- CreateIndex
CREATE INDEX "SeasonDeclaration_fiscalYearBs_season_idx" ON "SeasonDeclaration"("fiscalYearBs", "season");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonDeclaration_parcelId_fiscalYearBs_season_cropId_key" ON "SeasonDeclaration"("parcelId", "fiscalYearBs", "season", "cropId");

-- CreateIndex
CREATE UNIQUE INDEX "SubsidyAllocation_schemeId_farmerId_key" ON "SubsidyAllocation"("schemeId", "farmerId");

-- CreateIndex
CREATE INDEX "CalendarEvent_parcelId_startsOn_idx" ON "CalendarEvent"("parcelId", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_wardId_type_validFrom_key" ON "Alert"("wardId", "type", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "AlertDelivery_alertId_userId_channel_key" ON "AlertDelivery"("alertId", "userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_wardId_fetchedAt_idx" ON "WeatherSnapshot"("wardId", "fetchedAt");

-- CreateIndex
CREATE INDEX "SatelliteObservation_parcelId_observedOn_idx" ON "SatelliteObservation"("parcelId", "observedOn");

-- CreateIndex
CREATE INDEX "SatelliteObservation_wardId_observedOn_idx" ON "SatelliteObservation"("wardId", "observedOn");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_key_key" ON "FileObject"("key");

-- CreateIndex
CREATE INDEX "FileObject_entity_entityId_idx" ON "FileObject"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalLevel" ADD CONSTRAINT "LocalLevel_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_localLevelId_fkey" FOREIGN KEY ("localLevelId") REFERENCES "LocalLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerProfile" ADD CONSTRAINT "OfficerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerProfile" ADD CONSTRAINT "OfficerProfile_localLevelId_fkey" FOREIGN KEY ("localLevelId") REFERENCES "LocalLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_permanentWardId_fkey" FOREIGN KEY ("permanentWardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_farmingWardId_fkey" FOREIGN KEY ("farmingWardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropVariety" ADD CONSTRAINT "CropVariety_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCalendarTemplate" ADD CONSTRAINT "CropCalendarTemplate_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDeclaration" ADD CONSTRAINT "SeasonDeclaration_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDeclaration" ADD CONSTRAINT "SeasonDeclaration_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDeclaration" ADD CONSTRAINT "SeasonDeclaration_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputApplication" ADD CONSTRAINT "InputApplication_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "SeasonDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubsidyAllocation" ADD CONSTRAINT "SubsidyAllocation_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "SubsidyScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubsidyAllocation" ADD CONSTRAINT "SubsidyAllocation_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubsidyAllocation" ADD CONSTRAINT "SubsidyAllocation_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "OfficerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advisory" ADD CONSTRAINT "Advisory_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "OfficerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advisory" ADD CONSTRAINT "Advisory_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherSnapshot" ADD CONSTRAINT "WeatherSnapshot_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatelliteObservation" ADD CONSTRAINT "SatelliteObservation_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatelliteObservation" ADD CONSTRAINT "SatelliteObservation_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

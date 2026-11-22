-- AlterTable
ALTER TABLE "SatelliteObservation" ADD COLUMN "evi" DOUBLE PRECISION,
ADD COLUMN "savi" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ClimateDay" (
    "wardId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "precipMm" DOUBLE PRECISION,
    "tempMeanC" DOUBLE PRECISION,
    "tempMaxC" DOUBLE PRECISION,
    "soilMoisture" DOUBLE PRECISION,
    "et0Mm" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClimateDay_pkey" PRIMARY KEY ("wardId","date")
);

-- AddForeignKey
ALTER TABLE "ClimateDay" ADD CONSTRAINT "ClimateDay_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

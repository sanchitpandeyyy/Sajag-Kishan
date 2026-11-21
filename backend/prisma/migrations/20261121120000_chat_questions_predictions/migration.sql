-- CreateTable
CREATE TABLE "ChatQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wardId" INTEGER,
    "question" TEXT NOT NULL,
    "understoodEn" TEXT,
    "intent" TEXT NOT NULL,
    "answerNe" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPrediction" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "features" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatQuestion_wardId_createdAt_idx" ON "ChatQuestion"("wardId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatQuestion_createdAt_idx" ON "ChatQuestion"("createdAt");

-- CreateIndex
CREATE INDEX "ModelPrediction_parcelId_model_createdAt_idx" ON "ModelPrediction"("parcelId", "model", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatQuestion" ADD CONSTRAINT "ChatQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatQuestion" ADD CONSTRAINT "ChatQuestion_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelPrediction" ADD CONSTRAINT "ModelPrediction_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

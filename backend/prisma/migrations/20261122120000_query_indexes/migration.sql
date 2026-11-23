-- CreateIndex
CREATE INDEX "Alert_wardId_validTo_idx" ON "Alert"("wardId", "validTo");

-- CreateIndex
CREATE INDEX "AlertDelivery_userId_idx" ON "AlertDelivery"("userId");

-- CreateIndex
CREATE INDEX "Advisory_wardId_publishedAt_idx" ON "Advisory"("wardId", "publishedAt");

-- CreateIndex
CREATE INDEX "SeasonDeclaration_farmerId_idx" ON "SeasonDeclaration"("farmerId");

-- CreateIndex
CREATE INDEX "SubsidyAllocation_farmerId_idx" ON "SubsidyAllocation"("farmerId");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "InputApplication_declarationId_idx" ON "InputApplication"("declarationId");

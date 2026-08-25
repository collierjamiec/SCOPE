-- CreateTable
CREATE TABLE `Domain` (
    `id` VARCHAR(191) NOT NULL,
    `normalizedDomain` VARCHAR(255) NOT NULL,
    `displayDomain` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Domain_normalizedDomain_key`(`normalizedDomain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DomainAlias` (
    `id` VARCHAR(191) NOT NULL,
    `domainId` VARCHAR(191) NOT NULL,
    `normalizedDomain` VARCHAR(255) NOT NULL,
    `rawDomain` VARCHAR(2048) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DomainAlias_normalizedDomain_key`(`normalizedDomain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditRun` (
    `id` VARCHAR(191) NOT NULL,
    `domainId` VARCHAR(191) NOT NULL,
    `rawStartUrl` VARCHAR(2048) NOT NULL,
    `normalizedDomain` VARCHAR(255) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL,
    `status` ENUM('COMPLETE', 'PARTIAL') NOT NULL,
    `scanType` VARCHAR(40) NOT NULL,
    `configVersion` INTEGER NOT NULL DEFAULT 1,
    `configFingerprint` CHAR(64) NOT NULL,
    `rulesetVersion` VARCHAR(40) NOT NULL,
    `configJson` JSON NOT NULL,
    `outputDirectory` VARCHAR(2048) NULL,
    `reportJsonPath` VARCHAR(2048) NULL,
    `pageCount` INTEGER NOT NULL,
    `fetchedCount` INTEGER NOT NULL,
    `sitemapUrlCount` INTEGER NOT NULL,
    `criticalCount` INTEGER NOT NULL,
    `warningCount` INTEGER NOT NULL,
    `infoCount` INTEGER NOT NULL,
    `orphanPageCount` INTEGER NOT NULL,
    `averageClickDepth` DOUBLE NULL,
    `schemaCoverage` DOUBLE NULL,
    `indexableRate` DOUBLE NULL,
    `gscAveragePosition` DOUBLE NULL,
    `gscPeriodStart` DATETIME(3) NULL,
    `gscPeriodEnd` DATETIME(3) NULL,
    `ga4PeriodStart` DATETIME(3) NULL,
    `ga4PeriodEnd` DATETIME(3) NULL,
    `averageLcp` DOUBLE NULL,
    `averageCls` DOUBLE NULL,
    `averageInp` DOUBLE NULL,
    `averageTbt` DOUBLE NULL,
    `previousRunId` VARCHAR(191) NULL,
    `comparisonStatus` ENUM('BASELINE', 'COMPARABLE', 'PARTIAL', 'NOT_COMPARABLE') NOT NULL DEFAULT 'BASELINE',
    `comparisonNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditRun_domainId_generatedAt_idx`(`domainId`, `generatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RunFinding` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `ruleId` VARCHAR(160) NOT NULL,
    `ruleVersion` INTEGER NOT NULL DEFAULT 1,
    `normalizedPageUrl` VARCHAR(2048) NOT NULL,
    `category` VARCHAR(20) NOT NULL,
    `severity` VARCHAR(20) NOT NULL,
    `message` TEXT NOT NULL,
    `evidenceJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RunFinding_fingerprint_idx`(`fingerprint`),
    UNIQUE INDEX `RunFinding_runId_fingerprint_key`(`runId`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RunPageMetric` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `normalizedPageUrl` VARCHAR(2048) NOT NULL,
    `pageType` VARCHAR(50) NULL,
    `status` INTEGER NOT NULL,
    `indexable` BOOLEAN NOT NULL,
    `incomingInternalLinks` INTEGER NOT NULL,
    `clickDepth` INTEGER NULL,
    `orphan` BOOLEAN NOT NULL,
    `schemaEligible` BOOLEAN NOT NULL,
    `schemaAppropriate` BOOLEAN NOT NULL,
    `contentAgeDays` INTEGER NULL,
    `lcp` DOUBLE NULL,
    `cls` DOUBLE NULL,
    `inp` DOUBLE NULL,
    `tbt` DOUBLE NULL,

    UNIQUE INDEX `RunPageMetric_runId_normalizedPageUrl_key`(`runId`, `normalizedPageUrl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RunDelta` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `previousRunId` VARCHAR(191) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `state` ENUM('OPENED', 'RESOLVED', 'REOPENED', 'PERSISTING') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RunDelta_runId_fingerprint_key`(`runId`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DomainMerge` (
    `id` VARCHAR(191) NOT NULL,
    `sourceDomainId` VARCHAR(191) NOT NULL,
    `targetDomainId` VARCHAR(191) NOT NULL,
    `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `performedBy` VARCHAR(255) NULL,
    `reason` TEXT NULL,
    `metadataJson` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistoryEvent` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `domainId` VARCHAR(30) NULL,
    `runId` VARCHAR(50) NULL,
    `actor` VARCHAR(255) NULL,
    `detailsJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DomainAlias` ADD CONSTRAINT `DomainAlias_domainId_fkey` FOREIGN KEY (`domainId`) REFERENCES `Domain`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditRun` ADD CONSTRAINT `AuditRun_domainId_fkey` FOREIGN KEY (`domainId`) REFERENCES `Domain`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunFinding` ADD CONSTRAINT `RunFinding_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `AuditRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunPageMetric` ADD CONSTRAINT `RunPageMetric_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `AuditRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunDelta` ADD CONSTRAINT `RunDelta_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `AuditRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DomainMerge` ADD CONSTRAINT `DomainMerge_sourceDomainId_fkey` FOREIGN KEY (`sourceDomainId`) REFERENCES `Domain`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DomainMerge` ADD CONSTRAINT `DomainMerge_targetDomainId_fkey` FOREIGN KEY (`targetDomainId`) REFERENCES `Domain`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


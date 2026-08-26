ALTER TABLE `AuditRun`
    ADD COLUMN `gscClicks` INTEGER NULL,
    ADD COLUMN `gscImpressions` INTEGER NULL,
    ADD COLUMN `gscCtr` DOUBLE NULL,
    ADD COLUMN `gscKeywordCount` INTEGER NULL,
    ADD COLUMN `ga4Sessions` INTEGER NULL,
    ADD COLUMN `ga4Users` INTEGER NULL,
    ADD COLUMN `ga4EngagementRate` DOUBLE NULL,
    ADD COLUMN `ga4BounceRate` DOUBLE NULL;

ALTER TABLE `RunPageMetric`
    ADD COLUMN `gscClicks` INTEGER NULL,
    ADD COLUMN `gscImpressions` INTEGER NULL,
    ADD COLUMN `gscCtr` DOUBLE NULL,
    ADD COLUMN `gscPosition` DOUBLE NULL,
    ADD COLUMN `ga4Sessions` INTEGER NULL,
    ADD COLUMN `ga4Users` INTEGER NULL,
    ADD COLUMN `ga4EngagementRate` DOUBLE NULL,
    ADD COLUMN `ga4BounceRate` DOUBLE NULL;

CREATE TABLE `DomainCompetitor` (
    `id` VARCHAR(191) NOT NULL,
    `sourceDomainId` VARCHAR(191) NOT NULL,
    `normalizedDomain` VARCHAR(255) NOT NULL,
    `displayDomain` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `DomainCompetitor_sourceDomainId_normalizedDomain_key`(`sourceDomainId`, `normalizedDomain`),
    INDEX `DomainCompetitor_normalizedDomain_idx`(`normalizedDomain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DomainCompetitor` ADD CONSTRAINT `DomainCompetitor_sourceDomainId_fkey` FOREIGN KEY (`sourceDomainId`) REFERENCES `Domain`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

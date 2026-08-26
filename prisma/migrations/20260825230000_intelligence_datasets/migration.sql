CREATE TABLE `IntelligenceDataset` (
    `id` VARCHAR(191) NOT NULL,
    `domainId` VARCHAR(191) NOT NULL,
    `targetDomain` VARCHAR(255) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `datasetType` VARCHAR(30) NOT NULL,
    `reportStart` DATETIME(3) NULL,
    `reportEnd` DATETIME(3) NULL,
    `market` VARCHAR(80) NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `rowCount` INTEGER NOT NULL,
    `metricsJson` JSON NOT NULL,
    `rowsJson` JSON NOT NULL,
    `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `IntelligenceDataset_domainId_datasetType_importedAt_idx`(`domainId`, `datasetType`, `importedAt`),
    INDEX `IntelligenceDataset_targetDomain_idx`(`targetDomain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `IntelligenceDataset` ADD CONSTRAINT `IntelligenceDataset_domainId_fkey` FOREIGN KEY (`domainId`) REFERENCES `Domain`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

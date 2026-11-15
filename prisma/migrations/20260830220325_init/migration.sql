-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'CSO', 'SECURITY_OFFICER') NOT NULL DEFAULT 'CSO',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecurityCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityLocation` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecurityLocation_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityReport` (
    `id` VARCHAR(191) NOT NULL,
    `clientSubmissionId` VARCHAR(191) NOT NULL,
    `serverReference` VARCHAR(191) NOT NULL,
    `reporterType` ENUM('STUDENT', 'STAFF') NOT NULL,
    `isAnonymous` BOOLEAN NOT NULL DEFAULT false,
    `fullName` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `staffId` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `faculty` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `urgency` ENUM('NORMAL', 'URGENT', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
    `incidentDate` DATETIME(3) NULL,
    `incidentTime` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `additionalInfo` VARCHAR(191) NULL,
    `status` ENUM('SUBMITTED', 'RECEIVED', 'READ_BY_CSO', 'UNDER_INVESTIGATION', 'AWAITING_INFORMATION', 'RESPONDED', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'SUBMITTED',
    `installationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecurityReport_clientSubmissionId_key`(`clientSubmissionId`),
    UNIQUE INDEX `SecurityReport_serverReference_key`(`serverReference`),
    INDEX `SecurityReport_status_idx`(`status`),
    INDEX `SecurityReport_createdAt_idx`(`createdAt`),
    INDEX `SecurityReport_categoryId_idx`(`categoryId`),
    INDEX `SecurityReport_locationId_idx`(`locationId`),
    INDEX `SecurityReport_clientSubmissionId_idx`(`clientSubmissionId`),
    INDEX `SecurityReport_installationId_idx`(`installationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportResponse` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `authorRole` VARCHAR(191) NOT NULL DEFAULT 'USER',
    `authorName` VARCHAR(191) NULL,
    `isFromAdmin` BOOLEAN NOT NULL DEFAULT false,
    `body` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReportResponse_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ReportAttachment_storageKey_key`(`storageKey`),
    INDEX `ReportAttachment_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('SUBMITTED', 'RECEIVED', 'READ_BY_CSO', 'UNDER_INVESTIGATION', 'AWAITING_INFORMATION', 'RESPONDED', 'RESOLVED', 'CLOSED') NULL,
    `toStatus` ENUM('SUBMITTED', 'RECEIVED', 'READ_BY_CSO', 'UNDER_INVESTIGATION', 'AWAITING_INFORMATION', 'RESPONDED', 'RESOLVED', 'CLOSED') NOT NULL,
    `adminId` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReportStatusHistory_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` VARCHAR(191) NULL,

    INDEX `ReportAssignment_reportId_idx`(`reportId`),
    INDEX `ReportAssignment_assigneeId_idx`(`assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NULL,
    `adminId` VARCHAR(191) NULL,
    `action` ENUM('VIEWED', 'STATUS_CHANGED', 'ASSIGNED', 'RESPONDED', 'RESOLVED', 'CATEGORY_CHANGED', 'LOCATION_CHANGED', 'REPORTER_CHANGED') NOT NULL,
    `detail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_reportId_idx`(`reportId`),
    INDEX `AuditLog_adminId_idx`(`adminId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SecurityReport` ADD CONSTRAINT `SecurityReport_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `SecurityCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityReport` ADD CONSTRAINT `SecurityReport_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `SecurityLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportResponse` ADD CONSTRAINT `ReportResponse_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `SecurityReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportAttachment` ADD CONSTRAINT `ReportAttachment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `SecurityReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportStatusHistory` ADD CONSTRAINT `ReportStatusHistory_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `SecurityReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportStatusHistory` ADD CONSTRAINT `ReportStatusHistory_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportAssignment` ADD CONSTRAINT `ReportAssignment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `SecurityReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportAssignment` ADD CONSTRAINT `ReportAssignment_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportAssignment` ADD CONSTRAINT `ReportAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `SecurityReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


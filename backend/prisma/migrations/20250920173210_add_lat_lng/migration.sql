-- AlterTable
ALTER TABLE `booking` ADD COLUMN `dropoffLat` DOUBLE NULL,
    ADD COLUMN `dropoffLng` DOUBLE NULL,
    ADD COLUMN `pickupLat` DOUBLE NULL,
    ADD COLUMN `pickupLng` DOUBLE NULL;

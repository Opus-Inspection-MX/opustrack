-- Trip statuses in Spanish, like every other catalogue in the system.
--
-- `IN_PROGRESS`/`COMPLETED`/`CANCELLED` were the only English names left, and
-- they surface in the UI. Renaming the rows keeps every foreign key intact —
-- the trips keep pointing at the same ids.
UPDATE "VehicleTripStatus" SET name = 'EN_CURSO'   WHERE name = 'IN_PROGRESS';
UPDATE "VehicleTripStatus" SET name = 'COMPLETADO' WHERE name = 'COMPLETED';
UPDATE "VehicleTripStatus" SET name = 'CANCELADO'  WHERE name = 'CANCELLED';

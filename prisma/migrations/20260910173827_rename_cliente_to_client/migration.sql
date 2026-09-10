-- Rename Cliente -> Client (PR1a). RENAME-only: no data moves, no DROP+CREATE.
--
-- Physical names confirmed against
-- prisma/migrations/20260609000000_rename_cliente_remove_priority_sla/migration.sql
-- (live `psql \d` unavailable in this environment; Docker daemon down).
-- Live-DB drift check before deploy: `\d "Cliente"`, `\d "UserClienteAssignment"`,
-- `\d "ScheduleCliente"` must show the pre-rename names below.
--
-- JWT-safe: zero Permission/Role UPDATEs, no sessionVersion bump.
-- The `scope:all-clientes` value and `clientes:*` permission names move in PR2.

-- 1. Tables (constraint/index renames follow; RENAME TABLE does not rename them)
ALTER TABLE "Cliente" RENAME TO "Client";
ALTER TABLE "UserClienteAssignment" RENAME TO "UserClientAssignment";
ALTER TABLE "ScheduleCliente" RENAME TO "ScheduleClient";

-- 2. Columns clienteId -> clientId
ALTER TABLE "UserClientAssignment" RENAME COLUMN "clienteId" TO "clientId";
ALTER TABLE "ScheduleClient" RENAME COLUMN "clienteId" TO "clientId";
ALTER TABLE "Incident" RENAME COLUMN "clienteId" TO "clientId";
ALTER TABLE "Line" RENAME COLUMN "clienteId" TO "clientId";

-- 3. Constraints (PRIMARY KEY / UNIQUE / FOREIGN KEY)
ALTER TABLE "Client" RENAME CONSTRAINT "Cliente_pkey" TO "Client_pkey";
ALTER TABLE "Client" RENAME CONSTRAINT "Cliente_code_key" TO "Client_code_key";
ALTER TABLE "Client" RENAME CONSTRAINT "Cliente_stateId_fkey" TO "Client_stateId_fkey";
ALTER TABLE "UserClientAssignment" RENAME CONSTRAINT "UserClienteAssignment_pkey" TO "UserClientAssignment_pkey";
ALTER TABLE "UserClientAssignment" RENAME CONSTRAINT "UserClienteAssignment_userId_fkey" TO "UserClientAssignment_userId_fkey";
ALTER TABLE "UserClientAssignment" RENAME CONSTRAINT "UserClienteAssignment_clienteId_fkey" TO "UserClientAssignment_clientId_fkey";
ALTER TABLE "UserClientAssignment" RENAME CONSTRAINT "UserClienteAssignment_userId_clienteId_key" TO "UserClientAssignment_userId_clientId_key";
ALTER TABLE "ScheduleClient" RENAME CONSTRAINT "ScheduleCliente_pkey" TO "ScheduleClient_pkey";
ALTER TABLE "ScheduleClient" RENAME CONSTRAINT "ScheduleCliente_scheduleId_fkey" TO "ScheduleClient_scheduleId_fkey";
ALTER TABLE "ScheduleClient" RENAME CONSTRAINT "ScheduleCliente_clienteId_fkey" TO "ScheduleClient_clientId_fkey";
ALTER TABLE "Incident" RENAME CONSTRAINT "Incident_clienteId_fkey" TO "Incident_clientId_fkey";
ALTER TABLE "Line" RENAME CONSTRAINT "Line_clienteId_fkey" TO "Line_clientId_fkey";

-- 4. Indexes (plain + unique)
ALTER INDEX "UserClienteAssignment_userId_idx" RENAME TO "UserClientAssignment_userId_idx";
ALTER INDEX "UserClienteAssignment_clienteId_idx" RENAME TO "UserClientAssignment_clientId_idx";
ALTER INDEX "ScheduleCliente_clienteId_idx" RENAME TO "ScheduleClient_clientId_idx";
ALTER INDEX "ScheduleCliente_scheduleId_idx" RENAME TO "ScheduleClient_scheduleId_idx";
ALTER INDEX "Incident_clienteId_idx" RENAME TO "Incident_clientId_idx";
ALTER INDEX "Line_clienteId_idx" RENAME TO "Line_clientId_idx";
ALTER INDEX "Line_name_clienteId_key" RENAME TO "Line_name_clientId_key";

-- 5. Additive audit-prep (NOT a rename): UserProfile gains createdAt to match
-- the schema. Safe ADD COLUMN with default — no rows are modified or dropped.
-- Required for schema/migration parity in this same deploy.
ALTER TABLE "UserProfile" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

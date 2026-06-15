# Proposal · holidays-and-vacations

> SDD PROPOSE phase. Change: `holidays-and-vacations`. Artifact store: hybrid.
> Reads: `sdd/holidays-and-vacations/explore` (engram #55), spec/00-overview.md, spec/01-auth-rbac.md, spec/04-asignaciones.md.

## Executive summary

Introduce días festivos oficiales (LFT Art. 74) y vacaciones/incapacidades de FSR como
conceptos de primera clase, y bloquear de forma dura la asignación y el registro de
actividad de un FSR en fechas en las que está inhábil, mediante un helper central de
disponibilidad consciente de la zona horaria de Ciudad de México.

---

## Intent y problema de negocio

### Problema

Hoy el sistema **no tiene noción de tiempo no laborable**. Un administrador puede asignar
trabajo a un FSR para una fecha que es día festivo oficial, o para un periodo en el que ese
FSR está de vacaciones o incapacitado, y el sistema lo permite sin fricción. Esto provoca:

- Órdenes de trabajo programadas para fechas en las que nadie va a ejecutarlas → retraso en la
  atención al Cliente y métricas de *time-to-seen* contaminadas.
- Reasignaciones manuales de último momento cuando se descubre que el FSR no estaba disponible.
- Falta de un registro formal de ausencias del FSR: las vacaciones e incapacidades se manejan
  hoy fuera del sistema (verbal, chat, hoja de cálculo), sin trazabilidad ni aprobación.

### Por qué ahora

El dominio de asignaciones ya está maduro (máquina de estados completa, métricas, multi-FSR).
El siguiente cuello de botella operativo es la **planeación contra la disponibilidad real** del
personal de campo. Sin esto, toda mejora de programación arrastra el supuesto incorrecto de que
todos los FSR están disponibles todos los días.

### Cómo se ve el éxito

- El administrador no puede (sin darse cuenta) asignar trabajo con fecha objetivo en un día
  inhábil para ese FSR; recibe un error claro en español.
- Existe un catálogo de días festivos oficiales mexicanos, administrable, correcto en CDMX.
- El FSR registra sus propias vacaciones; el administrador las aprueba/rechaza y puede capturar
  incapacidades/permisos a nombre del FSR.
- La verificación de disponibilidad es una única función reutilizable, correcta en zona horaria,
  que cualquier punto de escritura futuro puede invocar.

---

## Usuarios y situaciones

| Usuario | Situación | Resultado esperado |
|---|---|---|
| **ADMINISTRADOR** | Mantiene el calendario de festivos oficiales | CRUD de Holiday en `/admin/holidays` |
| **ADMINISTRADOR** | Crea/agrega FSR a una asignación con fecha objetivo | Bloqueo si el FSR está inhábil esa fecha |
| **ADMINISTRADOR** | Captura una incapacidad/permiso a nombre de un FSR | Crea Vacation para cualquier FSR |
| **ADMINISTRADOR** | Revisa y resuelve solicitudes de vacaciones | Lista todas + aprobar/rechazar en `/admin/vacations` |
| **FSR** | Solicita sus propias vacaciones | Alta + ve sus solicitudes en `/fsr/vacations` |
| **FSR** | Registra actividad de trabajo | Bloqueo si la fecha de ejecución (`performedAt`) cae en día inhábil |

---

## Alcance

### In-scope

- Modelos nuevos: `Holiday`, `VacationStatus` (catálogo), `Vacation`.
- Cambio de schema: `Assignment.scheduledDate DateTime?` (fecha de trabajo objetivo).
- Helper central `src/lib/utils/availability.ts` → `isFsrUnavailable(userId, date)`.
- Bloqueo duro (throw) en: `createAssignment`/`updateAssignment` (al agregar FSR con
  `scheduledDate`), `createAssignmentActivity` (sobre `performedAt`).
- RBAC: permisos nuevos en seed + asignación a roles + mapa estático del middleware.
- Seed: festivos oficiales LFT Art. 74 + catálogo `VacationStatus` + permisos.
- UI (Server Components + Server Actions): admin holidays CRUD, admin vacations
  (lista + aprobar/rechazar + alta para FSR), FSR vacations (propias + alta).
- Detección de solapamiento al crear vacaciones (rechazo de la nueva si pisa
  PENDIENTE/APROBADA del mismo FSR).

### Out-of-scope (non-goals)

- Medio día / granularidad horaria de vacaciones.
- Auto-reasignación de asignaciones existentes al aprobar una vacación.
- Notificación de aprobación/rechazo de vacaciones (depende del gap de notificaciones, 08).
- Jornada electoral auto-seedable (el admin la captura manual como festivo one-time).
- Vacaciones por días no contiguos (se modela por RANGO inclusivo, no por días sueltos).
- Bloqueo del FSR al habilitarlo en el incidente (`IncidentAssignee`): NO se bloquea aquí
  porque el incidente no tiene fecha de trabajo propia (ver Reglas de negocio · decisión a
  confirmar en diseño).
- Modificar la métrica de *time-to-seen* o la máquina de estados de asignación.

---

## Reglas de negocio

### Modelos

**Holiday** — un día festivo. Se modela por regla:
- Festivo de fecha fija: `month` + `day` (ej. 1-ene, 1-may, 16-sep, 25-dic).
- Festivo de n-ésimo lunes: `month` + `nthMonday` (1=primer, 3=tercer lunes).
- `isRecurring` (default true) = aplica todos los años; `false` + `year` para el festivo
  sexenal one-time (Transmisión del Poder Ejecutivo Federal, ej. 1-oct año electoral).
- `active` para soft delete.

**VacationStatus** — catálogo `PENDIENTE | APROBADA | RECHAZADA`, con `color`, siguiendo el
patrón existente `ScheduleStatus` (07). Soft delete vía `active`.

**Vacation** — ausencia de un FSR por RANGO:
- `userId` (FSR dueño), `startDate`/`endDate` **inclusive** (día completo, sin componente horario
  significativo), `reason` opcional, `statusId` (FK a VacationStatus).
- `approvedById`/`approvedAt` (quién y cuándo resolvió).
- Soft delete vía `active`.

**Assignment** — gana `scheduledDate DateTime?` (fecha de trabajo objetivo). Nullable porque
las asignaciones existentes no la tienen y porque puede crearse sin fecha definida. El bloqueo
de FSR aplica **solo** cuando `scheduledDate` está presente.

### Helper de disponibilidad

`isFsrUnavailable(userId, date): Promise<boolean>` → `true` si la fecha (comparada en **día
CDMX**, usando el patrón `mxDayRange` de `datetime.ts`) cumple cualquiera de:
1. La fecha cae en un `Holiday` activo (resolviendo reglas fija y n-ésimo-lunes en el año de la
   fecha; respetando `isRecurring`/`year` para el one-time).
2. El FSR tiene una `Vacation` **APROBADA** activa con `startDate <= date <= endDate`.

### Bloqueo duro (throw con mensaje claro en español neutro)

- **createAssignment / updateAssignment**: al asignar o agregar un FSR (`toAdd`), si la
  asignación tiene `scheduledDate` y el FSR está inhábil esa fecha → error. No se persiste.
- **createAssignmentActivity**: si el FSR (autor/assignee) está inhábil en `performedAt` → error.
- **IncidentAssignee (habilitar FSR en incidente)**: **decisión a confirmar en diseño.**
  Propuesta: NO bloquear aquí, porque el incidente no tiene fecha de trabajo propia; el
  enforcement real vive en asignación (con `scheduledDate`) y actividad (con `performedAt`).

### Alta y aprobación de vacaciones

- El FSR crea sus propias vacaciones (`vacations:create`).
- El ADMIN puede crear vacaciones para cualquier FSR (incapacidades/permisos).
- El ADMIN aprueba/rechaza (`vacations:approve`).
- **Aprobación con solapamiento de asignaciones existentes**: se aprueba **igual**; NO se
  reasigna ni se toca ninguna asignación existente (sin auto-reasignación).
- **Rechazo de solapamiento de vacaciones**: una nueva vacación que pise otra PENDIENTE o
  APROBADA del mismo FSR se **rechaza** en el alta (no se permite el solape).

### RBAC

Permisos nuevos (seed):
- `holidays:read`, `holidays:create`, `holidays:update`, `holidays:delete` → ADMIN.
- `vacations:read` → FSR + ADMIN; `vacations:create` → FSR + ADMIN;
  `vacations:approve` → ADMIN; `vacations:delete` → FSR + ADMIN.
- Mapa estático del middleware (`src/middleware.ts`): `/admin/holidays`, `/admin/vacations`
  (ADMIN), `/fsr/vacations` (FSR). Recordar: el middleware y el RBAC de DB son sistemas
  paralelos que se mantienen sincronizados manualmente (RF-101 / 01).

### Seed

Festivos oficiales LFT Art. 74: Año Nuevo (1-ene), 1er lunes de febrero, 3er lunes de marzo,
Día del Trabajo (1-may), Independencia (16-sep), 3er lunes de noviembre, Navidad (25-dic), y
el sexenal (1-oct de año electoral, como one-time `isRecurring: false`). Más el catálogo
`VacationStatus` (PENDIENTE/APROBADA/RECHAZADA con color), los permisos y su asignación a roles.

---

## Slices (stacked-to-main, ~530 líneas, 3 PRs)

### Slice 1 — Fundación (~180 líneas)
Schema (`Holiday`, `VacationStatus`, `Vacation`, `Assignment.scheduledDate`) + migración +
seed (festivos + VacationStatus + permisos + asignación a roles) + helper `isFsrUnavailable`.
Sin UI ni bloqueo aún. Entrega la base de datos y la función pura de disponibilidad.

### Slice 2 — CRUD + RBAC + UI (~270 líneas)
`holidays.ts` (admin CRUD), `vacations.ts` (alta FSR/admin, aprobar/rechazar admin, rechazo de
solapamiento), páginas admin (holidays, vacations) y FSR (vacations), actualización del mapa
estático del middleware. Entrega la gestión funcional de festivos y vacaciones end-to-end.

### Slice 3 — Integración del bloqueo (~80 líneas)
Campo `scheduledDate` en el formulario de asignación + wiring de `isFsrUnavailable` en
`createAssignment`/`updateAssignment` y `createAssignmentActivity`. Entrega el enforcement real.

**Primera rebanada y límites:** el Slice 1 es autónomo y desplegable (no cambia comportamiento
observable, solo agrega tablas/seed/helper). El bloqueo (Slice 3) no se activa hasta que existan
las acciones y el campo de fecha (Slice 2). Cada slice merge a main en orden.

---

## Archivos afectados (por slice)

### Slice 1
- `prisma/schema.prisma` — modelos `Holiday`, `VacationStatus`, `Vacation`; campo
  `Assignment.scheduledDate`; relaciones inversas en `User` (vacations, approvedVacations).
- `prisma/migrations/*` — migración generada.
- `prisma/seed.ts` — festivos LFT Art. 74, catálogo VacationStatus, permisos nuevos + roles.
- `src/lib/utils/availability.ts` — nuevo: `isFsrUnavailable`.

### Slice 2
- `src/lib/actions/holidays.ts` — nuevo: CRUD admin (soft delete).
- `src/lib/actions/vacations.ts` — nuevo: alta (FSR/admin), aprobar/rechazar (admin),
  detección/rechazo de solapamiento, soft delete.
- `src/lib/validations/*` — esquemas Zod para Holiday y Vacation (patrón del proyecto).
- `src/app/admin/holidays/` — páginas CRUD (Server Components + Server Actions).
- `src/app/admin/vacations/` — lista todas + aprobar/rechazar + alta para FSR.
- `src/app/fsr/vacations/` — propias + alta.
- `src/components/{holidays,vacations}/` — formularios/listas según patrón.
- `src/middleware.ts` — mapa estático: `/admin/holidays`, `/admin/vacations`, `/fsr/vacations`.

### Slice 3
- `src/lib/actions/assignments.ts` — wiring de `isFsrUnavailable` en
  `createAssignment`/`updateAssignment` (sobre `scheduledDate` para `toAdd`); captura de
  `scheduledDate` desde el formulario.
- `src/lib/actions/assignment-activities.ts` — `createAssignmentActivity` (sobre `performedAt`).
- `src/components/assignments/*` — campo `scheduledDate` en el formulario de asignación.

---

## Riesgos y preguntas abiertas

1. **Zona horaria CDMX en `isFsrUnavailable`** (alto). El cruce festivo/vacación debe compararse
   en día CDMX, no UTC, o habrá off-by-one. Mitigación: usar exclusivamente `mxDayRange` /
   `mxDateString` de `datetime.ts`; el patrón ya existe en el proyecto. Definir contrato exacto
   en diseño (Date instante → día CDMX).
2. **Resolver del n-ésimo lunes** (medio). Calcular "3er lunes de marzo" para el año de la fecha
   consultada en CDMX. Decidir en diseño: ¿resolver en query-time (robusto, sin mantenimiento
   anual) o seedear fechas por año (simple, requiere mantenimiento)? La propuesta favorece
   resolver en query-time desde la regla almacenada.
3. **`scheduledDate` nullable → qué pasa si no hay fecha** (medio). Si la asignación no tiene
   `scheduledDate`, no se puede evaluar disponibilidad en creación. Propuesta: NO bloquear cuando
   `scheduledDate` es null (el enforcement de actividad sobre `performedAt` cubre el día real de
   ejecución). Confirmar en diseño.
4. **Performance del chequeo en bulk** (medio). `isFsrUnavailable` se llama por FSR en
   creación/actualización (multi-FSR). Con tablas grandes, la consulta de rango de vacaciones
   necesita el índice `(startDate, endDate)` (ya previsto en el modelo). Evaluar batch en diseño
   si el N de FSR por asignación crece.
5. **Estado retroactivo al aprobar** (producto). Aprobar una vacación que solapa asignaciones
   existentes NO las reasigna ni bloquea retroactivamente (contrato cerrado). Riesgo operativo:
   un FSR aprobado de vacaciones puede seguir teniendo asignaciones con `scheduledDate` en ese
   rango. Aceptado como non-goal; el admin lo resuelve manualmente.
6. **Decisión a confirmar en diseño:** bloqueo (o no) del incident-assignee. Propuesta: no
   bloquear por falta de fecha propia.

---

## Criterios de éxito

- `isFsrUnavailable` devuelve `true` correctamente para: un día festivo fijo, un día festivo de
  n-ésimo lunes, el festivo sexenal one-time, y una fecha dentro de una vacación APROBADA — todo
  comparado en día CDMX.
- `createAssignment`/`updateAssignment` lanzan error claro en español al agregar un FSR inhábil
  cuando la asignación tiene `scheduledDate`; no persisten cambios.
- `createAssignmentActivity` lanza error claro al registrar actividad de un FSR inhábil en
  `performedAt`.
- El FSR puede dar de alta vacaciones y verlas; el admin puede listar todas, aprobar/rechazar y
  capturar a nombre de un FSR.
- Una nueva vacación que solapa una PENDIENTE/APROBADA del mismo FSR es rechazada en el alta.
- Aprobar una vacación que solapa asignaciones existentes la aprueba sin tocar las asignaciones.
- Seed crea los 8 festivos LFT, el catálogo VacationStatus y los permisos asignados a roles.
- El middleware permite `/admin/holidays` y `/admin/vacations` a ADMIN y `/fsr/vacations` a FSR.

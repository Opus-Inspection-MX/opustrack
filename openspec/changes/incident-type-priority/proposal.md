# Proposal: Incident Type Priority (1–10)

## Intent

Hoy el dashboard miente: `criticalIncidents` ejecuta la MISMA query que `activeIncidents`
(`src/lib/actions/dashboard.ts`), así que el conteo de "críticos" siempre iguala al de
activos y no aporta información (deuda técnica registrada en spec/00 y spec/09 RF-500). La
causa raíz: `IncidentType` no tiene ninguna noción de prioridad/criticidad, por lo que no
existe forma de distinguir qué incidentes importan más. El administrador no puede triar:
todos los incidentes se ven iguales en listas, tracking y reportes.

Este cambio agrega una **prioridad numérica obligatoria (1–10) a cada tipo de incidente**,
define "crítico" como `priority >= 8`, arregla la métrica del dashboard y hace la prioridad
visible donde el administrador decide.

## Scope

### In Scope
- `IncidentType.priority Int` (1–10, **NOT NULL**) en schema + migración.
- Migración: filas existentes reciben `priority = 5`; seed asigna valores reales a los ~20 tipos.
- Constante `CRITICAL_PRIORITY_THRESHOLD = 8` en `src/lib/constants/`.
- Dashboard: `criticalIncidents` = incidentes ACTIVOS (`active:true`, `status.name != "CERRADO"`)
  cuyo tipo tiene `priority >= 8`. Deja de duplicar `activeIncidents` (idealmente en el `Promise.all`).
- Admin setea la prioridad en el formulario del tipo (campo numérico 1–10, Zod `min(1).max(10)`).
- Badge de prioridad (muestra el NÚMERO; color por rango — el rango/color lo define diseño) en:
  tabla de tipos, listas de incidentes, módulo de tracking y reportes.
- Actualizar spec/03 (modelo IncidentType + RF-213) y spec/09 (RF-500).

### Out of Scope (Non-Goals)
- NO crear un modelo catálogo `IncidentPriority` ni una sección CRUD de prioridades. La
  prioridad es un entero fijo en el tipo, no una entidad administrable aparte.
- NO etiquetas "Alto/Bajo/Crítico" como valores: la escala es **numérica 1–10**.
- NO el rediseño de consistencia de pantallas de catálogo (buscador + acciones con iconos):
  eso es el cambio separado `catalog-screens-consistency`. Aquí la tabla de tipos SOLO suma
  la columna de prioridad; no se reestiliza.
- NO cambiar el bulk import: la prioridad vive en el tipo, no en la fila del incidente.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `incidents`: RF-213 (catálogo de tipos) gana el campo `priority` obligatorio (1–10) en el
  modelo `IncidentType` y su formulario.
- `reportes-tracking`: RF-500 redefine `criticalIncidents` como incidentes activos cuyo tipo
  tiene `priority >= 8` (deja de duplicar `activeIncidents`).

## Approach

Campo entero directo sobre `IncidentType` (NO catálogo). "Crítico" es una constante de código
(`CRITICAL_PRIORITY_THRESHOLD = 8`), no un dato administrable, porque es una regla de negocio
estable. El dashboard filtra `type: { priority: { gte: 8 } }` reusando el patrón de filtro
relacional ya presente. El badge muestra el número; el color se deriva por rango (definido en
diseño). La migración usa default `5` para no romper el `NOT NULL` sobre datos existentes; el
seed sobrescribe con valores reales por tipo.

## Affected Areas

| Area | Impacto | Descripción |
|------|---------|-------------|
| `prisma/schema.prisma` | Modificado | `IncidentType.priority Int` NOT NULL |
| migración generada (`npm run db:migrate`) | Nuevo | Add column con default `5` para filas existentes |
| `prisma/seed.ts` | Modificado | Tipo del array `incidentTypes` + valores de priority para ~20 tipos |
| `src/lib/constants/` (nuevo o existente) | Nuevo | `CRITICAL_PRIORITY_THRESHOLD = 8` |
| `src/lib/actions/lookups.ts` | Modificado | `IncidentTypeFormData` + create/update + transform de query |
| `src/lib/validations/` (tipos) | Modificado/Nuevo | Zod `priority: z.number().int().min(1).max(10)` |
| `src/components/incident-types/incident-type-form.tsx` | Modificado | Campo numérico 1–10 (schema inline + UI) |
| `src/components/incident-types/incident-type-table.tsx` | Modificado | Columna/badge de prioridad |
| `src/lib/actions/dashboard.ts` | Modificado | Fix `criticalIncidents` con `priority >= 8` |
| Listas de incidentes (componentes) | Modificado | Badge de prioridad junto al tipo |
| Tracking (`src/lib/actions/tracking.ts` + UI) | Modificado | Exponer/mostrar priority del tipo |
| Reportes (`src/lib/actions/reports.ts` + UI) | Modificado | Mostrar priority en vistas por tipo |
| `spec/03-incidentes.md` | Modificado | Modelo IncidentType + RF-213 |
| `spec/09-reportes-tracking.md` | Modificado | RF-500 criticalIncidents |

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Migración NOT NULL sobre datos existentes | Media | Add column con DB default `5`; seed asigna valores reales. Verificar que el `add column` no falle en prod con filas existentes |
| PR grande por visibilidad amplia (tabla, listas, tracking, reportes, dashboard) | Alta | Candidato a slices: (1) schema+migración+seed+constante+validación+dashboard fix; (2) form + tabla de tipos; (3) badges en listas/tracking/reportes. Decisión de slicing en fase tasks |
| Color por rango sin definir | Baja | Diseño define rangos/colores; el badge muestra el número aunque el color quede pendiente |
| Tipo "Desconocido" obtiene priority por default | Baja | Default `5` (no crítico); seed puede fijar valor bajo explícito si el dominio lo pide |

## Rollback Plan

Revertir es seguro: el campo es aditivo. Para revertir, migración inversa que dropea la
columna `priority` y revertir el commit (dashboard vuelve a su query previa, badges y form
desaparecen). No hay borrado de datos de incidentes — solo se pierde el valor de prioridad
por tipo. Si solo falla el dashboard fix, se puede revertir esa función sin tocar el schema.

## Dependencies

- Ninguna externa. La fase de diseño debe definir los rangos numéricos → color del badge.

## Success Criteria

- [ ] `IncidentType.priority` existe como `Int` NOT NULL (1–10) y la migración corre limpia sobre datos existentes (default 5).
- [ ] Seed asigna prioridades reales a los ~20 tipos; "Desconocido" tiene un valor definido.
- [ ] Admin puede setear/editar la prioridad (1–10) desde el formulario del tipo; Zod rechaza fuera de rango.
- [ ] `criticalIncidents` del dashboard cuenta solo incidentes activos con `type.priority >= 8` y ya NO iguala a `activeIncidents`.
- [ ] El número de prioridad es visible (badge) en tabla de tipos, listas de incidentes, tracking y reportes.
- [ ] spec/03 y spec/09 reflejan la nueva regla.

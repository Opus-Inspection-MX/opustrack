# Propuesta · catalog-screens-consistency

> SDD · Fase PROPOSE · Change: `catalog-screens-consistency`
> Artifact store: hybrid (engram `sdd/catalog-screens-consistency/proposal` + este archivo)
> Insumo: exploración `sdd/catalog-screens-consistency/explore` (engram #47)

---

## 1. Intent · Problema y por qué ahora

OpusTrack tiene **16 pantallas de catálogo** en el área admin, cada una con su propio
componente de tabla. No existe abstracción de tabla compartida: conviven dos patrones
históricos ("Settings" / "Admin entity") que divergen en lenguaje de encabezados
(inglés vs español), forma de las acciones de fila (botones-icono vs menú de 3 puntos),
componente de paginación (`ui/pagination` vs `common/table-pagination`), presencia o
ausencia de búsqueda, y badges de estado activo (variantes shadcn vs strings de clases
inline). Las 30 confirmaciones de borrado usan `window.confirm()` nativo (no accesible,
no styleable, no testeable).

El resultado es una experiencia inconsistente para el administrador y deuda técnica que
encarece cada cambio: tocar "una tabla" significa tocar N tablas distintas.

**Por qué ahora:** el catálogo de pantallas ya está estabilizado (los dominios están
specados 01–09), la divergencia es medible (ver inventario) y no hay tests de regresión
visual que la protejan — cuanto más crezca el área admin, más caro será unificarla.

**Cómo se ve el éxito:** una pantalla de catálogo migrada se construye declarando
columnas + acciones sobre un único `CatalogTable`; las acciones son iconos accesibles
(tooltip + `aria-label`); la búsqueda es server-side uniforme; el borrado pide
confirmación con un diálogo accesible; los encabezados están en español neutro; y se
elimina la doble paginación, el componente de paginación duplicado y el `roles-table`
duplicado.

---

## 2. Usuarios y situaciones

- **Administrador** (rol `ADMINISTRADOR`): consume todas las pantallas de catálogo;
  busca, pagina, ve/edita/borra registros, y en Roles gestiona permisos. Es el usuario
  directo y el principal beneficiario de la consistencia.
- **Equipo de desarrollo**: mantiene 16 tablas hoy; tras la migración mantiene un
  componente y configuraciones declarativas por pantalla. Beneficiario de la reducción
  de deuda.
- **Usuarios de teclado / lectores de pantalla**: el reemplazo de `window.confirm()` por
  un diálogo accesible y las acciones con `aria-label` mejoran la accesibilidad.

Momento de uso: tareas de administración del sistema (alta/baja/edición de catálogos),
generalmente desde escritorio; Vehículos también desde móvil (layout de tarjetas).

---

## 3. Scope

### In-scope

- **Fundación reutilizable**:
  - `src/components/common/catalog-table/` — `CatalogTable` (columnas por render-prop +
    acciones-icono + búsqueda opcional + paginación controlada por el page).
  - `src/components/ui/confirm-dialog.tsx` — diálogo de confirmación accesible que
    reemplaza `window.confirm()` en pantallas migradas.
- **Búsqueda server-side** en TODOS los catálogos migrados. Upgrade de los server actions
  que hoy no la tienen para aceptar `{ page, limit, search }` y devolver
  `{ data, pagination: { total, page, limit, totalPages } }`:
  states (`getStatesAdmin`), lines (`getLines`), equipments, roles (`getRoles`),
  users (`getUsers`), parts (`getParts`). Búsqueda por **id + nombre + el campo obvio**
  de cada catálogo (p. ej. email en usuarios).
- **Acciones por fila como ICONOS**: Eye (ver), Pencil (editar), Trash2 (eliminar), con
  tooltip + `aria-label`. El componente soporta **acciones extra** (Roles conserva
  "Permisos" con icono Shield dentro del patrón).
- **Confirmación de borrado** vía `confirm-dialog` en pantallas migradas.
- **Encabezados de columna** normalizados a **español neutro**.
- **Migración por pantallas** (slices 1–4): status catalogs, incident catalogs,
  geográficos/estructurales, inventario + roles/users.
- **Vehículos** (slice 5): permanece como componente **custom** (su layout de tarjetas en
  móvil no entra al genérico) PERO se actualiza para usar **acciones con iconos** en vez
  de menú de 3 puntos.
- **Deuda resuelta durante la migración**:
  - Bug de doble paginación en pantallas Pattern A → la paginación la maneja el page.
  - Consolidar el `roles-table` duplicado (2 rutas → 1).
  - Deprecar `common/table-pagination.tsx` en favor de `ui/pagination.tsx`.
  - Preservar el banner de warning de la máquina de estados en `assignment-status`.

### Out-of-scope (Non-goals)

- **Permissions** (`/admin/permissions`): usa datos mock; **excluido**. Se migrará en un
  cambio futuro que primero conecte la pantalla a la DB. Migrarla ahora sería trabajo
  cosmético sin backing real.
- **Rediseño visual** más allá de tabla / buscador / acciones.
- **Sorting de columnas** (a menos que ya exista en una pantalla concreta).
- **Tests de regresión visual automatizados**.
- **Reescritura del layout de tarjetas de Vehículos** (se preserva; solo cambian las
  acciones a iconos).

---

## 4. Reglas de negocio (contrato cerrado)

Estas reglas están **cerradas con el usuario** y no se reabren en fases posteriores:

1. **Componente único**: las pantallas migrables usan `CatalogTable`. Vehículos es la
   única excepción justificada (layout de tarjetas móvil), pero adopta acciones-icono.
2. **Búsqueda = server-side, sin excepciones** en catálogos migrados. Nada de filtrado
   client-side sobre dataset completo.
3. **Campo de búsqueda por catálogo**: id + nombre + el campo obvio del catálogo.
4. **Acciones = iconos**, nunca menú de 3 puntos, en todas las pantallas migradas y en
   Vehículos. Iconos canónicos: Eye / Pencil / Trash2 (+ Shield para Permisos en Roles).
   Toda acción-icono lleva tooltip y `aria-label`.
5. **Borrado = confirm-dialog accesible**, nunca `window.confirm()` en pantallas migradas.
6. **Encabezados en español neutro** (artefacto técnico en español neutro/profesional, no
   rioplatense).
7. **Paginación**: controlada por el page; un solo componente (`ui/pagination.tsx`).
8. **Preservación obligatoria**: el banner de warning de la máquina de estados en
   `assignment-status` debe sobrevivir a la migración intacto.
9. **RBAC intacto**: la migración NO toca los checks de autorización (`requireRouteAccess`,
   `requirePermission`); cada server action upgradeado conserva su guard. (Regla
   transversal 2 del overview.)
10. **Soft delete intacto**: el borrado sigue siendo `active: false` con validación de
    hijos activos donde ya exista. La migración es de UI/búsqueda, no de semántica de datos.

---

## 5. Enfoque y rationale

**Approach A (recomendado en el explore): construir `CatalogTable` primero, migrar en
batches.** Se descartan:
- **B (solo arreglar acciones inline)**: resuelve la mitad del problema; deja búsqueda y
  paginación inconsistentes y código duplicado.
- **C (TanStack Table u otra lib headless)**: dependencia pesada y sobredimensionada para
  listas de catálogo simples; sorting/filtering avanzados no están en alcance.

La API de `CatalogTable` (del explore) usa **columnas como render-prop** (sin restricción
sobre qué muestra cada celda), **acciones declarativas** con `icon/label/onClick/variant/
disabled` y soporte de acción extra, **búsqueda opcional** (se omite el prop para ocultarla)
y **paginación controlada** (el estado vive en el page, eliminando la doble paginación de
raíz). Esto hace que cada migración sea declarativa y de bajo riesgo una vez probada la
fundación.

**Orden de migración** por riesgo creciente: primero los catálogos que ya tienen
icon-buttons + search server-side (status), luego los que ya tienen search pero usan
dropdown (incident), luego los que requieren upgrade de server action (geográficos),
luego inventario + roles/users (acción extra + consolidación de duplicado), y por último
Vehículos (custom). Esto deja el cambio más arriesgado al final y permite cortar en
cualquier slice sin dejar el sistema inconsistente dentro de un dominio.

---

## 6. Slices (encadenados stacked-to-main)

Estrategia de entrega: **stacked-to-main**, ~6 PRs, ~1,900–2,200 líneas totales.
Cada slice es entregable de forma independiente y deja el área en estado coherente.

| # | Slice | Contenido | Dependencias | Líneas aprox. |
|---|-------|-----------|--------------|----------------|
| 0 | **Fundación** | `CatalogTable` + `confirm-dialog`. Unificar paginación (reusar `ui/pagination.tsx`, marcar deprecación de `common/table-pagination.tsx`). **Sin migración de pantallas → cero regresión.** | ninguna | ~200–250 |
| 1 | **Status catalogs** | Migrar `GenericStatusTable`: user-status, equipment-status, assignment-status, line-status, vehicle-status, vehicle-trip-status. Ya tienen search server-side. **Resolver doble paginación. Preservar banner de assignment-status.** | Slice 0 | ~300–350 |
| 2 | **Incident catalogs** | incident-types, incident-status. Ya tienen search server-side; solo upgrade de confirmación + acciones-icono. | Slice 0 | ~200–250 |
| 3 | **Geográficos/estructurales** | states, lines, equipments. **Upgrade de server actions** a `{ page, limit, search }`. | Slice 0 | ~300–350 |
| 4 | **Inventario + roles/users** | parts, roles (acción extra **Permisos**/Shield), users. **Upgrade de actions** (`getParts`, `getRoles`, `getUsers`). **Consolidar `roles-table` duplicado.** | Slice 0 | ~400–500 |
| 5 | **Vehículos** | Actualizar a acciones-icono. **Queda custom** (no `CatalogTable`); se preserva layout de tarjetas móvil. | Slice 0 (confirm-dialog) | ~300–400 |

### Primera rebanada (Slice 0) — límites

**Entrega:** `CatalogTable` + `confirm-dialog` construidos, probados de forma aislada, con
la paginación unificada disponible y `common/table-pagination.tsx` marcado como deprecado.

**Límite explícito:** Slice 0 **no migra ninguna pantalla** y **no borra**
`common/table-pagination.tsx` (las pantallas Pattern B aún lo usan hasta sus slices). La
eliminación física del componente deprecado ocurre cuando ningún consumidor lo referencie
(después del último slice que lo usaba). Verificación de cierre: la app compila, las
pantallas existentes no cambian de comportamiento, y los nuevos componentes tienen su
contrato (props) estable para que los slices 1–5 los consuman sin re-trabajo.

---

## 7. Archivos afectados (por slice)

**Nuevos (Slice 0):**
- `src/components/common/catalog-table/` (index/`catalog-table.tsx` y subcomponentes)
- `src/components/ui/confirm-dialog.tsx`

**Slice 1 — status:**
- `src/components/settings/generic-status-table.tsx`
- `src/components/user-status/user-status-table.tsx`
- Pages: `src/app/admin/user-status/`, `src/app/admin/settings/{equipment,assignment,line,vehicle,vehicle-trip}-status/`

**Slice 2 — incident:**
- `src/components/incident-types/incident-type-table.tsx`
- `src/components/incident-status/incident-status-table.tsx`
- Pages correspondientes en `src/app/admin/incident-types/`, `.../incident-status/`

**Slice 3 — geográficos:**
- `src/components/states/state-table.tsx`, `src/components/lines/line-table.tsx`, `src/components/equipments/equipment-table.tsx`
- Server actions: `src/lib/actions/lookups.ts` (`getStatesAdmin`), `src/lib/actions/lines.ts` (`getLines`), `src/lib/actions/equipments.ts` (si existe)
- Pages: `src/app/admin/{states,lines,equipments}/`

**Slice 4 — inventario + roles/users:**
- `src/components/admin/parts/parts-table.tsx`
- `src/components/roles/role-table.tsx` **+** `src/components/admin/roles/roles-table.tsx` (consolidar a uno)
- `src/components/admin/users/users-table.tsx`
- Server actions: `src/lib/actions/parts.ts` (`getParts`), `src/lib/actions/roles.ts` (`getRoles`), `src/lib/actions/users.ts` (`getUsers`)
- Pages: `src/app/admin/{parts,roles,users}/`

**Slice 5 — vehículos:**
- `src/components/vehicles/vehicle-table.tsx` (solo acciones → iconos; preserva tarjetas)
- Page: `src/app/admin/vehicles/`

**Deprecación transversal:**
- `src/components/common/table-pagination.tsx` (deprecado en Slice 0; eliminado tras el último consumidor)

---

## 8. Riesgos

1. **Superficie grande**: 16 pantallas / 24+ archivos en 6 PRs, **sin** tests de regresión
   visual. Mitigación: slices pequeños y verificables; el orden deja lo riesgoso al final.
2. **Regresiones sin red visual**: cada migración cambia markup. Mitigación: verificación
   manual por slice + contrato de props estable desde Slice 0.
3. **Doble paginación** (Pattern A): el page y la tabla mantienen estado de paginación
   simultáneo. Mitigación: `CatalogTable` es controlado; el estado se elimina de la tabla
   en la migración (Slice 1).
4. **`roles-table` duplicado** en dos rutas: riesgo de migrar el equivocado o dejar uno
   huérfano. Mitigación: auditar y consolidar en Slice 4 antes de migrar.
5. **Banner de assignment-status**: warning crítico de acoplamiento con la máquina de
   estados; debe sobrevivir. Mitigación: regla de negocio 8 + checklist explícito en Slice 1.
6. **Upgrade de 7 server actions** a `{ page, limit, search }`: cambia contrato de retorno
   (de array crudo a `{ data, pagination }`); todos los consumidores actuales deben
   ajustarse en el mismo slice. Riesgo de romper páginas no migradas si el cambio se
   filtra. Mitigación: cada upgrade va junto a su pantalla en su slice; preservar el guard
   RBAC de cada action.
7. **Vehículos custom**: al quedar fuera de `CatalogTable`, su consistencia depende de
   replicar el patrón de iconos a mano. Mitigación: reutilizar `confirm-dialog` y los
   mismos iconos/labels.
8. **Eliminación tardía de `table-pagination.tsx`**: si queda un consumidor olvidado, el
   archivo no se puede borrar. Mitigación: borrar solo tras grep de cero referencias.

---

## 9. Criterios de éxito

- Existen `CatalogTable` y `confirm-dialog` con API estable y sin migrar pantallas (Slice 0).
- Todas las pantallas migradas: acciones-icono accesibles (tooltip + `aria-label`),
  búsqueda server-side, confirmación por diálogo, encabezados en español neutro.
- Los 6 server actions sin search hoy aceptan `{ page, limit, search }` y devuelven
  `{ data, pagination }`, conservando su guard RBAC.
- Cero `window.confirm()` en pantallas migradas.
- Una sola fuente de paginación (`ui/pagination.tsx`); `common/table-pagination.tsx`
  deprecado y finalmente eliminado sin consumidores.
- `roles-table` consolidado a un único componente.
- El banner de la máquina de estados en `assignment-status` persiste.
- Vehículos usa acciones-icono conservando su layout de tarjetas.
- Permissions queda intacto (excluido) sin romperse.

---

## Proposal question round (opcional)

El contrato ya cierra las 6 open questions del explore (iconos, server-side search,
campos de búsqueda, confirm-dialog, scope de vehículos/permisos, acción extra de roles).
No quedan decisiones de producto abiertas. Si el usuario quisiera afinar antes de specs,
los puntos revisables serían: (a) el set exacto de "campo obvio" de búsqueda por catálogo
(p. ej. en vehículos sería matrícula/make/model — pero vehículos queda custom y fuera de
search server-side genérica salvo que se decida lo contrario), y (b) si la deprecación de
`table-pagination.tsx` debe forzar su eliminación dentro de este change o puede quedar para
limpieza posterior. Ambos son afinables en `sdd-spec`/`sdd-design` sin reabrir el contrato.

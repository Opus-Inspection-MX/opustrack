# 05 · Partes e Inventario

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

El módulo de **partes e inventario** gestiona los componentes y materiales utilizados por los FSR durante la ejecución de asignaciones. El sistema mantiene stock en tiempo real: cada vez que un FSR usa una parte en campo, el inventario se decrementa automáticamente; si se elimina el registro de uso, el stock se restaura. También captura un snapshot del precio vigente en el momento del uso.

---

## Modelo de datos

### Part

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `name` | `String` (unique) | Nombre único de la parte |
| `description` | `String?` | Descripción opcional |
| `price` | `Float` | Precio unitario actual |
| `stock` | `Int` | Stock disponible actual (nunca negativo) |
| `active` | `Boolean` | Soft delete |

> **Nota:** El schema de Prisma actual no tiene `clienteId` en el modelo `Part`, pero el schema de validación Zod (`PartCreateSchema`) incluye `clienteId` como campo requerido. Esta discrepancia indica que la implementación de la vista de partes en la acción `getAvailableParts` filtra por `clienteId` a nivel de consulta, pero el modelo en BD no persiste ese vínculo. Ver sección de inconsistencias.

### WorkPart

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `partId` | `String` | FK → Part |
| `quantity` | `Int` | Cantidad utilizada (≥ 1) |
| `description` | `String?` | Nota opcional sobre el uso |
| `price` | `Float` | **Snapshot del precio** de `Part.price` al momento de crear el registro |
| `assignmentId` | `String?` | FK opcional → Assignment |
| `activityId` | `String?` | FK opcional → AssignmentActivity |
| `active` | `Boolean` | Soft delete |

Un `WorkPart` puede estar vinculado a una asignación, a una actividad específica de esa asignación, o a ambas.

---

## Requisitos funcionales

### RF-300 · Gestión de catálogo de partes (CRUD)

**Descripción:** El administrador mantiene el catálogo de partes disponibles para uso en campo.

**Reglas de negocio:**
- Requiere permisos: `parts:create`, `parts:read`, `parts:update`, `parts:delete`.
- `name` es único a nivel de la tabla (constraint de BD).
- `price` debe ser positivo; `stock` debe ser un entero no negativo.
- La eliminación es soft delete (`active: false`). No existe validación de registros `WorkPart` activos antes de eliminar la parte (el borrado se hace directamente).
- El listado `getParts()` no está filtrado por Cliente; devuelve todas las partes activas (vista de almacén global).

---

### RF-301 · Stock con decremento automático al registrar uso

**Descripción:** Cuando un FSR registra el uso de una parte en una asignación, el stock de esa parte se decrementa de forma atómica en la misma transacción de base de datos.

**Reglas de negocio:**
- La operación completa (decremento de stock + creación de `WorkPart`) se ejecuta dentro de `prisma.$transaction`.
- El decremento se hace con `updateMany` con condición `stock: { gte: quantity }`. Si `updateMany` devuelve `count === 0`, significa que el stock es insuficiente y se lanza error descriptivo; ningún registro se crea.
- El precio registrado en `WorkPart.price` es el `Part.price` vigente en el momento de la transacción (snapshot), no un vínculo dinámico.
- Requiere permiso `assignments:update`.
- No se puede registrar uso si la incidencia padre está en `CERRADO` o `CANCELADA`.

**Escenario crítico — decremento de stock:**
- DADO que la Parte "Filtro de aceite" tiene `stock = 3` y `price = 150.00`.
- CUANDO un FSR registra el uso de 2 unidades en la asignación A-001.
- ENTONCES `Part.stock` = 1, se crea `WorkPart` con `quantity = 2`, `price = 150.00` (snapshot), y ambas operaciones se confirman o revierten juntas.

- DADO que la Parte "Filtro de aceite" tiene `stock = 1`.
- CUANDO un FSR intenta registrar 3 unidades.
- ENTONCES se lanza `"Stock insuficiente. Disponible: 1, Solicitado: 3"` y ni el stock ni el WorkPart cambian.

---

### RF-302 · Restauración de stock al eliminar uso

**Descripción:** Cuando se elimina (soft delete) un registro `WorkPart`, el stock de la parte correspondiente se restaura de forma atómica.

**Reglas de negocio:**
- La operación completa (restauración de stock + soft delete del `WorkPart`) se ejecuta dentro de `prisma.$transaction`.
- Se usa `Part.stock.increment(workPart.quantity)` — restaura exactamente la cantidad que se decrementó.
- Requiere permiso `assignments:delete`.
- No se puede eliminar si la incidencia padre está en `CERRADO` o `CANCELADA`.

**Escenario crítico — restauración de stock:**
- DADO que existe un `WorkPart` con `quantity = 2` para la Parte "Filtro de aceite" con `stock = 1` actual.
- CUANDO el administrador elimina ese `WorkPart`.
- ENTONCES `WorkPart.active = false` y `Part.stock` = 3 (1 + 2), ambas operaciones confirmadas juntas.

---

### RF-303 · Ajuste de stock al actualizar cantidad

**Descripción:** Al modificar la cantidad de un `WorkPart`, el sistema calcula la diferencia y ajusta el stock de la parte de forma atómica.

**Reglas de negocio:**
- Si `nuevaQuantity > cantidadActual`: se decrementa el stock por la diferencia. Si el stock es insuficiente para la diferencia, se lanza error y no se persiste nada.
- Si `nuevaQuantity < cantidadActual`: se incrementa el stock por la diferencia (liberación parcial).
- Si `nuevaQuantity === cantidadActual`: no hay ajuste de stock.
- Toda la operación es atómica dentro de `prisma.$transaction`.
- Requiere permiso `assignments:update`.

**Escenario crítico — ajuste por actualización:**
- DADO que un `WorkPart` tiene `quantity = 2` y la parte tiene `stock = 5`.
- CUANDO se actualiza la cantidad a 4 (diferencia = +2).
- ENTONCES el stock decrece a 3 y el `WorkPart.quantity` = 4.

- DADO que un `WorkPart` tiene `quantity = 4` y la parte tiene `stock = 1`.
- CUANDO se actualiza la cantidad a 2 (diferencia = −2).
- ENTONCES el stock aumenta a 3 y el `WorkPart.quantity` = 2.

---

### RF-304 · Snapshot de precio en WorkPart

**Descripción:** El precio registrado en `WorkPart` es una copia del precio de la parte en el momento del registro, no una referencia dinámica.

**Reglas de negocio:**
- `WorkPart.price` se asigna de `part.price` en la transacción de creación (lectura de `Part` seguida de creación de `WorkPart`).
- Un cambio posterior en `Part.price` no afecta los `WorkPart` ya registrados.
- No existe acción de actualización de precio en `WorkPart`; el precio es inmutable post-creación.
- Esto preserva la integridad de costos históricos para reportes.

---

### RF-305 · Disponibilidad filtrada para FSR

**Descripción:** Al seleccionar partes para una asignación, el FSR solo ve partes con stock disponible. Opcionalmente se puede filtrar por Cliente.

**Reglas de negocio:**
- La acción `getAvailableParts(clienteId?)` filtra por `active: true` y `stock: { gt: 0 }`.
- El parámetro `clienteId` es opcional; si se provee, filtra por ese Cliente.
- Requiere permiso `parts:read`.

---

### RF-306 · Ajuste manual de stock por administrador

**Descripción:** El administrador puede ajustar el stock de una parte directamente (sin crear un `WorkPart`).

**Reglas de negocio:**
- La acción `updatePartStock(id, quantity)` usa `stock.increment(quantity)`.
- `quantity` puede ser positivo (incremento) o negativo (decremento manual).
- No valida stock resultante mínimo (no tiene guard de stock negativo explícito; la validación queda a criterio del admin).
- Requiere permiso `parts:update`.

---

## Reglas transversales aplicables

- **Atomicidad obligatoria**: todas las operaciones que combinan stock + WorkPart deben ejecutarse dentro de `prisma.$transaction`. Nunca actualizar stock sin crear/modificar/eliminar el WorkPart correspondiente en la misma transacción.
- **Soft delete**: los `WorkPart` se marcan `active: false`; nunca se borran físicamente. El stock siempre se restaura en el mismo momento del soft delete.
- **Bloqueo por incidencia terminal**: ninguna operación sobre `WorkPart` es posible si la incidencia de la asignación padre está en `CERRADO` o `CANCELADA`.
- **Permisos requeridos**:
  - `parts:read` — lectura del catálogo y disponibilidad.
  - `parts:create` — crear partes.
  - `parts:update` — actualizar partes y stock manual.
  - `parts:delete` — soft delete de partes.
  - `assignments:update` — crear/actualizar `WorkPart`.
  - `assignments:delete` — eliminar `WorkPart`.
- **Cache revalidation**: mutaciones en `WorkPart` revalidan `/admin/assignments/{id}` y `/fsr/assignments/{id}`. Mutaciones en `Part` revalidan `/admin/parts` y `/admin/parts/{id}`.

---

## Inconsistencias código vs. especificación

1. **`clienteId` en `PartCreateSchema` vs. modelo Prisma**: el schema de validación Zod (`PartCreateSchema`) define `clienteId` como campo requerido, pero el modelo `Part` en `prisma/schema.prisma` no tiene ese campo. La acción `createPart` no pasa `clienteId` a Prisma. El filtro en `getAvailableParts(clienteId?)` funciona porque la parte puede estar ligada a un Cliente de forma implícita, pero no existe columna de persistencia en `Part`. Esta discrepancia puede indicar una migración pendiente o una feature diseñada pero no implementada en el schema.

2. **`deletePart` sin validación de `WorkPart` activos**: a diferencia de `deleteAssignment` (que verifica partes/actividades/adjuntos activos antes de eliminar), `deletePart` hace soft delete directo sin verificar si existen `WorkPart` activos asociados. Un soft delete de `Part` con `WorkPart` activos podría generar registros huérfanos visualmente (parte "eliminada" apareciendo en asignaciones activas).

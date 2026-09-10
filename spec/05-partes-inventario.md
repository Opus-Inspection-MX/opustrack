# 05 · Partes usadas (AssignmentItem)

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Registrar **qué se usó, cuánto y a qué costo** en cada asignación. No es un
inventario: no hay catálogo de partes, no hay stock, no hay almacén. Apuntar a
una tabla de partes con existencias significaría operar una bodega; lo que el
trabajo necesita es una lista de líneas costeadas para facturación y auditoría.

> Esta spec reemplazó a la anterior ("Partes e Inventario" con modelos `Part`
> / `WorkPart` y stock con decremento automático). Esos modelos **no existen**
> en el schema y ese comportamiento nunca se implementó.

---

## Modelo de datos

### AssignmentItem

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `assignmentId` | `String` | FK → Assignment |
| `name` | `String` | Texto libre ("Sensor de proximidad", "Manguera 1/2") |
| `quantity` | `Int` | Cantidad usada (> 0) |
| `unitPrice` | `Float` | Precio por unidad (≥ 0). El total de la línea se deriva, nunca se guarda |
| `active` | `Boolean` | Soft delete |
| timestamps | | `createdAt`, `updatedAt` |

`name` es texto libre a propósito: sin catálogo detrás.

---

## Requisitos funcionales

### RF-300 · Registro de partes usadas

**Descripción:** El FSR (o un admin) agrega líneas de partes/equipos usados a
una asignación (`assignments:update`).

**Reglas de negocio:**
- `name` no vacío (recortado), `quantity` finita > 0, `unitPrice` finito ≥ 0.
  Tres reglas devueltas (`businessRule`), no lanzadas.
- Bloqueado si la incidencia padre está en `CERRADO` o `CANCELADA`: el
  registro de una incidencia terminada es lo que se factura y audita, y debe
  dejar de moverse.
- Revalida `/fsr/assignments/{id}` y `/admin/assignments/{id}`.

### RF-301 · Baja de líneas (soft delete)

**Descripción:** Eliminar es `active: false` (`assignments:update`); quitar
una línea no borra que alguna vez estuvo ahí.

**Reglas de negocio:**
- Mismo bloqueo por incidencia terminal que la creación.
- Revalida las mismas rutas.

### RF-302 · Las partes bloquean el borrado de la asignación

**Descripción:** `deleteAssignment` rechaza asignaciones con ítems activos
(RF-250): borrar con líneas costeadas huérfanas gasto sin rastro.

### Fuera de alcance (confirmado)

- Catálogo de partes, stock, decremento/restauración automática, snapshot de
  precio contra catálogo, ajuste manual de existencias, disponibilidad por
  Cliente. Nada de eso existe; si algún día se opera una bodega, es un dominio
  nuevo, no una extensión de este.

---

## Reglas transversales aplicables

- **Soft delete** y filtro `active: true` en lecturas.
- **Bloqueo por incidencia terminal** (`assertAssignmentEditable`, mismo gate
  que actividades).
- **Reglas devueltas** vía `guarded()`; mensajes en español para el operador.
- **Revalidación** de las rutas FSR y admin de la asignación.

---

## Cobertura de pruebas

- `src/lib/actions/assignment-items.test.ts` — validaciones, bloqueo terminal,
  soft delete.
- `src/lib/actions/assignments-delete.test.ts` — RF-250: con ítems activos no
  se elimina.

---

## RF rango registrado

RF-300 – RF-349: Partes usadas (este dominio). El rango se conserva aunque el
contenido cambió de inventario a lista de uso.

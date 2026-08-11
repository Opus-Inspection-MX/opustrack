# 00 · Visión general y reglas transversales

> OpusTrack — especificación de dominio. Índice: [spec/README.md](./README.md)

Este documento define el lenguaje ubicuo, las convenciones y las reglas de negocio que
**cruzan todos los dominios**. Cada spec de dominio (01–09) asume lo establecido aquí y no
lo repite.

---

## Propósito del sistema

OpusTrack es un sistema de **gestión de incidentes y órdenes de trabajo** para Centros de
Verificación Vehicular en México. El flujo central es:

```
Cliente reporta incidente
   → Administrador crea una o más Asignaciones (órdenes de trabajo) y habilita FSRs
      → FSR da "Visto", inicia trabajo en sitio (GPS), documenta actividades y partes, cierra
         → El incidente se cierra AUTOMÁTICAMENTE cuando todas sus asignaciones cierran
```

---

## Lenguaje ubicuo (glosario)

| Término | Significado en el código | Notas |
|---------|--------------------------|-------|
| **Cliente** | Centro de Verificación Vehicular (modelo `Cliente`) | Unidad organizacional central. **Reemplaza al antiguo "VIC"**. |
| **State** | Estado de la República (modelo `State`) | Nivel geográfico sobre el Cliente. No confundir con "estado/status" de una entidad. |
| **Línea** (`Line`) | Línea de inspección dentro de un Cliente | |
| **Equipo** (`Equipment`) | Equipo físico dentro de una línea | |
| **Incidente** (`Incident`) | Falla o evento reportado | Su estado es **siempre derivado** de sus asignaciones (salvo cancelación). |
| **Asignación** (`Assignment`) | Orden de trabajo que un FSR ejecuta para resolver un incidente | **Reemplaza al antiguo "WorkOrder"**. Relación 1→N desde el incidente. |
| **FSR** | Field Service Representative — técnico de campo | Rol de usuario y ejecutor de asignaciones/viajes. |
| **Visto** (`seenAt`/`seenById`) | Primer acuse de recibo del FSR sobre una asignación | Base de la métrica *time-to-seen* y de la máquina de estados de asignación. |
| **Folio** | Número interno autoincremental único de la asignación | Distinto del folio ODT externo. |
| **ODT folio** (`odtFolio`) | Folio capturado de un sistema externo (RF-010) | Texto, opcional. |
| **Viaje** (`VehicleTrip`) | Recorrido de un vehículo conducido por un FSR | Odómetro + foto + GPS al inicio y fin. |
| **Programación** (`Schedule`) | Agenda/calendario que vincula clientes e incidentes | UI en `/admin/programacion`. |

---

## Roles y acceso

| Rol | Alcance | defaultPath |
|-----|---------|-------------|
| **ADMINISTRADOR** | Acceso omnipotente a todas las rutas y recursos. No ligado a ningún Cliente. | `/admin` |
| **FSR** | Usuario operativo del sistema; ejecuta asignaciones y viajes. Ligado a Cliente(s). | `/fsr` |
| **CLIENT** | Levanta incidentes desde su Cliente; permisos de creación acotados. | `/client` |
| **GUEST** | Solo lectura, sin permisos de creación. | `/guest` |

El detalle del modelo RBAC (database-driven, JWT + Edge Runtime, caché de permisos) está en
[01 · Autenticación y RBAC](./01-auth-rbac.md).

---

## Convención de requisitos (RF-XXX)

Los requisitos se numeran `RF-NNN` y se agrupan por dominio en rangos. Los IDs **RF-010** y
**RF-025** son **históricos**: ya existían referenciados en el código (comentarios del schema)
y se preservan con su número original aunque queden fuera del rango de su dominio.

| Rango | Dominio | Spec |
|-------|---------|------|
| RF-010 *(histórico)* | Folio ODT externo | [04](./04-asignaciones.md) |
| RF-025 *(histórico)* | FSRs habilitados por incidente | [03](./03-incidentes.md) |
| RF-100 – RF-149 | Autenticación y RBAC | [01](./01-auth-rbac.md) |
| RF-150 – RF-199 | Clientes y jerarquía | [02](./02-clientes-jerarquia.md) |
| RF-200 – RF-249 | Incidentes | [03](./03-incidentes.md) |
| RF-250 – RF-299 | Asignaciones | [04](./04-asignaciones.md) |
| RF-300 – RF-349 | Partes e inventario | [05](./05-partes-inventario.md) |
| RF-350 – RF-399 | Vehículos y viajes | [06](./06-vehiculos-viajes.md) |
| RF-400 – RF-449 | Programación | [07](./07-programacion.md) |
| RF-450 – RF-499 | Notificaciones | [08](./08-notificaciones.md) |
| RF-500 – RF-549 | Reportes, tracking y dashboard | [09](./09-reportes-tracking.md) |
| RF-700 – RF-749 | Festivos y vacaciones | [10](./10-festivos-vacaciones.md) |

**Al agregar un requisito nuevo**: usá el siguiente número libre dentro del rango del dominio.
No reutilices números ni renumeres requisitos existentes (se referencian de forma cruzada).

---

## Reglas transversales (aplican a todos los dominios)

1. **Soft delete obligatorio.** Ningún registro se borra físicamente: se setea `active: false`.
   Toda consulta de negocio filtra `where: { active: true }`. Antes de desactivar un padre, se
   valida que no existan hijos activos (con asimetrías conocidas — ver Deuda técnica).

2. **RBAC database-driven.** No hay checks de permiso hardcodeados. Cada página usa
   `requireRouteAccess()`, cada API/Server Action usa `requirePermission()` / `requireAction()`
   o sus wrappers. ADMINISTRADOR pasa todos los checks.

3. **JWT + Edge Runtime.** El middleware enruta con datos del JWT (rápido, sin DB). Las rutas
   permitidas del rol (`Permission.routePath`) se embeben en el token al iniciar sesión y se
   evalúan con `canAccessRoute()` (`src/lib/authz/route-access.ts`), el mismo matcher que usa
   `roleCanAccessRoute()` en el servidor. Un token emitido antes de que existiera ese campo
   fuerza re-login en vez de degradar a permisivo. Las páginas/acciones consultan la DB para
   permisos finos. Cambios de rol/permiso requieren re-login. Detalle en
   [01](./01-auth-rbac.md).

4. **Scoping por Cliente.** Los usuarios no ADMINISTRADOR solo ven datos de su(s) Cliente(s).
   Las consultas filtran por el/los Cliente(s) asignados (`UserClienteAssignment`). Un permiso
   no implica alcance: reportes y dashboard aplican `src/lib/auth/report-scope.ts`, que falla
   cerrado (sin Cliente asignado ⇒ no ve nada). Las lecturas de datos personales
   (p. ej. vacaciones) además verifican propiedad, porque el permiso se comparte con el dueño
   del registro.

5. **Revalidación de cache.** Toda mutación llama `revalidatePath()` sobre las rutas afectadas
   (tanto `/admin/...` como las específicas del rol).

6. **El estado es derivado, no escrito a mano.** Incidentes y asignaciones tienen máquinas de
   estado (`src/lib/state-machine/`). El `statusId` no se setea desde formularios genéricos: lo
   calculan las transiciones válidas y la sincronización. La cancelación es la excepción.

7. **Almacenamiento de archivos abstracto.** Adjuntos y fotos guardan su `provider`
   (`vercel-blob` | `filesystem`) por registro, para borrar correctamente aunque cambie la config.

8. **Captura GPS en transiciones.** El inicio y cierre de trabajo en sitio (asignaciones) y el
   inicio/fin de viajes capturan latitud/longitud/dirección.

---

## Mapa de dominios

| # | Dominio | Entidades principales |
|---|---------|-----------------------|
| 01 | Autenticación y RBAC | User, Role, Permission, RolePermission, UserStatus, UserProfile, UserClienteAssignment |
| 02 | Clientes y jerarquía | State, Cliente, Line, Equipment |
| 03 | Incidentes | Incident, IncidentType, IncidentStatus, IncidentAssignee |
| 04 | Asignaciones | Assignment, AssignmentAssignee, AssignmentActivity, AssignmentAttachment |
| 05 | Partes e inventario | Part, WorkPart |
| 06 | Vehículos y viajes | Vehicle, VehicleTrip, VehicleStatus, VehicleTripStatus |
| 07 | Programación | Schedule, ScheduleCliente, ScheduleStatus |
| 08 | Notificaciones | Notification |
| 09 | Reportes, tracking y dashboard | (consume datos de todos los dominios) |
| 10 | Festivos y vacaciones | Holiday, Vacation, VacationStatus |

---

## Deuda técnica e inconsistencias conocidas

Riesgos abiertos detectados durante la revisión. No son requisitos; son candidatos a cambios
SDD futuros. Los hallazgos ya resueltos se retiran de esta lista al corregirse.

**Almacenamiento de archivos**
- El proveedor `filesystem` nombra los archivos `"<timestamp>-<nombre>"` en `public/uploads/`,
  que el middleware sirve como ruta pública. Son adivinables, a diferencia del sufijo aleatorio
  de Vercel Blob. Tratar `filesystem` como proveedor de desarrollo únicamente.

**Integridad de datos**
- `PartCreateSchema` (Zod) acepta `clienteId` opcional, pero el modelo `Part` **no tiene esa
  columna** y `createPart` no lo persiste: feature diseñada y no migrada (05). Mientras no se
  migre, ninguna consulta debe filtrar `Part` por Cliente.

**Consistencia funcional**
- `/admin/programacion` es Client Component que consume API REST, excepción al patrón
  "Server Components + Server Actions" declarado en CLAUDE.md (07).
- Las reglas de negocio que el usuario debe leer no pueden **lanzarse** desde un Server Action:
  un build de producción de Next reemplaza el mensaje por "An error occurred in the Server
  Components render". `tracking.ts` ya las **devuelve** (`{ success: false, error }`); el resto de
  las acciones sigue lanzando `Error` y esos mensajes no llegan al usuario en producción.
- `assignFSRToIncident()` (RF-514) no tiene consumidor: la asignación rápida real de
  `/admin/tracking` pasa por `createAssignment()` y `updateAssignmentAssignees()`.
- Los errores de `/admin/tracking` se comunican con `alert()`, no con el sistema de toasts del
  resto de la app.
- La página `/unauthorized` no expone su título como heading: `CardTitle` (shadcn) renderiza
  un `<div>`, así que no hay landmark de encabezado para lectores de pantalla. Aplica a toda
  pantalla que use `CardTitle` como título principal.

### Resuelto

- Middleware RBAC hardcodeado → ahora las rutas del rol viajan en el JWT y se evalúan con
  `src/lib/authz/route-access.ts`, compartido con `roleCanAccessRoute()`.
- Reportes y dashboard sin scoping por Cliente → `src/lib/auth/report-scope.ts`.
- Lectura de vacaciones sin control de propiedad; `approveVacation`/`rejectVacation` sin
  guardas de estado.
- `updateWorkPart` sin validación Zod (inflaba stock con cantidades negativas) y
  `deleteWorkPart` no idempotente (devolvía stock dos veces).
- `getAvailableParts` consultaba `Part.clienteId`, columna inexistente.
- Dashboard contaba `CANCELADA` como incidente activo/crítico.
- `updateMyPassword` no invalidaba sesión; `assignPermissionsToRole` no limpiaba la caché.
- `deleteLine` / `deletePart` sin validación de hijos activos.
- Notificaciones: los 10 tipos se disparan.
- Conteo N+1 de FSR por Cliente en el listado.
- `/uploads` quedaba detrás del middleware: con el proveedor `filesystem` ningún adjunto se
  renderizaba (next/image recibía el redirect a /login). Ahora es ruta pública, igual que los
  archivos de Vercel Blob.
- La suite e2e dejaba su contenedor vivo entre corridas: los datos de prueba se acumulaban y,
  antes del guard, una corrida contra `.env.development` (que apuntaba a Neon) dejó 4 cuentas
  `@e2e.opustrack.local` en la base real — ya eliminadas. Ahora `scripts/e2e.mjs` crea la base
  al empezar y la destruye en un `finally`, pase lo que pase.
- Suite e2e rota: credenciales del seed mock anterior + `reuseExistingServer` sobre el puerto
  3000. Ahora usa cuentas propias (`e2e/db.setup.ts`), su propio puerto (3100) y una base
  efímera en Docker cuya invariante verifica `assertEphemeralDatabase()`.
- El flujo central (cliente reporta → admin programa y asigna → FSR cierra → auto-cierre del
  incidente) no tenía prueba de integración: ahora lo cubre `e2e/incident-lifecycle.spec.ts`.
- El diálogo de incidente de `/admin/programacion` creaba incidentes sin Cliente, invisibles para
  FSR, CLIENT y GUEST por el scoping multi-tenant. Ahora el Centro es obligatorio.
- `/admin/tracking` filtraba por día con la zona del servidor (UTC en Vercel) en vez de CDMX, y
  sus `try/catch` reemplazaban toda regla de negocio por un mensaje genérico.
- Programación y seguimiento sin cobertura: `e2e/programacion.spec.ts` y `e2e/tracking.spec.ts`
  (proyecto `flows`), más los unitarios de `schedules`, `tracking` y `api/schedules/incidents`.

---

## Nota sobre CLAUDE.md

`CLAUDE.md` describe una versión anterior del dominio (**VIC** en vez de Cliente, **WorkOrder**
en vez de Assignment). Estos specs reflejan el **código actual** y son la fuente de verdad del
dominio. CLAUDE.md sigue siendo válido para patrones de arquitectura y comandos de desarrollo.

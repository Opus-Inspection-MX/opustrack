# Plan: difusiones a usuarios específicos y ajustes de administración

> Documento para el agente implementador. Autocontenido: qué cambia, en qué
> archivos y cómo se verifica. Revisado el 2026-09-11 sobre `main` (`f5722df`),
> leyendo el código. Cada hallazgo trae su evidencia con archivo y línea.

## Alcance

Cuatro cosas pedidas, en un orden que va de lo chico y seguro a lo grande:

1. El botón "volver" no hace nada en `/notifications` (y en otras cinco rutas).
2. Un empleado no puede solicitar vacaciones sin fecha de ingreso, y quien
   administra vacaciones no puede capturarla.
3. Las difusiones programadas solo se pueden dirigir a **roles**; se necesita
   poder dirigirlas a **usuarios específicos**.
4. Inventario de lo que un administrador no puede configurar hoy en el resto
   de los módulos.

## Hallazgos verificados

### H-1. "Volver" apunta a la página donde ya estás

`useBackTarget` (`src/hooks/use-back-target.ts:27-49`) recuerda la última ruta
de **lista** visitada. Considera lista a cualquier ruta que no termine en
`new`, `edit`, un número o un cuid. `/notifications` cumple esa regla, así que
al entrar guarda `/notifications` y devuelve `/notifications`: el enlace apunta
a sí mismo y no pasa nada.

Rutas afectadas hoy (tienen `BackButton` y el heurístico las llama lista):

| Ruta | `fallback` |
|---|---|
| `/notifications` | `/` |
| `/admin/notifications` | `/admin` |
| `/admin/settings/notifications` | `/admin/settings` |
| `/admin/settings/vacation-accrual` | `/admin/settings` |
| `/admin/roles/[id]/permissions` | `/admin/roles` |

En las páginas de detalle y formulario el hook funciona bien; el problema es
solo cuando la propia página cae en la categoría "lista".

### H-2. La fecha de ingreso existe, el permiso no

- El campo **ya está** en el formulario de usuario
  (`src/components/admin/users/user-form.tsx:225-236`, "Fecha de
  Contratación") y `updateUser` lo escribe y recalcula los períodos de
  vacaciones (`src/lib/actions/users.ts:281-300, 380`).
- El problema es de acceso: `users:update`, `users:create` y la ruta
  `route:admin-users` son **exclusivos de ROOT**
  (`src/lib/authz/permission-catalog.ts:1085-1092`). ADMIN_VACACIONES, que es
  quien administra vacaciones, solo tiene `users:read`.
- El empleado ve "Este usuario no tiene fecha de contratación registrada. Un
  administrador debe capturarla…"
  (`src/components/vacations/vacation-balance-panel.tsx:191-200`), y el
  administrador de vacaciones no puede hacerlo: `/admin/users` le está negado.

O sea: no falta la pantalla, falta que el rol correcto pueda usarla.

### H-3. Las difusiones solo llegan por rol

Lo que existe hoy:

| Pieza | Dónde |
|---|---|
| Modelo `Broadcast` + join `BroadcastRole` (solo roles) | `prisma/schema.prisma` |
| Alcance del emisor (rol → roles, vía `RoleBroadcastTarget`) | `broadcasts.ts:46-80` (`getSenderBroadcastScope`) |
| Validación de la difusión | `broadcasts.ts:94-160` (`assertBroadcastInput`) |
| Crear, editar, cancelar, listar | `broadcasts.ts:225-425` |
| Vista previa de destinatarios | `broadcasts.ts:191-222` |
| Resolución de audiencia | `src/lib/notifications/audiences.ts:132-156` (`broadcastAudience`: todos o por roles) |
| Despacho con reclamo atómico | `src/lib/notifications/broadcast-dispatch.ts:44-115` |
| Compositor | `src/components/notifications/broadcast-form.tsx` (390 líneas) |
| Quién puede difundir a qué rol | `/admin/roles/[id]` + `src/components/roles/broadcast-targets-form.tsx` |

No hay ninguna tabla ni campo que ligue una difusión con usuarios concretos:
la audiencia siempre sale de `allRoles` o de `BroadcastRole`.

### H-4. Inventario: lo que el administrador no puede configurar

Verificado leyendo formularios, acciones y el catálogo de permisos.

| # | Hueco | Evidencia | Impacto |
|---|---|---|---|
| G-1 | Solo ROOT administra usuarios (crear, editar, roles, fecha de ingreso) | `permission-catalog.ts:1085-1092`; `route:admin-users` solo ROOT | Alto: es H-2, y cada alta de personal pasa por ROOT |
| G-2 | Un usuario solo puede tener **un** Cliente desde la UI | `user-form.tsx:202-220` (un select) y `users.ts:270-330` con `assignUserToClient(..., true)` (`client-assignments.ts:73-95`), que marca primario sin desactivar los demás | Alto: el modelo y el scoping soportan varios Clientes; los secundarios no se ven ni se quitan |
| G-3 | `priority` e `isSuperuser` del rol no son editables | `role-form.tsx` solo tiene nombre, descripción y `defaultPath`; `roles.ts:152, 207` no los escribe | Medio: `priority` decide en qué rol aterriza un usuario con varios roles y el orden del menú |
| G-4 | El equipo no expone `model`, `serialNumber` ni su estado | Formulario con nombre, descripción, Cliente y línea (`equipments/equipment-form.tsx`); el modelo tiene `model`, `serialNumber`, `statusId` | Medio: no se puede registrar el número de serie del equipo inspeccionado |
| G-5 | `states:read` sigue siendo ROOT-only | `permission-catalog.ts` (deuda H-06 anotada en el propio archivo) | Medio: ADMIN_OPERACION tiene `route:admin-states` y la pantalla no le carga |
| G-6 | La política de SLA está en código | `src/lib/constants/sla-policy.ts:31-45` (objetivos por banda, `SLA_AT_RISK_RATIO`, umbrales de prioridad) | Medio: cambiar un objetivo de SLA exige un deploy |
| G-7 | `VacationStatus` y `ScheduleStatus` no tienen pantalla | Los otros seis catálogos de estado sí la tienen | Bajo: son conjuntos cerrados; queda como decisión |
| G-8 | `route:admin-permissions` apunta a `/admin/permissions`, que no existe | `permission-catalog.ts:147-150`; no hay `src/app/admin/permissions` | Bajo: ruta muerta que ROOT puede abrir y recibe 404 |
| G-9 | `incidents:read` lleva `routePath: "/incidents"`, sin página | `permission-catalog.ts:200-204` | Bajo: concede un prefijo de ruta que no existe |

**Lo que sí se puede hoy** (verificado, para no perder tiempo): editar la
prioridad de un tipo de incidente (`incident-type-form.tsx:124`), abrir
festivos y reglas de acumulación como ADMIN_VACACIONES (`holidays:read` lleva
`/admin/holidays`), ajustar días por período (`vacation-balance-panel.tsx:52`,
`updatePeriodOverride`), configurar a qué roles difunde cada rol
(`/admin/roles/[id]`), la matriz de canales de notificación, y restablecer la
contraseña de un usuario desde su edición (`users.ts:269-275`, con bump de
`sessionVersion`).

## Reglas para el agente

- Lee `CLAUDE.md`, `docs/ui-patterns.md` y `spec/08-notificaciones.md`.
- **Cuatro PRs**, en el orden de abajo. Commits por paso.
- Cada PR deja verdes `npm run check`, `npm run test:unit`, `npm run test:int`
  y `npm run test:e2e`.
- Permisos: se declaran en `src/lib/authz/permission-catalog.ts` y **nada más**
  ahí; los seeds lo importan y la prueba de alcanzabilidad exige que todo
  permiso nuevo lo tenga algún rol o esté en `ROOT_ONLY`.
- Toda acción nueva que reciba un id pasa por los cargadores de
  `src/lib/auth/access.ts` o justifica su entrada en el allowlist de
  `access-contract.test.ts`.
- Reglas de negocio devueltas en español; los mensajes nuevos van con
  `rejected(...)` o `businessRule(...)` dentro de `guarded(...)`.
- Sin dependencias nuevas.
- Las migraciones siguen el patrón de
  `prisma/migrations/20260914000000_inicio_home/migration.sql` y **dicen su
  orden de despliegue** en el encabezado.

## Orden de entrega

| PR | Contenido | Riesgo | Esfuerzo |
|---|---|---|---|
| 1 | Parte A: botón volver | Bajo | S |
| 2 | Parte B: fecha de ingreso para el admin de vacaciones (G-1 parcial) | Bajo | M |
| 3 | Parte C: difusiones a usuarios específicos | Medio | L |
| 4 | Parte D: huecos de administración, por prioridad | Medio | M |

---

## Parte A: que "volver" vuelva (PR 1)

1. **`src/hooks/use-back-target.ts`:** el objetivo nunca puede ser la ruta
   actual.
   - Guardar en `sessionStorage` una **pila corta** (las últimas 3 rutas de
     lista distintas) en vez de un solo valor.
   - `useBackTarget(fallback)` devuelve la primera entrada de la pila que sea
     distinta de `pathname`; si no hay, el `fallback`.
   - Sigue siendo `sessionStorage`: pertenece a la pestaña, no a la cuenta.
2. **Fallbacks con sentido** en las cinco rutas de la tabla H-1: `/notifications`
   pasa de `/` a `/inicio` (la landing universal). Las de `/admin/settings/*`
   ya apuntan a `/admin/settings`, que es correcto.
3. **Prueba unitaria nueva** (`use-back-target.test.tsx`, jsdom):
   - Lista → detalle: devuelve la lista.
   - Estando en la lista: devuelve el `fallback`, nunca la ruta actual.
   - Dos listas seguidas y luego un detalle: devuelve la última.
   - Pestaña nueva sin historial: `fallback`.
4. **e2e**: en `e2e/inicio.spec.ts` o en un spec de navegación, entrar a
   `/inicio`, abrir `/notifications`, pulsar "Volver" y comprobar que la URL
   cambia a `/inicio`.

---

## Parte B: fecha de ingreso sin ser ROOT (PR 2)

**Decisión #1** define el alcance; el default recomendado es un permiso nuevo y
angosto, no abrir `/admin/users` entero.

1. **Permiso nuevo** en `permission-catalog.ts`: `users:manage-employment`
   ("Capturar datos laborales: fecha de ingreso"), otorgado a
   ADMIN_VACACIONES. `users:update` sigue en `ROOT_ONLY`.
2. **Migración de datos** que inserta el permiso y el grant, idempotente, con
   bump de `sessionVersion` para los miembros del rol. Orden: migración antes
   que código (es aditiva).
3. **Acción nueva** `updateUserEmployment(userId, { hireDate })` en
   `src/lib/actions/users.ts`:
   - `requirePermission("users:manage-employment")`.
   - Valida: fecha presente, no futura y no anterior a 1950 (mensajes en
     español, devueltos).
   - Extraer de `updateUser` el bloque que ya recalcula períodos al cambiar la
     fecha (`users.ts:281-300, 380`) a un helper `applyHireDateChange(tx, …)`
     que ambas acciones usen. Sin duplicar lógica de acumulación.
   - Escribe con `logAudit` y `revalidatePath` de `/admin/vacations`,
     `/vacations` y `/admin/users/[id]`.
4. **UI**: en `/admin/vacations`, cuando el usuario seleccionado no tiene
   fecha, mostrar un campo de fecha con botón "Guardar fecha de ingreso",
   visible solo con `canPerform("users:manage-employment")`. Al guardar, el
   panel de saldos se recarga y ya muestra períodos.
5. **Texto**: actualizar el vacío de `vacation-balance-panel.tsx:191-200` para
   decir quién puede capturarla ("el administrador de vacaciones").
6. **Pruebas**:
   - Unitarias: validación de fecha y permiso.
   - Integración: ADMIN_VACACIONES la captura y aparecen períodos; un FSR
     recibe rechazo; ROOT sigue pudiendo por el formulario de usuario.
   - e2e: como `admin-vacaciones@`, capturar la fecha de un empleado y
     comprobar que el empleado ya puede solicitar vacaciones.

---

## Parte C: difusiones a usuarios específicos (PR 3)

### Modelo

Tabla nueva `broadcast_users`, espejo de `broadcast_roles`:

```prisma
model BroadcastUser {
  id          Int       @id @default(autoincrement())
  broadcastId String
  broadcast   Broadcast @relation(fields: [broadcastId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  active      Boolean   @default(true)
  createdById     String?
  updatedById     String?
  deactivatedAt   DateTime?
  deactivatedById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([broadcastId, userId])
  @@index([broadcastId])
  @@index([userId])
  @@map("broadcast_users")
}
```

Migración aditiva; **orden: migración primero, código después**.

### Quién puede dirigirse a quién

El alcance por rol ya existe (`RoleBroadcastTarget`). Para usuarios sueltos, la
regla propuesta (**decisión #2**) es la más restrictiva de las dos que ya usa
el sistema:

- Un emisor puede dirigirse al usuario **U** si U tiene al menos un rol activo
  dentro de `scope.allowedRoleIds`, **y**
- si el emisor no tiene `scope:all-clients`, U comparte al menos un Cliente
  activo con él (`UserClientAssignment`).
- ROOT (`isSuperuser`) alcanza a cualquiera.

Implementación en `broadcasts.ts`, junto a `getSenderBroadcastScope`:
`assertUsersInScope(senderId, scope, userIds)`, que devuelve los ids válidos y
lanza `businessRule("No puedes difundir a uno o más de los usuarios
seleccionados")` si alguno queda fuera. **Fail closed**: sin roles alcanzables,
tampoco hay usuarios alcanzables.

### Acciones

1. `BroadcastFormInput` gana `userIds: string[]`.
2. `assertBroadcastInput`: la regla "selecciona al menos un rol" pasa a "al
   menos un destinatario" — `allRoles`, o `roleIds`, o `userIds`. Los
   `userIds` se acotan con `assertUsersInScope`.
3. `searchBroadcastRecipients(query)` nueva, para el selector: exige
   `notifications:broadcast`, mínimo 2 caracteres, tope 20 resultados,
   devuelve `{ id, name, email, roleNames }` **solo** de usuarios dentro del
   alcance. Nunca revela usuarios fuera de él.
4. `previewBroadcastRecipients`: la cuenta pasa a ser la unión sin duplicados
   de la audiencia por rol y los `userIds`, restando al emisor cuando
   `includeSender` es falso.
5. `createBroadcast` y `updateBroadcast` persisten las filas de
   `BroadcastUser`; al editar, las que se quitan se **desactivan**
   (`active: false`), igual que los roles, nunca se borran.
6. `listBroadcasts` devuelve también los usuarios (nombre y correo, tope 5 más
   "y N más") para que el historial muestre a quién se envió.

### Audiencia y despacho

- `broadcastAudience` (`audiences.ts:132`) acepta `userIds` y devuelve la
  unión, filtrando siempre `user.active`. Un usuario dado de baja entre la
  programación y el envío no recibe nada.
- `dispatchBroadcast` (`broadcast-dispatch.ts:64-80`) incluye
  `users: { where: { active: true }, select: { userId: true } }` y pasa esos
  ids a la audiencia. El reclamo atómico y `recipientCount` no cambian.
- **Nota de seguridad**: el alcance se valida al crear y al editar, no en el
  despacho. Si un usuario pierde el rol antes del envío programado, la difusión
  igual le llega. Si eso no se quiere, hay que revalidar en el despacho
  (**decisión #3**).

### UI

En `broadcast-form.tsx`, la sección de destinatarios pasa a tres modos
excluyentes, con `RadioGroup`: **Todos** (si `canTargetAll`), **Por rol** (los
checkboxes de hoy) y **Usuarios específicos**.

- El modo de usuarios usa un buscador con `Command`/`MultiSelect` contra
  `searchBroadcastRecipients`, con los elegidos como chips removibles.
- La vista previa ya existente sigue mostrando el total.
- Mantener los textos y roles accesibles que ya asierta el e2e; los nuevos
  controles llevan etiqueta en español y objetivo táctil de 44 px.

### Pruebas

- **Unitarias**: `assertBroadcastInput` con solo `userIds`; con ninguno de los
  tres; con un `userId` fuera de alcance.
- **Integración** (`src/test/integration/`): un emisor solo alcanza usuarios de
  sus roles y su Cliente; `searchBroadcastRecipients` no devuelve a nadie
  fuera; el despacho entrega la unión sin duplicados; un usuario inactivo
  queda fuera; el envío es idempotente por el reclamo.
- **e2e**: componer una difusión a un usuario específico, verla en
  `/notifications` de ese usuario y comprobar que otro usuario no la recibe.

### Documentación

`spec/08-notificaciones.md`: la audiencia deja de ser solo por rol. Documentar
la tabla nueva, la regla de alcance y el comportamiento con usuarios inactivos.

---

## Parte D: huecos de administración (PR 4)

Por prioridad; los últimos son opcionales según decisión.

1. **G-2, varios Clientes por usuario.** El select simple pasa a
   `MultiSelect`, con marca de cuál es el primario. `updateUser` sincroniza la
   tabla (alta, baja y cambio de primario) en una transacción, en lugar de solo
   `assignUserToClient(..., true)`. Prueba de integración: un usuario con dos
   Clientes ve datos de ambos y al quitarle uno deja de verlos.
2. **G-5, `states:read` para ADMIN_OPERACION.** Sacarlo de `ROOT_ONLY`,
   otorgarlo en el catálogo y en una migración de datos. Hoy ese rol abre
   `/admin/states` y la pantalla falla.
3. **G-3, `priority` del rol.** Campo numérico en `role-form.tsx` y en
   `roles.ts`, con ayuda que explique que decide la landing y el orden del
   menú. `isSuperuser` **no** se toca: se queda fuera de la UI a propósito.
4. **G-4, datos del equipo.** Agregar `model`, `serialNumber` y estado
   (`statusId`, con el catálogo de `EquipmentStatus`) al formulario, a la
   acción y al detalle.
5. **G-8 y G-9, rutas muertas.** Crear `/admin/permissions` (lectura del
   catálogo, ROOT) o quitar el permiso; y quitar el `routePath: "/incidents"`
   de `incidents:read`, que no corresponde a ninguna página. Agregar a la
   prueba del catálogo una regla: **todo `routePath` declarado tiene una
   página**, para que no vuelva a pasar.
6. **G-7, catálogos sin pantalla** (`VacationStatus`, `ScheduleStatus`):
   decisión #4.
7. **G-6, política de SLA configurable**: es el más grande (modelo nuevo,
   migración, pantalla y lectura en caliente en `sla-policy.ts`). Decisión #5;
   si se aprueba, va en su propio PR después de este.

---

## Verificación

1. Los cuatro checks en verde en cada PR.
2. Recorrido manual por PR:
   - **A**: `/inicio` → `/notifications` → "Volver" regresa a `/inicio`.
   - **B**: como `admin-vacaciones@`, capturar la fecha de un empleado sin
     ella; el empleado solicita vacaciones en seguida.
   - **C**: difusión programada a un usuario; llega solo a él; el historial
     muestra el destinatario; cancelarla antes de la hora la deja sin enviar.
   - **D**: un usuario con dos Clientes ve ambos; ADMIN_OPERACION abre
     `/admin/states` y lista.
3. Migraciones: `npm run db:prod:status` antes y después, y respetar el orden
   escrito en cada encabezado.
4. `npm run db:permissions` (diff de solo lectura) sin errores tras los PR 2 y 4.

## Decisiones pendientes

| # | Decisión | Default recomendado |
|---|---|---|
| 1 | ¿Cómo captura la fecha de ingreso el admin de vacaciones? | Permiso angosto `users:manage-employment` + campo en `/admin/vacations`. La alternativa, darle `/admin/users` completo, le entregaría también roles y contraseñas |
| 2 | ¿A qué usuarios puede difundir un emisor? | Los que tengan un rol alcanzable **y**, si no tiene `scope:all-clients`, compartan Cliente |
| 3 | ¿Se revalida el alcance al despachar una difusión programada? | No: se valida al crear y editar, y así queda documentado. Revalidar significaría que una difusión pueda perder destinatarios en silencio |
| 4 | ¿`VacationStatus` y `ScheduleStatus` necesitan pantalla? | No: son conjuntos cerrados que las máquinas de estado conocen; documentarlo |
| 5 | ¿La política de SLA se vuelve configurable? | Sí, pero en un PR aparte después de este plan |
| 6 | ¿`priority` del rol editable desde la UI? | Sí, con una ayuda que explique su efecto |

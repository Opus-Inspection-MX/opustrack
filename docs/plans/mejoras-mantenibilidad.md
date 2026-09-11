# Plan: seguridad, red de pruebas y mantenibilidad de OpusTrack

> Documento para el agente implementador. Es autocontenido: explica el porqué,
> el qué y cómo verificar cada fase. Las cifras y los hallazgos se verificaron
> el 2026-09-11 sobre `main` (`5345274`), leyendo el código después de las
> Fases 4a–4e de `docs/plans/ui-revamp.md`. Antes de empezar una fase, vuelve a
> medir con los comandos de "Cómo medir", porque el código sigue cambiando.

## Contexto

La base es sólida: RBAC en base de datos, máquinas de estado dueñas del status,
reglas de negocio devueltas (con `actions-contract.test.ts` que lo obliga),
tipado estricto, salvaguardas en los scripts de base de datos y un e2e aislado.
Este plan no cambia esas decisiones.

Al revisar el código completo encontramos una **clase de defectos** que se
repite: errores que pasan `tsc`, `biome`, las unitarias (que simulan Prisma) y
el e2e (que corre como superusuario). Hay cuatro familias:

1. **Autorización por id.** Las Server Actions validan el *permiso*, pero
   muchas no validan que el registro sea del Cliente del usuario ni que el
   usuario sea su dueño. Una Server Action es un endpoint POST público para
   cualquier sesión; el middleware no la filtra por ruta. Que "la pantalla no
   lo ofrece" no protege nada.
2. **Consultas que compilan y hacen otra cosa.** Spreads que pisan una llave
   del `where`, `include` que arrastra columnas secretas y filtros sobre campos
   que el modelo no tiene.
3. **Identidad por nombre editable.** Estados y roles se identifican por el
   `name` que el admin puede cambiar desde la UI.
4. **Concurrencia.** Pasos de "revisar y luego escribir" sin atomicidad en el
   cron de correo, la captura offline y la edición de roles.

La Fase 0 corrige lo urgente. Las demás fases construyen la red que evita que
estos defectos vuelvan.

### Cifras de partida

| Métrica | Valor |
|---|---|
| Líneas en `src/` (ts/tsx) | 84 042 |
| Server Actions (`src/lib/actions/`) | 18 063 líneas, 232 funciones exportadas |
| Acciones exportadas que reciben un id y validan permiso pero no Cliente ni dueño | 75 según el script de "Cómo medir" (incluye catálogos globales legítimos y acciones que filtran por `user.id`; ver H-03/H-04) |
| Archivos de prueba unitaria / specs e2e | 90 / 16 (+2 sin commit) |
| Archivos de prueba que simulan `prisma.singleton` | 40 |
| Specs e2e que entran como `admin` (= ROOT, superusuario) | 13 de 29 usos de `authFile` |
| Archivos de más de 500 líneas (sin tests ni `components/ui`) | 20 |
| `page.tsx` enteramente `"use client"` | 34 de 124 |
| Comparaciones `status.name === "…"` fuera de tests | 27 |
| Archivos que importan `moment` | 18 |

Archivos más grandes: `tracking-table.tsx` (1847), `actions/assignments.ts`
(1311), `actions/reports.ts` (1294), `bulk-incidents-client.tsx` (1212),
`actions/tracking.ts` (1174), `actions/incidents.ts` (1034),
`actions/incidents-bulk.ts` (977) y `actions/lookups.ts` (840).

---

## Hallazgos verificados

Cada hallazgo se leyó en el código. **Antes de corregir uno, reprodúcelo con
una prueba que falle** (unitaria en la Fase 0, de integración desde la Fase 2).
"Quién" lista los roles del seed (`initial_load/seed.example.ts`) que pueden
explotarlo. Producción puede tener otros grants, porque los roles se editan
desde `/admin/roles`.

### Críticos: exposición de datos

**H-01. El hash de la contraseña sale en las respuestas de las Server Actions.**
`User.password` viaja completo cada vez que una consulta usa `include` sobre
`User` o `user: true`, porque no hay `omit` global en
`src/lib/database/prisma.singleton.ts`. Dónde:

| Sitio | Quién puede llamarlo |
|---|---|
| `users.ts:44` `getUsers` y `:122` `getUserById` (`include`, sin `select`) | `users:read`: FSR, ADMIN_OPERACION, ADMIN_VACACIONES |
| `users.ts:442` `getMyProfile` | Cualquier sesión (su propio hash) |
| `clients.ts:142` `getClientById` (`userAssignments.user` con `include`) | `clients:read`: FSR, REPORTER, GUEST, **sin scope** |
| `assignment-activities.ts:187` `getAssignmentActivityById` (`assignees.user: true`) | `assignments:read`: FSR, REPORTER, GUEST, sin scope |
| `assignments.ts:124` `getAssignmentById` (`incident.reportedBy: true`) | `assignments:read` |
| `incidents.ts:304` `createIncident` y `:509` `updateIncident` (`reportedBy: true`) | `incidents:create` y `incidents:update` |

`/admin/users` y `/admin/assignment-activities/[id]` son páginas cliente:
el hash llega al navegador y se ve en la pestaña Network. Un GUEST puede pedir
`getClientById` de cualquier Cliente y recibir los hashes y correos de todo su
personal.

**H-02. Fuga entre Clientes en el reporte de programa de incidentes.**
En `src/lib/actions/incident-program.ts:80-95`, `incidentWindowWhere` hace
`...incidentScopeWhere(scope)` y luego
`...(filters.clientIds?.length ? { clientId: { in: filters.clientIds } } : {})`.
El segundo spread **reemplaza** la llave `clientId` del scope; el comentario
dice lo contrario ("can only narrow it"). Cualquier usuario con
`reports:export` (el FSR lo tiene) descarga el Excel de otro Cliente con
`GET /api/reports/incident-program?startDate=…&endDate=…&clientIds=<otro>`
(el middleware deja pasar toda `/api/*` con sesión). Lo mismo aplica a las
acciones `getScheduleOptions` e `getIncidentProgramReport`.

**H-03. Lecturas sin scope de Cliente.**
- `clients.ts`: `getClients`, `getClientsForSelect` y `getClientById`
  (`clients:read`: FSR, REPORTER, GUEST). `/api/clients` sí aplica scope, así
  que la misma pregunta tiene dos respuestas.
- `lines.ts` y `equipments.ts`: todas las lecturas, sin ningún filtro de Cliente.
- `assignment-activities.ts`: `getAllAssignmentActivities` (todas las
  actividades de todos los Clientes), `getAssignmentActivities` y
  `getAssignmentActivityById`. `assignment-items.ts`: `getAssignmentItems`.
- `users.ts`: `getUsers` y `getUserById` exponen a todo el personal, con
  perfil y teléfonos, a quien tenga `users:read`. Ninguna pantalla de FSR usa
  estas lecturas (verificado con grep en `src/app/fsr` y `src/components/fsr`).

**H-04. Escrituras sin scope ni pertenencia.** Todas con permisos que el seed
le da al FSR o al REPORTER:
- **`assignments:update` (FSR):**
  - `updateAssignment` (`assignments.ts:240`) reasigna técnicos, cambia fecha,
    notas y folio de **cualquier** asignación de **cualquier** Cliente.
  - Con el mismo hueco: `updateAssignmentOdtFolio` (`:1214`),
    `updateAssignmentStatus` (`:1264`) y `deleteAssignmentAttachment`
    (`:1173`, que además borra el archivo de evidencia).
  - `uploadAssignmentAttachment` (`:1091`) solo revisa scope si el incidente
    tiene Cliente, y nunca revisa pertenencia.
  - `createAssignmentItem`, `deleteAssignmentItem`, `createAssignmentActivity`
    y `updateAssignmentActivity`.
  - Solo iniciar, pausar, reanudar, marcar visto y cerrar pasan por
    `ensureCallerIsAssigneeOrAdmin` (`:524`).
- **`lines:*` y `equipments:*` (FSR):** crear, editar, borrar y activar en
  cualquier Cliente, incluido mover una línea a otro Cliente (`updateLine`
  acepta `clientId`).
- **`incidents:create` (REPORTER):** `createIncident` (`incidents.ts:304`)
  acepta cualquier `clientId` y un `reportedById` arbitrario, así que permite
  suplantar al reportante. `POST /api/incidents` sí valida el scope: otra vez
  dos puertas con reglas distintas.
- **`incidents:update` (FSR):** `updateIncident` valida el Cliente *actual*,
  pero no el nuevo `data.clientId`, así que mueve incidentes a otro Cliente.
- **Referencias cruzadas:** `lineId`, `equipmentId` y `scheduleId` llegan del
  cliente y no se valida que pertenezcan al `clientId` del incidente
  (`createIncidentAsReporter`, `POST /api/incidents`). `createAssignment` no
  valida el scope de `incidentId`.

**H-05. Dos semánticas para "usuario sin Cliente".** `getReportScope` falla
cerrado (`in: []`), como pide `CLAUDE.md`. En cambio,
`canAccessClientAsync` (`auth/filters.ts:102`) y `scopeIncludesClient`
(`report-scope.ts:88`) le dan acceso a los registros con `clientId: null` a
quien no tiene Cliente. `getClientWhereClauseAsync` devuelve `clientId: null`,
y `getAssignmentById` y las subidas se saltan la revisión cuando el
incidente no tiene Cliente. Resultado: los listados esconden esos incidentes,
pero el acceso por id queda abierto.

### Altos: funcionalidad rota en producción que las pruebas no ven

**H-06. Permisos que existen pero ningún rol tiene** (ni el seed ni ninguna
migración los otorga):
- `incidents:cancel`: `admin/incidents/[id]/page.tsx:97` le muestra el botón
  "Cancelar" a ADMIN_OPERACION sin revisar `canPerform`. Al pulsarlo,
  `requirePermission` lanza y en producción el operador ve un error genérico.
  Hoy solo ROOT puede cancelar.
- `incidents:close` (`closeIncident`), `assignments:reopen`
  (`reopenAssignment`) y `refreshIncidentStatus`: acciones exportadas con
  **cero referencias**. Son endpoints vivos que knip no detecta, porque solo
  revisa archivos, no exports.
- `states:read`: ADMIN_OPERACION tiene `route:admin-states`, pero la pantalla
  llama `getStatesAdmin`, que exige `states:read`. La página no le carga.
- `settings:*`: ADMIN_VACACIONES tiene `route:admin-vacation-accrual`, pero
  `src/app/admin/settings/vacation-accrual/page.tsx:12` exige
  `requireRouteAccess("/admin/settings")` (un prefijo que no tiene) y
  `vacation-accrual-rules.ts` exige `settings:read`/`settings:update`. El
  administrador de vacaciones no puede configurar los días por antigüedad.

Es el mismo patrón que el hallazgo 3.0.1 (ADMIN_OPERACION sin
`tracking:read`).

**H-07. El e2e prueba como superusuario.** `e2e/fixtures/auth.ts` define
`admin` como ROOT, que se salta todas las revisiones de ruta y permiso. Los
flujos de operación, catálogos, vacaciones y días por antigüedad nunca se
ejercitan como ADMIN_OPERACION o ADMIN_VACACIONES, y por eso H-06 y 3.0.1
pasaron. El seed template ya trae `admin-operacion@` y `admin-vacaciones@`,
pero las fixtures no los usan.

**H-08. Renombrar un estado rompe la lógica; renombrar "ACTIVO" deja a todos
fuera.** `auth.ts:104` y `auth-options.ts:85` exigen
`userStatus.name === "ACTIVO"` en el login y en cada request, y
`/admin/user-status` permite editar ese nombre. Si alguien lo renombra, nadie
entra, ROOT incluido. Las máquinas de estado, `sync.ts`, `vehicle-trips.ts` y
`vacations.ts` resuelven los estados por `name` (27 comparaciones en UI y
lógica).

**H-09. Renombrar un rol rompe la lógica.** `updateRole` (`roles.ts:175`)
permite cambiar el nombre de FSR, REPORTER o ROOT. Hay ~24 referencias por
nombre (`whereHasRole("FSR")`, `role: { name: { in: ["REPORTER","ROOT"] } }`,
`roleNames.includes("FSR")`), además de las migraciones de datos. Peor:
`updateClient` (`clients.ts:296-299`) busca el rol "FSR" y, si no lo
encuentra, **ignora en silencio** la reasignación de técnicos que pidió el
usuario.

**H-10. Los mensajes de subida de archivos se pierden en producción.**
`assertAllowedUpload` (`storage/file-storage.ts:144-161`) lanza `Error` con
mensaje en español ("El archivo es demasiado grande…", "Tipo de archivo no
permitido…"). `guarded()` relanza todo lo que no sea `BusinessRuleError`, así
que en producción el FSR ve un error genérico al subir una foto grande.
`actions-contract.test.ts` no lo detecta porque solo escanea `actions/`,
`state-machine/` y tres archivos sueltos.

**H-11. `getClientsForSchedules` filtra `Client` por un campo que no existe.**
`schedules.ts:377` hace spread de `getClientWhereClauseAsync(user)` (que
devuelve `{ clientId }`) dentro de `prisma.client.findMany`, pero `Client` no
tiene `clientId`. Prisma lo rechaza en tiempo de ejecución para cualquier
usuario sin `scope:all-clients`.

### Medios: concurrencia y consistencia

**H-12. Correos duplicados.** `retryDueEmails` (`mail/outbox.ts:135`) toma
**todas** las filas `PENDIENTE`, incluidas las que `enqueueAndSend` está
enviando en ese momento en otra request, y las reenvía. Tampoco hay un claim
atómico: dos corridas del cron que se solapen envían la misma fila `FALLIDO`.
Y no hay límite de lote, así que un backlog grande puede agotar el timeout de
la función.

**H-13. Viajes duplicados al reenviar un borrador offline.**
`startVehicleTrip` (`vehicle-trips.ts:210`):
- La idempotencia es "revisar y luego escribir": `findReplayTargetId`, luego
  subir la foto, luego `vehicle.update`, luego `vehicleTrip.create` y al final
  `claimIdempotencyKey`. Nada de eso va en una transacción, y el P2002 del claim
  se traga.
- La regla "vehículo AVAILABLE" también es "revisar y luego escribir".
- En el cliente, `pending-drafts.tsx:131-150` programa un flush por borrador
  en cada evento `online`, sin guarda de "ya en vuelo". Un evento `online`
  repetido, el botón "Reintentar" o dos pestañas disparan dos envíos
  simultáneos del mismo borrador.

`startAssignmentWork` sí reclama la llave dentro de su transacción. Aun así,
el P2002 dentro de una transacción de Postgres la aborta, y el segundo envío
termina en un error genérico en vez de converger.

**H-14. Los borradores offline no son por usuario.** Hay una sola llave global
(`OFFLINE_OUTBOX_KEY`, `offline/outbox.ts:43`) y el logout no la toca. En un
celular compartido, el borrador de viaje del FSR A se envía con la sesión del
FSR B y el viaje queda a nombre de B.

**H-15. `updateRole` no es atómico ni invalida sesiones.** `roles.ts:175-214`
hace `update` del rol, luego `deleteMany` de `RolePermission` (borrado físico,
contra la convención de soft delete) y luego `createMany`, todo sin
transacción. Una falla a la mitad deja el rol sin permisos. Además, a
diferencia de `assignPermissionsToRole`, no llama a `invalidateRoleSessions`:
los JWT siguen con las rutas viejas.

**H-16. Caché de permisos por instancia.** `authz.ts:73-92` cachea
`getUserAuthz` 5 minutos en un `Map` en memoria, y `clearPermissionsCache()`
solo limpia la instancia que atendió la edición. En Vercel, un permiso revocado
puede seguir funcionando hasta 5 minutos en las otras instancias.

**H-17. Los registros borrados (soft delete) siguen editables.**
`loadAssignmentForTransition` (`assignments.ts:500`) y la mayoría de las 49
lecturas `findUnique({ where: { id } })` de las acciones no filtran
`active: true`. Una asignación borrada todavía se puede iniciar, cerrar o
llenar de partidas.

**H-18. `/api/schedules` ignora la búsqueda para usuarios con scope.**
`route.ts:58` pone `where.OR = [búsqueda]` y en `:76`
`Object.assign(where, scheduleScopeWhere(scope))` lo pisa con el `OR` del scope.
Aquí el scope gana y la búsqueda se pierde; con el orden al revés, el scope se
perdería y habría fuga. Es el mismo mecanismo que H-02.

**H-19. "Pendientes primero" en vacaciones solo ordena dentro de la página.**
`getVacations` (`vacations.ts:52-92`) pagina por `startDate` y reordena en
memoria. Con más de 20 solicitudes, una pendiente de la página 2 queda
enterrada, justo lo que el comentario dice evitar.

**H-20. El seed ignora grants mal escritos y la documentación nombra mal el
permiso de scope.** `seed.example.ts:1291-1305` hace
`if (permission) { … }`, así que un nombre con typo en la lista de un rol
simplemente no se otorga. Además, `CLAUDE.md` y `spec/` dicen
`scope:all-clientes` / `SCOPE_ALL_CLIENTES` en 12 lugares, pero el código usa
`scope:all-clients` / `SCOPE_ALL_CLIENTS` (`authz.ts:17`). Un agente que
siga `CLAUDE.md` escribiría un permiso que no existe, y nada fallaría.

### Bajos: endurecimiento

- **H-21.** El login no limita intentos. Además, `auth-options.ts:85` revisa
  el estado de la cuenta **antes** que la contraseña ("Account is not active"
  revela qué correos existen), y un correo inexistente responde sin pasar por
  bcrypt, más rápido.
- **H-22.** `image/svg+xml` está permitido en evidencias
  (`file-storage.ts:126`). Con storage `filesystem` se sirve desde el mismo
  origen (`/uploads`). En Vercel Blob las URLs son públicas y no expiran.
- **H-23.** `src/test/db.ts` no tiene guarda y nadie lo importa: arma la URL
  de pruebas reemplazando el nombre de la base en `DATABASE_URL` y corre
  `migrate deploy`. Además, `playwright.config.ts:48` usaría
  `/usr/bin/chromium` en CI si existiera, aunque el comentario dice que CI usa
  el build de Playwright.
- **H-24.** El FSR tiene permisos amplios que no usa en sus pantallas:
  `users:read`, `clients:read`, `lines:*`, `equipments:*` y un
  `incidents:update` que abre la edición completa del incidente. Es una
  decisión de producto (ver Decisiones).

---

## Reglas para el agente implementador

- Lee `CLAUDE.md` y los `spec/` del área. Respeta sus convenciones: Server
  Components primero, reglas de negocio devueltas en español, soft delete,
  Prisma desde `@/lib/database/prisma.singleton` y `revalidatePath()` en cada
  mutación. Donde `CLAUDE.md` dice `scope:all-clientes`, el nombre real es
  `scope:all-clients` (H-20; se corrige en la Fase 4).
- **Un PR por fase o subfase**, cada uno en su rama desde `main`. Commits con
  el estilo del historial (`fix(authz): …`, `ci: …`, `test(int): …`,
  `refactor(tracking): …`).
- Cada PR deja verdes `npm run check`, `npm run test:unit` y
  `npm run test:e2e`, y `npm run test:int` desde la Fase 2.
- **Prueba primero.** Cada hallazgo se corrige con una prueba que falla antes
  y pasa después. Los refactors no cambian comportamiento: primero un commit
  que solo mueve (`git diff --color-moved`) y los ajustes en otro.
- **Coordinación con `docs/plans/ui-revamp.md`.** Su Fase 5 está terminando: el
  responsive quedó en `0c54f9a`, y `e2e/accessibility.spec.ts` y
  `@axe-core/playwright` siguen sin commit. Las Fases 0 a 6 de este plan tocan
  sobre todo `src/lib/`, así que pueden correr en paralelo. Las Fases 7 y 8
  tocan UI y esperan a que ui-revamp cierre.
- **Sin dependencias nuevas.** Si alguna parece necesaria, detente y pregunta;
  si se aprueba, corre antes `npm run deps:freeze`.
- **Nada hacia afuera sin confirmación del usuario.** Eso incluye settings de
  Vercel, protección de ramas y `db:prod:*`. El agente prepara SQL, scripts e
  instrucciones; el usuario los ejecuta.
- Las migraciones de datos siguen el patrón de
  `prisma/migrations/20260914000000_inicio_home/migration.sql`: encabezado con
  propósito, orden de despliegue, idempotencia y la consulta de verificación.
- Si una fase cambia una convención, actualiza `CLAUDE.md` o `spec/` en el
  mismo PR.

## Orden y dependencias

| Fase | Tema | PRs | Corrige | Depende de | Esfuerzo |
|---|---|---|---|---|---|
| 0 | Correcciones urgentes | 0a–0e | H-01…H-06, H-10, H-11, H-18 | — | M |
| 1 | E2E en CI con los roles reales | 1a–1c (+1d del usuario) | H-07, H-23 | — | S |
| 2 | Integración contra Postgres real | 2a, 2b | Red para H-01…H-05, H-12, H-13 | 1a | M |
| 3 | Identidad estable de estados y roles | 3a–3c | H-08, H-09 | 2 | M |
| 4 | Catálogo declarativo de permisos | 4a, 4b | H-06 (estructural), H-20 | 2 | M |
| 5 | Concurrencia y consistencia | 5a–5e | H-12…H-17, H-19 | 2 | M |
| 6 | Polling y paginación | 6a, 6b | — | 1a | S |
| 7 | Partir archivos gigantes | 7a–7f | — | 2 y ui-revamp cerrado | L |
| 8 | Menos código en el cliente | 8a–8c | — | 7 | M–L |
| — | Endurecimiento | backlog | H-21, H-22, H-24 | — | S |

La Fase 0 va primero porque son fugas de datos vivas. Se corrige con pruebas
unitarias y verificación manual, y la Fase 2 agrega después la regresión contra
SQL real. La Fase 1 puede correr en paralelo con la 0.

---

## Fase 0: Correcciones urgentes

Son PRs chicos y separados, para que se puedan revisar y desplegar rápido.

### 0a. Sacar el hash de contraseña de todas las respuestas (H-01)

1. En `src/lib/database/prisma.singleton.ts`, agregar
   `omit: { user: { password: true } }` al constructor de `PrismaClient`. El
   `omit` global es estable desde Prisma 6.2 y el proyecto usa 6.16. Confírmalo
   con los tipos generados.
2. Correr `tsc`. El `omit` global quita `password` de los tipos, así que tsc
   señala exactamente los usos legítimos: `authorize` en `auth-options.ts`, el
   cambio de contraseña en `users.ts` (~`:535`) y el script de seed si aplica.
   En esas consultas, y solo en esas, agregar `omit: { password: false }`.
3. Además, reemplazar los `include` de `User` listados en H-01 por un `select`
   con lo que la pantalla usa (id, name, email, status, roles). El `omit` es la
   red; el `select` reduce lo que se expone.
4. Pruebas:
   - Unitaria sobre la configuración del singleton (el `omit` está presente).
   - En la Fase 2, una aserción genérica en la matriz de integración: ninguna
     respuesta contiene la llave `password`.
5. Verificación manual: en `/admin/users` como ROOT, la respuesta de la acción
   en Network ya no contiene `"$2b$`.
6. **Nota para el usuario en el PR:** los hashes estuvieron al alcance de
   cualquier FSR, REPORTER o GUEST. Decidir si se fuerza un cambio de
   contraseña a las cuentas con contraseñas débiles o compartidas.

### 0b. Scope que no se puede pisar (H-02, H-18, H-11)

1. Crear en `src/lib/auth/report-scope.ts`:
   - `withScope<T>(where: T, scopeWhere: T): T`, que devuelve
     `{ AND: [where, scopeWhere] }` (o solo `where` si el scope es `{}`).
   - `narrowClientIds(requested: string[] | undefined, scope): string[] | undefined`,
     que devuelve la intersección con `scope.clientIds`, o los pedidos si el
     scope es `null`.
2. `incident-program.ts`: `incidentWindowWhere` compone con `withScope` y usa
   `narrowClientIds` para `filters.clientIds`. Corregir el comentario.
3. `/api/schedules/route.ts`: la búsqueda y el scope se componen con `AND`.
   Revisa también `/api/incidents` y `/api/schedules/incidents`, que usan
   `Object.assign`.
4. `getClientsForSchedules` (`schedules.ts:373`): usar `getReportScope` +
   `id: { in: clientIds }`. Si `getClientWhereClauseAsync` queda sin usos,
   borrarlo con sus pruebas.
5. Pruebas unitarias:
   - `incidentWindowWhere` con scope `[A]` y `clientIds: [B]` produce un
     `where` que no puede devolver B (la llave `clientId` del scope sigue en
     un `AND`).
   - Buscar en `/api/schedules` con un usuario con scope conserva el `OR` de la
     búsqueda.

### 0c. Guardas de acceso por id (H-03, H-04, H-05)

1. Crear `src/lib/auth/access.ts`, un módulo plano, no `"use server"`, con
   cargadores que devuelven el registro o lanzan `businessRule(...)`:
   - `clientInScope(scope, clientId)`: una sola regla de **fallo cerrado**.
     `clientId: null` solo es accesible con scope sin restricción. Reemplaza la
     lógica de `canAccessClientAsync` y `scopeIncludesClient`, que pasan a
     delegar en ella (H-05).
   - `requireClientAccess(user, clientId)`.
   - `loadIncidentFor(user, incidentId)`: exige `active: true` y el Cliente en
     scope.
   - `loadAssignmentFor(user, assignmentId, mode)`: exige `active` y el scope
     del incidente. Con `mode: "worker"` exige además ser asignado o tener
     `assignments:manage-all` (reutiliza `ensureCallerIsAssigneeOrAdmin`). Con
     `mode: "manager"` exige `assignments:manage-all`.
   - `loadLineFor` y `loadEquipmentFor`, que llegan al Cliente por
     `line.clientId`.
   - `assertBelongsToClient({ lineId, equipmentId, scheduleId }, clientId)`
     para las referencias cruzadas.
   - Mensajes en español y devueltos: "Sin acceso a los datos de este
     Cliente." y "No encontrado.". Agrega `access.ts` a `EXTRA_SCAN_FILES` de
     `actions-contract.test.ts`.
2. Aplicarlos:
   - **Asignaciones:**
     - `mode: "manager"`: `updateAssignment` y `updateAssignmentStatus`.
       `createAssignment` valida el incidente con `loadIncidentFor`.
     - `mode: "worker"`: `updateAssignmentOdtFolio`, subir y borrar adjuntos,
       partidas (`assignment-items.ts`) y actividades (`assignment-activities.ts`).
     - `mode: "reader"`: `getAssignmentById`, `getAssignmentActivities`,
       `getAssignmentActivityById` y `getAssignmentItems`.
     - `getAllAssignmentActivities` filtra con `assignmentScopeWhere`.
     - `markAssignmentSeen`, `start`, `pause`, `resume` y `close` pasan a usar
       `loadAssignmentFor(…, "worker")`, que ya incluye `active` (H-17).
   - **Incidentes:**
     - `createIncident`: el `clientId` debe estar en scope, `reportedById` solo
       se honra si el que llama tiene `scope:all-clients` (si no, `user.id`) y
       se aplica `assertBelongsToClient`.
     - `updateIncident`: además del Cliente actual, valida el nuevo
       `data.clientId`.
     - `createIncidentAsReporter` y `POST /api/incidents`: aplicar
       `assertBelongsToClient`.
   - **Líneas y equipos:** las lecturas filtran por scope. Las escrituras usan
     `loadLineFor` o `loadEquipmentFor` y validan el `clientId` nuevo.
   - **Clientes:** `getClients`, `getClientsForSelect` y `getClientById` con
     scope, igual que `/api/clients`.
   - **Usuarios:** con 0a ya no exponen hashes. Si se quita `users:read` al FSR
     es una decisión (ver Decisiones).
3. **Contrato nuevo** (`src/lib/actions/access-contract.test.ts`, unitario,
   con el estilo de `actions-contract.test.ts`):
   - Recorre las acciones exportadas de `src/lib/actions/` que reciben un
     parámetro `id` o `*Id`.
   - Exige que el cuerpo llame a un cargador de `access.ts`, a `getReportScope`
     o a un helper `*ScopeWhere`.
   - Si no, la acción va en un allowlist **con razón**: catálogos globales
     (feriados, roles, permisos, estados, reglas de acumulación, vehículos,
     difusiones, configuración de notificaciones) o acciones que filtran por
     `userId: user.id` (notificaciones, vacaciones propias, viajes con
     `manage-all`).
   - El allowlist se valida para que no tenga entradas muertas. Hoy el script
     de "Cómo medir" lista 75 candidatas; muchas son legítimas y van al
     allowlist.
4. Pruebas unitarias de cada cargador (Prisma simulado), incluidos los casos
   `clientId: null` y `active: false`. La regresión real, acción por acción, va
   en la matriz IDOR de la Fase 2.

### 0d. Grants faltantes y botones que no se pueden usar (H-06)

**Requiere la decisión #2 del usuario** (quién hace qué). Con los defaults
recomendados:

1. Migración de datos idempotente, más el mismo cambio en ambos seeds:
   - `incidents:cancel` → ADMIN_OPERACION.
   - `states:read` (y `states:create`/`update`/`delete` si el usuario lo
     decide) → ADMIN_OPERACION.
   - Días por antigüedad: cambiar `vacation-accrual-rules.ts` para que exija
     `vacations:manage`, que ADMIN_VACACIONES ya tiene, en lugar de
     `settings:*`. Si se le diera `settings:*`, podría editar también los
     catálogos de estado de vehículos y equipos. La página usa
     `requireRouteAccess("/admin/settings/vacation-accrual")`.
   - `sessionVersion` bump para los usuarios de los roles tocados, como en
     `inicio_home`.
2. `CancelIncidentButton` solo se muestra con `canPerform("incidents:cancel")`.
   Revisa los demás botones de acción de las páginas de detalle con el mismo
   criterio.
3. Acciones muertas (`closeIncident`, `reopenAssignment`,
   `refreshIncidentStatus`): **decisión #3**. Si no tienen pantalla ni spec
   vigente, se borran. La reapertura sí aparece en el encabezado de
   `assignment-machine.ts` ("CERRADO → EN_PROGRESO (reopen, admin)") y en
   `spec/03-incidentes.md:480` (evento `REOPENED`). Si se confirma que se
   quiere, se conecta `reopenAssignment` a una pantalla y se otorga
   `assignments:reopen`.

### 0e. Mensajes de subida que sí llegan al operador (H-10)

1. `assertAllowedUpload` usa `businessRule(...)` en vez de `throw new Error`.
   Los tres llamadores ya están dentro de `guarded(...)`.
2. `actions-contract.test.ts` pasa a escanear **todo `src/lib/`** excepto
   tests, en lugar de una lista de carpetas. Así atrapa helpers como este.
   Ajusta el allowlist si aparecen invariantes legítimas.
3. Quitar `image/svg+xml` de `ALLOWED_MIMETYPES` (H-22): una evidencia de
   campo nunca es un SVG.

**Aceptación de la Fase 0:**

- Cada hallazgo tiene una prueba que fallaba antes.
- Una verificación manual en local: como `fsr@`, llamar
  `/api/reports/incident-program` con el `clientIds` de otro Cliente devuelve
  vacío o 403, y abrir `/admin/users` como ROOT no muestra hashes.
- Los tres checks, verdes.

---

## Fase 1: E2E en CI, con los roles reales

### 1a. Job e2e con Chromium en cada PR y en `main`

**Por qué:** `ci.yml` excluye los e2e a propósito, y Vercel despliega en cada
push.

1. En `.github/workflows/ci.yml`, agregar el job `e2e` ("E2E (Chromium)"):
   - `needs: verify`.
   - `if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'`.
   - `timeout-minutes: 45`. Ajustarlo tras medir la primera corrida.
   - Pasos:
     1. checkout.
     2. Node 22 con `cache: npm`.
     3. `npm ci`.
     4. Cache de `~/.cache/ms-playwright` con clave derivada de la versión de
        `@playwright/test`.
     5. `npx playwright install --with-deps chromium`.
     6. `npm run test:e2e`.
     7. Con `if: failure()`, subir `playwright-report/` y `test-results/`.
   - No hace falta ningún secreto: `config/e2e.env` está versionado y Mailpit
     captura el correo.
2. `playwright.config.ts:48`: la condición pasa a
   `!process.env.CI && existsSync("/usr/bin/chromium")` (H-23).
3. En `docker-compose.e2e.yml`, fijar `axllent/mailpit:latest` a una etiqueta
   concreta.
4. Reescribir el comentario de cabecera de `ci.yml`, que hoy dice que los e2e
   no corren, y anotar la duración medida.
5. **Specs de depuración:** `e2e/zz-debug.spec.ts` (sin commit) no debe
   entrar. Agrega a `playwright.config.ts` un `testIgnore` para `zz-*` o
   bórralo.
6. **Opcional, verificar antes:** compilar el e2e con `--turbopack`, que es lo
   que corre `npm run build` en producción. Si falla por causas ajenas, no lo
   fuerces: repórtalo.

Si pasa de ~25 minutos, separar en dos jobs por proyecto (`flows` + `catalogs`
en uno; `chromium` + `Mobile Chrome` en otro). No subas `workers` en los
proyectos seriales.

### 1b. Personas reales en el e2e (H-07)

1. En `e2e/fixtures/auth.ts`, agregar los roles `admin-operacion`
   (ADMIN_OPERACION) y `admin-vacaciones` (ADMIN_VACACIONES), con
   `E2E_ADMIN_OPERACION_EMAIL` y `E2E_ADMIN_VACACIONES_EMAIL` en
   `config/e2e.env`. El seed template ya trae esas cuentas. Confirma que
   `e2e/auth.setup.ts` genere su storage state.
2. Mover al rol real los flujos que hoy corren como `admin`:
   - Tracking, programación, incidentes, asignaciones y catálogos operativos
     (líneas, equipos, estados, clientes, vehículos) → `admin-operacion`.
   - Vacaciones de administración y días por antigüedad → `admin-vacaciones`.
   - Solo se quedan en ROOT los flujos que son de ROOT: usuarios, roles,
     permisos y catálogos de estado.
3. Agregar un caso por cada botón de acción de las pantallas de detalle, para
   que pruebe que el rol que lo ve puede usarlo (el patrón de H-06).
4. Estos specs deben fallar hoy en los puntos de H-06, o pasar si la 0d ya se
   fusionó. Anótalo en el PR.

### 1c. Corrida nocturna con todos los navegadores

1. Crear `.github/workflows/e2e-nightly.yml` con `schedule: - cron: "0 9 * * *"`
   (03:00 CDMX) y `workflow_dispatch`.
2. Definir `E2E_EXTRA_BROWSERS=1` e instalar
   `chromium firefox webkit`. Esto incluye el proyecto iPad que agregó
   ui-revamp Fase 5.
3. `timeout-minutes: 90` y subir el reporte siempre.
4. Con `CI` definido, un navegador faltante hace fallar la corrida en voz alta,
   que es lo esperado.

### 1d. Bloquear despliegues sin CI verde (lo configura el usuario)

- **A (recomendada):** protección de rama en `main`, exigiendo PR y los checks
  `verify`, `e2e` e `integration`.
- **B:** Vercel Deployment Checks, si el plan lo incluye.

El agente deja los pasos en la descripción del PR 1a.

---

## Fase 2: Integración contra Postgres real

**Por qué:** H-01, H-02, H-04, H-11, H-12 y H-13 son invisibles con Prisma
simulado. Esta fase las vuelve imposibles de reintroducir.

### 2a. Infraestructura

- **Convención:** `src/test/integration/**/*.int.test.ts`.
- **`vitest.config.ts` con `test.projects`:**
  - `unit`: la configuración actual, excluyendo `*.int.test.ts`. La cobertura
    del 75 % aplica solo aquí.
  - `integration`: `environment: "node"`,
    `setupFiles: ["src/test/integration/setup.ts"]`,
    `fileParallelism: false` y `testTimeout: 30_000`.
- **`package.json`:** `test`, `test:unit` y `test:coverage` pasan a usar
  `--project unit`. Nuevo `test:int` que corre `node scripts/test-int.mjs`.
  `test:all` lo incluye.
- **`scripts/test-int.mjs`:** mismo patrón que `scripts/e2e.mjs`:
  1. `loadProfile("e2e")` y `down -v`.
  2. `up -d --wait e2e-db` (solo la base).
  3. `tsx scripts/e2e-prepare.ts`.
  4. `vitest run --project integration`.
  5. `down -v` en un `finally` y en las señales.

  Extrae el ciclo a `scripts/lib/ephemeral-stack.mjs` para compartirlo con
  `e2e.mjs`. Documenta que `test:int` y `test:e2e` no corren a la vez en local.
- **`setup.ts`:**
  - Carga `config/e2e.env` con `override: true` **antes** de importar Prisma.
  - Llama a `assertEphemeralDatabase(process.env.DATABASE_URL)`.
  - Simula solo `next/cache` (no-op), `next/navigation` (`redirect` lanza un
    error reconocible) y `getServerSession` de `next-auth` (`actAs(userId)`).
  - Todo lo demás es real. Verifica que `cache()` de React sea passthrough
    fuera de RSC.
- **`fixtures.ts`:** cada archivo arma su mundo con un sufijo único:
  - Clientes A y B, cada uno con línea, equipo, incidente, asignación,
    actividad, partida, programación, vehículo y viaje.
  - Un incidente con `clientId: null`.
  - Personas: `root`, `opsAll` (ADMIN_OPERACION), `vacAdmin`
    (ADMIN_VACACIONES), `fsrA` (asignado a la asignación de A), `fsrA2`
    (Cliente A, pero **no** asignado), `reporterA`, `guestA` y `sinCliente`.
  - Las aserciones filtran por los IDs del mundo, nunca por conteos globales.
- **Borrar `src/test/db.ts`** (H-23) y sus secciones de `src/test/README.md`.
- **CI:** job `integration` (`needs: verify`, en paralelo con `e2e`,
  `timeout-minutes: 15`).

### 2b. Suites

1. **Matriz de lectura** (`scope-matrix.int.test.ts`). Para cada lector con
   datos de tenant:
   - `fsrA`, `reporterA` y `guestA` ven filas de A y nunca de B.
   - `sinCliente` ve cero filas, incluido el incidente sin Cliente.
   - `opsAll` y `root` ven A y B.
   - **Ninguna respuesta contiene la llave `password`**, con un recorrido
     profundo del resultado (H-01).
   - La lista sale de `grep -rln "getReportScope\|ScopeWhere\|access\"" src/lib src/app`
     y de las acciones de H-03.
2. **Matriz de acceso por id, IDOR** (`idor-matrix.int.test.ts`):
   - Cada acción de H-04, llamada como el actor equivocado (`fsrA` sobre B,
     `fsrA2` sobre la asignación de `fsrA`, `reporterA` con `clientId` de B o
     con `reportedById` ajeno), **devuelve un rechazo y no cambia la fila**. Se
     verifica releyendo la fila.
   - Las mismas acciones como el actor correcto funcionan.
   - Agregar el caso de la fila borrada (`active: false`), que se rechaza (H-17).
3. **Meta-prueba de cobertura** (unitaria): las acciones de la matriz se leen
   de `src/test/integration/coverage.ts`. Un escaneo estático exige que cada
   acción que lee datos de tenant o recibe un id esté ahí o en el allowlist de
   0c. Una acción nueva sin prueba de integración rompe el build.
4. **Colisiones de llaves** (`scope-compose.int.test.ts`): H-02 y H-18 con
   datos reales.
5. **Concurrencia** (`concurrency.int.test.ts`), de la Fase 5: dos
   `retryDueEmails` en paralelo mandan cada correo una vez (con un transport
   de prueba que cuenta envíos), y dos `startVehicleTrip` con la misma
   `idempotencyKey` crean un solo viaje.

**Aceptación:**

- `npm run test:int` pasa en local y en CI.
- Revertir en local cualquiera de las correcciones de la Fase 0 hace fallar su
  caso.
- Revertir `9860eb1` (`scheduleScopeWhere` en `getSchedules`) también.

---

## Fase 3: Identidad estable de estados y roles (H-08, H-09)

### 3a. `code` estable para los estados

1. **Esquema:** agregar `code String? @unique` a `IncidentStatus`,
   `AssignmentStatus`, `UserStatus`, `VacationStatus`, `VehicleStatus` y
   `VehicleTripStatus`. Revisa con grep si `ScheduleStatus` o
   `EquipmentStatus` también se comparan por nombre.
2. **Migración:** agregar la columna y hacer backfill `code = name` solo para
   los nombres de sistema (salen de las constantes y del seed). Es idempotente.
   **Orden de despliegue: migración primero, código después.** Es aditiva, y
   el código nuevo falla sin la columna. Escríbelo en el encabezado y en el PR.
3. **Constantes:** conservar `INCIDENT_STATE` y `ASSIGNMENT_STATE`. Agregar
   `USER_STATUS`, `VACATION_STATUS`, `VEHICLE_STATUS` y `VEHICLE_TRIP_STATUS`
   en `src/lib/constants/status-codes.ts`, con helpers puros
   (`isIncidentTerminal`, `isAssignmentClosed`, `isUserActive`…).
4. **La lógica resuelve por `code`:**
   - `auth.ts:104`, `auth-options.ts:85`, `sync.ts`, las máquinas,
     `vehicle-trips.ts`, `vacations.ts`, `reports.ts:136` y `getSlaState`.
   - Los dos `assertAssignmentEditable` duplicados
     (`assignment-activities.ts:15` y `assignment-items.ts:24`) se unifican en
     un helper que usa `isIncidentTerminal`.
   - `overrideIncidentStatus(toStatusName)` pasa a recibir un código.
5. **Historial:** `IncidentEvent.fromStatus` y `toStatus` no se reescriben
   (append-only). Los eventos nuevos guardan el código, que para las filas de
   sistema es el nombre de hoy.
6. **`catalog-factory.ts`:** una fila con `code` no se puede desactivar
   (`rejected("No se puede desactivar un estado del sistema.")`). El `name` y
   el color siguen editables, y la UI muestra un badge "Sistema".
7. **Seeds:** la lista de estados de sistema pasa a un módulo en `src/lib/`
   que importan ambos seeds.
8. **Pruebas de integración:**
   - Renombrar "ACTIVO" no bloquea el login ni `getAuthenticatedUser`.
   - Renombrar "CERRADO" no rompe `closeAssignment` + `syncIncidentState`.
   - Desactivar un estado de sistema devuelve el rechazo.

### 3b. UI y contrato de estados

1. Reemplazar las 27 comparaciones por nombre por los helpers.
2. Contrato `src/test/status-literals.test.ts` (estilo `ui-style.test.ts`):
   prohíbe `(status|Status)\??\.name\s*[!=]==` y
   `where: { name: "<código>" }` sobre modelos de estado. El allowlist queda
   vacío al terminar.

### 3c. Roles de sistema

1. Agregar `code String? @unique` a `Role`, con backfill `code = name` para
   los siete roles del seed (misma estrategia de despliegue que 3a).
2. `whereHasRole` y compañía (`src/lib/authz/user-queries.ts`) resuelven por
   `code`. Las ~24 referencias usan constantes `ROLE.FSR`, `ROLE.REPORTER`… en
   `src/lib/authz/roles.ts`. `roleNames.includes("FSR")` en
   `incident-form.tsx` pasa a usar `roleCodes`, lo que implica agregar
   `roleCodes` al JWT o a las opciones del formulario.
3. `updateRole`: el `name` de un rol con `code` sigue editable como etiqueta.
4. `updateClient` (`clients.ts:296-299`, `:450`): si el rol no existe, **no**
   ignorar en silencio; con `code` ya no puede faltar, pero si falta es un
   defecto que se lanza. Los helpers que se pasen a `code` deben seguir
   filtrando `active: true`.
5. Integración: renombrar "FSR" desde `updateRole` y verificar que las listas
   de técnicos, `assertAssigneesAreFsrs` y la reasignación en `updateClient`
   siguen funcionando.

**Decisión #4:** crear estados nuevos de incidente o asignación (la máquina no
los conoce). Default: no cambiarlo en este plan; solo documentarlo.

---

## Fase 4: Catálogo declarativo de permisos (H-06 estructural, H-20)

### 4a. Fuente única en TypeScript

1. Crear `src/lib/authz/permission-catalog.ts` con:
   - `PERMISSIONS` (`as const satisfies readonly PermissionDef[]`).
   - `type PermissionName`.
   - `SEED_ROLES`: por código, con `grants: readonly PermissionName[]` y los
     grupos reutilizables del seed (`UNIVERSAL_ROUTES`,
     `SELF_SERVICE_VACATIONS`, `OPERATIONS_ROUTES`).
   - `ROOT_ONLY: readonly PermissionName[]`, que lista explícitamente los
     permisos que ningún rol del seed lleva a propósito.
2. Ambos seeds importan el catálogo, y el seed **falla** si un grant no existe
   en `PERMISSIONS` (hoy lo ignora, H-20).
3. Tipar con `PermissionName` las firmas de `requirePermission`,
   `withPermission`, `canPerform`, `whereHasPermission`, `userHasPermission` y
   los `permissions` de `createCatalogActions`. Con eso, tsc detecta los nombres
   mal escritos.
4. **Pruebas unitarias** (`permission-catalog.test.ts`):
   - Sin duplicados, y cada grant existe.
   - **Alcanzabilidad:** cada permiso que el código exige (escaneo de
     `requirePermission("…")`, `withPermission("…")`, `canPerform("…")` y los
     `permissions` de catálogos) lo tiene al menos un rol del seed que no es
     superusuario, o está en `ROOT_ONLY`. Esta prueba habría detectado H-06 y
     3.0.1.
   - **Coherencia ruta–acciones:** para cada `route:*` de un rol, los permisos
     que exigen las acciones que llama esa página los tiene el mismo rol. Si
     el escaneo estático de página → acciones resulta frágil, basta con una
     tabla explícita `ROUTE_REQUIRES` para las rutas del menú, validada por la
     prueba.
   - Cada ruta de `src/lib/navigation/menu.ts` tiene su `route:*`.
5. **Integración:** después de `migrate deploy` + seed, los permisos y grants
   activos en la base coinciden con el catálogo.
6. **Documentación (H-20):** reemplazar `scope:all-clientes` y
   `SCOPE_ALL_CLIENTES` por `scope:all-clients` y `SCOPE_ALL_CLIENTS` en
   `CLAUDE.md` y `spec/` (12 menciones). Agregar a `CLAUDE.md`: "Permisos:
   fuente única en `src/lib/authz/permission-catalog.ts`".

### 4b. Diff contra bases existentes

1. `scripts/permissions-diff.ts`, **solo lectura**. Reporta:
   - **Error:** un permiso del catálogo que falta o está inactivo, o un grant
     del catálogo que le falta a un rol del seed.
   - **Info:** grants de más y roles creados desde la UI, que son legítimos.
2. Acción `permissions` en `scripts/db-prod.mjs` (solo lectura, imprime el
   host) y `db:permissions` en local, con `db-guard`.
3. Flag `--sql`: emite una migración idempotente con el patrón de
   `inicio_home`.
4. El agente no lo corre contra producción; deja la instrucción en el PR.
   Úsalo también para confirmar H-06 en producción, que puede diferir del seed.

---

## Fase 5: Concurrencia y consistencia (H-12…H-17, H-19)

### 5a. Cola de correo (H-12)

1. Claim atómico antes de enviar: `updateMany` que pase la fila de
   `PENDIENTE`/`FALLIDO` (debida) a un nuevo estado `ENVIANDO`, condicionado a
   `attempts` igual al leído, y solo se envía si `count === 1`. Esto requiere
   agregar `ENVIANDO` al enum `EmailOutboxStatus` (migración).
2. `retryDueEmails` solo toma `PENDIENTE` con `createdAt` de más de 2 minutos
   de antigüedad (las filas en vuelo de `enqueueAndSend` no califican) y usa
   `take` (50) por corrida.
3. Una fila atascada en `ENVIANDO` más de 15 minutos vuelve a `FALLIDO`, para
   que un crash no la deje muerta.
4. Prueba de integración de concurrencia (Fase 2).
5. **Verificación para el usuario:** que el cron de Vercel realmente corre.
   `route.ts` advierte que en el plan Hobby no corre cada 5 minutos. Revisar
   los logs de Cron en Vercel.

### 5b. Captura offline (H-13, H-14)

1. **Servidor:**
   - `startVehicleTrip` y `endVehicleTrip` reclaman la llave de idempotencia
     **primero**, dentro de una transacción que contiene el `vehicle.update` y
     el `vehicleTrip.create`. Si el insert de la llave choca (P2002), se
     devuelve el registro existente (converge) en vez de continuar.
   - La foto se sube después del claim. Si la transacción falla, se borra.
   - La condición "vehículo AVAILABLE" va en el `where` del `update`
     (`updateMany` con `statusId` disponible, exigiendo `count === 1`).
   - Revisar `startAssignmentWork` y `closeAssignment`: si la llave ya existe,
     responder con el registro en vez de dejar que el P2002 aborte la
     transacción.
2. **Cliente:**
   - `pending-drafts.tsx` lleva un `Set` de llaves en vuelo (en un ref) y no
     programa ni ejecuta un flush de una llave que ya está en vuelo.
   - Para las pestañas, usar `navigator.locks.request(key, …)` si está
     disponible; si no, basta el `Set`.
   - Cada `OutboxEntry` guarda el `userId` que la capturó. Solo se envían y
     muestran las del usuario en sesión.
   - Al hacer logout, las entradas se conservan (no se pierde evidencia), pero
     otro usuario no las envía. La UI muestra "Hay N borradores de otro
     usuario en este equipo".
3. **Pruebas:** unitarias del outbox (filtrado por usuario, guarda en vuelo),
   integración de concurrencia, y que `e2e/offline-field-capture.spec.ts`
   siga verde.

### 5c. Roles y caché de permisos (H-15, H-16)

1. `updateRole`: todo en una `prisma.$transaction`. Los permisos se
   desactivan y reactivan con `active` (soft delete), no con
   `deleteMany`/`createMany`. Si cambian permisos o `defaultPath`, llamar a
   `invalidateRoleSessions`. `assignPermissionsToRole` pasa a usar la misma
   función interna.
2. Caché: la clave de `getUserAuthz` pasa a ser
   `user-authz-${userId}-${sessionVersion}`. `getAuthenticatedUser` ya lee
   `sessionVersion` de la base en cada request, así que un bump invalida en
   todas las instancias al instante. Para cambios que no hacen bump, bajar el
   TTL a 60 s. Documentarlo en el comentario del caché.

### 5d. Soft delete en escrituras (H-17)

1. Con 0c, las acciones que pasan por `access.ts` ya exigen `active`.
2. Para el resto de lecturas por id que preceden a una escritura, crear
   `findActiveOrReject(model, id)` o agregar `active: true` al `where`.
3. Contrato estático: en `src/lib/actions/`, un `findUnique({ where: { id } })`
   seguido de `update` en la misma función debe incluir `active` o estar en el
   allowlist.

### 5e. Paginación de vacaciones (H-19)

`getVacations`: el orden "pendientes primero" va en la consulta. Puede ser
con dos consultas (pendientes, luego el resto) y paginación sobre la unión, o
con `orderBy` por `status.code` una vez que exista (Fase 3). Integración: con
25 solicitudes y una pendiente antigua, la pendiente sale en la página 1.

---

## Fase 6: Polling y paginación

### 6a. Campana de notificaciones

`notification-bell.tsx:123-147` consulta `/api/notifications` cada 10 s
**aunque la pestaña esté oculta**.

1. Firma barata (`unreadCount` + id de la más reciente) y `useLiveRefresh`
   (30 s, solo con la pestaña visible, sin solapar). La lista completa solo se
   pide si la firma cambia.
2. Conservar las notificaciones del navegador.
3. Backoff opt-in ante errores (hasta 5 min).
4. Pruebas con fake timers, al estilo de `use-live-refresh.test.tsx`. Ningún
   e2e depende de la campana.

### 6b. Paginación de tracking

`getIncidentsForTracking` corta en `TRACKING_MAX_RESULTS = 200`
(`tracking.ts:247`).

1. Agregar `page` y `pageSize` (50, 100 o 200) con
   `orderBy: [{ reportedAt: "desc" }, { id: "desc" }]`.
2. La firma no depende de la página.
3. En la UI, la paginación compartida (`e36ab57`), volviendo a la página 1
   cuando cambia un filtro.
4. Pruebas: unitaria, integración (la página 2 respeta el scope) y e2e.

---

## Fase 7: Partir archivos gigantes

**Empieza cuando ui-revamp cierre.**

### 7a. Límite automático primero

`src/test/file-size.test.ts` + un allowlist, con el patrón de
`ui-style.test.ts`:

- Máximo **500 líneas** por archivo.
- Los 20 archivos actuales quedan fijados con su conteo como techo (puede
  bajar, nunca subir).
- Se exige quitar las entradas que ya bajaron de 500.

### Reglas

- Nombres planos en `src/lib/actions/`, sin barrels. Se actualizan los imports
  y se conservan los nombres de las funciones.
- La lógica pura va a `src/lib/<dominio>/`, con pruebas.
- Tras la 0e, `actions-contract.test.ts` escanea todo `src/lib/`, así que no
  hay lista que mantener.
- Los tests también se parten.

| PR | Archivo | División |
|---|---|---|
| 7b | `assignments.ts` (1311) | `assignments.ts` (consultas), `assignments-admin.ts` (crear/editar/borrar/estado/folio), `assignments-lifecycle.ts` (visto/iniciar/pausar/reanudar/cerrar/reabrir), `assignment-attachments.ts`. |
| 7c | `tracking.ts` (1174) | `tracking.ts` (lecturas), `tracking-mutations.ts`, `src/lib/tracking/where.ts` (puro, probado). |
| 7d | `reports.ts` (1294) | `reports-fsr.ts`, `reports-incidents.ts`, `reports-vehicle-trips.ts`, `reports-notifications.ts`, `reports-summary.ts`; helpers en `src/lib/reports/`. |
| 7e | `incidents.ts` (1034) + `incidents-bulk.ts` (977) | `incidents.ts` (consultas), `incidents-admin.ts`, `incidents-reporter.ts`; la validación de filas a `src/lib/incidents/bulk-rows.ts`. |
| 7f | `tracking-table.tsx` (1847) + `bulk-incidents-client.tsx` (1212) | Tracking: columnas, filtros (ya existe `tracking-filters.tsx`), acciones de fila, un archivo por diálogo, tarjetas móviles y un hook de selección. Bulk: helpers puros a `src/lib/incidents/bulk-file.ts` y un componente por paso. |

Aprovechar estos PRs para activar knip **exports** en `src/lib/actions/`: una
Server Action sin usar es un endpoint vivo (H-06: `closeIncident`,
`reopenAssignment`, `refreshIncidentStatus`).

---

## Fase 8: Menos código en el cliente

34 de 124 `page.tsx` son enteramente `"use client"`: cargan en `useEffect`,
mandan todo el JS y no pueden llamar `requireRouteAccess`. Sigue
`docs/ui-patterns.md`: un Server Component no le pasa tipos de componente
(`icon={Icon}`) a un componente cliente.

- **8a. Listados de catálogos (~15):** `page.tsx` pasa a Server Component con
  `searchParams`. Las columnas y `CatalogTable` van en un archivo
  `"use client"` por catálogo. La búsqueda y la paginación se manejan por URL.
  Red de seguridad: `e2e/catalogs.spec.ts`, ya como `admin-operacion` tras la
  1b.
- **8b. Detalle y edición:** la página servidor carga y pasa props iniciales a
  un formulario cliente. Si el PR reescribe el formulario, usar
  `react-hook-form` + `zodResolver` con `src/lib/validations/`.
- **8c. Detalle de asignación FSR** (`fsr/assignments/[id]/page.tsx`, 717
  líneas): la carga pasa al servidor, con permiso y scope. Solo quedan como
  islas las acciones, el GPS, los adjuntos y la cola offline. Medir el First
  Load JS antes y después. `offline-field-capture.spec.ts`, verde.

---

## Backlog de endurecimiento

- **H-21, login:** limitar intentos por correo+IP (una tabla
  `LoginAttempt` con backoff, o una regla de rate limit de Vercel sobre
  `/api/auth/callback/credentials`: decisión #5). Verificar la contraseña antes
  de revisar el estado, y en correos inexistentes comparar contra un hash
  ficticio para igualar tiempos. Los mensajes al usuario ya son genéricos.
- **H-22, evidencias:** el SVG se quita en la 0e. Si se requiere que las
  evidencias no sean públicas, servirlas con un endpoint que valide sesión y
  scope, en lugar de URLs públicas de Blob (decisión de costo y complejidad).
- **H-24, permisos del FSR:** ver decisión #1.
- **`moment` → `date-fns`:** contrato que prohíba imports nuevos, con allowlist
  de los 18 actuales.
- **`@axe-core/playwright`** quedó en `dependencies` (sin commit en ui-revamp
  Fase 5); debe ir en `devDependencies`.

## Decisiones pendientes del usuario

| # | Decisión | Default recomendado |
|---|---|---|
| 1 | ¿El FSR necesita `users:read`, `clients:read`, `lines:*`, `equipments:*` y el `incidents:update` completo? (H-24) | Quitar `users:read` (ninguna pantalla FSR lo usa). Revisar con el equipo si el FSR da de alta líneas y equipos en campo. Restringir `incidents:update` del FSR a lo que usa su pantalla |
| 2 | ¿Quién cancela incidentes, lee y edita estados, y configura los días por antigüedad? (H-06) | ADMIN_OPERACION: `incidents:cancel` y `states:read`. Días por antigüedad bajo `vacations:manage` |
| 3 | ¿Qué pasa con `closeIncident`, `reopenAssignment` y `refreshIncidentStatus`? | Borrarlas, salvo que el spec vigente pida reabrir; en ese caso, conectar una pantalla |
| 4 | ¿Se bloquea crear estados nuevos de incidente o asignación? | No cambiar; documentar |
| 5 | Rate limit del login: ¿en la app o con una regla de Vercel? | En la app (sin costo ni configuración externa) |
| 6 | ¿Se fuerza un cambio de contraseña tras H-01? | Sí, para cuentas con contraseñas débiles o compartidas |
| 7 | Bloqueo de despliegues sin CI verde (1d) | Protección de rama en `main` |
| 8 | Límite de líneas por archivo (7a) | 500 |

## Cómo medir

```bash
# Acciones que reciben un id y no validan Cliente ni dueño (meta Fase 0: todas cubiertas o en allowlist).
# Lista por función: flags A=auth, S=scope, I=recibe id.
node -e '
const fs=require("fs"),d="src/lib/actions";
const AUTH=/require(Auth|Permission|Action)\(|withPermission\(/;
const SCOPE=/getReportScope|ScopeWhere|assertClientAccess|canAccessClient|scopeIncludesClient|load[A-Z]\w*For\(|requireClientAccess/;
for(const f of fs.readdirSync(d).filter(f=>f.endsWith(".ts")&&!f.includes(".test."))){
  const s=fs.readFileSync(d+"/"+f,"utf8"); if(!s.includes("\"use server\""))continue;
  const re=/export async function (\w+)\s*\(([^)]*)\)/g; let m,a=[];
  while((m=re.exec(s)))a.push([m[1],m[2],m.index]);
  a.forEach(([n,args,i],k)=>{const b=s.slice(i,k+1<a.length?a[k+1][2]:s.length);
    if(AUTH.test(b)&&!SCOPE.test(b)&&/\bid\b|Id\b/.test(args))console.log(f+":"+n);});
}'

# Relaciones a User sin select (meta Fase 0: 0)
grep -rnE "\b(user|reportedBy|approvedBy|seenBy)\s*:\s*true|user:\s*\{\s*include" src/lib --include=*.ts | grep -v '\.test\.'

# Spreads de scope junto a llaves que pueden chocar (revisar a mano cada resultado)
grep -rnE "\.\.\.(incidentScopeWhere|assignmentScopeWhere|scheduleScopeWhere|vehicleTripScopeWhere)\(|Object\.assign\(where" src --include=*.ts | grep -v '\.test\.'

# Permisos definidos que ningún rol del seed recibe (meta Fase 4: solo ROOT_ONLY)
for p in $(grep -oE 'name: "[a-z-]+:[a-z:-]+"' initial_load/seed.example.ts | grep -oE '"[^"]+"' | tr -d '"' | sort -u); do
  grep -qE "^\s*\"$p\"," initial_load/seed.example.ts || echo "$p"; done

# Specs e2e por rol (meta Fase 1: flujos operativos fuera de ROOT)
grep -rhoE 'authFile\("[a-z-]+"\)' e2e/*.spec.ts | sort | uniq -c

# Comparaciones de estado por nombre (meta Fase 3: 0)
grep -rnE "(status|Status)(\?)?\.name\s*(===|!==|==)\s*\"" src --include=*.ts --include=*.tsx | grep -v '\.test\.'

# Referencias a roles por nombre (meta Fase 3: solo constantes)
grep -rnE "whereHasRole\(\"|roleNames\.includes\(\"|name: \"(FSR|REPORTER|ROOT)\"" src --include=*.ts --include=*.tsx | grep -v '\.test\.'

# Archivos por encima del límite (meta Fase 7: solo baja)
find src -name '*.ts' -o -name '*.tsx' | grep -v '\.test\.' | grep -v 'components/ui/' \
  | xargs wc -l | awk '$1>500 && $2!="total"' | sort -rn

# Páginas enteramente cliente (meta Fase 8: bajar de 34)
grep -l '^"use client"' $(find src/app -name page.tsx) | wc -l
```

## Definición de terminado (todo el plan)

- Ninguna respuesta de una Server Action o de una ruta API contiene
  `password`, y la matriz de integración lo prueba.
- Cada acción que recibe un id valida Cliente, dueño y `active`, o está en un
  allowlist con razón. El contrato estático y la matriz IDOR lo sostienen.
- El scope se compone con `AND`, nunca con spread ni `Object.assign`.
- CI corre `verify`, `integration` y `e2e` en cada PR, con los flujos como
  ADMIN_OPERACION y ADMIN_VACACIONES, y hay una corrida nocturna con todos los
  navegadores.
- Todo permiso exigido por el código lo tiene algún rol o está en `ROOT_ONLY`,
  y el catálogo es la única fuente.
- Renombrar un estado o un rol desde la UI no cambia ningún comportamiento.
- El cron de correo, la captura offline y la edición de roles son atómicos
  ante reintentos y concurrencia.
- Ningún archivo nuevo pasa de 500 líneas, la campana no consulta con la
  pestaña oculta y tracking pagina.
- `CLAUDE.md` refleja las convenciones nuevas (`test:int`, `access.ts`,
  `withScope`, catálogo de permisos, códigos de estado y rol, límite de
  tamaño) y usa el nombre real del permiso de scope.

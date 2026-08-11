# OpusTrack

Sistema de gestión de incidentes y órdenes de trabajo para Centros de
Verificación Vehicular (VICs) en México.

El flujo central: **un Cliente reporta un incidente → un Administrador lo
programa y crea las asignaciones → un FSR da visto, trabaja en sitio y cierra →
el incidente se cierra automáticamente** cuando todas sus asignaciones cierran.

## Qué incluye

- **Incidentes y asignaciones** con máquinas de estado; el estado del incidente
  se deriva de sus asignaciones, no se escribe a mano.
- **RBAC database-driven**: roles, permisos y rutas viven en la base de datos.
- **Multi-tenancy por Cliente**: cada usuario solo ve los datos de su centro.
- **Inventario** con descuento y devolución de stock automáticos.
- **Vehículos y viajes** con odómetro, foto y GPS.
- **Programación, notificaciones y reportes** operativos.

## Stack

Next.js 15 (App Router) · PostgreSQL + Prisma · NextAuth v4 (JWT) ·
Tailwind 4 + shadcn/ui · Biome · TypeScript strict · Vitest + Playwright

---

## Montar el proyecto en local

Todo corre en Docker: la base de datos y el servidor Next. No necesitas
PostgreSQL instalado.

**Requisitos**: Node.js 22+ y Docker.

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar el entorno

Copia la plantilla y ajusta lo que necesites:

```bash
cp .env.example .env.development
```

Para desarrollo local, estos son los valores correctos:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/opustrack?schema=public"
NEXTAUTH_SECRET="dev-secret-not-for-production"
NEXTAUTH_URL="http://localhost:3000"
FILE_STORAGE_PROVIDER="filesystem"
```

> `DATABASE_URL` debe apuntar a `localhost`. Los comandos `db:*` se niegan a
> correr contra un host remoto, para que un `db:reset` no pueda alcanzar la base
> de producción.

### 3. Preparar la base de datos

```bash
npm run db:up     # crea el contenedor opustrack-db si no existe
npm run db:init   # migra y siembra SOLO si la base está vacía
```

`db:init` es idempotente: puedes ejecutarlo siempre. Si ya hay datos te lo dice
y no vuelve a sembrar.

### 4. Levantar la aplicación

```bash
npm run dev
```

Base de datos y servidor Next en contenedores, con hot reload, en
[http://localhost:3000](http://localhost:3000).

¿Prefieres correr Next en tu máquina y solo la base en Docker?

```bash
npm run db:up && npm run dev:host
```

### Credenciales

Las crea el seed. Si usas la plantilla (`initial_load/seed.example.ts`):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@opusinspection.com` | `password123` |
| FSR | `fsr@opusinspection.com` | `password123` |
| Cliente | `client@opusinspection.com` | `password123` |
| Invitado | `guest@opusinspection.com` | `password123` |

Si existe `initial_load/seed.ts` (datos reales, fuera de git), `db:init` lo usa
en su lugar y las credenciales están en `initial_load/users.txt`.

---

## Ejecutar los tests

```bash
npm run test:all      # todo: lint + tipos + unitarios + e2e
```

Por partes:

```bash
npm run check         # Biome + TypeScript
npm test              # unitarios en watch
npm run test:unit     # unitarios, una pasada
npm run test:e2e      # end-to-end en 5 navegadores
```

Los e2e crean **su propia base de datos** en Docker al empezar y la **destruyen
al terminar**, incluso si fallan o cancelas con Ctrl-C. No tocan tu base de
desarrollo ni la de producción.

Primera vez, instalar los navegadores:

```bash
npx playwright install
```

Para depurar un spec concreto sin recrear todo:

```bash
npm run e2e:up
npm run test:e2e:only -- --project=chromium e2e/incident-lifecycle.spec.ts
npm run e2e:down
```

---

## Comandos

### Desarrollo

```bash
npm run dev           # stack completo en Docker
npm run dev:host      # Next en el host, base en Docker
npm run stack:down    # detener el stack
npm run build         # build de producción (el que usa Vercel)
npm run format        # formatear con Biome
```

### Base de datos local

```bash
npm run db:up         # levantar el contenedor
npm run db:down       # detenerlo
npm run db:init       # migrar + sembrar si está vacía
npm run db:migrate    # crear una migración nueva
npm run db:studio     # abrir Prisma Studio
npm run db:reset      # borrar y reconstruir desde cero
```

### Base de datos de producción

Requieren confirmación escrita y muestran el destino antes de actuar.
Documentación completa en
[`docs/base-de-datos-produccion.md`](./docs/base-de-datos-produccion.md).

```bash
npm run db:prod:status    # solo lectura: migraciones y conteos
npm run db:prod:migrate   # aplicar migraciones pendientes
npm run db:prod:seed      # ejecutar el seed
npm run db:prod:reset     # BORRA TODO y reconstruye
npm run db:prod:studio    # Prisma Studio contra producción
```

---

## Entornos

| Archivo | Base de datos | Almacenamiento | Lo usa |
|---|---|---|---|
| `.env.development` | contenedor local | `filesystem` | desarrollo, `db:*`, tests unitarios |
| `.env.production` | Neon | `vercel-blob` | build local de producción, `db:prod:*` |
| `config/e2e.env` | contenedor efímero | `filesystem` | e2e (versionado, sin secretos) |
| Vercel Dashboard | Neon | `vercel-blob` | el despliegue real |

Ningún `.env*` se sube a git. Vercel toma sus variables del Dashboard, no de
estos archivos.

---

## Despliegue

Vercel despliega desde `main` con `npm run build`. Las variables se configuran
en el Dashboard del proyecto: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
`FILE_STORAGE_PROVIDER=vercel-blob` y `BLOB_READ_WRITE_TOKEN`.

Las migraciones **no** se aplican solas en el despliegue: córrelas con
`npm run db:prod:migrate` después de que Vercel publique.

---

## Documentación

- [`spec/`](./spec/) — especificación del dominio por área (incidentes,
  asignaciones, RBAC, inventario, vehículos, programación, notificaciones,
  reportes, festivos y vacaciones). Es la fuente de verdad del negocio.
- [`CLAUDE.md`](./CLAUDE.md) — arquitectura y patrones del proyecto.
- [`e2e/README.md`](./e2e/README.md) — cómo funciona la suite end-to-end.
- [`docs/base-de-datos-produccion.md`](./docs/base-de-datos-produccion.md) —
  operaciones sobre la base real.

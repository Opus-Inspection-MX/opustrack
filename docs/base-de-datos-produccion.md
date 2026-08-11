# Base de datos de producción

Operaciones contra la base real. Los comandos `db:*` normales se niegan a tocar
cualquier host que no sea local (`scripts/lib/db-guard.ts`); los `db:prod:*` son
la única vía para saltarse esa protección, y están diseñados para ser incómodos
a propósito.

> **Antes de cualquier cosa: ten un respaldo.** Neon tiene *branching* y
> *point-in-time restore*; úsalos antes de `migrate`, `seed` o `reset`.

---

## Cómo se conectan

Los `db:prod:*` leen `DATABASE_URL` de **`.env.production`**.

Vercel **no** usa ese archivo: toma sus variables del Dashboard. Es decir, que
`.env.production` apunte a la base correcta es responsabilidad tuya y nada lo
verifica. Por eso todos los comandos imprimen el host y la base antes de actuar
— **léelo antes de confirmar**.

---

## Comandos

| Comando | Qué hace | Destructivo |
|---|---|---|
| `npm run db:prod:status` | Estado de migraciones y conteo de filas | No |
| `npm run db:prod:migrate` | Aplica migraciones pendientes | Sí |
| `npm run db:prod:seed` | Ejecuta el seed | Sí |
| `npm run db:prod:reset` | **Borra todo**, migra y siembra desde cero | Sí |
| `npm run db:prod:studio` | Prisma Studio contra producción | Sí |

Todos, salvo `status`, piden que **escribas el nombre de la base** para
confirmar. Cualquier otra cosa cancela sin tocar nada.

Antes de pedir la confirmación se imprime siempre el estado actual:

```
🎯 Base de datos: postgresql://***:***@<host>/<base>
   Acción:        migrate — Aplica las migraciones pendientes.

   Contenido actual:
     usuarios        82
     clientes        107
     incidentes      0
     asignaciones    0
     programaciones  0

Escribe el nombre de la base ("<base>") para confirmar:
```

---

## Cuál usar

**`status`** — empieza siempre por aquí. Es solo lectura y te dice si hay
migraciones pendientes y qué hay en la base.

**`migrate`** — el flujo normal de despliegue. Usa `prisma migrate deploy`, que
solo aplica hacia adelante y nunca borra. Es lo que quieres el 95 % de las veces.

**`seed`** — ejecuta `initial_load/seed.ts` (o `PROD_SEED_SCRIPT`). El seed está
escrito con `upsert`, así que es idempotente para los catálogos; aun así puede
sobrescribir campos editados a mano. Úsalo para incorporar catálogos nuevos, no
para "arreglar" datos.

**`reset`** — borra la base entera. Solo tiene sentido en un entorno que puedas
perder, o después de un respaldo verificado. No hay deshacer.

**`studio`** — un GUI con permisos de escritura sobre producción. Cómodo y
peligroso; ciérralo cuando termines.

---

## Cambiar el seed

```bash
PROD_SEED_SCRIPT=initial_load/otro-seed.ts npm run db:prod:seed
```

Por defecto usa `initial_load/seed.ts`, que está en `.gitignore` porque contiene
datos reales de personal y clientes. Si no existe en tu copia, el comando fallará
en vez de sembrar datos de plantilla en producción — lo cual es intencional.

---

## Flujo recomendado para desplegar un cambio de esquema

```bash
npm run db:migrate          # 1. crear la migración en local
npm run test:all            # 2. verificar en local
git push                    # 3. Vercel despliega el código
npm run db:prod:status      # 4. confirmar qué falta aplicar
npm run db:prod:migrate     # 5. aplicar en producción
```

El paso 4 no es opcional: es donde ves si la base está donde crees que está.

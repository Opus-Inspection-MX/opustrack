# OpusTrack

Sistema profesional de gestión de incidentes y seguimiento de órdenes de trabajo para Centros de Verificación Vehicular (VICs) en México.

## 🚀 Características Principales

- **Gestión de Incidentes**: Sistema completo para reportar, rastrear y resolver incidentes
- **Órdenes de Trabajo**: Administración de órdenes con seguimiento de actividades y partes
- **Control de Acceso Basado en Roles (RBAC)**: Sistema dinámico de permisos almacenado en base de datos
- **Multi-tenancy**: Soporte para múltiples Centros de Verificación (VICs)
- **Gestión de Inventario**: Control de partes y refacciones
- **Reportes y Análisis**: Sistema de reportes integrado

## 🛠️ Stack Tecnológico

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Autenticación**: NextAuth v4 con JWT
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Estilos**: Tailwind CSS 4 + shadcn/ui
- **Linting**: Biome
- **TypeScript**: Strict mode habilitado

## 📋 Requisitos Previos

- Node.js 20+
- PostgreSQL 14+
- npm o yarn

## 🚀 Inicio Rápido

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd opustrack
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Este proyecto usa 2 archivos de entorno:

#### Archivos de Entorno

- `.env.development` - Desarrollo local Y tests (base de datos Docker)
- `.env.production` - Testing de build de producción local (base de datos Neon)

#### Setup Inicial

1. **Copia la plantilla de ejemplo:**

```bash
cp .env.example .env.development
```

2. **Actualiza `.env.development` con tus credenciales de Docker:**

```env
DATABASE_URL="postgresql://tu_usuario:tu_password@localhost:5432/opustrack?schema=public"
NEXTAUTH_SECRET="dev-secret-not-for-production"
NEXTAUTH_URL="http://localhost:3000"
FILE_STORAGE_PROVIDER="filesystem"
```

**¿Por qué archivos separados?**
- ✅ **Seguridad**: No puedes ejecutar código accidentalmente contra producción
- ✅ **Conveniencia**: Los comandos usan automáticamente la configuración correcta
- ✅ **Simplicidad**: Solo 2 ambientes (desarrollo y producción)

### 4. Configurar Base de Datos

```bash
# Ejecutar migraciones
npm run db:migrate

# Poblar base de datos con datos de prueba
npm run db:seed
```

### 5. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 👤 Credenciales de Prueba

Después de ejecutar el seed, puedes usar estas credenciales:

- **Administrador**: admin@opusinspection.com / password123 _(No relacionado con VIC)_
- **FSR**: fsr@opusinspection.com / password123 _(Field Service Representative)_
- **Cliente**: client@opusinspection.com / password123 _(Levanta incidentes desde VIC)_
- **Invitado**: guest@opusinspection.com / password123 _(Solo lectura)_

## 📚 Documentación

Toda la documentación del proyecto se encuentra en la carpeta [`docs/`](./docs/):

- **[docs/README.md](./docs/README.md)** - Índice de documentación
- **[CLAUDE.md](./CLAUDE.md)** - Arquitectura y guía de desarrollo
- **[docs/MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md)** - Guía de migración de base de datos
- **[docs/REFACTOR_SUMMARY.md](./docs/REFACTOR_SUMMARY.md)** - Resumen de refactorización
- **[docs/LOGIN_LOGOUT_GUIDE.md](./docs/LOGIN_LOGOUT_GUIDE.md)** - Guía de login/logout

### Documentación para Claude Code

Si estás usando Claude Code, consulta [CLAUDE.md](./CLAUDE.md) para información sobre:
- Arquitectura del sistema
- Comandos de desarrollo
- Sistema RBAC basado en base de datos
- Patrones comunes de desarrollo
- Funciones helper de autenticación

## 🧪 Comandos Disponibles

### Desarrollo

```bash
npm run dev           # Iniciar servidor de desarrollo (usa .env.development)
npm run build         # Compilar para producción local (usa .env.production)
npm run build:vercel  # Compilar para Vercel (usa variables de Vercel Dashboard)
npm run start         # Iniciar servidor de producción
```

### Tests

```bash
npm test              # Ejecutar tests unitarios (usa .env.development)
npm run test:ui       # Tests con interfaz visual
npm run test:watch    # Tests en modo watch
npm run test:coverage # Tests con reporte de cobertura
npm run test:e2e      # Tests end-to-end con Playwright (usa .env.development)
npm run test:e2e:ui   # E2E tests con interfaz visual
npm run test:e2e:debug # E2E tests en modo debug
```

### Calidad de Código

```bash
npm run lint          # Verificar código con Biome
npm run format        # Formatear código con Biome
```

### Base de Datos

```bash
npm run db:migrate    # Ejecutar migraciones (usa .env.development)
npm run db:studio     # Abrir Prisma Studio (usa .env.development)
npm run db:reset      # Resetear base de datos (usa .env.development)
npm run db:seed       # Poblar base de datos (usa .env.development)
```

**Nota**: Todos los comandos de desarrollo y tests usan `.env.development` automáticamente gracias a `dotenv-cli`.

### Migraciones en Producción

Para ejecutar migraciones en tu base de datos de producción (Neon):

```bash
# Opción 1: Usar .env.production localmente (CUIDADO - usa tu DB de producción!)
dotenv -e .env.production -- npx prisma migrate deploy

# Opción 2: Especificar DATABASE_URL directamente
DATABASE_URL="postgresql://tu-neon-url" npx prisma migrate deploy
```

**IMPORTANTE**: `prisma migrate deploy` solo ejecuta migraciones pendientes sin crear nuevas. Nunca corras `prisma migrate dev` contra producción.

## 🏗️ Estructura del Proyecto

```
opustrack/
├── src/
│   ├── app/                 # Páginas de Next.js App Router
│   │   ├── api/            # Rutas de API
│   │   ├── admin/          # Dashboard de administrador
│   │   ├── fsr/            # Dashboard de usuario sistema
│   │   ├── client/         # Dashboard de cliente
│   │   └── guest/          # Dashboard de personal
│   ├── components/          # Componentes React
│   │   ├── ui/             # Componentes shadcn/ui
│   │   ├── auth/           # Componentes de autenticación
│   │   └── layout/         # Componentes de layout
│   ├── lib/                # Bibliotecas de utilidades
│   │   ├── auth/           # Helpers de autenticación
│   │   ├── authz/          # Lógica de autorización
│   │   └── database/       # Cliente de Prisma
│   ├── middleware.ts       # Protección de rutas
│   └── types/              # Tipos de TypeScript
├── prisma/
│   ├── schema.prisma       # Esquema de base de datos
│   └── seed.ts            # Script de seed
├── docs/                   # Documentación
├── examples/               # Ejemplos de código
└── CLAUDE.md              # Guía para Claude Code
```

## 🔐 Sistema de Autenticación y Autorización

### Características

- **Sistema RBAC Basado en BD**: Todos los permisos y roles en PostgreSQL
- **Autenticación JWT**: NextAuth con estrategia JWT
- **Protección por Middleware**: Cada solicitud verificada
- **Redirecciones Basadas en Rol**: Usuarios redirigidos según su rol
- **Patrón Superusuario Admin**: Admin tiene acceso sin restricciones

### Roles Predeterminados

1. **ADMINISTRADOR** (`/admin`)
   - Acceso completo al sistema
   - Gestión de usuarios, roles y permisos
   - Todas las funcionalidades

2. **USUARIO_SISTEMA** (`/fsr`)
   - Gestión de incidentes y órdenes de trabajo
   - Acceso a reportes
   - Gestión de inventario

3. **USUARIO_PERSONAL** (`/guest`)
   - Visualización y actualización de incidentes
   - Acceso limitado a órdenes de trabajo

4. **USUARIO_EXTERNO** (`/client`)
   - Visualización de incidentes propios
   - Creación de nuevos incidentes
   - Acceso de solo lectura

### Funciones Helper

```typescript
// Obtener rutas accesibles
const routes = await getMyAccessibleRoutes();

// Verificar permiso
const canCreate = await canPerform("incidents:create");

// Requerir autenticación
const user = await requireAuth();

// Proteger rutas de API
export const POST = withPermission("incidents:create", async (req, user) => {
  // Handler
});
```

## 🚀 Deployment y CI/CD

### Deployment a Vercel

#### ¿Qué pasa durante el deployment?

Cuando haces push a tu repositorio, Vercel automáticamente:

1. Clona tu código
2. Instala dependencias: `npm install`
3. Ejecuta el build: `npm run build:vercel`
4. Despliega la aplicación

**IMPORTANTE**: Los tests **NO se ejecutan** en Vercel durante el deployment. Vercel solo compila la aplicación.

#### Configuración de Variables de Entorno en Vercel

Ve a tu proyecto en Vercel Dashboard → **Settings** → **Environment Variables** y configura:

```
DATABASE_URL
  Production + Preview: <tu-connection-string-de-neon>

NEXTAUTH_SECRET
  Production + Preview: <genera-con-openssl-rand-base64-32>

NEXTAUTH_URL
  Production: https://tu-dominio-produccion.com
  Preview: (déjalo vacío - Vercel lo genera automáticamente)

FILE_STORAGE_PROVIDER
  All: vercel-blob

BLOB_READ_WRITE_TOKEN
  All: <obtén-desde-vercel-dashboard-storage>
```

#### Configuración del Build Command

En Vercel Dashboard → **Settings** → **Build & Development Settings**:

- **Build Command**: `npm run build:vercel`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### CI/CD con GitHub Actions (Opcional pero Recomendado)

Para ejecutar tests automáticamente **antes** de que Vercel despliegue, configura GitHub Actions:

#### 1. Crea el archivo de workflow

Crea `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: opustrack
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/opustrack?schema=public

      - name: Run unit tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/opustrack?schema=public
          NEXTAUTH_SECRET: test-secret
          NEXTAUTH_URL: http://localhost:3000
          FILE_STORAGE_PROVIDER: filesystem

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/opustrack?schema=public
          NEXTAUTH_SECRET: test-secret
          NEXTAUTH_URL: http://localhost:3000
          FILE_STORAGE_PROVIDER: filesystem
```

#### ¿Cómo funciona?

1. **GitHub Actions crea una base de datos PostgreSQL temporal** en el runner de CI
2. **Ejecuta las migraciones** para crear las tablas
3. **Corre los tests** contra esa base de datos temporal
4. **Si los tests pasan**, Vercel procede con el deployment
5. **Si los tests fallan**, el deployment se detiene

#### ¿Por qué GitHub Actions puede ejecutar tests si no tiene acceso a tu Docker local?

**Respuesta**: GitHub Actions **NO usa tu base de datos local**. En su lugar:

- ✅ Crea un contenedor PostgreSQL **temporal** en la nube (GitHub runners)
- ✅ Este contenedor vive solo durante el workflow (unos minutos)
- ✅ Se destruye automáticamente al finalizar
- ✅ Es completamente independiente de tu Docker local
- ✅ No puede acceder a tus datos locales ni de producción

**Flujo completo**:

```
┌─────────────────┐
│  git push       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  GitHub Actions         │
│  ┌─────────────────┐   │
│  │ PostgreSQL temp │   │  ← Base de datos temporal
│  └─────────────────┘   │
│          │              │
│          ▼              │
│  ┌─────────────────┐   │
│  │  Run tests      │   │  ← Tests corren aquí
│  └─────────────────┘   │
└────────┬────────────────┘
         │
         ▼ (Si tests pasan)
┌─────────────────────────┐
│  Vercel Deployment      │
│  Uses: Neon Database    │  ← Producción usa tu DB real
└─────────────────────────┘
```

### Resumen de Ambientes

| Ambiente | Base de Datos | Cuándo se usa |
|----------|---------------|---------------|
| **Local Dev & Tests** | Docker local (`opustrack`) | `npm run dev`, `npm test` |
| **GitHub Actions CI** | PostgreSQL temporal | Automático en push/PR |
| **Vercel Production** | Neon (producción) | Deployment automático |

**✅ Tu base de datos de producción está 100% segura:**
- Desarrollo y tests locales → Docker local (misma base de datos)
- Tests en CI → Base de datos temporal en GitHub
- Producción → Neon (nunca tocada por tests)

## 🧩 Ejemplos de Uso

### Proteger una Página

```typescript
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function MyPage() {
  const user = await requireRouteAccess("/my-page");
  return <div>Contenido protegido</div>;
}
```

### Proteger una Ruta de API

```typescript
import { withPermission } from "@/lib/auth/auth";

export const POST = withPermission("incidents:create", async (req, user) => {
  // El usuario está autenticado y autorizado
  const body = await req.json();
  // ... lógica
  return Response.json({ success: true });
});
```

### Navegación Dinámica

```typescript
import { getMyAccessibleRoutes } from "@/lib/auth/auth";

export default async function Navigation() {
  const routes = await getMyAccessibleRoutes();

  return (
    <nav>
      {routes.map(route => (
        <a key={route} href={route}>{route}</a>
      ))}
    </nav>
  );
}
```

## 🐛 Solución de Problemas

### Error de Conexión a Base de Datos

Verifica que:
- PostgreSQL esté ejecutándose
- `DATABASE_URL` en `.env` sea correcta
- El usuario tenga permisos en la base de datos

```bash
# Probar conexión
npm run db:migrate
```

### Errores de Permiso

Verifica que:
- El rol tenga el permiso requerido en la BD
- El nombre del permiso coincida exactamente
- La caché de permisos esté actualizada

```typescript
// Limpiar caché de permisos
import { clearPermissionsCache } from "@/lib/authz/authz";
clearPermissionsCache();
```

### Redirecciones Incorrectas

Verifica que:
- El rol tenga un `defaultPath` en la BD
- El middleware esté ejecutándose
- No haya errores en la consola del navegador

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Notas de Desarrollo

- El sistema usa **Turbopack** para compilaciones más rápidas
- **Biome** reemplaza a ESLint y Prettier
- Todos los modelos de BD tienen campo `active` para soft deletes
- VIC (Vehicle Inspection Center) es la unidad organizacional central
- Los tokens JWT expiran después de 30 días

## 📄 Licencia

[Especificar Licencia]

## 📞 Soporte

Para problemas o preguntas:
1. Consulta la [documentación en docs/](./docs/)
2. Revisa los [ejemplos en examples/](./examples/)
3. Consulta [CLAUDE.md](./CLAUDE.md) para arquitectura

---

Desarrollado con Next.js 15 y Prisma

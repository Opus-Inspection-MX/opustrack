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

Crea un archivo `.env` en la raíz del proyecto:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/opustrack"

# NextAuth
NEXTAUTH_SECRET="your-secret-here"  # Genera con: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
```

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
npm run dev          # Iniciar servidor de desarrollo (Turbopack)
npm run build        # Compilar para producción
npm run start        # Iniciar servidor de producción
```

### Calidad de Código

```bash
npm run lint         # Verificar código con Biome
npm run format       # Formatear código con Biome
```

### Base de Datos

```bash
npm run db:migrate   # Ejecutar migraciones de Prisma
npm run db:studio    # Abrir Prisma Studio (GUI de BD)
npm run db:reset     # Resetear base de datos
npm run db:seed      # Poblar base de datos con datos de prueba
```

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

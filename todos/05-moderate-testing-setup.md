# 🟡 MODERADO: Configurar Framework de Testing

## Problema
El proyecto no tiene ningún tipo de testing: ni unitarios, ni de integración, ni E2E.

**Severity**: 🟡 Media (Calidad de Código)
**Esfuerzo**: 🔴 Alto (4-6 horas setup + escribir tests)
**Impacto**: Confianza en refactors, prevención de regresiones

## Stack Recomendado

### Testing Framework: Vitest
- Más rápido que Jest
- Compatible con Vite/Next.js
- Syntax similar a Jest

### React Testing: Testing Library
- Estándar de la industria
- Enfoque en testing de comportamiento

### E2E: Playwright (opcional, largo plazo)
- Mejor que Cypress para Next.js
- Soporte para múltiples browsers

## Instalación

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

## Configuración

### 1. vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/*.d.ts',
        'src/components/ui/**', // shadcn components
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 2. tests/setup.ts

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock NextAuth
vi.mock('next-auth', () => ({
  default: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
```

### 3. Actualizar package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 4. Actualizar tsconfig.json

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

## Estructura de Tests

```
/tests
├── setup.ts                      # Test setup
├── /unit                         # Unit tests
│   ├── /lib
│   │   ├── auth.test.ts
│   │   ├── authz.test.ts
│   │   └── filters.test.ts
│   └── /utils
│       └── format.test.ts
├── /integration                  # Integration tests
│   ├── /actions
│   │   ├── incidents.test.ts
│   │   └── work-orders.test.ts
│   └── /api
│       └── incidents.test.ts
├── /components                   # Component tests
│   ├── IncidentForm.test.tsx
│   └── WorkOrderCard.test.tsx
└── /helpers                      # Test helpers
    ├── mocks.ts
    └── factories.ts
```

## Ejemplos de Tests

### 1. Unit Test - Authorization

```typescript
// tests/unit/lib/authz.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { roleCanAccessRoute, roleHasPermission } from '@/lib/authz/authz';

describe('Authorization', () => {
  describe('roleCanAccessRoute', () => {
    it('should grant admin access to all routes', () => {
      const adminRole = {
        id: 1,
        name: 'ADMINISTRADOR',
        defaultPath: '/admin',
        permissions: []
      };

      expect(roleCanAccessRoute(adminRole, '/admin')).toBe(true);
      expect(roleCanAccessRoute(adminRole, '/fsr')).toBe(true);
      expect(roleCanAccessRoute(adminRole, '/client')).toBe(true);
    });

    it('should restrict FSR to allowed routes only', () => {
      const fsrRole = {
        id: 2,
        name: 'FSR',
        defaultPath: '/fsr',
        permissions: [
          { permission: { routePath: '/fsr' } },
          { permission: { routePath: '/incidents' } },
        ]
      };

      expect(roleCanAccessRoute(fsrRole, '/fsr')).toBe(true);
      expect(roleCanAccessRoute(fsrRole, '/incidents')).toBe(true);
      expect(roleCanAccessRoute(fsrRole, '/admin')).toBe(false);
    });
  });

  describe('roleHasPermission', () => {
    it('should check permission by name', () => {
      const role = {
        permissions: [
          { permission: { name: 'incidents:read' } },
          { permission: { name: 'incidents:create' } },
        ]
      };

      expect(roleHasPermission(role, 'incidents:read')).toBe(true);
      expect(roleHasPermission(role, 'incidents:delete')).toBe(false);
    });
  });
});
```

### 2. Integration Test - Server Actions

```typescript
// tests/integration/actions/incidents.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIncident, getIncidents } from '@/lib/actions/incidents';
import { prisma } from '@/lib/database/prisma.singleton';

// Mock auth
vi.mock('@/lib/auth/auth', () => ({
  requirePermission: vi.fn(async () => ({
    id: 'user-1',
    roleId: 1,
    vicId: 'vic-1',
    role: { name: 'FSR' }
  }))
}));

describe('Incident Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createIncident', () => {
    it('should create incident with valid data', async () => {
      const mockIncident = {
        id: 1,
        title: 'Test Incident',
        priority: 5,
        active: true,
      };

      vi.spyOn(prisma.incident, 'create').mockResolvedValue(mockIncident);

      const result = await createIncident({
        title: 'Test Incident',
        priority: 5,
        typeId: 1,
        statusId: 1,
        vicId: 'vic-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockIncident);
    });

    it('should filter by VIC for non-admin users', async () => {
      vi.spyOn(prisma.incident, 'findMany').mockResolvedValue([]);

      await getIncidents();

      expect(prisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vicId: 'vic-1'
          })
        })
      );
    });
  });
});
```

### 3. Component Test

```typescript
// tests/components/IncidentCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncidentCard } from '@/components/incidents/IncidentCard';

describe('IncidentCard', () => {
  const mockIncident = {
    id: 1,
    title: 'Test Incident',
    priority: 5,
    status: { name: 'ABIERTO', color: '#ef4444' },
    type: { name: 'Mecánico' },
    reportedAt: new Date('2024-01-01'),
  };

  it('should render incident details', () => {
    render(<IncidentCard incident={mockIncident} />);

    expect(screen.getByText('Test Incident')).toBeInTheDocument();
    expect(screen.getByText('Priority: 5')).toBeInTheDocument();
    expect(screen.getByText('ABIERTO')).toBeInTheDocument();
  });

  it('should show priority badge with correct color', () => {
    render(<IncidentCard incident={mockIncident} />);

    const priorityBadge = screen.getByText('5');
    expect(priorityBadge).toHaveClass('badge-priority-high');
  });
});
```

### 4. Test Helpers

```typescript
// tests/helpers/factories.ts
import type { Incident, User, Role } from '@prisma/client';

export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  roleId: 1,
  vicId: 'vic-1',
  status: 'ACTIVO',
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockIncident = (overrides?: Partial<Incident>): Incident => ({
  id: 1,
  title: 'Test Incident',
  description: 'Test description',
  priority: 5,
  typeId: 1,
  statusId: 1,
  vicId: 'vic-1',
  reportedById: 'user-1',
  reportedAt: new Date(),
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockRole = (overrides?: Partial<Role>): Role => ({
  id: 1,
  name: 'FSR',
  description: 'Field Service Representative',
  defaultPath: '/fsr',
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
```

## Coverage Goals

### Mínimo Inicial
- **Unit Tests**: 60% coverage en `src/lib`
- **Integration Tests**: Server actions críticos
- **Component Tests**: Componentes de formulario

### Objetivo Largo Plazo
- **Overall**: 80% coverage
- **Critical Paths**: 90% coverage (auth, authz, actions)

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:run

      - name: Coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Checklist de Completado

- [ ] Instalar Vitest y dependencias
- [ ] Crear `vitest.config.ts`
- [ ] Crear `tests/setup.ts` con mocks
- [ ] Actualizar `package.json` scripts
- [ ] Crear estructura de carpetas `/tests`
- [ ] Escribir tests de authorization (authz.test.ts)
- [ ] Escribir tests de filters (filters.test.ts)
- [ ] Escribir tests de server actions (incidents.test.ts)
- [ ] Escribir tests de componentes (IncidentForm.test.tsx)
- [ ] Crear helpers y factories
- [ ] Setup CI/CD pipeline
- [ ] Documentar en README.md

## Criterio de Éxito

✅ `npm run test` ejecuta tests sin errores
✅ Coverage > 60% en `src/lib`
✅ Tests de authz pasando (admin, role checks)
✅ Tests de VIC filtering pasando
✅ Tests de componentes renderizando correctamente
✅ CI/CD corriendo tests en PRs

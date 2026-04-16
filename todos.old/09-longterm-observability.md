# 🟢 LARGO PLAZO: Implementar Observabilidad

## Problema
El sistema no tiene logging estructurado, métricas, ni monitoreo de eventos de seguridad.

**Severity**: 🟢 Baja (Operaciones)
**Esfuerzo**: 🔴 Alto (6-8 horas)
**Impacto**: Debugging, auditoría, observabilidad

## Áreas de Observabilidad

### 1. Security Logging
- Intentos de acceso denegado
- Cambios de permisos
- Logins/logouts
- Acciones sensibles (deletes, updates críticos)

### 2. Performance Monitoring
- Tiempos de respuesta de API
- Queries lentas de Prisma
- Cache hit/miss rates

### 3. Business Metrics
- Incidents creados por día
- Work orders completados
- Tiempo promedio de resolución
- Stock bajo de parts

### 4. Error Tracking
- Excepciones no manejadas
- Errores de validación
- Fallos de integración

## Solución

### 1. Logger Estructurado

**Archivo**: `src/lib/logging/logger.ts`

```typescript
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SECURITY = 'security'
}

export enum SecurityEventType {
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_CHECK = 'PERMISSION_CHECK',
  AUTH_FAILURE = 'AUTH_FAILURE',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  ROLE_CHANGED = 'ROLE_CHANGED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  SENSITIVE_ACTION = 'SENSITIVE_ACTION'
}

interface LogContext {
  userId?: string;
  userEmail?: string;
  roleId?: number;
  roleName?: string;
  resource?: string;
  action?: string;
  metadata?: Record<string, any>;
}

class Logger {
  private serviceName: string;

  constructor(serviceName = 'opustrack') {
    this.serviceName = serviceName;
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...context
    };

    // En desarrollo: console
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(logEntry, null, 2));
    }

    // En producción: enviar a servicio externo
    // this.sendToLogService(logEntry);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, {
      ...context,
      error: error?.message,
      stack: error?.stack
    });
  }

  security(
    eventType: SecurityEventType,
    message: string,
    context?: LogContext
  ) {
    this.log(LogLevel.SECURITY, message, {
      ...context,
      eventType,
      severity: 'high'
    });
  }
}

export const logger = new Logger();
```

### 2. Integrar en Auth/Authz

```typescript
// src/lib/auth/auth.ts

export async function requirePermission(permissionName: string) {
  const user = await getAuthenticatedUser();

  if (!user) {
    logger.security(
      SecurityEventType.AUTH_FAILURE,
      "Unauthenticated access attempt",
      { resource: permissionName }
    );
    redirect("/login");
  }

  const hasPermission = await userHasPermission(user, permissionName);

  if (!hasPermission) {
    logger.security(
      SecurityEventType.ACCESS_DENIED,
      `Permission denied: ${permissionName}`,
      {
        userId: user.id,
        userEmail: user.email,
        roleName: user.role?.name,
        resource: permissionName
      }
    );

    throw new Error("Forbidden");
  }

  logger.info(`Permission granted: ${permissionName}`, {
    userId: user.id,
    userEmail: user.email,
    resource: permissionName
  });

  return user;
}
```

### 3. Performance Monitoring

```typescript
// src/lib/logging/performance.ts

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  async measure<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - start;

      this.recordMetric(operation, duration);

      if (duration > 1000) {
        logger.warn(`Slow operation: ${operation}`, {
          duration,
          metadata: { threshold: 1000 }
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Operation failed: ${operation}`, error as Error, {
        duration
      });
      throw error;
    }
  }

  private recordMetric(operation: string, duration: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    this.metrics.get(operation)!.push(duration);
  }

  getStats(operation: string) {
    const durations = this.metrics.get(operation) || [];

    if (durations.length === 0) {
      return null;
    }

    const sorted = [...durations].sort((a, b) => a - b);

    return {
      count: durations.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
}

export const perfMonitor = new PerformanceMonitor();
```

**Uso**:
```typescript
export async function getIncidents() {
  return await perfMonitor.measure('getIncidents', async () => {
    const user = await requirePermission("incidents:read");
    return await prisma.incident.findMany({...});
  });
}
```

### 4. Audit Trail (Base de Datos)

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])

  action    String   // CREATE, UPDATE, DELETE, ACCESS
  resource  String   // incidents, work-orders, users
  resourceId String?

  eventType String   // SECURITY, BUSINESS, SYSTEM

  before    Json?    // Estado anterior (para updates)
  after     Json?    // Estado nuevo

  metadata  Json?    // Contexto adicional

  ipAddress String?
  userAgent String?

  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([resource, resourceId])
  @@index([eventType, createdAt])
}
```

**Helper**:
```typescript
// src/lib/logging/audit.ts

export async function logAudit({
  userId,
  action,
  resource,
  resourceId,
  before,
  after,
  metadata,
  req
}: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resource,
      resourceId,
      eventType: 'BUSINESS',
      before,
      after,
      metadata,
      ipAddress: req?.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req?.headers.get('user-agent') || 'unknown'
    }
  });
}
```

**Uso en Server Actions**:
```typescript
export async function deleteIncident(id: number) {
  const user = await requirePermission("incidents:delete");

  const incident = await prisma.incident.findUnique({ where: { id } });

  await prisma.incident.update({
    where: { id },
    data: { active: false }
  });

  await logAudit({
    userId: user.id,
    action: 'DELETE',
    resource: 'incidents',
    resourceId: id.toString(),
    before: incident,
    after: { active: false },
    metadata: { soft_delete: true }
  });

  return { success: true };
}
```

### 5. Integración con Servicios Externos

#### Opción A: Sentry (Error Tracking)

```bash
npm install @sentry/nextjs
```

```typescript
// sentry.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

#### Opción B: LogRocket (Session Replay)

```bash
npm install logrocket
```

```typescript
// src/lib/logging/logrocket.ts
import LogRocket from 'logrocket';

if (process.env.NEXT_PUBLIC_LOGROCKET_ID) {
  LogRocket.init(process.env.NEXT_PUBLIC_LOGROCKET_ID);
}

export function identifyUser(user: User) {
  LogRocket.identify(user.id, {
    name: user.name,
    email: user.email,
    role: user.role?.name
  });
}
```

#### Opción C: Better Stack (Logging)

```bash
npm install @logtail/node @logtail/next
```

```typescript
// src/lib/logging/logtail.ts
import { Logtail } from "@logtail/node";

const logtail = new Logtail(process.env.LOGTAIL_TOKEN!);

export function sendToLogtail(level: string, message: string, context: any) {
  logtail[level](message, context);
}
```

### 6. Dashboard de Métricas (Interno)

```typescript
// src/app/admin/metrics/page.tsx

export default async function MetricsPage() {
  const metrics = await getSystemMetrics();

  return (
    <div>
      <h1>System Metrics</h1>

      <MetricCard
        title="Incidents Today"
        value={metrics.incidentsToday}
        change={metrics.incidentsTrend}
      />

      <MetricCard
        title="Avg Resolution Time"
        value={`${metrics.avgResolutionTime}h`}
        change={metrics.resolutionTrend}
      />

      <ChartComponent data={metrics.weeklyActivity} />
    </div>
  );
}

async function getSystemMetrics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const incidentsToday = await prisma.incident.count({
    where: {
      createdAt: { gte: today },
      active: true
    }
  });

  // Más métricas...

  return { incidentsToday, /* ... */ };
}
```

## Métricas Clave a Rastrear

### Performance
- Response time (p50, p95, p99)
- Database query duration
- Cache hit rate
- API error rate

### Security
- Failed login attempts per hour
- Permission denials per user
- Unusual access patterns
- Role changes

### Business
- Incidents created/resolved per day
- Average resolution time
- Work orders completed
- Parts usage
- User activity

## Alertas

```typescript
// src/lib/logging/alerts.ts

export async function checkAndAlert() {
  // Alerta: Muchos intentos de login fallidos
  const failedLogins = await prisma.auditLog.count({
    where: {
      eventType: 'SECURITY',
      action: 'AUTH_FAILURE',
      createdAt: { gte: new Date(Date.now() - 3600000) } // última hora
    }
  });

  if (failedLogins > 10) {
    await sendAlert({
      type: 'SECURITY',
      message: `${failedLogins} failed login attempts in last hour`,
      severity: 'high'
    });
  }

  // Alerta: Stock bajo
  const lowStockParts = await prisma.part.count({
    where: {
      stock: { lt: 10 },
      active: true
    }
  });

  if (lowStockParts > 0) {
    await sendAlert({
      type: 'INVENTORY',
      message: `${lowStockParts} parts with low stock`,
      severity: 'medium'
    });
  }
}
```

## Checklist de Completado

- [ ] Implementar logger estructurado
- [ ] Integrar logging en auth/authz
- [ ] Agregar performance monitoring
- [ ] Crear modelo AuditLog
- [ ] Implementar audit trail en actions
- [ ] Elegir servicio externo (Sentry/LogRocket)
- [ ] Crear dashboard de métricas
- [ ] Implementar sistema de alertas
- [ ] Configurar CI para enviar logs
- [ ] Documentar en CLAUDE.md

## Criterio de Éxito

✅ Eventos de seguridad loggeados
✅ Performance metrics registradas
✅ Audit trail completo en BD
✅ Alertas automáticas funcionando
✅ Dashboard de métricas accesible

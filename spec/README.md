# Especificación de OpusTrack

Especificación de dominio del sistema **OpusTrack** — gestión de incidentes y órdenes de
trabajo para Centros de Verificación Vehicular en México.

Estos documentos son **reverse-engineering del código actual**: describen lo que el sistema
hace hoy, no una propuesta. Son la base para planificar cambios futuros con SDD
(Spec-Driven Development).

## Cómo leer esta carpeta

Empezá por **[00 · Visión general](./00-overview.md)**: define el lenguaje ubicuo, los roles,
la convención de requisitos `RF-XXX` y las reglas de negocio que cruzan todos los dominios.
Cada spec de dominio asume eso y no lo repite.

## Formato

Híbrido: requisitos numerados `RF-XXX` con sus reglas de negocio, más escenarios
`DADO / CUANDO / ENTONCES` **solo donde aportan** (máquinas de estado, manejo de stock, cierre
automático, captura GPS, chequeos de permiso). El CRUD simple se documenta en prosa y tablas.

## Índice

| # | Documento | Contenido | Rango RF |
|---|-----------|-----------|----------|
| 00 | [Visión general](./00-overview.md) | Lenguaje ubicuo, roles, convención RF, reglas transversales, deuda técnica | — |
| 01 | [Autenticación y RBAC](./01-auth-rbac.md) | Login, JWT + Edge, RBAC en BD, sesiones, usuarios, roles | RF-100–149 |
| 02 | [Clientes y jerarquía](./02-clientes-jerarquia.md) | State → Cliente → Línea → Equipo | RF-150–199 |
| 03 | [Incidentes](./03-incidentes.md) | Ciclo de vida, máquina de estados, cierre automático, FSRs habilitados | RF-025, RF-200–249 |
| 04 | [Asignaciones](./04-asignaciones.md) | Máquina "Visto", GPS, folio, ODT, multi-FSR, actividades, adjuntos | RF-010, RF-250–299 |
| 05 | [Partes e inventario](./05-partes-inventario.md) | Catálogo y stock automático | RF-300–349 |
| 06 | [Vehículos y viajes](./06-vehiculos-viajes.md) | Flota, odómetro, GPS, km recorridos | RF-350–399 |
| 07 | [Programación](./07-programacion.md) | Schedules, calendario, vínculo cliente/incidente | RF-400–449 |
| 08 | [Notificaciones](./08-notificaciones.md) | Triggers, tipos, lectura, prioridad | RF-450–499 |
| 09 | [Reportes, tracking y dashboard](./09-reportes-tracking.md) | Reportes operativos, seguimiento, métricas | RF-500–549 |
| 10 | [Festivos y vacaciones](./10-festivos-vacaciones.md) | Festivos LFT, vacaciones FSR, bloqueo de días inhábiles | RF-700–749 |

## Convención al agregar requisitos

Usá el siguiente número libre dentro del rango del dominio (ver tabla en
[00 · Visión general](./00-overview.md)). No reutilices ni renumeres requisitos existentes:
se referencian de forma cruzada entre documentos.

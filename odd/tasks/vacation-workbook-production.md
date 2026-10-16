# Vacaciones: conciliación del Excel y carga incremental

Continuación autorizada de T8c del [tracker de carga inicial](initial-load-workbooks.md). El usuario solicitó ejecutar el plan, probarlo y seguir el flujo documental; confirmó cortes por aniversario y conservación pendiente de identidades sin cuenta y saldos inconsistentes. Solicitó meses de vigencia configurables y que ningún dato sensible entre al repositorio.

El contrato sigue implementación directa con código, pruebas y documentación juntos; no se activa RDD. Fuente funcional: `spec/10-festivos-vacaciones.md`; diseño y ejecución: `docs/plans/vacaciones-excel-produccion.md`. Los reportes públicos contienen conteos y categorías, nunca identidades, fechas individuales, extractos, credenciales ni respaldos. No hay cambios de permisos o accesos de usuarios.

- [x] Inventario de producción en lectura y comparación privada con el libro.
- [x] Archivo íntegro de celdas, fórmulas, observaciones y reglas; excepciones pendientes.
- [x] Ventanas por aniversario y prórroga configurable; corrección de fechas civiles importadas.
- [x] Importador incremental con simulación, huella del destino, auditoría y reejecución sin duplicados.
- [x] Consulta administrativa con autorización de servidor y descarga privada.
- [x] Verificación final: 174 archivos / 1758 unitarios; 2 archivos / 10 pruebas PostgreSQL; check completo; build de producción y 8 casos Chromium (7 de autenticación y 1 flujo nuevo).
- [x] Respaldo privado 0600 restaurado en PostgreSQL local aislado; conteos comprobados; migración aditiva aplicada. Simulación final en curso.
- [ ] Carga y conciliación independiente, segunda ejecución sin cambios.
- [ ] Entrega de código y verificación del despliegue.

La primera ejecución completa de unitarios detectó Node 26 en el shell, contrario al contrato de Node 24; con el runtime local Node 24 pasaron 173 archivos / 1756 pruebas en ese checkpoint. La integración inicial de importación pasó dos casos; al combinarla con las pruebas de solicitudes detectó una validación demasiado amplia de consumos históricos de otros usuarios. Se corrigió para comprobar solo las cuentas afectadas. La evidencia final se registra al terminar.

La frontera de rollback comprende la migración aditiva, importador/lector, componentes de archivo, reglas compartidas y cambios de ciclos/fechas, junto con pruebas y documentación. Las filas importadas y los snapshots conciliados requieren reversión revisada mediante respaldo/auditoría; volver al código anterior por sí solo no revierte los datos. No retirar evidencia de origen ni solicitudes.

Entrega: un cambio de dominio integrado (esquema, importación, ciclo y consulta), mayor que el presupuesto orientativo de 400 líneas; no se ha solicitado ni abierto PR. Se conserva como unidad funcional con pruebas y documentación; una revisión posterior puede dividirlo por fundamento de ciclos, lector de origen, importador y consulta administrativa.

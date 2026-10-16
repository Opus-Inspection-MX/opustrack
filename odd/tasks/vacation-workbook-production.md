# Vacaciones: conciliación del Excel y carga incremental

Continuación autorizada de T8c del [tracker de carga inicial](initial-load-workbooks.md). El usuario solicitó ejecutar el plan, probarlo y seguir el flujo documental; confirmó cortes por aniversario y conservación pendiente de identidades sin cuenta y saldos inconsistentes. Solicitó meses de vigencia configurables y que ningún dato sensible entre al repositorio.

El contrato sigue implementación directa con código, pruebas y documentación juntos; no se activa RDD. Fuente funcional: `spec/10-festivos-vacaciones.md`; diseño y ejecución: `docs/plans/vacaciones-excel-produccion.md`. Los reportes públicos contienen conteos y categorías, nunca identidades, fechas individuales, extractos, credenciales ni respaldos. No hay cambios de permisos o accesos de usuarios.

- [x] Inventario de producción en lectura y comparación privada con el libro.
- [x] Archivo íntegro de celdas, fórmulas, observaciones y reglas; excepciones pendientes.
- [x] Ventanas por aniversario y prórroga configurable; corrección de fechas civiles importadas.
- [x] Importador incremental con simulación, huella del destino, auditoría y reejecución sin duplicados.
- [x] Consulta administrativa con autorización de servidor y descarga privada.
- [x] Verificación final: 174 archivos / 1758 unitarios; 2 archivos / 10 pruebas PostgreSQL; check completo; build de producción y 8 casos Chromium (7 de autenticación y 1 flujo nuevo).
- [x] Respaldo privado 0600 restaurado en PostgreSQL local aislado; conteos comprobados; migración aditiva aplicada. Simulación final confirmó 145 filas, 115 conciliadas y 30 pendientes.
- [x] Carga completada; conciliación independiente en lectura verificó todas las celdas y las 145 filas, 115 consumos, 18 saldos operativos y la solicitud cancelada conservada. Relectura del mismo libro confirma ausencia de cambios propuestos.
- [x] Código seguro entregado en `e66f6e8`; estado Vercel `success` confirmado para ese commit.

La primera ejecución completa de unitarios detectó Node 26 en el shell, contrario al contrato de Node 24; con el runtime local Node 24 pasaron 173 archivos / 1756 pruebas en ese checkpoint. La integración inicial de importación pasó dos casos; al combinarla con las pruebas de solicitudes detectó una validación demasiado amplia de consumos históricos de otros usuarios. Se corrigió para comprobar solo las cuentas afectadas. La evidencia final se registra al terminar.

La frontera de rollback comprende la migración aditiva, importador/lector, componentes de archivo, reglas compartidas y cambios de ciclos/fechas, junto con pruebas y documentación. Las filas importadas y los snapshots conciliados requieren reversión revisada mediante respaldo/auditoría; volver al código anterior por sí solo no revierte los datos. No retirar evidencia de origen ni solicitudes.

Entrega: un cambio de dominio integrado (esquema, importación, ciclo y consulta), mayor que el presupuesto orientativo de 400 líneas; no se ha solicitado ni abierto PR. Se conserva como unidad funcional con pruebas y documentación; una revisión posterior puede dividirlo por fundamento de ciclos, lector de origen, importador y consulta administrativa.

Resultado de producción: 195 períodos por aniversario y 213 registros de auditoría de la conciliación; 24 usuarios conservados. Las 30 filas pendientes están archivadas y no generan consumos. La configuración inicial de prórroga se conserva; la administración puede cambiarla para períodos nuevos. El respaldo permanece privado y fuera de Git.

La prueba HTTP anónima usando la URL del perfil local de producción llegó a un sitio ajeno a la aplicación; no valida el frontend productivo ni se usó para modificar configuración. La entrega se verificó mediante el estado de despliegue Vercel del commit, compilación y navegador contra la aplicación aislada. La URL local y las variables del Dashboard de Vercel son fuentes distintas.

La auditoría del índice antes de publicar encontró 28 archivos seguros, cero coincidencias de nombres/correos reales y cero Excel/CSV/respaldos/credenciales incluidos. El diff de la migración generada tenía una línea vacía al final; tras aplicarla se conservaron sus bytes para mantener el checksum. El check del proyecto (Biome, TypeScript, knip) pasó; sus 12 avisos de optional chaining son no bloqueantes.

# Mantenimiento de la ayuda de usuario

Las cinco guías de este directorio son la fuente única de la sección de Ayuda, disponible con sesión iniciada en `/inicio/ayuda`. La exportación a PDF no está implementada.

## Actualizar una guía

1. Verifique el flujo y los textos exactos de los botones contra la interfaz actual y las reglas de negocio de `spec/`.
2. Edite el archivo Markdown correspondiente en español neutro y sin datos de producción.
3. Ejecute `npm run test:unit -- src/app/inicio/ayuda/help.test.tsx src/lib/navigation/menu.test.ts next.config.test.ts` y después `npm run check`.
4. Abra Ayuda en la aplicación y revise la guía en tamaños de pantalla móvil y de escritorio. Compruebe las instrucciones con una cuenta que tenga los permisos correspondientes antes de publicar cambios en los procedimientos.

## Markdown admitido

Cada guía comienza con un `# Título`, una línea en blanco y un párrafo de resumen. Los bloques del cuerpo se separan con líneas en blanco y admiten `## Sección`, párrafos de texto, listas numeradas (`1. Elemento`) y listas con viñetas (`- Elemento`). Mantenga cada elemento de lista en una sola línea del archivo. No se interpretan formato en línea, enlaces, imágenes, HTML, tablas ni listas anidadas; React muestra el contenido como texto escapado.

Conserve las secciones de destinatarios, requisitos, pasos, resultado esperado y solución de problemas. Registre las nuevas guías y sus requisitos en `src/lib/help/access.ts` y agregue sus pruebas de Ayuda. La configuración de rastreo de archivos de Next.js en `next.config.ts` incluye este directorio en el despliegue de ambas rutas de Ayuda. No hay una segunda copia del contenido en el código de la interfaz.

## Alcance y acceso

La plantilla de `/inicio` y el middleware existentes protegen la entrada a Ayuda. Además, cada guía comprueba en el servidor los permisos y las rutas del flujo que describe, tanto en el índice como al abrir su dirección directamente. Una guía no disponible devuelve una página no encontrada; no basta con ocultar su enlace. Leer documentación no concede permisos para ejecutar operaciones.

El índice agrupa las guías por los nombres actuales de los roles asignados a la cuenta, incluidos los roles personalizados. Una guía compartida puede aparecer en varios roles sin duplicar su archivo Markdown. Si el acceso a una tarea solo resulta de combinar permisos de varios roles, aparece en Permisos combinados. Las cuentas sin guías aplicables reciben un mensaje; no se les muestran guías de otros roles para llenar el espacio.

Los requisitos se definen en `src/lib/help/access.ts` y reutilizan los comprobadores de autorización existentes. No se autoriza por el nombre del rol. La unión de permisos de la cuenta decide qué puede consultar; los permisos de cada rol sirven para organizar las guías. Los flujos que abren formularios y detalles necesitan acceso a esas rutas, no solo un permiso exacto sobre la lista. Los permisos exactos sí son suficientes si cubren todas las páginas de un flujo finito, como la lista y el formulario de solicitud de vacaciones. ROOT conserva su acceso implícito mediante `isSuperuser`.

La sección Programación y asignaciones tiene requisitos adicionales y se omite si la cuenta solo puede gestionar asignaciones, pero no consultar esas pantallas del calendario. Si agrega o cambia una sección restringida, mantenga su encabezado y requisitos sincronizados en `src/lib/help/access.ts` y verifique tanto su presencia como su ausencia en las pruebas.

La selección usa la autorización vigente del servidor y su mecanismo existente de invalidación de sesiones y caché; no mantiene una copia global de las guías filtradas. Los datos disponibles, la pertenencia a un Cliente, la asignación del trabajo, sus estados y los saldos siguen siendo requisitos de cada operación. Tener los permisos de una guía no garantiza que existan registros disponibles para la cuenta.

El registro de navegación permite encontrar Ayuda en el menú lateral y la búsqueda rápida. No se cambian los permisos de las operaciones ni se añaden consultas directas a la base de datos para agrupar la documentación.

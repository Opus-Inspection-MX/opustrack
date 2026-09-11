│ Plan: Renovación de UI de OpusTrack                                                │
│                                                                                    │
│ ▎ Paso inmediato al aprobar: copiar este documento a docs/plans/ui-revamp.md en el repo. Ese archivo es la referencia que usará el agente implementador. knip --include files solo revisa código, así que un .md no afecta a npm run check.    │
│                                                                                    │
│ Contexto                                                                           │
│                                                                                    │
│ La UI de OpusTrack funciona pero no es consistente y cuesta navegarla. Se revisó el código:                                                                         │
│                                                                                    │
│ - Una sola shell (src/components/layout/app-shell.tsx + app-sidebar.tsx) con menú derivado de permisos (src/lib/navigation/menu.ts, 12 secciones y ~45 ítems en una lista plana). No hay breadcrumbs, búsqueda ni barra superior en desktop.     │
│   - Entre 768 y 1023 px aparecen dos campanas de notificaciones, porque use-mobile corta en md y el header en lg.                                                 │
│   - El selector de tema solo existe en el footer del sidebar, así que en móvil no se alcanza.                                                                    │
│ - Tokens ignorados: hay 604 clases de paleta cruda (text-red-500, bg-green-100…) y 56 hex. Los --chart-* no se usan. El tema es el neutral stock de shadcn, sin marca y sin --font-sans.                                                         │
│ - Sin componentes compartidos de página:                                           │
│   - 118 <h1> escritos a mano en 9 variantes.                                       │
│   - ~90 estados vacíos a mano.                                                     │
│   - KPIs duplicados en 6 páginas.                                                  │
│   - Colores de estado repartidos en helpers locales (getStatusColor, getStatusBadge).                                                               │
│   - 6 tablas a medida, además de CatalogTable.                                     │
│   - 2 paginaciones (common/table-pagination.tsx está deprecada y sigue en uso).    │
│ - Sin error.tsx, not-found.tsx ni skeletons. 6 de 7 loading.tsx devuelven null.    │
│ - Responsive desigual:                                                             │
│   - 29 páginas grandes no tienen ningún breakpoint.                                │
│   - Varios grid-cols-3 fijos y anchos w-[260px].                                   │
│   - Solo 5 vistas cambian de tabla a tarjetas.                                     │
│   - El detalle de asignación FSR (src/app/fsr/assignments/[id]/page.tsx, 897 líneas) no es mobile-first.                                                    │
│ - Pantallas iniciales pobres:                                                      │
│   - Cada rol cae en el defaultPath de su rol de mayor prioridad, y los demás roles no se reflejan.                                                                │
│   - /guest es estático aunque el rol tiene permisos de lectura.                    │
│   - /admin le muestra ceros al ADMIN_VACACIONES.                                   │
│   - /notifications se ve sin shell.                                                │
│   - /unauthorized enlaza a /me, que no existe.                                     │
│ - No hay librería de animación, solo tw-animate-css.                               │
│                                                                                    │
│ Resultado buscado:                                                                 │
│ - Un sistema de diseño consistente con 3 temas (Claro, Oscuro negro y Opus) más la opción Sistema.                                     │
│ - Navegación más simple: agrupada, con búsqueda y breadcrumbs, y con barra inferior en móvil.                                                               │
│ - Animaciones moderadas                               │
│ - Una pantalla inicial única /inicio hecha de widgets según los permisos del usuario, sumando todos sus roles.                                                │
│ - Todo el sistema 100 % ).                            │
│                                                                                    │
│ Decisiones del usuario:                                                            │
│ - /inicio es una sola ru                              │
│ - La animación usa Motio                              │
│ - Los temas son Claro, Oscuro (negro) y Opus, y el selector es un dropdown.        │
│ - Se entrega por fases, con un PR por fase.                                        │
│                                                                                    │
│ Reglas para el agente imlas fases)                    │
│                                                                                    │
│ - Leer CLAUDE.md y respetar sus convenciones:                                      │
│   - Server Components primero.                                                     │
│   - Reglas de negocio de                              │
│   - Toasts con @/hooks/use-toast.                                                  │
│   - Prisma desde @/lib/d                              │
│   - Soft delete.                                                                   │
│ - La lógica de negocio nresentación. Excepciones:     │
│   - Queries nuevas de agregación para widgets, siempre con getReportScope() +      │
│     *ScopeWhere() y cerr                              │
│   - Arreglos de bugs de scoping encontrados.                                       │
│ - Cada PR deja verdes npm run check (biome + tsc + knip: no dejar archivos sin usar), npm run test:unit (umbral 75 %) y npm run test:e2e.                       │
│ - Contrato e2e a preservctualiza el spec en el mismo  │
│   PR:                                                 │
│   - [data-sidebar="sidebel menú ("Solicitudes", "Mis  │Vacaciones", "Mis Asignaciones", "Roles", "Usuarios", "Incidentes").           │
│   - Los headings ("Seguiudes de Vacaciones", "Mis     │Vacaciones", "Días de Vacaciones", "Asignación de Programación", "Nueva        │
│     Programación", /Hist                              │
│   - En desktop, las filas getByRole("row") de tablas de catálogo, vacaciones y errores.                                                                       │
│   - [data-slot="dialog-content"].                                                  │
│   - La adyacencia label /forms.ts.                    │
│   - Los ids de inputs (#folio, #title, #scheduledAt, #startOdometer, #endOdometer, │
│     #email, #password, #                              │
│   - Los textos de botones ("Iniciar trabajo", "Cerrar trabajo", "Iniciar Viaje",   │
│     "Finalizar Viaje", "Rápida", "Marcar como visto", │ "Reintentar", "Pendiente de envío").                                           │
│ - Las dependencias nuevas se agregan después de npm run deps:freeze. Hoy .npmrc    │
│   tiene before=2026-08-0                              │
│ - Accesibilidad:                                      │
│   - Contraste AA en los 3 temas.                                                   │
│   - Foco visible.                                     │
│   - Objetivos táctiles ≥                              │
│   - Toda animación respetionConfig                    │reducedMotion="user").                                                         │
│ - Textos de UI en español, como hoy.                                               │
│ - Fechas vía src/lib/utils/datetime.ts (formatMX…). No agregar más moment ni       │
│   toLocaleString. Migrarvo.                           │
│                                                                                    │
│ ---                                                   │
│                                                       │
│ Fase 1: Fundaciones del                               │
│                                                                                    │
│ 1.1 Temas y tokens (src/                              │
│                                                       │
│ Reescribir los tokens OKLCH con tres temas. El tema Oscuro sigue en la clase .dark para que las variantes dark: existentes funcionen.                                 │
│                                                                                    │
│ ┌──────────────────┬──────────┬────────────────────── │───┐                                                                               │
│ │      Token       │       Claro        │  Oscuro (negro)  │          Opus           │                                                                                │
│ ├──────────────────┼──────────┼────────────────────── │───┤                                                                               │
│ │ background       │ bla      │ #f3f6f6               │
│   │                                                   │
│ │                  │    )     │                       │
│   │                                                   │
│ ├──────────────────┼──────────┼────────────────────── │───┤                                                                               │
│ │ card / popover   │ blanco             │ #0a0a0a          │ blanco                  │                                                                                │
│ ├──────────────────┼──────────┼────────────────────── │───┤                                                                               │
│ │ foreground       │ neutro 0.145       │ neutro 0.985     │ navy #141e29            │                                                                                │
│ ├──────────────────┼──────────┼────────────────────── │───┤                                                                               │
│ │ primary          │ tea      │ #004851               │   │                                                                                │
│ │                  │ #00      │                       │   │                                                                                │
│ ├──────────────────┼──────────┼────────────────────── │───┤                                                                               │
│ │ accent / ring    │ tea      │ #00968f               │   │                                                                                │
│ │                  │ baj      │                       │   │                                                                                │
│ ├──────────────────┼──────────┼────────────────────── │───┤                                                                               │
│ │ muted            │ #f2      │ #e5eced               │   │                                                                                │
│ ├──────────────────┼──────────┼────────────────────── │───┤                                                                               │
│ │ muted-foreground │ #54      │ #54565a               │   │                                                                                │
│ ├──────────────────┼──────────┼────────────────────── │───┤                                                                               │
│ │ border           │ #ed      │ #dfe7e8               │   │                                                                                │
│ ├──────────────────┼──────────┼────────────────────── │───┤                                                                               │
│ │ sidebar          │ bla      │ #004851, texto        │
│ blanco,  │                                            │
│ │                  │          │ activo #00968f        │   │                                                                                │
│ └──────────────────┴──────────┴────────────────────── │───┘                                                                               │
│                                                       │
│ - La paleta del tema Opus se sacó de opus.global/css/styles.css:                   │
│   - #004851 es el primar                              │
│   - #00968f / #009b9a so                              │
│   - #141e29 es el navy.                               │
│   - #54565a, #a9aaac y #ededee son los grises.                                     │
│   - #4c9c2e es el verde.                              │
│   - #00a0e0 es el azul.                                                            │
│   - #f18006 es el naranj                              │
│ - Claro y Oscuro usan el teal de Opus solo como acento de marca discreto. El tema  │
│   Opus lo lleva a la sup con gradiente sutil #004851  │→ #00968f en el hero de /inicio, y cards con borde teal.                         │
│ - Tokens semánticos nueven @theme inline):            │
│   - --success (verde Opus #4c9c2e)                                                 │
│   - --warning (#f18006)                               │
│   - --info (#00a0e0)                                                               │
│   - --danger (el destruc                              │
│   - Cada uno con su -foreground y su variante -muted para fondos de badges.        │
│ - Tokens de estado de dotatusColor locales:           │
│   - --status-open, --status-progress, --status-done, --status-cancelled.           │
│   - SLA: --sla-ok, --sla-risk, --sla-breach.                                       │
│ - Redefinir --chart-1..5vy, verde, naranja, azul) y   │
│   usarlos de verdad en s.tsx para reemplazar los hex. │
│ - Tipografía:                                                                      │
│   - next/font: Roboto pastituta de Brokman (una       │fuente propietaria) para títulos. Se sugiere Outfit o Montserrat de Google Fonts.                                                                         │
│   - Exponer --font-sans y --font-display en @theme y quitar inter.className.       │
│ - Radio --radius: 0.75reens --shadow-card y           │--shadow-elevated.                                                               │
│ - src/app/layout.tsx:                                                              │
│   - ThemeProvider con themes={["light","dark","opus"]}, enableSystem, value={{     │
│     light:"light", dark:ibute="class".                │
│   - Quitar disableTransitionOnChange y hacer una transición de color de 150 ms.    │
│   - Arreglar la metadatay agregar themeColor por      │
│     esquema.                                          │
│ - Borrar los backups src                              │
│                                                                                    │
│ 1.2 Selector de tema (srgle.tsx)                      │
│                                                                                    │
│ - Sigue siendo un Dropdo Claro (Sun), Oscuro (Moon),  │Opus (un swatch circular teal) y Sistema (Monitor).                              │
│ - Usar DropdownMenuRadioctiva.                        │
│ - Cada ítem muestra una mini-muestra de color del tema.                            │
│ - Se monta en el header de usuario, no solo en el     │sidebar.                                                                         │
│                                                       │
│ 1.3 Animación                                                                      │
│                                                       │
│ - Agregar motion (el paquete motion, importado desde motion/react) tras            │
│   deps:freeze.                                        │
│ - src/components/motion/:                                                          │
│   - motion-provider.tsx:user", montado en el root     │layout.                                                                        │
│   - fade-in.tsx, stagger de hijos, 40 ms).            │
│   - animated-number.tsx (contador para KPIs con useSpring).                        │
│   - page-transition.tsx e dentro de main).            │
│   - Presets en src/lib/ui/motion.ts: duraciones 150/200/300 ms y easing [0.2, 0,   │
│     0, 1].                                            │
│ - Micro-interacciones solo con CSS en ui/button.tsx y ui/card.tsx (variante        │
│   interactive): active:sver.                          │
│ - No animar tablas grandes. Esto evita problemas de rendimiento en la de tracking. │
│                                                                                    │
│ 1.4 Primitivas compartidas (src/components/common/ y src/components/ui/)           │
│                                                       │
│ Agregar los componentes de shadcn que faltan: avatar, breadcrumb, collapsible,     │
│ accordion, chart.                                     │
│                                                                                    │
│ Crear:                                                                             │
│                                                                                    │
│ ┌──────────────────────┬───────────────────────────── │────┐                                                                              │
│ │      Componente      │                          Propósito                        │
│    │                                                  │
│ ├──────────────────────┼────────────────────────────────────────────────────────── │
│ ────┤                                                 │
│ │                      │tions, breadcrumbs. Renderiza │    │                                                                               │
│ │ page-header.tsx      │ara e2e). Layout flex-col     │gap-3  │                                                                           │
│ │                      │sm:justify-between. Las       │acciones │                                                                         │
│ │                      │óvil.                         │    │                                                                               │
│ ├──────────────────────┼───────────────────────────── │────┤                                                                              │
│ │ page-container.tsx   │l consistentes.               │    │                                                                               │
│ ├──────────────────────┼───────────────────────────── │────┤                                                                              │
│ │ section-card.tsx     │ descripción y acciones.      │    │                                                                               │
│ ├──────────────────────┼───────────────────────────── │────┤                                                                              │
│ │                      │ Mover y generalizar src/components/reports/stat-card.tsx:    │                                                                               │
│ │ stat-card.tsx        │ber, delta/tendencia, href    │    │                                                                               │
│ │                      │ opcional, tono semántico. Reemplaza los 6 KPIs caseros.      │                                                                               │
│ ├──────────────────────┼───────────────────────────── │────┤                                                                              │
│ │ empty-state.tsx      │ Icono, título, descripción y CTA. Reemplaza los ~90 "No   │
│    │                                                  │
│ │                      │                              │
│    │                                                  │
│ ├──────────────────────┼───────────────────────────── │────┤                                                                              │
│ │ status-badge.tsx     │digo del catálogo) a un token │ de │                                                                               │
│ │                      │Color y getStatusBadge        │locales.  │                                                                        │
│ ├──────────────────────┼───────────────────────────── │────┤                                                                              │
│ │ sla-badge.tsx        │tracking.                     │    │                                                                               │
│ ├──────────────────────┼───────────────────────────── │────┤                                                                              │
│ │                      │etas en <md a partir de la    │
│ misma │                                               │
│ │ responsive-table.tsx │  definición de columnas (mobileCard render prop). Base para  │                                                                            │
│ │                      │ CatalogTable.                                             │
│    │                                                  │
│ ├──────────────────────┼──────────────────────────────────────────────────────────────┤                                                                              │
│ │ filter-bar.tsx       │ Filtros en línea en desktop y, en móvil, botón "Filtros   │
│ (n)" │                                                │
│ │                      │  que abre Sheet/Drawer inferior.                          │
│    │                                                  │
│ ├──────────────────────┼────────────────────────────────────────────────────────── │
│ ────┤                                                 │
│ │ skeletons.tsx        │ PageSkeleton, TableSkeleton, CardGridSkeleton,            │
│    │                                                  │
│ │                      │ WidgetSkeleton.                                           │
│    │                                                  │
│ └──────────────────────┴────────────────────────────────────────────────────────── │
│ ────┘                                                 │
│                                                                                    │
│ - Consolidar los hooks: ry.ts quedan en un solo       │use-breakpoint.ts. Borrar el sobrante, porque knip lo exige.                     │
│ - Consolidar la paginaciination.tsx y migrar          │schedule-table y assignment-activity-table a ui/pagination.tsx.                  │
│ - ResponsiveDialog (src/og.tsx) pasa a ser el diálogo │
│   por defecto: Drawer en                              │
│ - Tests de componentes cy ninguno): status-badge,     │empty-state, page-header, responsive-table (modo móvil/desktop) y theme-toggle.  │
│   Ayudan a sostener el 7                              │
│                                                                                    │
│ 1.5 Reglas de lint                                                                 │
│                                                                                    │
│ Agregar un test src/test línea de                     │actions-contract.test.ts:                                                          │
│ - Falla si aparecen nuevos hex o clases de paleta cruda ((text|bg|border)-(red|green|blue|gray|yellow)-\d{2,3}) fuera de ui/.            │
│ - Usa una allowlist con e a fase.                     │
│                                                                                    │
│ ---                                                                                │
│                                                                                    │
│ Fase 2: Shell y navegaci                              │
│                                                                                    │
│ 2.1 Layout                                                                         │
│                                                                                    │
│ - Unificar el breakpointara todo.                     │
│   - Sidebar fijo colapsa                              │
│   - Sheet en <lg.                                     │
│   - Arreglar SidebarProvider para que use el mismo breakpoint. Así desaparecen las │
│     dos campanas.                                     │
│ - Header global (src/components/layout/app-header.tsx) sticky en todos los         │
│   tamaños:                                            │
│   - Trigger del sidebar en <lg.                                                    │
│   - Breadcrumbs como <na: solo "← Padre"). Nunca con  │headings, porque duplicaría los <h1> que el e2e busca.                         │
│   - Botón de búsqueda (⌘queda rápida". No debe        │contener "Buscar" (colisiona con getByRole("button",{name:"Buscar"}) en        │
│     tracking, errors e iinput type="search"> en la    │shell (colisiona con getByRole("searchbox") en errors.spec.ts).                │
│   - NotificationBell, Thcon iniciales: Perfil, Tema,  │Cerrar sesión).                                                                │
│   - Quitar la campana, e del sidebar. El footer queda │ con el usuario compacto.                                                       │
│ - Barra inferior móvil (tab-bar.tsx, lg:hidden,       │respeta env(safe-area-inset-bottom)):                                            │
│   - 4 accesos: Inicio, Bs y Más (abre el sidebar).    │
│   - No debe tapar botones de acción. Tampoco puede reutilizar nombres de acciones  │
│     de página ("Iniciar Reintentar", "Cancelar",      │"Pendiente de envío"). Los specs móviles corren en Pixel 5 y en iPhone 12.     │
│   - Uno más, prioritariojemplo:                       │
│     - FSR: "Mis Asignaciones".                                                     │
│     - REPORTER: "Reporta                              │
│     - ADMIN_OPERACION: "Seguimiento".                                              │
│   - El orden se define en el registro del menú con un campo mobilePriority.        │
│ - main con pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-8 y PageTransition.   │
│ - Mover /notifications brear                          │src/app/notifications/layout.tsx con requireRouteAccess("/notifications").       │
│ - src/app/unauthorized/ppor defaultPath. Borrar el    │
│   huérfano src/app/incid                              │
│                                                       │
│ 2.2 Registro de menú (src/lib/navigation/menu.ts)                                  │
│                                                       │
│ - Reagrupar las 12 secciones en 5 grupos colapsables (Collapsible, con el estado   │
│   recordado en cookie), s ítems para e2e.             │
│   - En desktop, los grupos arrancan expandidos y el contenido colapsado no se      │
│     desmonta (forceMounts espera ver los links        │"Solicitudes", "Mis Vacaciones" y "Mis Asignaciones".                          │
│   - Ningún otro link vis contener esos textos, porque │ el match es por substring.                                                     │
│   - Para ADMIN_VACACIONEtengan "Roles", "Usuarios" o  │"Incidentes", tampoco en el header ni en el footer del sidebar.                │
│   - Los grupos:                                       │
│   a. Inicio: /inicio, Notificaciones, Perfil.                                      │
│   b. Mi trabajo: FSR, Mirter), Consulta (guest).      │
│   c. Operación: Seguimiento, Asignación de Programación, Programación, Incidentes, │
│      Asignaciones, Activ                              │
│   d. Reportes: el índice y los 9 reportes. En el sidebar se muestra solo "Reportes" y cada reporte vive como tab o subnav en /admin/reports. Así se    │
│      reducen ~10 ítems.                               │
│   e. Administración: Organización, Usuarios y Roles, Vacaciones (admin) y Configuración, como subgrupos.                                                │
│ - Nuevos campos en MenuI                              │
│   - keywords? para la búsqueda.                                                    │
│   - mobilePriority?.                                  │
│   - description? para el command palette y los accesos rápidos.                    │
│ - visibleMenu() sigue filtrando por ruta. Agregar flattenMenu() y breadcrumbsFor(pathname) como funciones puras con tests en vitest.               │
│ - Command palette (src/c.tsx, con cmdk, que ya está   │instalado):                                                                      │
│   - Navega a cualquier ro con el botón en el header o │ la tab "Búsqueda rápida".                                                      │
│   - Incluye acciones rápidas según permisos: "Nuevo incidente", "Iniciar viaje" y "Reportar incidente".                                                          │
│ - Subnavegación por tabslinks) para reemplazar los    │grids de tarjetas de enlace en src/app/admin/settings/page.tsx y src/app/admin/reports/page.tsx.                                                  │
│                                                                                    │
│ 2.3 Estados globales                                  │
│                                                       │
│ - src/app/error.tsx, srcpp/not-found.tsx con          │EmptyState.                                                                      │
│ - Reemplazar los loadingkeletons reales.              │
│ - Añadir loading.tsx por área: admin, fsr, reporter, vacations e inicio.           │
│ - Rediseñar las páginas authorized y /logout con un   │layout (auth) compartido:                                                        │
│   - Panel de marca a la ente Opus. En móvil queda     │como tarjeta centrada.                                                         │
│   - Deben funcionar los                               │
│ - / sigue redirigiendo en el middleware. La landing de marketing src/app/page.tsx  │
│   nunca se ve, así que selimina el contenido          │estático.                                                                        │
│                                                       │
│ ---                                                                                │
│                                                       │
│ Fase 3: Pantalla inicial personalizada /inicio (PR 3)                              │
│                                                       │
│ 3.0 Hallazgos a resolver primero, dentro de este PR                                │
│                                                       │
│ 1. ADMIN_OPERACION no tiene tracking:read/tracking:update, ni en                   │
│    initial_load/seed.exadas las acciones de tracking  │hacen requirePermission("tracking:*"), así que su landing actual                │
│    /admin/tracking falla                              │
│    - Verificar en la BD local y en el seed real.                                   │
│    - Si falta, otorgarlo1 y en ambos seeds.           │
│    - Sin eso, el widget tracking-queue no le aparece.                              │
│ 2. Fuga de scoping:                                   │
│    - getDashboardStats().scheduledTasks (src/lib/actions/dashboard.ts ~l.62) y     │
│      getSchedules (src/lo aplican                     │scheduleScopeWhere(scope). Agregarlo y cubrirlo con un test de regresión.     │
│    - Los widgets nunca d                              │
│ 3. src/app/unauthorized/page.tsx:32 enlaza a /me. Cambiarlo a /inicio.             │
│ 4. Orden de despliegue: build no corre migraciones. Primero se despliega el código con la ruta /inicio y después la migración. En orden inverso, todos los logins  │
│    caen en un 404.                                    │
│ 5. CLAUDE.md, spec/00-overview.md y spec/01-auth-rbac.md (RF-101, RF-111) todavía  │
│    dicen CLIENT (/clientPORTER y /inicio.             │
│                                                                                    │
│ 3.1 Ruteo, permiso y lan                              │
│                                                                                    │
│ - Archivos de ruta:                                                                │
│   - src/app/inicio/layout.tsx: await requireRouteAccess("/inicio") + <AppShell>,   │
│     copiado de src/app/p                              │
│   - src/app/inicio/page.tsx.                                                       │
│   - Agregar "inicio" a Gout-guards.test.ts.           │
│ - Seeds: en initial_loads real, gitignored) agregar   │
│   el permiso route:inici).                            │
│   - Crear una constante UNIVERSAL_ROUTES =                                         │
│     ["route:inicio","rouons"] repartida a los 7       │roles.                                                                         │
│   - Poner defaultPath: "                              │
│ - Migración prisma/migrations/20260914000000_inicio_home/migration.sql. Debe       │
│   ordenar después de la on ls prisma/migrations.      │Copiar el patrón de 20260911000000_phase1_notifications_rbac:                    │
│   a. INSERT del permiso OTHING.                       │
│   b. Concederlo a todos los roles activos: UPDATE para reactivar y luego INSERT …  │
│      CROSS JOIN … ON CON                              │
│   c. UPDATE "Role" SET "defaultPath"='/inicio' WHERE "name" IN ('ROOT','ADMIN_OPER │
│      ACION','ADMIN_VACACRTER','GUEST'). Los roles se  │nombran explícitamente para que los creados desde la UI conserven su landing. │
│   d. (Si aplica 3.0.1) cing:update a ADMIN_OPERACION. │
│   e. Subir sessionVersion a todos los usuarios con un rol activo. Es obligatorio:  │
│      routePaths y defauliddleware Edge no consulta la │ BD. Puede pasar que el primer login tras el deploy caiga una vez en el        │
│      portal viejo; es aco.                            │
│   f. Notas de rollback, al estilo de las migraciones existentes.                   │
│ - Se conserva la columnade por rol, y mergeRoles() no │ cambia. El middleware sigue mandando / y /dashboard a defaultPath.               │
│ - Las páginas de portal en su URL, no redirects:      │/admin, /fsr, /reporter, /guest, /vacations, /admin/tracking y /admin/vacations. │
│   El e2e depende de ellae aligeran (sin KPIs          │duplicados con /inicio), y /guest pasa a mostrar datos de solo lectura.          │
│ - Menú:                                               │
│   - { title: "Inicio", url: "/inicio", icon: Home } como primer ítem.              │
│   - Renombrar los tres "a "Panel FSR", /reporter a    │"Mis Reportes" y /guest a "Panel de Invitado".                                 │
│                                                       │
│ 3.2 Registro de widgets                                                            │
│                                                       │
│ Metadatos puros en src/lib/home/widgets.ts. Solo importa                           │
│ canAccessRoute/RouteGraness.ts, sin Prisma, así que   │se prueba en vitest sin mocks.                                                     │
│ export type WidgetId = "ns" | "my-work" |             │"my-active-trip"                                                                   │
│   | "my-reports" | "my-vs" | "upcoming-absences"      │
│   | "tracking-queue" | "ops-kpis" | "incidents-by-status" | "sla-risk" |           │
│ "upcoming-schedules";                                 │
│ export type WidgetSize =        // 1 / md:2 / xl:4    │
│ cols                                                  │
│ export interface WidgetRequirement {                                               │
│   permissions?: readonly                              │
│   anyPermission?: readonly string[]; // ANY                                        │
│   route?: string;       er alcanzable                 │
│ }                                                                                  │
│ export interface WidgetDefinition {                                                │
│   id: WidgetId; title: string; description?: string;                               │
│   requires: WidgetRequirrity: number;                 │
│   selfService?: boolean; // datos personales; para superuser se oculta si está     │
│ vacío                                                 │
│ }                                                                                  │
│ export function selectWidgets(viewer: WidgetViewer, registry = WIDGETS): WidgetDefinition[];                                                                │
│ // filtra → ordena por p                              │
│ Cada widget exige permiso + ruta. FSR tiene reports:view y dashboard:view, y       │
│ REPORTER/GUEST tienen dasolo por permiso, verían      │widgets de admin.                                                                  │
│                                                                                    │
│ Componentes en src/compo                              │
│ - widget-components.tsx …} satisfies Record<WidgetId, │ …>, así tsc obliga a que cada id tenga componente.                               │
│ - WidgetFrame renderiza -widget-id> con un título     │<h2>, el col-span según el tamaño y <Suspense fallback={<WidgetSkeleton          │
│   size/>}>.                                           │
│ - safeLoad() envuelve cada loader:                                                 │
│   - Ante un error, lo reNo se pudo cargar" sin tumbar │ la página.                                                                     │
│   - AuthorizationError sse registra un warning.       │
│   - NEXT_REDIRECT se relanza.                                                      │
│                                                       │
│ page.tsx:                                                                          │
│ - const user = await req                              │
│ - Hero con saludo ("Buenos días, {nombre}"), fecha MX y resumen de una línea. En   │
│   tema Opus usa el gradi                              │
│ - Fila de accesos rápidos.                                                         │
│ - selectWidgets(user).ma grid gap-4 md:grid-cols-2    │xl:grid-cols-4, con entrada escalonada (StaggerList) y KPIs con AnimatedNumber.  │
│ - Opcional: refrescar cae-refresh.                    │
│                                                                                    │
│ Loaders en src/lib/actioions-contract.test.ts lo      │escanea). Reglas:                                                                  │
│ - Cada loader repite su chequeo con requirePermission(<el mismo permiso del        │
│   registro>). El registr; no es autorización.         │
│ - El scope se resuelve una vez por request: const homeScope = cache(async () => getReportScope(await requireAuth())).                                            │
│ - Siempre se aplica el * es fail-closed: clientIds:   │[] no devuelve nada.                                                             │
│ - Nunca recibir userId n                              │
│ - No usar scopeIncludesClient, que devuelve true con clientId === null.            │
│                                                                                    │
│ 3.3 Catálogo de widgets                                                            │
│                                                       │
│ id: quick-actions                                                                  │
│ requiere: — (filtra cada ítem)                                                     │
│ loader: puro src/lib/home/quick-actions.ts                                         │
│ quién lo ve (seed): todo                              │
│ ────────────────────────────────────────                                           │
│ id: notifications                                     │
│ requiere: notifications:read + /notifications                                      │
│ loader: getMyNotificatiount() (existentes)            │
│ quién lo ve (seed): todos                                                          │
│ ────────────────────────                              │
│ id: my-work                                                                        │
│ requiere: assignments:re                              │
│ loader: nuevo getMyWorkSummary(): conteos no iniciadas / en progreso / cerradas en │
│ 7 días                                                │
│ + las próximas 5 abiertas. Mismo where que getMyAssignments (assignments.ts:991),  │
│ pero                                                  │
│ acotado                                                                            │
│ quién lo ve (seed): FSR                               │
│ ────────────────────────────────────────                                           │
│ id: my-active-trip                                    │
│ requiere: vehicle-trips:read + /fsr/vehicle-trips                                  │
│ loader: nuevo getMyActiveTrip(): viaje abierto (endedAt:null) y viajes de hoy. CTA │
│                                                       │
│ "Iniciar viaje" o "Finalizar viaje"                                                │
│ quién lo ve (seed): FSR                                                            │
│ ────────────────────────                              │
│ id: my-reports                                                                     │
│ requiere: incidents:create + /reporter                                             │
│ loader: nuevo getMyReportsSummary(): groupBy statusId, reportedById=user y Cliente │
│                                                       │
│ primario (vacío si es null), + últimos 5                                           │
│ quién lo ve (seed): REPORTER                                                       │
│ ────────────────────────                              │
│ id: my-vacation                                       │
│ requiere: vacations:read + /vacations                                              │
│ loader: sobre getVacatios de periodos no expirados    │(maneja                                                                            │
│ hasHireDate:false), próxentes                         │
│ quién lo ve (seed): staff (no REPORTER ni GUEST)                                   │
│ ────────────────────────                              │
│ id: vacation-approvals                                                             │
│ requiere: vacations:apprin/vacations                  │
│ loader: nuevo getPendingVacationApprovals(): número de PENDIENTE + top 5           │
│ quién lo ve (seed): ROOT                              │
│ ────────────────────────────────────────                                           │
│ id: upcoming-absences                                 │
│ requiere: vacations:manage + /admin/vacations                                      │
│ loader: nuevo: vacacione4 días, take 8                │
│ quién lo ve (seed): ROOT, ADMIN_VACACIONES                                         │
│ ────────────────────────                              │
│ id: tracking-queue                                                                 │
│ requiere: tracking:read                               │
│ loader: nuevo getTrackingQueue(): incidentes abiertos con scope, del más antiguo al más                                                                             │
│ reciente, take 5, con SLA                                                          │
│ quién lo ve (seed): ROOT)                             │
│ ────────────────────────────────────────                                           │
│ id: ops-kpis                                                                       │
│ requiere: dashboard:view + /admin/incidents                                        │
│ loader: nuevo getOperatihboardStats, con scope. Cada  │KPI                                                                                │
│ enlaza solo si canAccessRoute pasa                                                 │
│ quién lo ve (seed): ROOT                              │
│ ────────────────────────────────────────                                           │
│ id: incidents-by-status                               │
│ requiere: incidents:read + /admin/incidents                                        │
│ loader: nuevo getIncidengroupBy statusId +            │
│ incidentScopeWhere, con art-*                         │
│ quién lo ve (seed): ROOT, ADMIN_OPERACION                                          │
│ ────────────────────────                              │
│ id: sla-risk                                                                      quiere: reports:view +                              │
│ loader: getSlaBreachData() existente (30 días): suma de vencidos y en riesgo, top tipos                                               │
│ quién lo ve (seed): ROOT, ADMIN_OPERACION                                         ──────────────────────                              │
│ id: upcoming-schedules                                                            quiere: schedules:read                              │
│ loader: nuevo getUpcomingSchedules(5) con scheduleScopeWhere. Enlaza solo si      dmin/schedules es alca                              │
│ quién lo ve (seed): ADMIN_OP, FSR, REPORTER, GUEST                                 │
│                                                                                    │
│ Quick actions (src/lib/home/quick-actions.ts, puro):                              Acciones:                                           │
│   - "Reportar incidente" → /reporter/new                                          - "Nuevo incidente" →                               │
│   - "Iniciar viaje" → /fsr/vehicle-trips/start                                     │
│   - "Solicitar vacaciones"                                                        - "Nueva programación"                              │
│   - "Seguimiento"                                                                  │
│   - "Aprobar vacaciones"                                                           │
│   - "Difundir aviso"                                                               │
│ - visibleQuickActions(viewer, max=6) usa el mismo canAccessRoute que visibleMenu, más un permiso opcional.                                                        El command palette (2.                              │
│                                                                                   4 Tests                                             │                                                    │src/lib/home/widgets.tergeRoles a partir de los     │permisos del seed de ejemplo:                                                   - FSR ve my-work, my-afications y                   │upcoming-schedules; no ve sla-risk ni ops-kpis.                               - REPORTER ve my-repor                              │
│   - GUEST no ve widgets de staff.                                                 - EMPLEADO solo ve my-                              │
│   - ADMIN_VACACIONES: ve las aprobaciones, y su grant exacto de /admin no           satisface /admin/inc                              │
│   - ADMIN_VACACIONES + FSR ve la unión.                                           - ROOT ve todo.                                     │
│   - Registro: ids únicos, orden estable, y toda requires.route está cubierta por algún URL del MENU.                                                            │
│ - src/lib/home/quick-actions.test.ts: filtrado, tope y consistencia con MENU.     src/lib/actions/home.trts.test.ts):                 │
│   - Cada loader llama a requirePermission con el permiso del registro.            - El where contiene el                              │
│   - Con clientIds: [] se genera in: [].                                            │
│   - El loader de reporter devuelve vacío si no hay Cliente primario.              E2E: ver la sección "I                              │
│                                                                                    │
│ ---                                                                                                                                   │
│ Fase 4: Migración de páginas por área (PRs 4a–4e)                                                                                     │
│ Patrón en cada página:                                                             │
│ - PageHeader + PageContainer.                                                      │
│ - Tokens en lugar de colores crudos.                                               │
│ - StatusBadge / SlaBadge.                                                          │
│ - EmptyState.                                                                     ResponsiveTable o Catan móvil.                      │
│ - FilterBar.                                                                      Formularios en una col:grid-cols-2) y botones de    │acción fijos abajo en móvil (sticky bottom-0) para formularios largos.           │
│ - Sin anchos fijos: w-[260px] pasa a w-full sm:w-[260px].                         Mantener los ids de ins.                            │
│                                                                                    │
│ Orden sugerido: primero lo de más uso.                                             │
│                                                                                   4a. FSR (mobile-first,                              │- src/app/fsr/assignme): partir en componentes      │(encabezado, acciones del trabajo, actividades, ítems y adjuntos).              - Acciones principalar trabajo") en una barra     │sticky inferior en móvil.                                                     - Secciones en Accor                              │
│   - Viajes: trip-start-form.tsx y trip-end-form.tsx con capture="environment" en    la foto del odómetrorico (inputMode="numeric").   │
│   - Probar el flujo offline (src/lib/offline/*).                                  4b. Operación:                                      │
│   - tracking-table.tsx (1745 líneas): extraer columnas, filtros (a FilterBar) y la  vista de tarjetas mógual para el e2e.             │
│   - bulk-incidents-client.tsx (1213 líneas): quitar los min-w-[180-240px].         │
│   - Incidentes, asignaciones, programación y schedules.                           4c. Reportes:                                       │
│   - Tabs de /admin/reports.                                                        │
│   - Gráficas con los --chart-* y el chart de shadcn.                              - incident-program-cliBFBF], filtros de ancho fijo. │
│   - Mantener el bloque @media print.                                              4d. Catálogos y admini                              │
│   - Las 14 páginas con CatalogTable (usuarios, roles, clientes, líneas, equipos, estados, vehículos, settings/*-status) y su modo tarjetas móvil.               │
│   - admin/clients/[id] y admin/lifecycle.                                         - En móvil, las filas  El e2e de catálogos corre en │ Desktop Chrome, pero agregar role="row"/listitem coherentes.                   │
│ - 4e. Personas:                                                                    │
│   - /vacations y /admin/vacations: grid-cols-3 → grid-cols-1 sm:grid-cols-3, y      VacationPlanner resp                              │
│   - /profile (641 líneas): partir en secciones con tabs.                           │
│   - /reporter/*: reporter/new como wizard en móvil.                                │
│   - /guest y /notifications.                                                                                                          │da PR de área baja la (1.5).                        │                                                    │
│ Fase 5: Pulido y verificación responsive (PR 5)                                                                                       │
│ - Auditoría con Playwright: un spec nuevo e2e/responsive.spec.ts recorre una ruta representativa por áre×900. Verifica:               │
│   - Que no haya scroll horizontal del documento                             (document.documentElth).                          │
│   - Que el header y la barra inferior sean visibles en móvil.               Que no haya dos camp                              │
│ - Agregar los proyectos Mobile Chrome e iPad a los specs de navegación, rba inicio.                                           │
│ - Accesibilidad: @axe-core/playwright en /inicio, /login, tracking y el detSR, en los 3 temas. Sijarla con deps:freeze.       │
│ - Revisar la animación con prefers-reduced-motion: reduce emulado.         ocumentar el sistema ens, temas, componentes y     │patrones responsive, y referenciarlo desde CLAUDE.md. Un /admin/design serabajo; basta el doc.                              │
│                                                                                                                               │
│                                                                            acto e2e (actualizar                               │
│                                                                            e 3, defaultPath → /i                              │
│ - En e2e/fixtures/auth.ts (DEFINITIONS), los cuatro defaultPath pasan a /inso rompe primero e2e/RL), que bloquea toda la      │suite.                                                                   ambién rompe e2e/authp RF-104 (/ → landing por     │rol).                                                                    eemplazar esos casos ts, agregado a la regex flows │ de playwright.config.ts. Para cada rol verifica / → /inicio y los widgetsresentes o ausentes c o [data-widget-id]. Para     │multi-rol usar makeUser de rbac-roles.spec.ts.                           ctualizar e2e/README.                              │
│                                                                            cambiar los redirectsa:                            │
│ - router.push("/reporter") en src/app/reporter/new/page.tsx:229.           */vacations, **/fsr/vs$ y **/admin/assignments**.  │
│ - landsOn(path) === path para las rutas de portal en rbac-roles.spec.ts.   MPLEADO → /unauthorizado".                         │
│                                                                            in: conservar #email,r Sesión".                    │
│                                                                            overs de la shell (noo): cerrados por defecto,     │porque varios specs usan getByRole("dialog") sin nombre.                                                                      │
│ Verificación (por PR)                                                                                                         │
│ 1. npm run check, npm run test:unit y npm run test:e2e, todos verdes.      npm run dev y entrar in@, fsr@, la cuenta          │REPORTER, guest@… @opusinspection.com / password123; ver e2e/fixtures/auRevisar:                                           │
│    - La landing /inicio y los widgets que corresponden al rol.             - Un usuario multi-ro                              │
│    - Cambio de tema Claro, Oscuro, Opus y Sistema desde el dropdown del hea  desktop y en móvil.                              │
│ 3. DevTools en 360, 768, 1024 y 1440 px en las páginas tocadas: sin scroll horizontal, tablas →                               │
│ 4. Flujo FSR completo en móvil emulado: iniciar viaje con foto y GPS → iniciar trabajo → actividad →alizar viaje, incluido el     │modo offline.

# Plan: e2e estable en CI y dos temas con identidad Opus

> Documento para el agente implementador. Autocontenido: qué cambia, con qué
> valores, en qué archivos y cómo se verifica. Revisado el 2026-09-11 sobre
> `main` (`dad571f`).

## Orden de entrega

| PR | Contenido | Por qué en este orden |
|---|---|---|
| **1** | Parte A: warning de `themeColor` + estabilizar el e2e de CI | El PR de temas se valida con el e2e (accesibilidad incluida); si la suite falla y sale flaky por causas ajenas, no sirve como red |
| **2** | Parte B: dos temas Opus (Claro y Oscuro) | Toca los mismos specs de accesibilidad que la Parte A deja confiables |

---

# Parte A: e2e estable en CI (PR 1)

## Qué pasó

Resultado de la última corrida de GitHub Actions (1 worker, `retries: 2`,
11.1 min):

- **6 fallidos:**
  - `accessibility › detalle FSR` en los 3 temas.
  - `inicio › FSR`.
  - `offline › 4 · Viajes`.
  - `rbac-roles › ADMIN_VACACIONES menú`.

  Todos en Mobile Chrome.
- **5 flaky:**
  - `catalogs › vehicle-status lo edita`.
  - `flows › inicio FSR`.
  - `chromium › incident-evidence`.
  - `Mobile Chrome › inicio ROOT`.
  - `Mobile Chrome › offline 0`.
- **20 sin correr**: los grupos seriales se cortan cuando falla un test.

Al reproducir en local (Mobile Chrome, sin reintentos) salen **otras**
fallas: `accessibility › tracking` en los 3 temas e `inicio › ROOT`. Que
cambie el conjunto de fallas según la máquina, el número de workers y el orden
es la firma del problema. **Casi todo son carreras de tiempo y datos
compartidos en los propios tests**, más dos defectos reales de la app que el
spec de accesibilidad solo detecta a veces. Abajo, cada causa con su evidencia.

## Causas

### A1. Widgets duplicados durante el streaming (confirmado)

Afecta a `inicio.spec.ts`: FSR falla en Mobile y sale flaky en `flows`; ROOT
sale flaky en Mobile.

`/inicio` hace streaming de cada widget con `Suspense`. Mientras llega, React
coloca el HTML ya resuelto en un `<div id="S:n" hidden>` al final del `<body>`
y luego un script inline lo mueve a su lugar. Durante esa ventana, el mismo
widget existe **dos veces** en el DOM.

Lo reproducimos con un spec de diagnóstico (16 cargas en paralelo con 4
workers). En 2 de 16, a los 125 ms de `goto` aparecían todos los widgets
duplicados: una copia visible dentro de `main` y otra en
`div#S:2[hidden] < body`. Con el servidor en reposo, 0 de 6.

`e2e/inicio.spec.ts:69` ubica los widgets con
`page.locator('[data-widget-id="…"]')`, sin acotar. En modo estricto,
Playwright falla **al instante** si el locator resuelve a dos elementos: no
reintenta. El test gana o pierde según si el primer chequeo cae dentro de la
ventana. En CI, que es más lento, cae más seguido.

No es un defecto de la app; es cómo funciona el streaming de React.

**Arreglo:**

1. `widget(page, id)` pasa a ser
   `page.locator(\`main [data-widget-id="${id}"]\`)`. Las copias de streaming
   viven fuera de `main`. El selector CSS de descendiente devuelve cada
   elemento una sola vez, aunque haya dos `main` anidados (ver A6).
2. Regla para toda la suite, escrita en `e2e/README.md`: en páginas con
   streaming (`/inicio` y cualquier Server Component con `Suspense`), los
   locators por atributo (`[data-…]`) se acotan a `main`. Los locators por rol
   (`getByRole`) ya ignoran lo oculto.
3. Revisar con grep los otros `locator('[data-` en `e2e/` sobre páginas con
   streaming. Hoy solo `inicio.spec.ts:69` apunta a contenido en streaming.

### A2. El spec offline choca consigo mismo entre proyectos (confirmado leyendo el código)

Afecta a `offline-field-capture.spec.ts`: el paso 4 falla y el paso 0 sale
flaky, los dos en Mobile Chrome.

El spec corre en `chromium` **y** en `Mobile Chrome` (y en iPad y Mobile Safari
en la corrida nocturna) contra **la misma base**. En CI, con 1 worker, primero
corre en un proyecto y después en el otro:

- **El paso 4 elige el vehículo** con
  `getByRole("option", { name: /E2E Offline/ })` (`:380`). La opción se llama
  `"E2E Offline - E2E-…"` (`trip-start-form.tsx:256`). Cuando corre el segundo
  proyecto, el vehículo del primero ya volvió a AVAILABLE (su viaje terminó),
  así que hay **dos** opciones: violación de modo estricto. Falla siempre en el
  segundo proyecto, y los reintentos crean un tercer vehículo.
- **La placa se trunca**: `\`E2E-${SUFFIX}\`.slice(0, 12)` (`:147`), con
  `SUFFIX = \`${Date.now()}-${rand}\``. Solo quedan los primeros 8 dígitos del
  timestamp, es decir, resolución de **100 segundos**, y la parte aleatoria se
  pierde. Un reintento del grupo serial dentro de esa ventana choca con el
  `@unique` de `licensePlate` en el paso 0. Por eso ese paso sale flaky.
- **El viaje se busca** con
  `findFirstOrThrow({ where: { startOdometer: 1000, active: true } })`
  (`:398`), sin acotar al vehículo, así que puede leer el viaje del otro
  proyecto.

**Arreglo:**

1. Agregar `shortId()` en `e2e/fixtures/db.ts`: 8 caracteres base36 aleatorios,
   para campos con límite de longitud. **Nunca truncar `uniqueSuffix()`.**
   Buscar otros `.slice(` sobre sufijos en `e2e/` y corregirlos igual.
2. En el paso 0: `model: \`Offline ${SHORT}\`` y
   `licensePlate: \`E2E-${SHORT}\``, y guardar `vehicleId` y la placa en
   variables del módulo.
3. En el paso 4: elegir la opción por la placa exacta
   (`getByRole("option", { name: new RegExp(plate) })`) y buscar el viaje por
   `vehicleId`.
4. Regla para `e2e/README.md`: **todo spec que corre en más de un proyecto
   crea sus datos con nombres únicos por corrida y los busca por id**, nunca
   por nombre genérico ni por "el más reciente".
5. Decisión #4: si el flujo offline sigue corriendo también en `chromium`.

### A3. El spec de accesibilidad compite con la carga de datos (confirmado)

Afecta a `accessibility.spec.ts`: tracking falla en local y detalle FSR falla
en CI.

`scan()` hace `goto(path, { waitUntil: "networkidle" })` y corre axe.
`networkidle` no garantiza que React ya haya pintado los datos: tracking y el
detalle FSR son páginas cliente que cargan con una Server Action después de
hidratar. Axe escanea a veces la página cargada y a veces el spinner o el
esqueleto.

Lo comprobamos esperando a que carguen los datos. **Tracking tiene 5 botones
sin nombre en desktop y 3 en móvil.** Están en la paginación compartida
`src/components/ui/pagination.tsx`:

- El `SelectTrigger` de resultados por página (`:60`) no tiene etiqueta. El
  texto "Resultados por página:" es un `<span>` suelto, oculto en móvil.
- Los botones de primera, anterior, siguiente y última página (`:73-114`)
  son solo ícono, sin `aria-label`.

El spec pasa en `chromium` solo cuando escanea antes de que llegue la
paginación. La misma `Pagination` la usan `admin/schedules`, `schedule-table`,
`assignment-activity-table` y `CatalogTable`, así que el defecto está en todos
los catálogos.

Para el **detalle FSR en CI** no tenemos el mensaje de error: en local da 0
violaciones. La hipótesis es la misma carrera, pero en la otra dirección (axe
escanea el estado de carga o de error). Con el arreglo de abajo, el scan pasa
a medir la página cargada. Si sigue fallando, el mensaje dirá la regla.

**Arreglo:**

1. **App:** en `pagination.tsx`, `aria-label` en los cuatro botones ("Primera
   página", "Página anterior", "Página siguiente", "Última página") y
   `aria-label="Resultados por página"` en el `SelectTrigger`. Test unitario de
   que cada botón tiene nombre accesible.
2. **Spec:**
   - Cada página de `PAGES` declara un `ready`, un locator que solo existe con
     los datos cargados:
     - login: `#email`.
     - `/inicio`: ningún esqueleto de widget visible y
       `main [data-widget-id]` presentes.
     - tracking: el texto "Mostrando … de …" o la primera fila del fixture.
     - detalle FSR: el encabezado con el folio o título del fixture y **no**
       el texto "Cargando asignación...".
   - `scan()` espera ese `ready` (hasta 20 s) antes de llamar a axe.
   - Además, falla si al escanear sigue visible un spinner o esqueleto
     (`[data-slot="skeleton"]`, "Cargando"). Así, un escaneo del estado vacío
     no puede volver a pasar como verde.
3. `test.setTimeout(60_000)` en los tests de axe: en local se vio "Test
   timeout of 30000ms exceeded" en Mobile.
4. Después de esto, correr la auditoría en los catálogos que usan
   `Pagination` (por ejemplo, agregar `/admin/clients` a `PAGES`) para
   confirmar que el arreglo cubre a todos.

### A4. Clics antes de hidratar (hipótesis fuerte, no reproducida en local)

Afecta a `rbac-roles.spec.ts:136`, ADMIN_VACACIONES en Mobile Chrome.

`openMenuOnMobile()` (`:95-101`) revisa `tabBar.isVisible()`, que no espera, y
hace clic en "Más". En CI, que es lento, `networkidle` puede llegar antes de que
React hidrate la barra de pestañas. El botón ya está en el HTML del servidor,
pero sin su handler, así que el clic no hace nada: el Sheet no se abre y el
`toBeVisible` del primer link falla. En local pasa porque hidrata antes.

**Arreglo:**

1. **App** (mínimo, para que la suite pueda esperar): un componente cliente
   `HydrationMarker` en `src/app/layout.tsx`. En un `useEffect` hace
   `document.documentElement.dataset.hydrated = "true"`, y no renderiza nada.
2. **e2e:** un helper `gotoReady(page, path)` en `e2e/fixtures/` que hace
   `goto` y espera `html[data-hydrated="true"]`. Úsalo en `rbac-roles.spec.ts`
   (`landsOn`, `signIn`, antes de `openMenuOnMobile`) y en todo spec que haga
   clic justo después de navegar.
3. `openMenuOnMobile()`: esperar a que la barra sea visible
   (`await expect(tabBar).toBeVisible()`) en vez de `isVisible()` cuando el
   viewport es menor que `lg`. Decidir por `page.viewportSize()`, no por lo que
   se ve en ese instante.

### A5. Los flaky no dejan rastro en CI

Hoy `ci.yml` sube `playwright-report/` y `test-results/` solo con
`if: failure()`. Si la corrida pasa con flaky, no queda traza y no hay forma
de diagnosticarlos. Por eso de `catalogs › vehicle-status lo edita` y
`incident-evidence › la evidencia se ve` no sabemos la causa.

**Arreglo:**

1. Subir el reporte con `if: always()`. Con 7 días de retención, el costo es
   bajo.
2. Con `trace: "on-first-retry"` (ya configurado), cada flaky deja una traza.
   Tras la primera corrida con este cambio, bajar el artefacto, abrir las
   trazas de esos dos tests (`npx playwright show-trace`) y clasificarlos en
   A1–A4 o documentar una causa nueva en este plan.
3. Cuando la suite esté estable (dos corridas seguidas sin flaky), activar
   `failOnFlakyTests: !!process.env.CI` en `playwright.config.ts`. Revisar que
   la versión instalada de `@playwright/test` lo soporte; si no, pasar
   `--fail-on-flaky-tests`. Un flaky pasa a ser un fallo que se atiende, no
   ruido.

### A6. Otros hallazgos del diagnóstico (bajo)

- **`<main>` anidados.** `SidebarInset` (`src/components/ui/sidebar.tsx:307`)
  renderiza un `<main>`, y `app-shell.tsx:32` pone otro `<main>` adentro, con
  el header también dentro del `main` de afuera. axe no lo marca porque las
  reglas de landmarks son "best-practice" y el spec solo usa las etiquetas
  WCAG. Arreglo: que `SidebarInset` renderice `div` y el `<main>` de
  `app-shell` sea el único. Revisar que ningún spec dependa de
  `getByRole("main")` contando dos.
- **Texto en inglés en la UI.** El `FileUpload` muestra "Selected Files (1)"
  (lo asierta `incident-evidence.spec.ts:70`). Pasarlo a español
  ("Archivos seleccionados (1)") y actualizar el spec en el mismo commit.
- **Advertencia de Node** `DEP0205 module.register()`: viene de una
  dependencia de tooling (tsx o Playwright), no del código. No hace nada
  todavía; anotarlo y revisar al actualizar dependencias.

## Pasos de la Parte A (PR 1)

Commits sugeridos, en este orden:

1. `fix(ui): quitar themeColor de metadata`: paso 1 de la Parte B, sub-pasos
   1.1 y 1.2. Quita el ruido del log antes de todo lo demás.
2. `fix(a11y): nombres accesibles en la paginación compartida` (A3.1).
3. `test(e2e): acotar widgets a main por el streaming` (A1).
4. `test(e2e): datos únicos por proyecto en el flujo offline` (A2).
5. `test(e2e): accesibilidad espera datos cargados` (A3.2-A3.4).
6. `test(e2e): esperar hidratación antes de interactuar` (A4, con
   `HydrationMarker`).
7. `ci: reporte e2e siempre disponible` (A5.1).
8. `fix(ui): un solo main y textos de carga en español` (A6).

Reglas nuevas en `e2e/README.md`: locators acotados a `main` en páginas con
streaming, datos únicos por proyecto con búsqueda por id, `gotoReady` antes de
interactuar, y el `ready` de cada página en accesibilidad.

## Verificación de la Parte A

1. `npm run check`, `npm run test:unit` y `npm run test:int`, en verde.
2. `npm run test:e2e` en local **dos veces seguidas**, sin fallos ni flaky.
3. La prueba de estrés que reprodujo A1 y A3:
   `npm run test:e2e -- --project="Mobile Chrome" --workers=4 --repeat-each=5 e2e/inicio.spec.ts e2e/accessibility.spec.ts`,
   sin fallos.
4. En CI, el job `e2e` pasa en el PR. Si reporta flaky, sus trazas se clasifican
   (A5.2) antes de fusionar.
5. `npm run build 2>&1 | grep -c "Unsupported metadata"` da 0.

---

# Parte B: dos temas con identidad Opus (PR 2)

## Contexto y decisión

Hoy hay tres temas en `src/app/globals.css`, que el usuario elige en
`ThemeToggle` y `UserMenu` (Claro / Oscuro / Opus / Sistema):

| Tema | Clase | Aspecto actual |
|---|---|---|
| Claro | `:root` | Blanco con el teal de Opus solo como acento |
| Oscuro | `.dark` | Negro puro (`#000000`) con acento teal |
| Opus | `.opus` | Fondo gris-teal, texto navy, sidebar teal y hero en degradado |

**Decisión del usuario:** simplificar a **dos temas, Claro y Oscuro, ambos con
la identidad de Opus**, y quitar el tema Opus. Claro hereda lo que hoy es el
tema Opus. Oscuro pasa de negro puro a un navy de marca. "Sistema" se queda.

Qué se gana:

- Dos juegos de tokens en lugar de tres.
- La auditoría axe corre en 2 temas en lugar de 3 (8 casos en vez de 12).
- El `<meta name="theme-color">` deja de depender de una clase que el
  navegador no conoce.
- De paso se corrigen los defectos del hero descritos abajo.

### Defectos que este cambio corrige

Los encontramos al revisar el código para este plan:

1. **El saludo de `/inicio` no se lee en Oscuro.** `.bg-opus-hero` solo tiene
   un fondo oscuro bajo `.opus`. En Claro y Oscuro es un degradado casi blanco
   (`oklch(0.95 …)`). En Oscuro, el `<h1>` del hero (`src/app/inicio/page.tsx:43`)
   hereda `--foreground: #fafafa`, así que queda texto casi blanco sobre fondo
   casi blanco.
2. **El panel de marca del login no se lee en Claro ni en Oscuro.**
   `src/app/(auth)/layout.tsx:18` pone `text-white` sobre ese mismo degradado
   claro.
3. **En el tema Opus, el hero no pasa AA.** El degradado termina en `#00968f`.
   El texto blanco al 80 % (`.opus .bg-opus-hero .text-muted-foreground`) da
   2.87:1 sobre ese extremo, y el `text-white/60` del login da ~3.4:1. AA pide
   4.5:1.
4. **El warning `Unsupported metadata themeColor`** que llena el log del e2e:
   `src/app/layout.tsx:27-30` repite `themeColor` dentro de `metadata`. Next lo
   ignora y solo avisa en cada ruta; el que funciona es el de `viewport`.

**Por qué axe no los detectó:** con fondos en degradado, axe no puede calcular
el contraste y marca el caso como `incomplete` ("needs review"), no como
violación. Por eso este plan agrega una prueba de contraste sobre los tokens
(paso 6), que no depende del navegador.

## Reglas para el agente

- Lee `CLAUDE.md` y `docs/ui-patterns.md`. Nada de hex ni clases de paleta
  cruda fuera de `globals.css` y `components/ui/`: lo vigila
  `src/test/ui-style.test.ts`.
- **Dos PRs**, en el orden de la tabla del inicio. Este es el PR 2, con commits
  por paso. Sugerencia de título:
  `feat(theme): Claro y Oscuro con identidad Opus`. El paso 1.1 (warning) ya
  entra en el PR 1; si ya está fusionado, sáltalo.
- `npm run check`, `npm run test:unit` y `npm run test:e2e` en verde, y
  `npm run test:int` si el PR lo toca.
- Todos los colores de tema se escriben en **hex de 6 dígitos** (sin `oklch`
  ni `rgb(… / a)`), para que la prueba de contraste los pueda leer. Las
  transparencias ya vienen calculadas como hex sólido en las tablas.
- `.dark` se queda como clase del tema oscuro, para que todos los `dark:`
  existentes sigan funcionando.
- No cambies los nombres de los tokens: los usan cientos de clases. Solo
  cambian sus valores, y se agregan los tokens nuevos que se indican.
- Sin dependencias nuevas.

## Paletas

Colores de marca, tomados de `docs/plans/ui-revamp.md` (vienen del CSS de
opus.global):

- Teal: `#004851`, más claro `#00968f`.
- Navy: `#141e29`.
- Grises: `#54565a`, `#a9aaac`, `#ededee`.
- Verde `#4c9c2e`, azul `#00a0e0` y naranja `#f18006`.

Los contrastes de las tablas se calcularon con la fórmula WCAG 2.x. El umbral
es 4.5:1 para texto normal y 3:1 para texto grande, bordes de foco y gráficos.

### Claro (`:root`)

Es la base del tema Opus actual, ya auditado, con ajustes donde no pasaba AA.

| Token | Valor | Contraste relevante |
|---|---|---|
| `--background` | `#f3f6f6` | — |
| `--foreground` | `#141e29` | 15.5 sobre background |
| `--card` / `--popover` | `#ffffff` | — |
| `--card-foreground` / `--popover-foreground` | `#141e29` | — |
| `--primary` | `#004851` | 9.5 sobre background (enlaces) |
| `--primary-foreground` | `#ffffff` | 10.3 sobre primary |
| `--secondary` / `--muted` | `#e5eced` | — |
| `--secondary-foreground` | `#141e29` | 14.1 |
| `--muted-foreground` | `#54565a` | 6.8 sobre background; 6.2 sobre muted; 7.4 sobre card |
| `--accent` | `#e0efed` | Hover de menús. **No** `#00968f` como en Opus: el blanco sobre `#00968f` da 3.65 |
| `--accent-foreground` | `#004851` | 8.7 sobre accent |
| `--destructive` | `#c2410c` | — |
| `--destructive-foreground` | `#ffffff` | 5.2 |
| `--border` / `--input` | `#dfe7e8` | — |
| `--ring` | `#00968f` | 3.4 sobre background (el foco pide ≥ 3) |
| `--chart-1…5` | `#004851`, `#00968f`, `#4c9c2e`, `#f18006`, `#00a0e0` | Los mismos del tema Opus actual |
| `--shadow-card` / `--shadow-elevated` | Los del tema Opus actual | — |
| Semánticos, estado y SLA | Los valores actuales de `:root`, sin cambios | Ya auditados |
| `--sidebar` | `#004851` | Sidebar teal, como en Opus |
| `--sidebar-foreground` | `#ffffff` | 10.3 |
| `--sidebar-primary` | `#00968f` | — |
| `--sidebar-primary-foreground` | `#04191b` | 5.0. **No** blanco (3.65) |
| `--sidebar-accent` | `#1f5e66` | Blanco al 12 % sobre `#004851`, ya calculado |
| `--sidebar-accent-foreground` | `#ffffff` | 7.4 |
| `--sidebar-border` | `#245f67` | — |
| `--sidebar-ring` | `#00968f` | — |
| `--sidebar-muted-foreground` (**nuevo**) | `#bcd3d6` | 6.6 sobre sidebar; 4.7 sobre sidebar-accent |

### Oscuro (`.dark`)

Navy de marca en lugar de negro puro, con teal de acento.

| Token | Valor | Contraste relevante |
|---|---|---|
| `--background` | `#0b141c` | — |
| `--foreground` | `#e8eef0` | 15.8 sobre background |
| `--card` | `#141e29` | El navy de marca |
| `--card-foreground` | `#e8eef0` | 14.4 |
| `--popover` | `#18242f` | — |
| `--popover-foreground` | `#e8eef0` | 13.5 |
| `--primary` | `#00968f` | 5.1 sobre background; 4.6 sobre card |
| `--primary-foreground` | `#04191b` | 5.0 sobre primary |
| `--secondary` / `--muted` | `#1e2c38` | — |
| `--secondary-foreground` | `#e8eef0` | 12.2 |
| `--muted-foreground` | `#9aa8b0` | 7.6 sobre background; 6.9 sobre card; 5.8 sobre muted |
| `--accent` | `#0e3b40` | — |
| `--accent-foreground` | `#e8eef0` | 10.4 |
| `--destructive` | `#f5975c` | — |
| `--destructive-foreground` | `#1a0d02` | 8.6 |
| `--border` / `--input` | `#2a3a48` | — |
| `--ring` | `#2bb5ab` | 6.7 sobre card |
| `--chart-1…5` | `#2bb5ab`, `#00a0e0`, `#4c9c2e`, `#f18006`, `#a9aaac` | Todos ≥ 4.8 sobre card. **No** `#004851`: da 1.6 sobre navy |
| `--shadow-card` | `0 1px 2px rgb(0 0 0 / 0.45), 0 1px 3px rgb(0 0 0 / 0.55)` | Las sombras no entran en la prueba de contraste |
| `--shadow-elevated` | `0 4px 6px rgb(0 0 0 / 0.45), 0 12px 24px rgb(0 0 0 / 0.5)` | — |
| Semánticos (success, warning, info, danger) | Los valores actuales de `.dark` | Todos ≥ 7.5 sobre `#141e29` (verificado) |
| Estado y SLA | Los valores actuales de `.dark`, salvo `--status-cancelled-muted` | `--status-cancelled-muted: #1e2c38`, en lugar de `#262626` gris neutro |
| `--sidebar` | `#003a42` | Teal profundo: la marca sin deslumbrar de noche |
| `--sidebar-foreground` | `#e8eef0` | 10.6 |
| `--sidebar-primary` | `#00968f` | — |
| `--sidebar-primary-foreground` | `#04191b` | 5.0 |
| `--sidebar-accent` | `#1a4e55` | Blanco al 10 % sobre `#003a42`, ya calculado |
| `--sidebar-accent-foreground` | `#e8eef0` | 7.9 |
| `--sidebar-border` | `#1f4a51` | — |
| `--sidebar-ring` | `#2bb5ab` | — |
| `--sidebar-muted-foreground` (**nuevo**) | `#b9c9cf` | 7.3 sobre sidebar; 5.4 sobre sidebar-accent |

### Hero de marca (mismo en ambos temas)

Son tokens nuevos. Van en `:root` y **no** se redefinen en `.dark`: el
degradado ya es oscuro y funciona igual sobre los dos fondos.

| Token | Valor | Contraste |
|---|---|---|
| `--hero-from` | `#004851` | — |
| `--hero-to` | `#006a64` | Más oscuro que el `#00968f` actual, para que el texto pase AA en todo el degradado |
| `--hero-foreground` | `#ffffff` | 10.3 sobre from; 6.5 sobre to |
| `--hero-muted-foreground` | `#d6ecea` | 8.3 sobre from; 5.3 sobre to |

Además, un token de marca constante (en `:root`, sin redefinir):
`--brand-navy: #141e29`, para la muestra del tema Oscuro en el selector.

## Pasos

### 1. Metadata y color del navegador (`src/app/layout.tsx`)

1. Quitar `themeColor` de `metadata` (líneas 27-30). Esto elimina el warning.
2. Quitar `generator: "v0.app"`, resto del scaffold de v0.
3. `viewport.themeColor` pasa a un solo color de marca: `"#004851"`, sin media
   queries. Con dos temas elegibles, la barra del navegador ya no depende de si
   el tema elegido coincide con el del sistema operativo. Ver la decisión #1
   para la alternativa.
4. `ThemeProvider`: `themes={["light", "dark"]}` y
   `value={{ light: "light", dark: "dark" }}`.

### 2. Tokens (`src/app/globals.css`)

1. Reescribir `:root` y `.dark` con las tablas de arriba y borrar el bloque
   `.opus` completo.
2. Agregar los tokens nuevos (`--sidebar-muted-foreground`, `--hero-*` y
   `--brand-navy`) y mapearlos en `@theme inline`:
   `--color-sidebar-muted-foreground`, `--color-hero-foreground`,
   `--color-hero-muted-foreground` y `--color-brand-navy`.
3. Cambiar el comentario de cabecera ("three themes") por la descripción de los
   dos temas.
4. `.bg-opus-hero` (el nombre se conserva para no tocar cinco archivos; "Opus"
   es la marca, no el tema): en `@layer utilities`, poner
   `background-image: linear-gradient(135deg, var(--hero-from) 0%, var(--hero-to) 100%)`
   y `color: var(--hero-foreground)`, más
   `.bg-opus-hero .text-muted-foreground { color: var(--hero-muted-foreground); }`.
   Borrar las reglas `.opus .bg-opus-hero…`.
5. Borrar las dos reglas `.opus [data-sidebar="footer"] …`. Las reemplaza el
   token del paso 3.
6. En `@media print`, quitar `.opus` de la lista `body, .dark, .opus`.

### 3. Sidebar con sus propios tokens (`src/components/layout/app-sidebar.tsx`)

Ahora los dos temas tienen el sidebar teal, así que el texto secundario del
footer (`:228`, `text-muted-foreground`) no pasaría AA en ninguno de los dos.
Cámbialo a `text-sidebar-muted-foreground`, y `AvatarFallback` a
`bg-sidebar-accent text-sidebar-accent-foreground`. Revisa el resto del
sidebar: cualquier `text-muted-foreground`, `bg-muted` o `border-border`
dentro de `[data-sidebar]` pasa al token `sidebar-*` equivalente, como ya
pide `docs/ui-patterns.md`.

### 4. Hero y panel de login

- `src/app/inicio/page.tsx:43`: el hero ya tiene `bg-opus-hero`; con el paso
  2.4 toma el color de texto correcto. Quitar `border` si se ve como un marco
  gris sobre el degradado (revisar a ojo en los dos temas).
- `src/app/(auth)/layout.tsx:18-35`:
  - `text-white` pasa a `text-hero-foreground`.
  - `text-white/80` y `text-white/60` pasan a `text-hero-muted-foreground`,
    porque las transparencias fallan AA sobre `#006a64`.
  - El `bg-white/15` del ícono se conserva: es decorativo.

### 5. Selector de tema

- `src/components/layout/theme-toggle.tsx` y `src/components/layout/user-menu.tsx`:
  quitar la opción `opus`. Quedan Claro (Sun), Oscuro (Moon) y Sistema
  (Monitor).
  - Muestras: Claro `bg-background border`, Oscuro `bg-brand-navy border` y
    Sistema `bg-gradient-to-b from-background to-brand-navy border`. No uses
    `bg-black`: el oscuro ya no es negro.
  - En `theme-toggle.tsx`, el fallback `OPTIONS[3]` pasa a buscar `system` por
    valor, no por índice.
  - En `UserMenu`, la muestra del submenú "Tema" (`bg-opus-hero`) puede
    quedarse: es la marca.
- **Preferencias guardadas:** hoy hay usuarios con `localStorage.theme = "opus"`.
  Así se comporta `next-themes` con un valor que ya no está en `themes`: su
  script pone la clase `opus`, que ya no tiene CSS, y el resultado se ve como
  Claro. Pero el selector no marca nada y el valor queda guardado para siempre.
  En `src/components/theme-provider.tsx`, agrega un componente interno con
  `useTheme()` y un `useEffect`: si `theme === "opus"`, llamar
  `setTheme("light")`. Opus era un tema claro, así que es la migración natural.
  Pruébalo en `theme-toggle.test.tsx`.
- `src/components/ui/chart.tsx:9`: `THEMES = { light: "", dark: ".dark" }`.
  Hoy ninguna gráfica usa `theme:` en su config (verificado con grep), así que
  es solo un cambio de tipo.

### 6. Prueba de contraste de tokens (nueva)

Crear `src/test/theme-contrast.test.ts`, que no usa el navegador:

1. Lee `src/app/globals.css` y extrae los bloques `:root { … }` y
   `.dark { … }` con una expresión regular. Resuelve cada tema como `:root`
   más las redefiniciones de `.dark`.
2. Implementa la luminancia relativa y el contraste WCAG 2.x (unas 10 líneas;
   no hace falta una dependencia).
3. Una tabla de pares `[texto, fondo, mínimo]` evaluada en **ambos temas**:
   - `foreground` / `background` 4.5
   - `card-foreground` / `card` 4.5
   - `popover-foreground` / `popover` 4.5
   - `muted-foreground` sobre `background`, `card` y `muted` 4.5
   - `primary-foreground` / `primary` 4.5
   - `secondary-foreground` / `secondary` 4.5
   - `accent-foreground` / `accent` 4.5
   - `destructive-foreground` / `destructive` 4.5
   - `primary` / `background` 4.5 (enlaces)
   - `ring` / `background` 3
   - `sidebar-foreground` / `sidebar` 4.5
   - `sidebar-muted-foreground` sobre `sidebar` y `sidebar-accent` 4.5
   - `sidebar-accent-foreground` / `sidebar-accent` 4.5
   - `sidebar-primary-foreground` / `sidebar-primary` 4.5
   - `hero-foreground` y `hero-muted-foreground` sobre `hero-from` **y**
     `hero-to` 4.5. Los dos extremos del degradado cubren lo que axe no ve.
   - Cada `*-muted-foreground` semántico sobre su `*-muted` 4.5, y cada
     `*-foreground` sobre su sólido 4.5.
   - `status-open-foreground` / `status-open-muted` 4.5.
   - `chart-1…5` sobre `card` 3.
4. Falla si un token de la tabla no existe, o si no está en hex de 6 dígitos.
   Así, un valor nuevo en `oklch` no puede escapar de la prueba.
5. Falla si `globals.css` contiene un selector `.opus`, para que el tema no
   reaparezca a medias.

Los valores de este plan pasan todos los pares (calculados al escribirlo).
Si uno falla al implementar, se ajusta el color, no el umbral.

### 7. Pruebas existentes y e2e

- `src/components/layout/theme-toggle.test.tsx`:
  - "ofrece Claro, Oscuro y Sistema" y que **no** hay opción Opus.
  - Elegir Oscuro pone la clase `dark`.
  - La migración `opus → light`.
- `e2e/accessibility.spec.ts:21`: `THEMES = ["light", "dark"]`. Actualizar el
  comentario de cabecera ("three themes").
- Buscar otros specs que elijan un tema o busquen la opción "Opus":
  `grep -rn "Opus\|opus" e2e/`. Hoy solo aparece en `accessibility.spec.ts`,
  aparte de nombres de fixtures y de correo que no tienen que ver.

### 8. Documentación

- `docs/ui-patterns.md`:
  - La tabla de temas pasa a dos filas (Claro: gris-teal, navy y sidebar teal;
    Oscuro: navy, teal y sidebar teal profundo).
  - El selector: Claro / Oscuro / Sistema.
  - "Adding a token: declare it in `:root` and `.dark`".
  - La nota del sidebar: usar `sidebar-muted-foreground`.
  - La sección de accesibilidad: dos temas en axe, más la prueba de tokens y
    el motivo (axe no mide degradados).
  - Documentar `--hero-*` y `--brand-navy`.
- `CLAUDE.md`: no menciona los temas por nombre; no hace falta tocarlo.

## Verificación

1. `npm run check`, `npm run test:unit` (incluida la prueba nueva de contraste)
   y `npm run test:e2e` (incluido `accessibility.spec.ts` en los 2 temas), en
   verde.
2. `npm run build 2>&1 | grep -c "Unsupported metadata"` da 0.
3. Revisión visual en `npm run dev`, en los dos temas, a 360 px y a 1440 px:
   `/login` (panel de marca en desktop), `/inicio` (hero), `/admin/tracking`
   (tabla, badges de estado y SLA), un reporte con gráficas y el detalle de
   asignación FSR. Revisar también el sidebar (activo, hover y footer) y un
   diálogo o popover. Adjuntar capturas en el PR.
4. Con `localStorage.theme = "opus"` puesto a mano, recargar: el selector debe
   quedar en Claro y el valor guardado debe cambiar a `light`.
5. `grep -rn "\.opus\|\"opus\"" src e2e` no devuelve nada, salvo nombres que
   no son del tema (`font-display-opus`, correos y fixtures).

## Decisiones pendientes del usuario

| # | Decisión | Default recomendado |
|---|---|---|
| 1 | Color de la barra del navegador (`theme-color`) | Teal de marca `#004851` fijo. La alternativa es seguir al fondo (`#f3f6f6` / `#0b141c`) con media queries, pero eso no coincide cuando el usuario elige un tema distinto al del sistema |
| 2 | ¿El sidebar es teal también en Oscuro? | Sí, `#003a42`: da la misma identidad en los dos temas. La alternativa es un sidebar navy (`#141e29`) con acento teal, más sobrio |
| 3 | ¿Se renombra `.bg-opus-hero` a `.bg-brand-hero`? | No: sin tema Opus el nombre ya no confunde, y renombrar toca cinco archivos sin beneficio |
| 4 | ¿El flujo offline corre también en `chromium` (desktop) o solo en móvil? (A2) | Hacerlo seguro entre proyectos de todos modos, porque la corrida nocturna lo corre en iPad y Mobile Safari. Además, sacarlo de `chromium`: el FSR captura desde el celular, y así la suite baja ~1 min |
| 5 | ¿Se agrega `HydrationMarker` a la app solo para las pruebas? (A4) | Sí: son 6 líneas, no afecta al usuario y elimina toda una clase de carreras. La alternativa es reintentar cada clic con `expect(...).toPass()` en cada spec |

# Auditoría de UI de Hovy: reporte consolidado

Fecha: 12/11/2026 · Rama: `develop` (commit `8676608`) · Alcance: `client/src`

Este reporte une los hallazgos de la auditoría de tokens y componentes, la de accesibilidad (WCAG 2.1 AA), la revisión contra las guías web de Vercel y la verificación responsive. Es la base para las correcciones.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Verde principal | `#1B3006` como único valor |
| Responsive | Sin scroll horizontal a 320, 768 y 1280 px |
| Tipografía | **Pendiente.** Recomendación: cargar Plus Jakarta Sans con `@fontsource`; hoy está declarada pero no se carga y la app cae en la fuente del sistema |

## Cómo se midió

- **Código:** conteos sobre 90 archivos JSX y 7 hojas SCSS (3.288 líneas). El SCSS se compiló aparte para cruzar las clases usadas en JSX contra el CSS que realmente se genera.
- **Navegador:** app local contra la base de staging, 15 pantallas (3 públicas y 12 internas), a 320, 375, 640, 768, 967 y 1280 px.
- **Teclado:** tres modales probados a mano (Nuevo Cliente, Nuevo Servicio, Nuevo Turno); los 15 modales revisados en código.

Los conteos de atributos en JSX son aproximados: se cuentan por línea y hay etiquetas partidas en varias.

---

## Prioridad 1: lo que rompe el responsive

A 1280 px no hay roturas.

| ID | Ancho | Pantalla | Problema | Ubicación | Arreglo propuesto |
|---|---|---|---|---|---|
| R1 | 320 | Cobros | El selector de mes mide 361 px y se sale 65 px; toda la pantalla gana scroll horizontal | `pages/CobrosPage.jsx:195` | Permitir que la fila se parta; quitar `text-nowrap` del badge o achicarlo |
| R2 | 320 | Configuración | En las secciones desplegables el título y el resumen quedan en una columna de 23 px y se parten palabra por palabra | `components/ui/SeccionDesplegable.jsx:40` | Se arregla con C1 (`text-truncate` no tiene CSS); además dejar que el estado baje de línea |
| R3 | 320 | Detalle de solicitud | Las tres cajas de "Precio final" se cortan; la tabla de servicios recorta la columna de precio | `components/visitas/PresupuestoPanel.jsx:75` | Cambiar las tres `col-4` por `col-12 col-sm-4` |
| R4 | 320 | Login | El logo se corta por la derecha | `pages/Auth/Login.jsx:50` | Agregar `maxWidth: '100%'` |
| R5 | 768 | Cobros | El selector de orden queda 116 px fuera; barra de scroll horizontal en toda la pantalla | `pages/CobrosPage.jsx:239` | Permitir `flex-wrap` en la barra de filtros |
| R6 | 768 | Servicios | Tarjetas de a dos con el menú lateral abierto: el nombre se parte y las etiquetas miden 30 px | `pages/ServiciosPage.jsx:135` | `col-md-6` → `col-md-12 col-lg-6`, o dejar que el interior se apile |
| R7 | 768 | Clientes | El contenedor se pasa 11 px | sin ubicar | Investigar |

**Nota de medición:** el scroll de la app vive en `main.hovy-content-wrapper`, no en la página. Comprobar solo `document.documentElement.scrollWidth` da siempre bien aunque el contenido se salga; hay que medir ese contenedor.

**Sin cubrir:** 12 modales y los menús desplegables a 320 px; vistas Semanal y Mensual de la Agenda; listas con muchos datos; orientación horizontal.

---

## Prioridad 2: inconsistencias visuales

### C1. Clases de Bootstrap usadas sin CSS (lo más urgente de este bloque)

`styles/main.scss:17` importa Bootstrap por partes y deja afuera `type`, `helpers`, `badge`, `alert`, `spinners`, `tables` y `card`. Estas clases se usan igual y no hacen nada:

| Clase | Usos | Efecto de que falte |
|---|---|---|
| `small` | 362 | El texto queda a 16 px (verificado en pantalla) |
| `badge` | 53 | Sin padding, tamaño ni peso base |
| `text-truncate` | 47 | El texto largo no se corta (causa de R2) |
| `alert`, `alert-*` | 27 | Mensajes de error sin estilo |
| `visually-hidden` | 9 | Textos para lector de pantalla se ven en pantalla |
| `spinner-border` | 4 | El spinner no se dibuja |
| `table`, `table-hover`, `table-sm` | 3 | Tablas sin estilo base |
| `sticky-top`, `container-fluid`, `list-unstyled`, `text-bg-*`, `card-header`, `card-title` | 1–2 c/u | Sin efecto |

Clases que no existen en Bootstrap: `w-sm-auto`, `w-md-auto`, `w-lg-auto`, `w-xl-auto` (6 usos), `border-dashed` (7), `hover-opacity` (7), `tab-index-1` (5), `fs-md-3`, `fs-md-5`, `pointer-events-none`, `opacity-10`, `text-light-subtle`.

**Arreglo:** importar `bootstrap/scss/type` y `bootstrap/scss/helpers` (dos líneas, más de 400 usos). Para `badge`, `alert` y `spinner`: importarlos o terminar la migración a componentes propios (`Aviso` ya reemplaza a `alert` en 19 lugares; quedan 24 crudos).

### C2. Color

- 211 valores hex distintos en 573 usos; 126 se usan una sola vez. Verdes: 75 valores (21 oscuros). Neutros: 68.
- `main.scss` define 5 variables de color. Los SCSS de módulo no las importan y declaran paletas propias (`$metricas-verde` y `$cobros-verde` = `#2D4A27`; `$notif-verde` = `#1B3006`).
- **Unificar el verde:** 2 variables (`metricas.scss:4`, `cobros.scss:2`) más 10 literales en `MapaAgenda.jsx` y `FiltroFechas.jsx`.
- `#1B3006` escrito como literal 82 veces; 9 archivos declaran su propia `const VERDE`. `text-primary` y `bg-primary` ya valen ese verde y se usan 10 veces.
- `$secondary`, `$success`, `$danger`, `$warning` e `$info` quedan con los valores por defecto de Bootstrap (ver A6).
- Azul fuera de paleta: `#2563EB` y `#1D4ED8`, 16 usos. Falta decidir si pertenece al sistema.
- 52 valores `rgba` distintos; `rgba(27,48,6,…)` 28 veces con opacidades diferentes.

### C3. Escalas sin definir

| Categoría | Valores distintos | Detalle |
|---|---|---|
| Tamaño de fuente | 38 en SCSS, 25 inline | 138 `fontSize` inline; `0.65rem` ×42, `0.7rem` ×33 |
| Radio de borde | 30 | `999px` y `9999px` conviven; `0.75` a `1rem` en seis pasos |
| Sombras | 23 | más `shadow-sm` ×114 |
| Transiciones | 20 | seis duraciones entre 0.15 y 0.3 s |
| `gap` / `padding` | 24 / 53 | |
| z-index | 8 | 29 inline, 1050 → 1080 |
| Tamaño de íconos | 15 | de 11 a 56 px |
| `!important` | 80 | 38 en `main.scss`, 24 en `_buttons.scss` |

El rótulo en mayúsculas con `letterSpacing` inline se repite 31 veces.

### C4. Componentes

| Componente | Uso | Markup equivalente a mano |
|---|---|---|
| `Button` | 57 en 29 archivos | 115 `<button>` crudos en 43 archivos |
| `Input` | 0 | 57 `form-control` en 26 archivos |
| `Card` | 58 en 31 archivos | unas 25 tarjetas a mano |
| `Aviso` | 19 | 24 `alert` crudos |
| `Skeleton` | 100 | ninguno |
| Modal | no existe | 15 modales copian la estructura |
| Badge | no existe | 53 usos con estilo inline |
| Menú desplegable | no existe | 7 a mano |
| Buscador | no existe | 5 copias |

- 358 bloques `style={{…}}`; los peores: `TurnosSemanal.jsx` (32), `NuevoTurnoModal.jsx` (31), `PanelClima.jsx` (31).
- `Card.jsx:20` define un borde inline que `border-0` anula.
- Nombres mezclados entre inglés y español; `ui/` contiene modales de dominio.
- `main.scss` tiene 1.338 líneas con estilos de páginas concretas.
- Unas 20 de 268 clases propias sin referencia en JSX (16 son `nuevo-turno-*`); aproximado.

### C5. Breakpoints

- `576px` en 9 lugares de `main.scss` (debe ser `575.98px`), `420px` en 3, `359.98px` en 1.
- Ningún archivo usa los mixins `media-breakpoint-*`.

### C6. Guías web (Vercel)

- `transition: all` en 7 lugares (`turnos.scss:254`, `:289`, `:306`; `main.scss:160`, `:472`; `PanelClima.jsx:190`; `FiltroFechas.jsx:41`).
- 74 textos con `...` en lugar de `…`.
- 8 navegaciones con `onClick` en lugar de enlace (`ClientsPage.jsx:378`, `VisitasPage.jsx:363`, `Login.jsx:135`, entre otras).
- `ClientsPage.jsx:378` arma la URL con el teléfono del cliente.
- Dos `window.confirm` nativos: `TurnoDetalleModal.jsx:220`, `ClientInmueblesPage.jsx:177`.
- De 85 campos, 3 tienen `autoComplete`; ninguno usa `type="tel"`.
- Las 5 `<img>` sin `width` ni `height`.
- Fechas armadas a mano en `notificacionesConfig.js:71`; `PanelClima.jsx` usa `es-ES` en lugar de `es-AR`.
- Sin aviso de cambios sin guardar; sin `theme-color`; sin `overscroll-behavior` en modales.
- `.leaflet-container` tiene `min-height: 400px` y `height: 320px` a la vez (`main.scss:778`).

---

## Prioridad 3: accesibilidad (WCAG 2.1 AA)

| ID | Problema | Criterio | Evidencia |
|---|---|---|---|
| A1 | Ningún modal atrapa el foco | 2.4.3 | 0 de 15; verificado en dos |
| A2 | Escape cierra solo 3 de 15 modales | 2.1.1 | `RegistroPagoModal`, `ModificarTurnoModal`, `NuevoTurnoModal` |
| A3 | Los modales no se anuncian como diálogo ni reciben el foco | 4.1.2 | `role="dialog"` en 2 de 15 |
| A4 | Campos sin etiqueta asociada | 3.3.2, 1.3.1 | `NewClientModal` (5), `EditClientModal` (5), `InmuebleModal` (10), Registro (6), buscadores y selectores de Clientes, Inmuebles, Historial y Agenda |
| A5 | Campos sin foco visible | 2.4.7 | 10 inputs con `shadow-none`; `outline: none` en `main.scss:481` |
| A6 | Contraste insuficiente | 1.4.3 | Ver tabla |
| A7 | Texto de menos de 11 px | 1.4.4 | Clientes (18), Métricas (18), Detalle de solicitud (15), Cobros (11); mínimo 5,5 px en Registro |
| A8 | Sin `<h1>` en las pantallas internas; saltos de nivel | 1.3.1 | Clientes salta de `h3` a `h6` |
| A9 | `lang="en"` y título "Hovy" en todas las rutas | 3.1.1, 2.4.2 | `client/index.html` |
| A10 | Elementos clicables que no son botones | 2.1.1 | 5 `div` en Agenda; ícono en `ClientInmueblesPage.jsx:258` |
| A11 | Sin enlace de "saltar al contenido" | 2.4.1 | |
| A12 | Errores de formulario sin vínculo con el campo | 3.3.1 | Sin `aria-invalid` ni `aria-describedby` |

### Contraste medido (mínimo 4.5)

| Texto | Color | Fondo | Ratio | Dónde |
|---|---|---|---|---|
| Gris secundario (`text-secondary`, 433 usos) | `#6c757d` | `#f2f2e6` | 4.16 | subtítulos de todas las páginas |
| Gris secundario | `#6c757d` | `#f8f9fa` | 4.45 | tarjetas |
| Rótulo verde de sección | `#198754` | `#f2f2e6` | 4.02 | todas las páginas |
| Badge "Activo" / "Confirmada" | `#198754` | `#d1e7dd` | 3.49 | Clientes, Inmuebles, Detalle |
| Badge "Confirmado" | `#0dcaf0` | `#e7fafe` | 1.81 | Panel |
| Aviso "Estimado interno" | `#ffc107` | `#fff3cd` | 1.47 | Detalle de solicitud |
| Gris tenue | `#8d968b` | blanco | 3.06 | Métricas |
| Terracota | `#c87d55` | blanco | 3.22 | Métricas, Cobros |
| Iniciales en rojo | `#dc3545` | `#ffebee` | 3.96 | Clientes |
| Estado vacío | `#b1b6b8` | `#f6f6f3` | 1.90 | Agenda |
| Riesgo de lluvia | `#d97706` | `#faf9f6` | 3.03 | Agenda |
| Pie "© 2024" | `#8f969c` | `#f8f9fa` | 2.84 | Home |

Los primeros cuatro son colores por defecto de Bootstrap: redefinir `$secondary` y `$success` los corrige en un solo lugar.

### Lo que está bien

- Objetivos táctiles en celular: casi todos los botones llegan a 44 px.
- Zoom al 200 % (640 px): sin scroll horizontal en las 12 pantallas internas.
- Hay `main`, `nav`, `header` y `aside`; el menú marca la página actual con `aria-current`.
- Ninguna imagen sin `alt`; 44 usos de `role="alert"` o `role="status"`.
- `prefers-reduced-motion` contemplado; no se bloquea el pegado ni el zoom.

**Sin cubrir:** prueba con lector de pantalla real (NVDA o VoiceOver).

---

## Orden sugerido de corrección

Módulo por módulo; después de cada tanda correr `npm --prefix client run lint` y `npm --prefix client run build`.

1. **Base de estilos:** importar `type` y `helpers` (C1); crear un archivo de tokens que importen todos los SCSS; unificar el verde (C2); redefinir `$secondary` y `$success` (A6); cargar la tipografía.
2. **Roturas responsive:** R1 a R7.
3. **Componente `Modal`:** foco atrapado, Escape, `role="dialog"`, devolución del foco. Resuelve A1 a A3 en los 15 modales.
4. **Formularios:** vincular etiquetas, adoptar `Input`, foco visible, `autoComplete` y `type="tel"` (A4, A5, C6).
5. **Página:** `<h1>`, `lang="es"`, título por ruta, enlace de salto (A8, A9, A11).
6. **Escalas:** tamaños de fuente, radios, sombras, z-index y breakpoints (C3, C5).
7. **Componentes `Badge`, menú y buscador;** reemplazo de `alert` por `Aviso` (C4).
8. **Detalles de las guías web** (C6).

El paso 1 cambia el aspecto de toda la app: al activarse `small`, 362 textos pasan de 16 px a 14 px. Conviene revisarlo en pantalla antes de seguir.

---

## Estado de las correcciones (rama `feat/auditoria-ui-correcciones`)

Hecho y verificado en el navegador a 320, 768 y escritorio; `lint` y `build` en verde.

| Ítem | Estado |
|---|---|
| C1: importar `type`, `helpers` y `spinners` de Bootstrap | Hecho. `small`, `text-truncate`, `visually-hidden`, `sticky-top`, `list-unstyled`, `text-bg-*` y `spinner-border` ya tienen CSS |
| C1: clases `alert` | Hecho. Toman el aspecto de `Aviso` desde `main.scss`, sin tocar los 27 usos |
| C1: clase inválida `tab-index-1` | Eliminada (5 usos) |
| Tipografía: cargar Plus Jakarta Sans (pesos 400 a 800) | Hecho |
| C2: tokens compartidos (`styles/_tokens.scss`, `styles/colores.js`) | Hecho. Los SCSS de módulo los importan; se eliminaron las 9 `const VERDE` |
| C2: verde único `#1B3006` | Hecho. Sin literales `#1B3006` ni `#2D4A27` fuera de los dos archivos de tokens |
| C5: `576px` → `575.98px` | Hecho (9 lugares) |
| R1 a R6 | Hecho |
| R7 | Dejó de reproducirse tras C1 |
| Cobros a 320 px: el estado se encimaba con el monto | Hecho. Por debajo de 400 px van en líneas separadas |
| A2: Escape cierra el modal | Hecho en los 15 (`components/ui/useCerrarConEscape.js`) |
| A3: `role="dialog"` y `aria-modal` | Hecho en los 15. Falta mover el foco adentro al abrir |
| A4: etiquetas vinculadas | Hecho en `NewClientModal`, `EditClientModal` e `InmuebleModal` (19 campos). Faltan Registro y los buscadores |
| A9: `lang="es"` | Hecho. Falta el título por ruta |

Pendiente: A1 (atrapar el foco), A5 a A8, A10 a A12; `badge` y `table` sin CSS; el resto de la paleta (unos 200 valores); breakpoints `420px` y `359.98px`; anchos fijos inline; C3, C4 y C6.

## Segunda tanda: decisiones del sistema de diseño (rama `feat/sistema-diseno-accesibilidad`)

Aplica en la app las decisiones del sistema de diseño publicado en Claude. Verificado en el navegador a 320, 768 y 1280 px; `lint` y `build` en verde.

| Ítem | Estado |
|---|---|
| A6: `$secondary` `#5c636a`, `$success` `#08775b`, `$body-secondary-color` | Hecho. Ninguna de las 12 pantallas internas tiene texto por debajo de 4.5:1 |
| A6: terracota y gris tenue usados como texto | Hecho (`#a35a34` y `metricas-texto-secundario`) |
| A6: badge Confirmado (1.81:1) y aviso "Estimado interno" (1.47:1) | Hecho con el componente `Badge` |
| A5: borde de campos `#7d8577` (3.8:1) y foco que no anula `shadow-sm` | Hecho |
| A5: foco de `SeccionDesplegable` recortado por `overflow-hidden` | Hecho: el anillo va hacia adentro |
| A1 y A3: foco atrapado, foco inicial y devolución del foco en los 15 modales | Hecho (`useFocoModal`) |
| A2: Escape cierra solo el modal de arriba | Hecho (pila en `useCerrarConEscape`) |
| A12: errores vinculados con `aria-invalid` y `aria-describedby` | Hecho en Nuevo Cliente, Editar Cliente, Inmueble y Servicio |
| A7: texto de menos de 12 px | Hecho, salvo el texto interno del logo de Registro |
| Títulos en peso 700 y rótulo de pantalla `.hovy-rotulo` | Hecho |
| C4: componente `Badge` | Hecho en 13 estados; quedan contadores, prioridades y etiquetas sobre imágenes |

Tercera tanda, en la misma rama:

| Ítem | Estado |
|---|---|
| C4: componente `Modal` | Hecho. Los 15 modales lo usan; título en `h2` vinculado, cierre bloqueado mientras guardan |
| A1: con dos modales encimados, solo el de arriba atrapa el foco | Hecho (pila en `useFocoModal`) |
| Foco inicial en modales que cargan datos (Nuevo Turno) | Hecho: reintenta mientras los campos se habilitan |
| A4 y A12 en Registro | Hecho: etiquetas, errores vinculados y `autoComplete` |
| Nuevo Turno | Aviso de error con `role="alert"`, opciones con `aria-pressed`, obligatorios con `aria-required` |
| Etiquetas `bg-*-subtle` con `text-*` (prioridades, tipos) | Hecho: usan el tono `*-text-emphasis` |
| Mensajes vacíos y separadores con `opacity-50` | Hecho |
| Logo de Registro con texto de 5 a 8 px | Hecho: el nombre pasa debajo del círculo, a 14 y 12 px |

Cuarta tanda, en la misma rama: base para escalar.

| Ítem | Estado |
|---|---|
| C2: paleta por escalas | Hecho. `styles/_paleta.scss` (75 tonos en 12 escalas) es el único lugar con valores de color; se publica como variables CSS `--hovy-*` y en `styles/paleta.js` para SVG y Leaflet. Quedan en hex solo los dibujos SVG (logo de Registro, marcadores) |
| C3: escalas | Hecho en `_tokens.scss`: texto (10 tamaños), radios (9), sombras (5), capas z-index (10, también en `styles/capas.js`), duraciones (4) y cortes de pantalla propios |
| C5: cortes 420 y 359.98 px | Con nombre: `$hovy-bp-telefono` y `$hovy-bp-telefono-chico` |
| C6: `transition: all` | Hecho: propiedades explícitas |
| C6: navegación con `onClick` | Hecho: enlaces (`Link`) en Login, Inmuebles, Detalle de solicitud y Solicitudes |
| C6: teléfono del cliente en la URL | Hecho: la ruta usa el número de cliente |
| C6: `window.confirm` | Hecho: `ConfirmarModal` (cancelar turno, dar de baja inmueble) |
| C6: `...` en textos | Hecho: 81 reemplazos por `…` |
| C6: imágenes sin tamaño | Hecho; el avatar externo (ui-avatars) pasa a iniciales locales |
| C6: fechas a mano y `es-ES` | Hecho con `Intl` en `es-AR` |
| C6: cambios sin guardar | Hecho en 4 formularios y Registro (`useAvisoCambiosSinGuardar`) |
| C6: `theme-color`, `touch-action`, `overscroll-behavior`, `spellCheck` en correos | Hecho |
| Dos modales encimados | Probado en pantalla con Cancelar turno sobre Detalle del turno |

Quinta tanda, en la misma rama: lo que había quedado pendiente.

| Ítem | Estado |
|---|---|
| C3: escala de espaciado | Hecho: `$hovy-espacio-2` a `$hovy-espacio-56` (el número es la medida en px) y `var(--hovy-espacio-*)`. 183 paddings, margins, gaps y desplazamientos de las hojas y 11 estilos inline pasan a la escala; cada valor se movió al paso más cercano (2 px como máximo) |
| C6: `alert()` | Hecho: avisos flotantes (`AvisosProvider` y `useAvisos`) en Clientes, Inmuebles, Agenda y Detalle de solicitud. Los errores usan `role="alert"`, quedan hasta cerrarlos y aparecen sobre los modales y sobre la barra inferior |
| Ver en Maps sin coordenadas | Hecho: el botón queda deshabilitado con su motivo, como el de WhatsApp |
| A5: bloques clicables sin teclado | Hecho: tarjetas y turnos de la agenda semanal y mensual, "+N más" y los días del clima se usan con Tab, Enter y Espacio (`accionable.js`); los días del clima anuncian cuál está elegido (`aria-pressed`) |
| A4 y A12 en Login | Hecho: etiquetas vinculadas, errores con `aria-describedby`, `autoComplete`, y el ojo de la contraseña pasa a ser un botón con nombre |
| `Input.jsx` | Hecho: vincula etiqueta, error y ayuda con `aria-*`, marca obligatorios y desactiva el corrector en correos |

Quedan fuera, a propósito: los desplazamientos decorativos de Métricas (−4 rem), la altura del encabezado (80 px) y el espacio de la barra inferior (6 rem), que son medidas de diseño y no de espaciado.


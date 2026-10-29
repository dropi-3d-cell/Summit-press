# Dropi · Lab Summit · presentación web

Presentación a pantalla completa (HTML, CSS y JavaScript sin dependencias): 100 millones de órdenes,
ecosistema y logística, **Dropi Pro** en Europa, DropiPay, IA y MCP, el **lanzador de anuncios con IA**
y las novedades de **Chatea Pro**.

Abre `index.html` con un servidor local (por ejemplo `npx serve` o Live Server) o publícalo
directamente en GitHub Pages: no necesita compilación.

## Navegación
Rueda del mouse, flechas del teclado, swipe en móvil o las flechas del riel derecho.
Cada gesto avanza un paso: primero los pasos internos de la escena (`data-beats`) y luego
la escena siguiente. Las escenas con `data-curtain="Texto"` abren con la cortina animada
(titular con partículas radiales); `data-n` es el número que aparece encima.

## Escenas
| # | Escena | Visual |
|---|---|---|
| 1 | Dropi = 100 millones de órdenes | Titular gigante en ASCII con ondas y campo de wave dots; el cursor lo ilumina |
| 2 | Ecosistema → Logística → Dropi Pro | Globo 3D en tres pasos (Latinoamérica, rutas, Europa) |
| 3 | Dropi Pro · tiempos y hora de corte | Horas de corte y barras de días de entrega |
| 4 | Dropi Pro · % de entrega | Barras de rango por país y transportadora |
| 5 | DropiPay | Titulares en bucle y tres beneficios |
| 6 | El ecosistema que piensa → MCP | Campo ASCII |
| 7 | Lanzador de anuncios con IA | Titular grande sobre foto con parallax |
| 8 | Chatea Pro | Cinco novedades + capturas que cambian cada 2 s |

## Ajustes rápidos (`js/main.js` → `CONFIG`)
- `hundred.lines` / `hundred.linesMobile`: texto del titular ASCII, una línea por elemento.
  Tusker no trae el signo `=`, así que se dibuja con dos barras del mismo grosor del trazo.
- `hundred.waveSpeed`: velocidad de las ondas.
- `chatea.intervalMs`: cada cuánto cambia la captura de Chatea Pro (2000 = 2 s).
  Para añadir capturas, agrega otra `<img>` dentro de `.ch-slides` en `index.html`.

## Archivos
- `js/globe-data.js`: siluetas de Natural Earth (paquete `world-atlas`). No requiere red.
- `assets/img/`: `publicidad.jpg` (lanzador de anuncios), `ch1.jpeg` y `ch2.jpeg` (capturas de Chatea Pro)
  y `logo-chatea-pro.svg` (versión blanca para fondo oscuro). Reemplázalas con el mismo nombre.
- `assets/fonts/`: Anton y Montserrat (licencia OFL). Tusker Grotesk y Montserrat van incrustadas en `css/styles.css`.

# Dropi Acceleration · presentación web

Presentación a pantalla completa (HTML, CSS y JavaScript sin dependencias) con el programa
**Dropi Acceleration** y los datos logísticos de **Dropi Pro** en Europa.

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
| Inicio | Dropi, ecosistema de ecommerce más grande de Latinoamérica | Mapa mundi 3D, 11 países con wave dots y nombre al pasar el cursor |
| 2 | Retorno del curso | Moneda 3D que se parte 50 / 50 |
| 3 | Financiación de usuarios | Barras isométricas que crecen |
| 4 | Importación en privado | Caja 3D y anillo de 30 días |
| 5 | Importación y personalización | Foto con parallax + "0 €" en 3D |
| 6 | Apoyo publicitario | Foto con parallax |
| 7 | Soporte semanal | Anillo 3D de temas + foto |
| 8 | Venta en Europa | Mapa 3D interactivo de Europa |
| Dropi Pro | Tiempos y hora de corte | Horas de corte y barras de días de entrega |
| Dropi Pro | % de entrega por país y transportadora | Barras de rango |
| 9 | Go Verify | Teléfono 3D que confirma pedidos en vivo |

## Mapa de Europa
- Gira solo a velocidad constante; arrastra (mouse o dedo) para girarlo e inclinarlo.
- Doble clic, botones + / −, pellizco o rueda (después de tocar el mapa) para acercar.
- Al pasar el cursor o presionar un país, se eleva, brilla y el resto se desenfoca.
- Ajustes en `js/main.js` → `CONFIG.europe` (`spin`, `tilt`, `zoomMax`, `lift`).

## Archivos
- `js/geo-data.js`: siluetas pre-proyectadas de Natural Earth (paquete `world-atlas`). No requiere red.
- `assets/img/`: fotos de los PDF de Dropi Pro y Dropi Acceleration. Reemplázalas con el mismo nombre
  o cambia la ruta en el atributo `data-src` de cada `.photo` en `index.html`.
- `assets/fonts/`: Anton y Montserrat (licencia OFL). Para usar Tusker Grotesk, copia aquí
  `TuskerGrotesk-8800Super.woff2` y `TuskerGrotesk-3500Medium.woff2` del proyecto de Leyendas;
  si no están, los titulares usan Anton.

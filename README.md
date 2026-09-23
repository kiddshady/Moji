# Moji

Panel de emojis, kaomojis y símbolos para Windows. Construido a partir de una copia independiente de Onyx.

*Moji* es «carácter» en japonés: emoji es 絵文字 (carácter-imagen) y kaomoji es 顔文字 (carácter-cara).

## Abrir

Bajá el instalador `Moji-Setup-<versión>.exe` de los [Releases](https://github.com/kiddshady/Moji/releases) y abrilo desde Inicio o el acceso directo del escritorio. También podés usar el portable `dist/Moji.exe`. Queda en la bandeja del sistema. Mientras escribís en otra app, presioná **Ctrl + Alt + .**, elegí un carácter y seguí escribiendo.

- **Clic:** inserta en la ventana desde la que abriste Moji. El panel queda abierto para elegir varios seguidos.
- **Clic derecho:** copia el carácter explícitamente.
- **Esc:** limpia una búsqueda activa, vuelve de ajustes o cierra el panel. Después de insertar, cierra directo. Hacer clic afuera también lo cierra.
- **Flechas:** recorren los caracteres; Enter inserta.
- **Ctrl + 1 / 2 / 3 / 4:** cambia de pestaña.
- **Ctrl + C:** copia el carácter enfocado.
- **/**: enfoca la búsqueda.
- Para salir del todo: Ajustes > Salir de Moji, o menú de la bandeja.

El atajo se cambia en Ajustes. Win + . conserva su función de Windows. El inicio automático es opcional y se habilita desde la versión instalada o portable. Si usás el portable, el archivo debe permanecer en la misma ubicación; por eso su ejecutable no lleva la versión en el nombre y una recompilación lo reemplaza allí mismo (con Moji cerrado).

## Actualizaciones

La versión instalada busca actualizaciones en los Releases de GitHub al arrancar y cada 6 horas, las baja en silencio y avisa cuando están listas. Se instalan desde Ajustes > Actualizaciones o desde el menú de la bandeja; si no, al salir de Moji. Nunca reinicia sola. El portable no se actualiza solo: se reemplaza por el nuevo `Moji.exe`.

Para publicar una versión:

```powershell
npm version minor        # o patch; bumpea package.json y crea el tag
git push --follow-tags   # el workflow arma el instalador y publica el Release
```

## Contenido

Cuatro pestañas: Más usados, Emojis, Kaomojis y Símbolos. El catálogo se incluye en el ejecutable y funciona offline. Los emojis usan la fuente Segoe UI Emoji de Windows: el aspecto y la disponibilidad visual de los más recientes dependen de la versión de esa fuente.

La búsqueda admite nombres y palabras clave en español e inglés, sin exigir tildes. Hay seis opciones de tono de piel. Más usados ordena por cantidad de selecciones y, en caso de empate, por la última selección; recuerda el tono utilizado. En una instalación nueva se muestran sugerencias bajo «Para empezar» hasta que empieces a usarlo.

No incluye GIFs, historial del portapapeles ni cuentas. La inserción normal no lee ni modifica el portapapeles. El menú Copiar sí lo modifica por pedido explícito.

## Datos

Ajustes y frecuencias en `%APPDATA%/Moji/data/panel.json`. `MOJI_DATA` permite elegir otra carpeta, por ejemplo en pruebas. Escritura atómica heredada de Onyx. No se importa el historial del panel de Windows.

## Desarrollo

```powershell
npm install
npm start
npm test
npm run smoke
npm run icons
npm run build
npm run build:installer
npm run test:package
```

`npm run build` genera el portable `dist/Moji.exe`. `npm run build:installer` genera el instalador asistido `installer-dist/Moji-Setup-<versión>.exe`, para el usuario actual, con accesos directos, desinstalador y elección de carpeta.

`npm test` comprueba tokens, almacenamiento, búsqueda (incluidos los ejemplos que sugieren los buscadores), catálogo, variantes y codificación UTF-16. `npm run smoke` prueba el renderer real, menús, íconos de bandeja, atajo global e inserción Win32 en una ventana de prueba; usa una carpeta temporal. `npm run test:package` abre `dist/Moji.exe` como proceso independiente, verifica el atajo, la inserción de un emoji compuesto, el portapapeles intacto y la persistencia tras reiniciar. Las capturas quedan en `.shots/`.

`npm run icons` hornea `assets/icon.ico`, `assets/icon.png` y `assets/tray-{16,20,24,32}.png` desde `tools/icons.mjs`: la carita de la marca sobre la baldosa, con los colores de `tokens.css`. Hasta 24 px usa una versión ajustada al píxel para que se lea en la bandeja. La hoja de control, con cada tamaño a 1:1 y ampliado, queda en `.shots/icons.png`.

`npm run catalog` reconstruye el catálogo desde Emojibase (datos CLDR/Unicode) más la selección local de kaomojis y símbolos. El generador es una herramienta de desarrollo; el programa no necesita la dependencia de datos completa en ejecución.

## Implementación y límites

Electron 40, Koffi para Win32 y CSS/controles de Onyx. El renderer tiene sandbox y contextIsolation; solo puede insertar IDs del catálogo validado. No hay navegación externa ni solicitudes de permisos. La ventana se prepara fuera de pantalla antes de mostrarse siguiendo el método anti-flash de Onyx.

Antes de abrir se conserva el HWND de la ventana activa; al seleccionar se restaura el foco y se envían unidades UTF-16 mediante SendInput, incluidos los pares sustitutos y secuencias ZWJ. No se presupone compatibilidad con todos los controles: algunas apps o ventanas elevadas pueden rechazar entrada sintetizada. Moji muestra el error y permite usar Copiar. El destino más confiable se obtiene abriendo con el atajo desde el campo de texto.

Fuentes técnicas: [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), [SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow), [atajos globales de Electron](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts), [datasets de Emojibase](https://emojibase.dev/docs/datasets/).

Los datos de Emojibase conservan su licencia en `assets/Emojibase-LICENSE.txt`; las fuentes de Onyx incluyen sus licencias en `renderer/fonts/`.

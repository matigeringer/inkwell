# Inkwell

Editor local de manuscritos Markdown. Permite abrir carpetas y archivos, editar sin distracciones, recuperar borradores y versiones, y exportar a PDF, DOCX, ODT, Markdown y texto.

## Requisitos y comandos

Node.js >=22.12.0 y npm. Desde esta carpeta:

```bash
npm ci
npm run dev
npm run check
```

Electron descarga su binario oficial al ejecutarse por primera vez. Para descargarlo previamente: `npm exec --no -- install-electron`. La compilación y las pruebas de Node/DOM no necesitan abrir Electron.

- `npm test`: pruebas de archivos, historial, contratos IPC, sesión, exportación e interfaz React/Tiptap.
- `npm run check`: ESLint sin advertencias, pruebas y compilación de producción.
- `npm run test:electron`: prueba nativa de arranque, sandbox, IPC, edición, guardado y PDF; utiliza perfil y archivos temporales en Linux, sin acceder a los documentos del usuario.
- `npm run test:packaged`: repite esa prueba sobre el código y las dependencias del ASAR generado por `build:linux`.
- `npm run build:unpack`: paquete para inspección local.
- `npm run build:linux`: AppImage y deb x64, con `SHA256SUMS-linux.txt`.
- `npm run build:win`: ejecutable portable x64, con `SHA256SUMS-windows.txt`, compilable en Windows o Linux.
- `npm run build:win:installer`: instalador NSIS opcional. Requiere Windows o Wine funcional en Linux y no forma parte de las descargas de la release.
- `npm run release:check`: coherencia entre versión, lockfile y etiqueta de CI.
- `npm run release:publish -- --dry-run`: verifica los paquetes y genera una vista previa local de la release.

Las descargas e instrucciones de instalación están en el [README principal](../README.md). Consulta la [guía de publicación](../docs/RELEASING.md) para crear una release en GitHub.

## Conservación de documentos

Desactivar el autoguardado detiene el debounce periódico; cambiar de documento, crear otro, volver a portada o cerrar la ventana igualmente espera la persistencia de los cambios. Si falla, se conserva el editor abierto y se muestra el error. «Guardar como» permite crear una copia ante un conflicto. Un guardado antiguo no marca como persistidos cambios posteriores.

Las escrituras se serializan y reemplazan el original mediante un temporal del mismo volumen. Se compara el contenido leído con el de disco para detectar modificaciones externas o eliminación. Esto no bloquea el archivo para otras aplicaciones: evitar ediciones simultáneas durante una escritura.

Los borradores sin ruta aparecen en «Recuperar un borrador» al reiniciar, incluidas las claves de versiones anteriores. Al eliminar un archivo activo se conserva su contenido como borrador y no se vuelve a escribir en la ruta eliminada. Si falla la papelera se conserva el elemento; no hay fallback a borrado definitivo.

El historial se almacena en `fountain_history` dentro de `userData`. Las operaciones se serializan y los metadatos se reemplazan atómicamente. Un índice dañado se copia a `meta.corrupt.*.json` y se reconstruye desde las versiones. Al cambiar de ruta se traslada el historial y se conserva el origen como recuperación.

Borradores y versiones son almacenamiento local **sin cifrado** y no reemplazan una copia de seguridad externa.

## Markdown y exportación

Los documentos con tablas, imágenes o HTML se editan como fuente Markdown para conservar sintaxis que el schema visual de Tiptap no representa. Los bloques de código con ejemplos HTML siguen siendo compatibles con el editor visual.

PDF se genera desde Markdown, sin HTML crudo, JavaScript ni red, en una sesión aislada con CSP. No se cargan imágenes remotas. DOCX/ODT conservan saltos, listas anidadas, tablas y enlaces; las imágenes se representan mediante descripción y enlace, con aviso al exportar.

La comparación de versiones usa un worker cancelable y matrices limitadas. Cambios muy grandes se muestran por bloques.

## Arquitectura

- `src/main/fileService.js`: autorizaciones, rutas, conflictos y operaciones de archivos.
- `src/main/storage.js`: cola, escritura atómica y renombrado sin reemplazo.
- `src/main/historyManager.js`: versiones, recuperación y traslado del historial.
- `src/main/ipcSecurity.js`: verificación de ventana/frame/URL y protocolos externos.
- `src/main/documentModel.js`: conversión de tokens para exportaciones.
- `src/main/index.js`: ciclo de vida, diálogos y adaptadores IPC que validan el remitente.
- `src/preload/index.js`: API específica y suscripciones con limpieza, sin IPC genérico.
- `src/renderer/src/lib/documentSession.js`: contenido, revisiones y guardado, independiente de React.
- `src/renderer/src/hooks`: persistencia, operaciones de archivos, comparación y foco de modales.

Sólo los selectores nativos conceden acceso. Las autorizaciones se guardan en `authorized-paths.json`. Tras actualizar desde una versión sin ese registro puede ser necesario volver a abrir una vez las carpetas/archivos con el selector. Carpetas desconectadas o sin acceso muestran un error. Los documentos tienen un límite de 10 MiB y el explorador informa límites de profundidad/tamaño y errores parciales.

## Seguridad y distribución

Todas las ventanas usan sandbox. No usar `--no-sandbox` para solucionar una instalación: Linux necesita namespaces de usuario o el helper de sandbox correctamente instalado. Se verificó el arranque nativo en Linux sin desactivar esta protección.

Se distribuyen AppImage y deb para Linux y un ejecutable portable para Windows, únicamente x64. Los paquetes contienen el código compilado, dependencias de producción y la licencia GPL. Los iconos se comparten desde `resources/`. No se incluye un actualizador automático: las actualizaciones se descargan desde Releases. El ejecutable Windows no está firmado por defecto; la guía de publicación documenta la configuración opcional. Los paquetes deben probarse en sus sistemas antes de publicar. No hay credenciales de firma en el repositorio.

GitHub Actions ejecuta instalación reproducible, controles, `npm audit --omit=dev` y `npm audit --audit-level=high`. Las vulnerabilidades de producción o los avisos altos/críticos detienen el workflow. No se fuerzan sustituciones mayores incompatibles. Las pruebas usan directorios temporales y no deben apuntarse a manuscritos reales.

# Auditoría de Inkwell

> Informe del estado previo. Las correcciones y verificaciones posteriores están documentadas en [IMPLEMENTACION_AUDITORIA.md](IMPLEMENTACION_AUDITORIA.md).

Fecha: 2 de noviembre de 2026. Código revisado: commit `5de51c2`, árbol de trabajo inicialmente limpio.

## Dictamen

La aplicación tiene una base razonable, pero todavía no reúne las condiciones de seguridad y conservación de datos que esperaría para distribuir un editor de documentos de forma confiable. Hay errores concretos que pueden sobrescribir archivos, perder cambios o mostrar un guardado que no ocurrió. Conviene corregirlos antes de ampliar funcionalidades.

La separación `main` / `preload` / `renderer`, el uso de módulos, React, ESLint y un lockfile son buenos puntos de partida. El renderer principal tiene CSP y el editor configura Markdown con `html: false`. No encontré en el código propio ejecución de comandos mediante `exec`/`spawn` ni acceso directo a Node desde los componentes. Estas protecciones no compensan la amplitud del IPC ni el sandbox desactivado.

Esto es una evaluación técnica, no una certificación de conformidad con una norma concreta. No se definieron requisitos normativos, de distribución ni una matriz de sistemas operativos.

## Alcance y verificación

- Se revisaron los cuatro módulos de `main`, el preload, la gestión de documentos y preferencias, los exploradores, el historial, los exportadores y la configuración de compilación y distribución.
- `npm run build`: correcto. Esto verifica compilación, no comportamiento de la aplicación.
- `npm run lint -- --no-cache`: falla, con **8 errores y 37 advertencias**. Incluye imports sin uso, bloques `catch` vacíos, problemas de hooks y formato.
- `npm audit`: **34 paquetes señalados: 9 altos y 25 moderados**. Son paquetes afectados, no 34 vulnerabilidades independientes demostradas en la aplicación.
- `npm audit --omit=dev`: **3 paquetes señalados con severidad alta**: `electron`, `markdown-it`, `extract-zip`. La etiqueta de npm no describe por sí sola la exposición: `extract-zip` pertenece al mecanismo de instalación de Electron; el binario Electron y el parser Markdown sí son relevantes para la aplicación distribuida.
- Se realizaron **14 comprobaciones aisladas** sobre código original: handlers con Electron simulado, callbacks extraídos del AST y archivos reales exclusivamente en directorios temporales. Confirmaron los comportamientos registrados más abajo. La ventana PDF y las APIs nativas se simularon; no se explotó un navegador real.
- No se ejecutó una sesión gráfica completa ni se probaron instaladores en Windows/macOS, firma, notarización, fallos reales de energía o disco lleno. No se ejecutaron scripts maliciosos ni se accedió a documentos del usuario.
- No se modificó la implementación, las dependencias ni el lockfile. Se generaron este informe y evidencias; la compilación regeneró salidas ignoradas por Git.

Evidencias:

- [Comprobaciones reproducibles](/home/matias/.codex/visualizations/2026/11/02/01a19c98-b11a-7d22-8e6a-da254a93d479/inkwell-review.cjs).
- [Resultados observados](/home/matias/.codex/visualizations/2026/11/02/01a19c98-b11a-7d22-8e6a-da254a93d479/inkwell-review-results.json).
- [Auditoría completa de npm](/home/matias/.codex/visualizations/2026/11/02/01a19c98-b11a-7d22-8e6a-da254a93d479/npm-audit-completo.json).
- [Auditoría de npm excluyendo desarrollo](/home/matias/.codex/visualizations/2026/11/02/01a19c98-b11a-7d22-8e6a-da254a93d479/npm-audit-sin-dev.json).

El script se puede ejecutar con `node` desde su ubicación. Usa las dependencias ya instaladas en este checkout y crea sus propios archivos en `/tmp`. Es una herramienta de diagnóstico con mocks, no sustituye una suite de integración.

## Hallazgos prioritarios

### 01 — P1: El proceso principal acepta rutas y remitentes IPC sin autorización

Referencias: [creación de carpetas](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:341), [lectura de archivos](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:398), [creación de archivos](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:414), [preload](/run/media/matias/Archivos/fountain/electron-app/src/preload/index.js:56).

Los handlers confían en `parentPath`, `filePath`, `oldPath`, `targetPath` y nombres enviados por el renderer. No verifican `senderFrame`, ventana, URL autorizada ni que la ruta pertenezca a archivos/carpetas elegidos por el usuario. Además, `trim()` y `join()` no validan un nombre: `../escaped.md` crea un archivo fuera del padre seleccionado. Se reprodujo con el handler original. Un evento simulado con remitente remoto también pudo leer ese archivo.

La falta de control de IPC amplifica un compromiso previo del renderer; esta comprobación no demuestra que cualquier Markdown permita comprometerlo. La traversal de nombres sí puede introducirse desde la propia interfaz de creación/renombrado.

**Corrección:** validar tipos y tamaños; permitir sólo nombres simples sin separadores, `.` o `..`; mantener en `main` las autorizaciones derivadas de diálogos nativos; verificar rutas reales, enlaces simbólicos y pertenencia al ámbito permitido; aceptar IPC sólo de la ventana y frame principal confiables. Reemplazar la exposición genérica `window.electron.ipcRenderer` por operaciones específicas utilizadas por la interfaz.

### 02 — P1: El sandbox se desactiva también en producción

Referencias: [switch global](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:33), [ventana principal](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:112), [apertura externa](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:221).

`app.commandLine.appendSwitch('no-sandbox')` se ejecuta incondicionalmente y la ventana usa `sandbox: false`. Una adaptación a un montaje Linux termina afectando todas las instalaciones y las ventanas de impresión. No hay restricción de navegación mediante `will-navigate`, y cualquier URL recibida por `setWindowOpenHandler` se entrega a `shell.openExternal` sin filtrar protocolos.

**Corrección:** habilitar sandbox, mantener explícitos `contextIsolation: true` y `nodeIntegration: false`, y resolver la instalación Linux sin deshabilitar globalmente la protección. Bloquear navegación inesperada y permitir sólo protocolos externos requeridos y validados. Electron recomienda estas medidas y validar todos los remitentes IPC en su [guía oficial de seguridad](https://www.electronjs.org/docs/latest/tutorial/security).

### 03 — P1: Exportar un Markdown a PDF incorpora HTML activo sin sanitizar

Referencias: [Markdown con HTML habilitado](/run/media/matias/Archivos/fountain/electron-app/src/main/pdfExporter.js:7), [inserción y carga](/run/media/matias/Archivos/fountain/electron-app/src/main/pdfExporter.js:370), [exportación desde el árbol](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/FileTree.jsx:259).

La exportación desde el explorador lee el Markdown original, permite HTML crudo y lo introduce en una `BrowserWindow` con JavaScript habilitado, sin CSP propia, restricción de red ni bloqueo de ventanas/navegación. La CSP del renderer principal no protege ese documento `data:`. El HTML generado conservó intacta una etiqueta `<script>` en la comprobación aislada.

Esto permite contenido activo en la ventana auxiliar y recursos externos durante la exportación. No se demostró ejecución nativa/RCE ni acceso a `window.api` desde esa ventana, que no tiene el preload principal.

**Corrección:** desactivar HTML crudo cuando no sea necesario; sanitizar el HTML recibido; usar `javascript: false`, sandbox, sesión de impresión aislada, CSP restrictiva y bloqueo de red/navegación/ventanas. Adaptar la espera de fuentes al desactivar JavaScript.

### 04 — P1: Hay dependencias instaladas afectadas por avisos de seguridad actuales

Referencias: [lock de Electron](/run/media/matias/Archivos/fountain/electron-app/package-lock.json:4028), [lock de Markdown](/run/media/matias/Archivos/fountain/electron-app/package-lock.json:6344).

Se instalaron `electron@39.8.10` y `markdown-it@14.3.0`. El segundo se utiliza tanto al abrir manuscritos como al exportarlos. Está afectado por avisos de complejidad cuadrática que pueden bloquear el parser con documentos preparados. El [aviso oficial GHSA-gfr2-rv44-r23c](https://github.com/markdown-it/markdown-it/security/advisories/GHSA-gfr2-rv44-r23c) incluye esta versión y fija la rama 14 en `14.3.3`. Electron también queda dentro de rangos afectados; por ejemplo, el [aviso de certificados eMudhra](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9) requiere una versión corregida y aplica cuando se realizan conexiones TLS interceptables.

**Corrección:** actualizar a versiones corregidas y soportadas, regenerar el lock y verificar apertura, edición, exportación y empaquetado. Evaluar la aplicabilidad de cada aviso. No aplicar indiscriminadamente `npm audit fix --force`: el informe contiene cambios mayores e incluso propuestas de downgrade para herramientas de construcción.

### 05 — P1: Crear otro documento o cerrar la aplicación puede perder cambios

Referencias: [Ctrl+N](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:1482), [cancelación del debounce](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:749), [volver a portada](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:1068).

Ctrl+N llama directamente a `onNewDoc()`. El cambio de `key` desmonta el editor y cancela el autoguardado pendiente, sin ejecutar `saveBeforeSwitch()`. Se confirmó que el atajo crea otro documento sin intentar guardar. Al cerrar la ventana tampoco existe protocolo de guardado/cancelación. Volver a portada inicia un guardado sin esperarlo ni comprobar `{ success: false }`, y omite reintentos si el estado ya es `error`.

**Caso:** escribir y pulsar Ctrl+N o cerrar antes de los 2,5 segundos de inactividad; con autoguardado desactivado la exposición dura toda la edición.

**Corrección:** centralizar todas las transiciones de documento y cierre en una operación que detecte cambios, espere las escrituras y permita guardar, descartar o cancelar. Un error debe conservar la sesión del documento.

### 06 — P1: Restaurar una versión puede marcar como persistido contenido que nunca se guardó

Referencia: [restauración del editor](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:758).

Se ejecuta `setSaveStatus('saved')` antes de persistir. Si el archivo tiene ruta y el autoguardado está desactivado, no se escribe. `saveBeforeSwitch()` ve `saved`, permite salir y se pierde la restauración. La comprobación aislada obtuvo `saveStatus: saved`, cero llamadas a guardado y cambio permitido. Cuando sí se escribe, no se comprueba `res.success`.

También se conserva la llamada de API antigua `setContent(contenido, false)`: Tiptap 3 espera un objeto de opciones, por lo que ese booleano no expresa `emitUpdate: false` en la versión instalada.

**Corrección:** restaurar deja el documento modificado; marcarlo persistido sólo tras confirmar la escritura de esa revisión. Esperar y validar el respaldo previo a restaurar, y usar la API vigente de Tiptap.

### 07 — P1: Renombrar sobre un archivo existente destruye su contenido en Linux

Referencia: [handler de renombrado](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:526).

Se llama directamente a `fs.rename(oldPath, newPath)`. En el entorno Linux revisado, renombrar `a.md` a `b.md` devolvió éxito y sustituyó el contenido original de `b.md`. No hay detección de colisiones ni confirmación de reemplazo. No es necesario un atacante: alcanza con elegir un nombre existente.

**Corrección:** rechazar colisiones y utilizar una estrategia de renombrado sin reemplazo adecuada a cada plataforma; contemplar cambios sólo de mayúsculas/minúsculas. Evitar basarse únicamente en una comprobación previa vulnerable a carreras.

### 08 — P1: Renombrar o eliminar el documento activo desincroniza editor y disco

Referencias: [renombrado desde el árbol](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/FileTree.jsx:195), [borrado](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/FileTree.jsx:217), [guardado previo al cambio](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:1013).

El archivo se renombra antes de guardar la sesión actual. Luego `onSelectFile(newPath)` pasa por el guardado del editor, que todavía apunta al nombre anterior. Se reprodujo que el archivo nuevo conserva el contenido viejo y que el nombre original reaparece con los cambios pendientes. Renombrar una carpeta tampoco actualiza las rutas de los documentos descendientes.

Eliminar el activo sólo refresca el árbol. El editor conserva la ruta y el siguiente autoguardado recrea el archivo eliminado; también se reprodujo.

**Corrección:** coordinar estas operaciones con la sesión activa, cancelar o completar escrituras pendientes, actualizar rutas y claves de historial de forma coherente, y cerrar o convertir a borrador un documento eliminado.

### 09 — P1: La respuesta de un guardado antiguo puede ocultar cambios nuevos

Referencias: [autoguardado](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:697), [guardado manual](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:810), [cancelación de Guardar como](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:896).

No se distingue la revisión enviada a disco de la revisión actual. Si se escribe mientras un guardado está pendiente, su respuesta ejecuta `setSaveStatus('saved')` aunque la nueva edición no se haya guardado. Se reprodujo con una promesa controlada. Un cambio inmediato de documento puede entonces saltarse el guardado y cancelar el debounce que quedaba. Cancelar «Guardar como» también asigna `saved` sólo por tener una ruta.

**Corrección:** mantener `revision` y `persistedRevision`, serializar escrituras por documento y no borrar el estado modificado al cancelar un diálogo. Los errores de autoguardado deben mostrarse: actualmente los fallos devueltos por el backend pueden ignorarse.

### 10 — P1: Las operaciones concurrentes de historial pierden versiones

Referencia: [lectura, modificación y escritura de metadatos](/run/media/matias/Archivos/fountain/electron-app/src/main/historyManager.js:71).

`saveSnapshot()` lee `meta.json`, modifica una copia y la reescribe sin exclusión mutua. Dos operaciones pueden partir del mismo estado y la última borrar del índice las anteriores. En la comprobación, una versión inicial más diez guardados simultáneos produjeron diez respuestas exitosas, pero el índice sólo enumeró **dos versiones**, en lugar de once.

Guardado manual, autoguardado, restauración, borrado y poda pueden solaparse. Las escrituras directas de `meta.json` también admiten corrupción por interrupción; una lectura fallida se interpreta como ausencia de historial y puede crear un índice nuevo.

**Corrección:** cola o mutex por documento y coordinación para limpieza global; escritura atómica de metadatos; recuperación explícita de metadatos dañados y limpieza controlada de huérfanos. No tratar corrupción y archivo inexistente como el mismo caso.

### 11 — P1: Un fallo de la papelera se convierte silenciosamente en borrado definitivo

Referencias: [fallback destructivo](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:548), [promesa al usuario](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/i18n/index.js:76).

La interfaz promete enviar a la papelera. Si `shell.trashItem()` falla por cualquier motivo, se ejecuta `fs.rm(..., { recursive: true, force: true })`. Se reprodujo un fallo simulado de papelera y el archivo temporal fue eliminado definitivamente, con respuesta exitosa. Una carpeta afectada puede contener documentos no visibles en el explorador filtrado.

**Corrección:** devolver el error y conservar el elemento. El borrado definitivo, si se ofrece, necesita una acción explícita que describa su efecto y no debe ser un fallback automático.

## Hallazgos de prioridad media

### 12 — P2: El guardado no es atómico ni detecta modificaciones externas

Referencias: [guardar](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:468), [crear](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:427).

`fs.writeFile` escribe directamente sobre el único original. Una interrupción después del truncado puede dejarlo incompleto. Si otro editor o una sincronización cambia el archivo abierto, Inkwell lo sobrescribe sin conflicto. En creación, `access()` seguido de `writeFile()` tampoco garantiza exclusión: dos creaciones pueden pasar la comprobación.

**Corrección:** escribir a un temporal del mismo volumen y reemplazarlo de forma atómica, con política de permisos/symlinks y durabilidad definida; usar creación exclusiva (`wx`) donde corresponda. Comparar una huella del archivo leído antes de reemplazar cambios externos. Estas condiciones se identificaron en el código; no se simuló un corte real de energía.

### 13 — P2: Restaurar puede aplicar el contenido de la selección anterior

Referencias: [carga asíncrona](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/HistoryModal.jsx:295), [acción de restaurar](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/HistoryModal.jsx:487), [botón](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/HistoryModal.jsx:721).

Al elegir una instantánea, cambia el ID inmediatamente, pero `previewContent` conserva el contenido anterior hasta terminar el IPC. El botón no espera la carga y `handleRestore()` combina ese texto con la nueva instantánea. Se comprobó el callback con ese estado intermedio; incluso puede enviar una cadena vacía en la primera carga.

**Corrección:** vincular contenido e ID en un único resultado cargado, bloquear restauración durante carga/error y obtener o verificar nuevamente el contenido al confirmar.

### 14 — P2: Los borradores persistidos no tienen un flujo de recuperación

Referencias: [ID nuevo en cada creación](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/App.jsx:362), [persistencia del borrador](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:721), [lectura sólo con ID conocido](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/Editor.jsx:472).

El autoguardado de un documento sin ruta escribe `fountain_draft_<id>` y muestra «guardado», pero al reiniciar no se restaura la sesión ni se listan esos IDs. Crear otro documento genera un ID nuevo; la portada sólo enumera archivos y carpetas. El texto puede existir en almacenamiento local sin ser recuperable desde la interfaz.

**Corrección:** índice de borradores con ID estable y metadatos, restauración de sesión o vista de recuperación, y eliminación del borrador sólo al confirmar su persistencia definitiva. Mostrar la diferencia entre borrador local y archivo guardado.

### 15 — P2: Exportar un documento vaciado puede recuperar texto antiguo del disco

Referencia: [fallback por falsedad de contenido](/run/media/matias/Archivos/fountain/electron-app/src/main/documentExporter.js:389).

`if (!content && filePath)` interpreta `''` como contenido ausente. Si se vacía un documento y se exporta antes del autoguardado, Markdown/TXT/DOCX/ODT pueden incluir el contenido viejo. Se reprodujo: se pasó explícitamente `content: ''` y el archivo exportado contenía `OLD CONTENT` del disco. El PDF tiene una condición similar, aunque el flujo normal del editor suele enviar HTML no vacío.

**Corrección:** distinguir contenido no proporcionado (`undefined`/`null`) de contenido vacío y mantener una única revisión como origen de la exportación.

### 16 — P2: Los exportadores DOCX y ODT pierden separadores y estructura

Referencias: [conversión DOCX inline](/run/media/matias/Archivos/fountain/electron-app/src/main/documentExporter.js:84), [conversión ODT inline](/run/media/matias/Archivos/fountain/electron-app/src/main/documentExporter.js:233).

Los conversores no manejan `softbreak` ni `hardbreak`. Se verificó que `hola\nmundo` produce `holamundo` en el XML ODT: dos palabras se convierten en una. También faltan tratamientos explícitos para imágenes y tachado, y la estructura de listas usa booleanos globales que no preservan correctamente anidación y estado de listas exteriores. ODT omite los destinos de enlaces.

**Corrección:** convertir desde un modelo de documento compartido o recorrer tokens con una pila de contexto y una política explícita por nodo. Probar fidelidad de texto y semántica mediante lectura del documento exportado; no alcanza con comprobar que se generó un ZIP válido.

### 17 — P2: La comparación de historial reserva memoria cuadrática en el hilo de interfaz

Referencias: [matriz de líneas](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/HistoryModal.jsx:132), [cálculo síncrono](/run/media/matias/Archivos/fountain/electron-app/src/renderer/src/components/HistoryModal.jsx:383).

La protección de tamaño en `diffWords` no se aplica a `computeSideBySideDiff`. Este último reserva una matriz de `(líneasA+1) × (líneasB+1)` con enteros de 16 bits y la recorre completamente, incluso si sólo se añadió una línea. Se ejecutaron comparaciones de hasta 6.000 líneas; esa matriz supera 72 MB sin contar otros objetos. Dos documentos de 20.000 líneas requerirían aproximadamente 800 MB sólo para la matriz. Esto puede bloquear la interfaz o agotar memoria con manuscritos extensos.

**Corrección:** algoritmo de diff con límites y comportamiento de degradación; eliminar prefijos/sufijos comunes antes de comparar; ejecutar trabajo costoso en un worker. Tratar documentos grandes como caso de uso normal y mantener cancelación.

### 18 — P2: Los errores de lectura de carpetas se presentan como éxito con un árbol vacío

Referencias: [error absorbido](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:94), [respuesta exitosa](/run/media/matias/Archivos/fountain/electron-app/src/main/index.js:325).

`buildDirectoryTree()` captura cualquier error y devuelve `[]`. Por eso una carpeta inexistente, desmontada o sin permisos puede devolverse como `{ success: true, tree: [] }`. No se puede distinguir de una carpeta vacía, y la recuperación de espacios de trabajo la conserva como válida. Los subárboles truncados por profundidad tampoco se identifican.

Además, cada autoguardado refresca todas las carpetas abiertas recursivamente, aunque guardar contenido no cambie la estructura. Esto agrega I/O y respuestas susceptibles de llegar fuera de orden.

**Corrección:** devolver errores y estados parciales tipados; comunicar carpetas desconectadas; actualizar el árbol sólo cuando haya cambios estructurales, mediante refresco dirigido o un watcher con debounce y control de solicitudes obsoletas.

## Arquitectura, estructura y legibilidad

El principal problema de diseño es que las reglas de conservación del documento están repartidas entre `App`, `Editor`, `FileTree`, `ZenFloatingFolder`, `HistoryModal` y los handlers. Por eso cada acción resuelve de manera diferente cuándo guardar, cuándo actualizar rutas y qué significa `saved`.

Cambios recomendados, sin exigir una reescritura:

1. **Una sesión de documento:** ID estable, ruta, contenido/revisión actual, revisión persistida, estado de escritura y cambios externos. Un controlador común coordina nuevo, abrir, cambiar, volver, cerrar, renombrar, borrar y restaurar.
2. **Persistencia en `main`:** módulo de archivos con permisos/ámbitos, validación de rutas, escrituras atómicas y cola por documento; historial separado con operaciones serializadas. Los handlers IPC deben ser adaptadores pequeños con contratos y errores consistentes.
3. **Hooks de interfaz acotados:** extraer de `Editor.jsx` (2.481 líneas) persistencia, atajos, typewriter, exportación y menús. `App.jsx` tiene 832 líneas y `FileTree.jsx` 953. La cantidad por sí sola no es un defecto, pero aquí acompaña responsabilidades mezcladas y reglas duplicadas.
4. **Operaciones compartidas entre exploradores:** `FileTree` y `ZenFloatingFolder` duplican creación y borrado. Compartir lógica permite aplicar una corrección de validación o coherencia a ambos.
5. **Contratos verificables:** esquemas de validación de runtime en IPC y preferencias, más JSDoc o TypeScript para estructuras centrales. Los tipos estáticos no reemplazan autorización ni validación en `main`.
6. **Exportación desde un modelo común:** evitar interpretar de forma diferente Markdown en el editor, el PDF y los conversores DOCX/ODT. Definir qué sintaxis se conserva y comunicar los elementos no soportados.
7. **Calidad verificable:** corregir los errores actuales de lint, incorporar pruebas de comportamiento y CI con instalación reproducible, lint, pruebas y build. No hay script `test` ni configuración de CI versionada en el árbol revisado.
8. **Documentación real de distribución:** el README raíz conserva la plantilla de GitLab. Documentar arquitectura, recuperación de borradores, limitaciones Markdown, persistencia, instalación y matriz de sistemas soportados. Revisar metadatos de ejemplo, permisos macOS no justificados, `notarize: false` y URL de actualizaciones de ejemplo antes de publicar.

Otros puntos concretos para verificar durante la refactorización:

- StarterKit 3 ya incorpora Link y se añade otro `Link.configure(...)`. Construir el schema con las dependencias instaladas emite la advertencia real de extensión `link` duplicada. Configurar Link en un solo lugar.
- El schema actual no contiene nodos de imagen ni tabla. Debe probarse el ciclo abrir → editar → guardar de Markdown con imágenes, tablas y HTML para evitar pérdida o transformación silenciosa del original. No se verificó ese ciclo en una interfaz real.
- Las preferencias y el estado se persisten principalmente en `localStorage` sin un esquema versionado. Hay bloques vacíos que ocultan fallos de almacenamiento; una recuperación debe distinguir JSON inválido, cuota agotada y datos antiguos.
- Los modales tienen parte del marcado ARIA, pero no implementan una gestión de foco completa. Probar navegación sólo con teclado, devolución de foco y supresión de atajos globales mientras se edita un campo o un modal está abierto.

## Casos de regresión requeridos

| Flujo | Resultado esperado |
| --- | --- |
| Escribir y pulsar Ctrl+N antes del debounce | Guardar, descartar o cancelar sin perder cambios |
| Cerrar con cambios, autoguardado desactivado o error de escritura | No cerrar silenciosamente sobre cambios pendientes |
| Editar mientras una escritura anterior sigue pendiente | Conservar estado modificado hasta persistir la revisión nueva |
| Cancelar Guardar como | Mantener el estado modificado anterior |
| Renombrar al nombre de otro archivo | Rechazar o pedir reemplazo explícito, sin pérdida silenciosa |
| Crear/renombrar con `../`, separadores, espacios, nombres reservados y symlinks | Rechazar nombres inválidos y accesos fuera del ámbito autorizado |
| Renombrar archivo activo o su carpeta | Mantener una sola ruta coherente, sin recrear el nombre viejo |
| Borrar el activo durante un autoguardado | No recrear el archivo ni escribir sobre otro documento |
| Papelera no disponible | Conservar archivos y mostrar el error |
| Restaurar con autoguardado desactivado | Marcar cambios pendientes y conservarlos al navegar |
| Seleccionar otra versión y restaurar antes de terminar la carga | Bloquear o restaurar exactamente el ID seleccionado |
| Guardar/podar/borrar historial simultáneamente | Índice y archivos coherentes, sin versiones perdidas |
| Reiniciar con manuscrito sin ruta | Recuperar el borrador desde la interfaz |
| Disco lleno, archivo de sólo lectura, corte durante escritura | Preservar original y mostrar estado recuperable |
| Cambios externos o edición en dos instancias | Detectar conflicto y evitar sobrescritura silenciosa |
| Vaciar y exportar antes del autoguardado | Exportar vacío, sin recuperar texto viejo |
| Exportar texto con saltos, listas anidadas, enlaces, imágenes y tablas | Fidelidad o aviso explícito de características no soportadas |
| Exportar PDF con HTML/script/recurso remoto | Ninguna ejecución ni conexión no autorizada |
| Comparar manuscritos grandes | Tiempo/memoria acotados e interfaz cancelable |
| Carpeta desmontada, movida, sin permisos o demasiado profunda | Estado de error/parcial diferenciado de carpeta vacía |

## Orden de remediación

1. Evitar pérdida de datos: transiciones/cierre, revisión persistida, restauración, colisiones de renombrado, coherencia de rutas y fallback de borrado.
2. Cerrar límites de confianza: validación y autorización IPC/rutas, sandbox, navegación/URLs y exportación PDF sin contenido activo; actualizar dependencias afectadas.
3. Hacer robusta la persistencia: escritura atómica, conflictos externos, historial serializado, recuperación de borradores y metadatos dañados.
4. Corregir fidelidad de exportación, comparación grande y errores del explorador; luego extraer responsabilidades y exigir los controles automáticos antes de distribuir.

Cada corrección debe incorporar el caso de regresión que la justifica. Una compilación exitosa por sí sola no acredita los flujos de conservación y recuperación de un editor.

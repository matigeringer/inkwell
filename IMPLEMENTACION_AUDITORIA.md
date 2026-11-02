# Implementación de la auditoría de Inkwell

Fecha: 2 de noviembre de 2026. Complementa el informe original, que describe el estado previo.

## Cambios por hallazgo

| Auditoría                   | Solución implementada                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 — IPC y rutas            | Validación de ventana/frame/URL; API específica; permisos concedidos por diálogos nativos y persistidos; rechazo de traversal, nombres reservados y enlaces que escapen del ámbito |
| 02 — Sandbox                | Sandbox habilitado, aislamiento explícito, navegación/webviews bloqueados, protocolos externos limitados y permisos denegados por defecto                                          |
| 03 — PDF activo             | Markdown sin HTML crudo; se ignora HTML del renderer; JavaScript y red deshabilitados; sesión auxiliar aislada con CSP y bloqueo de ventanas                                       |
| 04 — Dependencias           | Electron 45.2.1, Markdown-it 14.3.3, Vite 7.3.7 y actualizaciones compatibles de transitivas; retiro del puente genérico no utilizado                                              |
| 05 — Transiciones/cierre    | Coordinador único que espera las escrituras antes de cambiar, crear, volver o cerrar; un fallo conserva el documento abierto                                                       |
| 06 — Restauración           | Respaldo esperado y validado; API vigente de Tiptap; la restauración queda modificada hasta persistirse                                                                            |
| 07 — Renombrado destructivo | Creación exclusiva del destino, sin reemplazar archivos ni carpetas; rollback de movimientos de directorio si falla una operación                                                  |
| 08 — Archivo activo         | Guardado previo a mutaciones, actualización de rutas descendientes, traslado de historial y conservación como borrador al eliminar                                                 |
| 09 — Estado de guardado     | Revisión actual/persistida diferenciadas; cola de guardados; cancelación de Guardar como mantiene cambios pendientes                                                               |
| 10 — Historial concurrente  | Operaciones serializadas, metadatos atómicos, recuperación de índices y preservación de versiones de origen al mover                                                               |
| 11 — Papelera               | Se eliminó el fallback a borrado definitivo; los fallos conservan el elemento                                                                                                      |
| 12 — Persistencia           | Escritura a temporal, sincronización del archivo y reemplazo; creación exclusiva; comparación de contenido para conflictos externos                                                |
| 13 — Selección de versiones | Contenido asociado a ID/documento; restauración bloqueada mientras no exista una carga válida; se espera el resultado de restaurar                                                 |
| 14 — Borradores             | Índice, descubrimiento de claves antiguas y recuperación desde la portada                                                                                                          |
| 15 — Exportación vacía      | Se distingue contenido ausente de una cadena vacía                                                                                                                                 |
| 16 — Fidelidad              | Conversores compartidos con saltos, formato anidado, listas, tablas y enlaces; imágenes como descripción/enlace con aviso                                                          |
| 17 — Comparación grande     | Worker con cancelación, recorte de partes comunes y memoria limitada; degradación a bloques grandes                                                                                |
| 18 — Explorador             | Errores de raíz explícitos, advertencias parciales, límites visibles y control de respuestas obsoletas; no se reescanean carpetas por cada autoguardado                            |

Se extrajeron responsabilidades del editor a una sesión y hooks independientes; se normalizaron/versionaron preferencias, se eliminó Link duplicado, se agregó edición de fuente para sintaxis no representable, foco de modales y controles en GitLab CI. También se retiraron permisos macOS y metadatos de distribución de ejemplo innecesarios.

## Validación

- 35 pruebas automáticas distribuidas en siete archivos: sistema de archivos real sobre temporales, historial concurrente/corrupto, sesiones y respuestas tardías, exportaciones y seguridad IPC.
- Pruebas de interfaz con React y Tiptap reales en DOM: transiciones, errores, cierre, restauración, renombrado, eliminación, conservación de Markdown y recuperación de borradores.
- Prueba con Electron/Chromium reales y perfil temporal: sandbox, preload, IPC nativo, edición, guardado al crear otro documento y PDF. Pasó sin desactivar el sandbox.
- Empaquetado local Linux con `electron-builder --dir`: correcto. No se publicaron artefactos.
- `npm audit --omit=dev`: cero vulnerabilidades; auditoría completa: 25 moderadas y ninguna alta/crítica.
- `npm run check` reúne lint sin advertencias, pruebas y build. `npm run test:electron` repite la prueba nativa en Linux.

## Límites que requieren seguimiento

- Quedan avisos moderados de dependencias de desarrollo asociados a `minimatch`; se actualizaron las transitivas compatibles sin imponer versiones mayores incompatibles. No se aplicó el downgrade de electron-builder propuesto por `audit --force`.
- Las pruebas nativas realizadas corresponden a Linux. Falta validar firma, notarización e instaladores finales en Windows/macOS y la matriz de distribuciones Linux soportadas; no se configuraron credenciales ni se publicó una versión.
- El renombrado sin reemplazo utiliza hard links para archivos y traslado con rollback para carpetas; un sistema de archivos sin soporte puede devolver un error y conservar el origen. Una interrupción abrupta durante un movimiento de carpeta puede dejar elementos repartidos entre origen y destino; no se elimina recursivamente ninguno como rollback.
- La escritura atómica y la detección de cambios externos reducen riesgos, pero no son un bloqueo cooperativo para editores externos ni una garantía absoluta frente a fallos de hardware. No se simularon cortes reales de energía.
- Las imágenes remotas no se descargan al exportar. DOCX/ODT las conservan como descripción y enlace. El contenido local y el historial permanecen sin cifrado.
- La primera apertura tras actualizar puede requerir volver a autorizar carpetas con el selector nativo. No se convierte automáticamente una ruta de `localStorage` en un permiso de acceso.

Los cambios se organizaron en commits por responsabilidad. No se publicaron versiones ni se modificaron documentos reales del usuario.

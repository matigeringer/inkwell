# Inkwell

Inkwell es una aplicación de escritorio para escribir y organizar manuscritos en Markdown. Trabaja con archivos locales y ofrece un espacio de escritura personalizable, recuperación de borradores e historial y exportación a otros formatos. Está construida con Electron, React y Tiptap y es software libre bajo GPL-3.0-only.

[![Build and release](https://github.com/matigeringer/inkwell/actions/workflows/build.yml/badge.svg)](https://github.com/matigeringer/inkwell/actions/workflows/build.yml)

## Descargar

Las versiones se distribuyen en [Releases de GitHub](https://github.com/matigeringer/inkwell/releases). Estos enlaces siempre apuntan a los archivos de la última versión publicada:

| Sistema               | Descarga                                                                                                                        | Uso                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Linux x86-64          | [inkwell-linux-x86_64.AppImage](https://github.com/matigeringer/inkwell/releases/latest/download/inkwell-linux-x86_64.AppImage) | Ejecutable sin instalación                  |
| Debian / Ubuntu amd64 | [inkwell-linux-amd64.deb](https://github.com/matigeringer/inkwell/releases/latest/download/inkwell-linux-amd64.deb)             | Instalación e integración con el escritorio |
| Windows 10 / 11 x64   | [inkwell-windows-x64.exe](https://github.com/matigeringer/inkwell/releases/latest/download/inkwell-windows-x64.exe)             | Ejecutable portable, sin instalación        |

**Disponibilidad:** los enlaces se habilitan cuando termine correctamente el primer workflow de una etiqueta `vX.Y.Z`. Si todavía no hay una release publicada, usa las instrucciones para compilar desde el código fuente. Los binarios se adjuntan a las releases; no se guardan en Git.

No necesitas Node.js ni npm para usar las descargas. Esta distribución incluye únicamente equipos Intel/AMD de 64 bits; no hay paquetes ARM ni de 32 bits. Linux necesita una sesión gráfica y las bibliotecas de escritorio requeridas por Electron. La compatibilidad con cada distribución debe comprobarse antes de anunciarla como soportada.

### Linux: AppImage

Descarga el archivo, abre una terminal en esa carpeta y ejecuta (ajusta el nombre si conservaste el nombre con versión):

```bash
chmod +x inkwell-linux-x86_64.AppImage
./inkwell-linux-x86_64.AppImage
```

Si el sistema informa que falta FUSE, instala el paquete FUSE 2 de tu distribución (`libfuse2` o `libfuse2t64` en Debian/Ubuntu, según la versión). También puedes extraer el ejecutable sin FUSE:

```bash
./inkwell-linux-x86_64.AppImage --appimage-extract
./squashfs-root/AppRun
```

El sandbox de Electron permanece activado y requiere namespaces de usuario o un helper de sandbox correctamente instalado. En Ubuntu, si AppArmor bloquea el AppImage, utiliza el paquete `.deb`, que incorpora la integración del sistema. No ejecutes la aplicación como root ni uses `--no-sandbox` como solución.

### Debian / Ubuntu: paquete .deb

Desde la carpeta de descarga (ajusta el nombre del archivo si contiene la versión):

```bash
sudo apt install ./inkwell-linux-amd64.deb
```

Abre **Inkwell** desde el menú de aplicaciones o con `inkwell`. Para desinstalar: `sudo apt remove inkwell`.

### Windows

Descarga `inkwell-windows-x64.exe`, guárdalo en una carpeta propia y ábrelo con doble clic. No requiere instalación ni permisos de administrador. Puedes crear un acceso directo manualmente. El ejecutable extrae sus componentes en una carpeta temporal al arrancar; las preferencias, borradores e historial se conservan en `%APPDATA%\inkwell` entre ejecuciones. Para quitar la aplicación, elimina el `.exe`; los datos locales se conservan.

El ejecutable se distribuye **sin firma digital**: Windows puede mostrar «Editor desconocido» o una advertencia de SmartScreen. Comprueba el origen y la suma SHA-256 antes de abrirlo. El arranque y las operaciones de escritura en un Windows real forman parte de la validación previa a la publicación.

### Verificar una descarga

Descarga el manifiesto de [Linux](https://github.com/matigeringer/inkwell/releases/latest/download/SHA256SUMS-linux.txt) o [Windows](https://github.com/matigeringer/inkwell/releases/latest/download/SHA256SUMS-windows.txt) **de la misma release** que el ejecutable. Los manifiestos de Releases usan los nombres de descarga sin versión. Conserva esos nombres para la comprobación automática. Los paquetes generados localmente incluyen la versión en el nombre y tienen sus propios manifiestos.

En Linux, con los dos paquetes y el manifiesto en la misma carpeta:

```bash
sha256sum --check SHA256SUMS-linux.txt
```

Si descargaste sólo un paquete, compara `sha256sum nombre-del-archivo` con su línea del manifiesto; la comprobación completa informará que falta el otro archivo.

En PowerShell, sustituye el nombre por el descargado y compara `Hash` con el manifiesto:

```powershell
Get-FileHash .\inkwell-windows-x64.exe -Algorithm SHA256
```

## Funcionalidades

- Abrir carpetas y archivos Markdown, crear documentos y explorar manuscritos.
- Escribir en un editor visual o en modo fuente para conservar tablas, imágenes y HTML.
- Usar el modo Zen, personalizar temas y tipografía, y elegir español o inglés.
- Recuperar borradores locales, consultar versiones y comparar cambios.
- Exportar a PDF, DOCX, ODT, Markdown y texto.

Los manuscritos se guardan en las ubicaciones que elijas. Las preferencias, borradores e historial se almacenan en `~/.config/inkwell` en Linux (o `$XDG_CONFIG_HOME/inkwell`) y `%APPDATA%\inkwell` en Windows. No se eliminan automáticamente al desinstalar. Borradores e historial se conservan **sin cifrado** y no sustituyen una copia de seguridad externa. Los documentos están limitados a 10 MiB. Consulta la [guía técnica](electron-app/README.md) para conocer el guardado, la recuperación, los conflictos y los límites de exportación.

## Desarrollo

Necesitas [Node.js](https://nodejs.org/) 22.12.0 o posterior y npm. Para abrir la aplicación necesitas además un entorno gráfico compatible con Electron.

```bash
git clone https://github.com/matigeringer/inkwell.git
cd inkwell/electron-app
npm ci
npm run dev
```

`npm ci` descarga Electron y las dependencias fijadas en el lockfile. Ejecuta desde `electron-app/`:

```bash
npm run check          # lint sin advertencias, pruebas y compilación
npm run test:electron  # prueba nativa de Electron en Linux, con perfil temporal
npm run test:packaged  # misma prueba sobre el ASAR generado por build:linux
npm run build:unpack   # aplicación desempaquetada para inspección
npm run build:linux    # AppImage, deb y SHA256SUMS-linux.txt (x64)
npm run build:win      # ejecutable portable y SHA256SUMS-windows.txt (x64)
```

Los paquetes se generan en `electron-app/dist/`. Compila Linux en Linux. El ejecutable portable de Windows puede generarse en Windows o en Linux con las herramientas de electron-builder fijadas en el lockfile. GitHub Actions compila Linux en Ubuntu y Windows en un runner Windows, con Node 22. La publicación usa el token automático de GitHub Actions; no requiere un token personal. Los comandos de compilación locales nunca publican archivos.

Para reproducir los paquetes en un equipo con Docker, desde la raíz del repositorio:

```bash
docker run --rm -v "$PWD:/project" -w /project/electron-app electronuserland/builder:22-wine /bin/bash -lc 'npm ci && npm run build:linux && npm run build:win'
```

El contenedor puede crear archivos con propietario root. Evita compartir `node_modules` entre el host y el contenedor: usa una copia de trabajo dedicada para este comando.

## Publicar una versión

La [guía de publicación](docs/RELEASING.md) detalla los requisitos de GitHub Actions, la validación de paquetes, la firma opcional y cómo generar además un instalador NSIS en Windows. El workflow ejecuta controles y empaqueta Linux y Windows también en ramas y pull requests; conserva esos artefactos durante 14 días. Sólo una etiqueta estable `vX.Y.Z` publica paquetes permanentes y crea una release con los enlaces del README.

Para la primera versión, después de revisar, guardar y subir estos cambios a `main` y validar los paquetes:

```bash
git tag -a v1.0.0 -m "Inkwell 1.0.0"
git push origin v1.0.0
```

La etiqueta debe coincidir con `version` en `electron-app/package.json` y su lockfile. El job `release` verifica todos los archivos y sus sumas antes de adjuntarlos a GitHub Releases. No reemplaza una release existente: para corregirla, publica una versión nueva. Las notas están en [CHANGELOG.md](CHANGELOG.md).

## Contribuir y pedir ayuda

Abre una [incidencia en GitHub](https://github.com/matigeringer/inkwell/issues) con la versión, el sistema operativo y los pasos para reproducir el problema. Para contribuir, crea una rama, realiza los cambios, ejecuta `npm run check` desde `electron-app/` y abre una pull request. Evita incluir manuscritos personales, datos sensibles, dependencias o archivos generados.

## Licencia

[Licencia Pública General de GNU, versión 3](LICENSE) (GPL-3.0-only). Cada paquete incluye la licencia; el código fuente correspondiente está disponible en la etiqueta de su release.

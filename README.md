# Inkwell

Inkwell es una aplicación de escritorio para escribir y organizar manuscritos en Markdown. Trabaja con archivos locales y ofrece un espacio de escritura personalizable, recuperación de borradores e historial y exportación a otros formatos. Está construida con Electron, React y Tiptap y es software libre bajo GPL-3.0-only.

## Descargar

Las versiones se distribuyen en [Releases de GitLab](https://gitlab.com/ada-arg/fountain/-/releases). Estos enlaces siempre apuntan a los archivos de la última versión publicada:

| Sistema               | Descarga                                                                                                             | Uso                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Linux x86-64          | [Inkwell.AppImage](https://gitlab.com/ada-arg/fountain/-/releases/permalink/latest/downloads/linux/inkwell.AppImage) | Ejecutable sin instalación                  |
| Debian / Ubuntu amd64 | [Inkwell.deb](https://gitlab.com/ada-arg/fountain/-/releases/permalink/latest/downloads/linux/inkwell.deb)           | Instalación e integración con el escritorio |
| Windows 10 / 11 x64   | [Inkwell.exe](https://gitlab.com/ada-arg/fountain/-/releases/permalink/latest/downloads/windows/inkwell.exe)         | Ejecutable portable, sin instalación        |

**Disponibilidad:** los enlaces se habilitan cuando termine correctamente la primera pipeline de una etiqueta `vX.Y.Z`. Si todavía no hay una release publicada, usa las instrucciones para compilar desde el código fuente. Los binarios se adjuntan a las releases; no se guardan en Git.

No necesitas Node.js ni npm para usar las descargas. Esta distribución incluye únicamente equipos Intel/AMD de 64 bits; no hay paquetes ARM ni de 32 bits. Linux necesita una sesión gráfica y las bibliotecas de escritorio requeridas por Electron. La compatibilidad con cada distribución debe comprobarse antes de anunciarla como soportada.

### Linux: AppImage

Descarga el archivo, abre una terminal en esa carpeta y ejecuta (ajusta el nombre si conservaste el nombre con versión):

```bash
chmod +x Inkwell.AppImage
./Inkwell.AppImage
```

Si el sistema informa que falta FUSE, instala el paquete FUSE 2 de tu distribución (`libfuse2` o `libfuse2t64` en Debian/Ubuntu, según la versión). También puedes extraer el ejecutable sin FUSE:

```bash
./Inkwell.AppImage --appimage-extract
./squashfs-root/AppRun
```

El sandbox de Electron permanece activado y requiere namespaces de usuario o un helper de sandbox correctamente instalado. En Ubuntu, si AppArmor bloquea el AppImage, utiliza el paquete `.deb`, que incorpora la integración del sistema. No ejecutes la aplicación como root ni uses `--no-sandbox` como solución.

### Debian / Ubuntu: paquete .deb

Desde la carpeta de descarga (ajusta el nombre del archivo si contiene la versión):

```bash
sudo apt install ./Inkwell.deb
```

Abre **Inkwell** desde el menú de aplicaciones o con `inkwell`. Para desinstalar: `sudo apt remove inkwell`.

### Windows

Descarga `Inkwell.exe`, guárdalo en una carpeta propia y ábrelo con doble clic. No requiere instalación ni permisos de administrador. Puedes crear un acceso directo manualmente. El ejecutable extrae sus componentes en una carpeta temporal al arrancar; las preferencias, borradores e historial se conservan en `%APPDATA%\inkwell` entre ejecuciones. Para quitar la aplicación, elimina el `.exe`; los datos locales se conservan.

El ejecutable se distribuye **sin firma digital**: Windows puede mostrar «Editor desconocido» o una advertencia de SmartScreen. Comprueba el origen y la suma SHA-256 antes de abrirlo. El arranque y las operaciones de escritura en un Windows real forman parte de la validación previa a la publicación.

### Verificar una descarga

Descarga el manifiesto de [Linux](https://gitlab.com/ada-arg/fountain/-/releases/permalink/latest/downloads/checksums/SHA256SUMS-linux.txt) o [Windows](https://gitlab.com/ada-arg/fountain/-/releases/permalink/latest/downloads/checksums/SHA256SUMS-windows.txt) **de la misma release** que el ejecutable. Los manifiestos usan los nombres originales con versión: consérvalos para la comprobación automática.

En Linux, con los dos paquetes y el manifiesto en la misma carpeta:

```bash
sha256sum --check SHA256SUMS-linux.txt
```

Si descargaste sólo un paquete, compara `sha256sum nombre-del-archivo` con su línea del manifiesto; la comprobación completa informará que falta el otro archivo.

En PowerShell, sustituye el nombre por el descargado y compara `Hash` con el manifiesto:

```powershell
Get-FileHash .\inkwell-1.0.0-windows-x64.exe -Algorithm SHA256
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
git clone https://gitlab.com/ada-arg/fountain.git
cd fountain/electron-app
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

Los paquetes se generan en `electron-app/dist/`. Compila Linux en Linux. El ejecutable portable de Windows puede generarse en Windows o en Linux con las herramientas de electron-builder fijadas en el lockfile. La pipeline usa `electronuserland/builder:22-wine`, con Node 22 y las herramientas de empaquetado; no necesita un runner Windows ni un token personal para publicar. Los comandos de compilación locales nunca publican archivos.

Para reproducir los paquetes en un equipo con Docker, desde la raíz del repositorio:

```bash
docker run --rm -v "$PWD:/project" -w /project/electron-app electronuserland/builder:22-wine /bin/bash -lc 'npm ci && npm run build:linux && npm run build:win'
```

El contenedor puede crear archivos con propietario root. Evita compartir `node_modules` entre el host y el contenedor: usa una copia de trabajo dedicada para este comando.

## Publicar una versión

La [guía de publicación](docs/RELEASING.md) detalla los requisitos de GitLab, la validación de paquetes, la firma opcional y cómo generar además un instalador NSIS en Windows. La pipeline ejecuta controles y empaqueta Linux y Windows también en ramas y merge requests; conserva esos artefactos durante 14 días. Sólo una etiqueta estable `vX.Y.Z` publica paquetes permanentes y crea una release con los enlaces del README.

Para la primera versión, después de revisar, guardar y subir estos cambios a `main` y validar los paquetes:

```bash
git tag -a v1.0.0 -m "Inkwell 1.0.0"
git push origin v1.0.0
```

La etiqueta debe coincidir con `version` en `electron-app/package.json` y su lockfile. El job `release` verifica todos los archivos y sus sumas antes de subirlos al registro de paquetes. No reemplaza una release existente: para corregirla, publica una versión nueva. Las notas están en [CHANGELOG.md](CHANGELOG.md).

## Contribuir y pedir ayuda

Abre una [incidencia en GitLab](https://gitlab.com/ada-arg/fountain/-/issues) con la versión, el sistema operativo y los pasos para reproducir el problema. Para contribuir, crea una rama, realiza los cambios, ejecuta `npm run check` desde `electron-app/` y abre una solicitud de fusión. Evita incluir manuscritos personales, datos sensibles, dependencias o archivos generados.

## Licencia

[Licencia Pública General de GNU, versión 3](LICENSE) (GPL-3.0-only). Cada paquete incluye la licencia; el código fuente correspondiente está disponible en la etiqueta de su release.

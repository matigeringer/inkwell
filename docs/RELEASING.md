# Publicar Inkwell en GitHub

El repositorio principal es [matigeringer/inkwell](https://github.com/matigeringer/inkwell). El historial anterior se conserva con sus identificadores, autores, fechas y etiquetas. La migración y la adaptación a GitHub se añaden como un commit posterior.

## Compilación y controles

[GitHub Actions](https://github.com/matigeringer/inkwell/actions/workflows/build.yml) ejecuta el workflow [build.yml](../.github/workflows/build.yml) al subir cambios a `main`, subir etiquetas `v*` o iniciarlo manualmente.

- `quality`: comprueba versión y lockfile, instala con `npm ci`, ejecuta lint, pruebas, compilación y auditorías. Los avisos de producción y los altos/críticos impiden continuar.
- `package`: genera AppImage y `.deb` en Ubuntu 22.04 y el portable `.exe` en Windows Server 2022. Los paquetes de prueba y sus manifiestos se conservan como artefactos durante 14 días.
- `release`: sólo publica desde una etiqueta estable `vX.Y.Z` que coincida con la versión del proyecto, después de pasar los controles y ambas compilaciones.

Habilitar Actions en el repositorio y permitir las acciones oficiales `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` y `actions/download-artifact` si existe una política de restricciones. La publicación usa `GITHUB_TOKEN` con `contents: write` únicamente en el job `release`; no requiere un token personal ni un registro de paquetes.

## Antes de publicar

1. Desde `electron-app/`, actualizar la versión con `npm version X.Y.Z --no-git-tag-version`; se actualiza también el lockfile.
2. Actualizar `CHANGELOG.md`, ejecutar `npm run check` y revisar `npm audit --omit=dev --audit-level=low` y `npm audit --audit-level=high`.
3. En Linux, ejecutar `npm run test:electron` y, después de `npm run build:linux`, `npm run test:packaged`. Probar AppImage y `.deb` en las distribuciones que se quiera soportar.
4. Probar el portable en Windows 10/11 x64 real: arranque sin administrador, edición, guardado, recuperación de borradores e historial, exportación y reemplazo del ejecutable sin perder datos de `%APPDATA%\inkwell`. Compilar en un runner Windows no sustituye la comprobación interactiva.
5. Integrar los cambios en `main` y comprobar su workflow. El proyecto debe ser público para que cualquiera pueda descargar sin iniciar sesión.
6. Crear y subir la etiqueta del commit validado, por ejemplo:

```bash
git tag -a v1.0.0 -m "Inkwell 1.0.0"
git push origin v1.0.0
```

La etiqueta histórica `0.1` se conserva como parte de la migración. No activa el nuevo workflow de versiones ni equivale a una release nueva.

## Archivos y enlaces

Las compilaciones locales conservan la versión en el nombre. Al adjuntarlas a GitHub Releases se usan nombres estables para que los enlaces del README sirvan en cada versión:

| Paquete local de 1.0.0                | Archivo adjunto a la release    |
| ------------------------------------- | ------------------------------- |
| `inkwell-1.0.0-linux-x86_64.AppImage` | `inkwell-linux-x86_64.AppImage` |
| `inkwell-1.0.0-linux-amd64.deb`       | `inkwell-linux-amd64.deb`       |
| `inkwell-1.0.0-windows-x64.exe`       | `inkwell-windows-x64.exe`       |

El script verifica las sumas de los paquetes originales antes de contactar con GitHub. Crea una release en borrador, adjunta los tres binarios y dos manifiestos `SHA256SUMS-*.txt` con los nombres de descarga y, sólo entonces, publica. Los archivos públicos permanecen adjuntos a la release; no dependen de los artefactos temporales de Actions. GitHub incluye automáticamente archivos del código fuente de la etiqueta.

Para revisar la publicación sin red ni credenciales, después de generar ambos paquetes:

```bash
cd electron-app
npm run release:check
npm run release:publish -- --dry-run
```

La vista previa se guarda en `dist/release.json`. La publicación real exige una etiqueta de GitHub y `GITHUB_TOKEN`; Actions proporciona ambos. Si una subida falla, puede quedar un borrador sin publicar. Revisarlo en Releases y eliminar ese borrador incompleto antes de reintentar. Una release publicada no se reemplaza: preparar una versión nueva para corregirla. No mover etiquetas publicadas.

## Firma e instalador Windows opcional

El portable se distribuye sin firma digital. El README y las notas de versión lo informan. Si se configura firma en el futuro, usar secretos de Actions para el certificado y la contraseña, pasarlos sólo al job Windows y verificar la firma antes de cambiar esa información en la documentación.

Para generar además un instalador NSIS, ejecutar en Windows desde `electron-app/`:

```powershell
npm ci
npm run build:win:installer
```

El instalador permite elegir la carpeta, crea accesos directos y conserva los datos al desinstalar. Desde Linux requiere Wine funcional. Este instalador opcional no forma parte de las descargas automáticas y debe validarse antes de distribuirlo.

Después de publicar, comprobar las cinco descargas y los enlaces del README en una ventana sin sesión de GitHub, y verificar sus SHA-256.

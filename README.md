# Inkwell

Inkwell es una aplicación de escritorio para escribir y organizar manuscritos en Markdown. Trabaja con archivos locales y ofrece un espacio de escritura personalizable, herramientas de recuperación y exportación a otros formatos.

Está construida con Electron, React y Tiptap y se distribuye como software libre bajo la licencia GPL-3.0-only.

## Funcionalidades

- Abrir carpetas y archivos Markdown, crear documentos y explorar manuscritos desde la aplicación.
- Escribir en un editor visual o en modo fuente para conservar elementos de Markdown que el editor visual no representa, como tablas, imágenes y HTML.
- Usar el modo Zen, personalizar la apariencia y la tipografía, y elegir entre español e inglés.
- Recuperar borradores locales, consultar versiones y comparar cambios.
- Exportar a PDF, DOCX, ODT, Markdown y texto.

Los borradores y el historial se almacenan localmente sin cifrado y no sustituyen a una copia de seguridad externa. Los documentos están limitados a 10 MiB. Consulta la [guía de la aplicación](electron-app/README.md) para conocer cómo funcionan el guardado, la recuperación, los conflictos y las limitaciones de exportación.

## Empezar desde el código fuente

Necesitas [Node.js](https://nodejs.org/) 22.12.0 o posterior, npm y un entorno gráfico compatible con Electron. Clona el repositorio e instala las dependencias desde el directorio de la aplicación:

```bash
git clone https://gitlab.com/ada-arg/fountain.git
cd fountain/electron-app
npm ci
npm run dev
```

Electron puede descargar su binario oficial la primera vez que se ejecuta. En Linux, el sandbox necesita namespaces de usuario o el helper de sandbox correctamente instalado; no es necesario desactivarlo para ejecutar la aplicación.

## Desarrollo y pruebas

Ejecuta estos comandos desde `electron-app/`:

```bash
npm run check          # lint, pruebas y compilación de producción
npm test               # pruebas automatizadas
npm run test:electron  # prueba nativa de Electron en Linux
```

La prueba nativa usa un perfil y archivos temporales. La [guía técnica](electron-app/README.md) describe la arquitectura, las pruebas y las medidas de seguridad de la aplicación.

## Crear paquetes

Desde `electron-app/`, ejecuta el comando correspondiente:

```bash
npm run build:unpack  # aplicación desempaquetada para inspección local
npm run build:linux   # AppImage, snap y deb
npm run build:win     # instalador de Windows
npm run build:mac     # paquete de macOS
```

Los resultados se generan en `electron-app/dist/`. La firma de Windows, la notarización de macOS y la validación de instaladores deben configurarse y comprobarse en el entorno de distribución. El arranque nativo se ha verificado en Linux; no se afirma aquí una validación equivalente en Windows o macOS.

## Contribuir

Las contribuciones son bienvenidas, desde informes de errores y mejoras de documentación hasta cambios en el código. Puedes abrir una incidencia en el [proyecto de GitLab](https://gitlab.com/ada-arg/fountain/-/issues) para describir el problema o proponer una mejora. Para errores, incluye los pasos para reproducirlos, el comportamiento esperado y el observado, el sistema operativo y, cuando sea posible, la versión de Inkwell.

Para enviar cambios, crea una rama en tu copia del repositorio, realiza los cambios y ejecuta `npm run check` desde `electron-app/`. Después, abre una solicitud de fusión en GitLab con una descripción del cambio y las pruebas realizadas. Evita incluir manuscritos personales, datos sensibles o archivos generados en la contribución.

## Licencia

Inkwell se distribuye bajo la [Licencia Pública General de GNU, versión 3](LICENSE) (GPL-3.0-only).

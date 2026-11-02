# Inkwell

Editor local de manuscritos Markdown para escritorio, construido con Electron, React y Tiptap.

## Desarrollo

Se necesita Node.js 22.12 o posterior y npm.

```bash
cd electron-app
npm ci
npm run dev
```

```bash
npm run check          # lint sin advertencias, pruebas y compilación
npm run test:electron  # prueba nativa con perfil temporal (Linux)
```

La [guía de la aplicación](electron-app/README.md) describe arquitectura, recuperación, conflictos, exportación y empaquetado. El [informe de implementación](IMPLEMENTACION_AUDITORIA.md) registra las correcciones de la auditoría y sus límites de verificación.

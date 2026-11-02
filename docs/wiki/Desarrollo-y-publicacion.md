# 🛠️ Desarrollo y publicación

[← Volver a la Wiki](README.md) · [Arquitectura](Arquitectura.md)

---

## Requisitos

- Node.js **20.19+** o **22.12+**.
- npm.
- Navegador moderno con soporte WebGL.

## Instalar y ejecutar

Desde la raíz del repositorio:

```bash
npm ci
npm run dev
```

Vite indica en la terminal la dirección local. Para crear y revisar el build:

```bash
npm run build
npm run preview
```

Los archivos de publicación se generan en `dist/`. `npm run format` aplica Prettier y modifica los archivos del proyecto.

## Publicación

Vercel puede publicar el frontend y ejecutar las funciones serverless incluidas en `api/`. La configuración del proyecto está en `vercel.json`; comprueba las variables y ajustes del proyecto Vercel antes de un cambio de infraestructura.

La configuración Vite usa `/` en Vercel y `/KRONOX/` en otros entornos para el despliegue del sitio de proyecto. En alojamiento puramente estático, la escena puede estar disponible, pero las funciones de búsqueda SPHEREx, voz y sugerencia regional necesitan un runtime compatible.

## Contribuir con seguridad

1. Revisa las guías de [arquitectura](Arquitectura.md) y [ciencia](Ciencia-y-limitaciones.md).
2. Mantén cada cambio en el módulo responsable y actualiza la documentación cuando cambie el comportamiento.
3. No incluyas claves, tokens, datos personales ni secretos en el código o en capturas compartidas.
4. Describe qué verificaste, en qué entorno y cualquier limitación.
5. Evita presentar una representación visual como medida científica sin calibración y validación.

## Comprobaciones

El proyecto declara `npm run build` para verificar la compilación. Consulta `package.json` para los comandos disponibles en la rama actual; no todos los entornos incluyen un script de pruebas automatizadas.

---

[Repositorio KRONOX](https://github.com/Goonzzas/KRONOX) · [Registro de cambios](../../CHANGELOG.md)

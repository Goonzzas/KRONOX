# Registro de cambios

## Próximo — Misión SPHEREx

- Incorporación de “Ecos en infrarrojo”, una consola de misión para consultar coordenadas del cielo en el archivo público NASA/IPAC IRSA.
- Secuencia con filtros por banda, fechas y controles de reproducción; representación en el navegador de recortes de imágenes FITS.
- Objetivos precargados: estrella de Barnard, Epsilon Indi B, WISE 0855, RW Aurigae y R Draconis.
- Función serverless para buscar en colecciones QR2/QR3 y obtener recortes SPHEREx.
- Documentación sobre cobertura de datos y requisitos de publicación en Vercel.

## 1.0.0 — Migración a React y Vite

- Reemplazo del HTML monolítico por una aplicación React modular.
- Incorporación de Vite, `@vitejs/plugin-react`, React, ReactDOM y Three.js como dependencias npm.
- Separación de datos astronómicos, escena 3D, estilos y componentes de viajes rápidos, Kronox, notificaciones y fichas.
- Ciclo de vida explícito para cancelar el render loop y retirar listeners al desmontar la escena.
- Conservación de escalas, simulación, nave, viajes rápidos, estela, avisos, voz y fichas planetarias.
- Documentación actualizada para instalación, desarrollo y compilación.

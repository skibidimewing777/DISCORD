# Discord funcional (rápido)

Mini clon de Discord con:

- login con nombre de usuario
- canales de chat
- creación de canales en vivo
- mensajería en tiempo real con Socket.IO
- selector rápido de emojis
- lista de miembros conectados por canal
- avatar por defecto para todos los usuarios

## Requisitos

- Node.js 18+

## Cómo correrlo

```bash
npm install
npm start
```

Abrí `http://localhost:3000`.

## Scripts

- `npm start` → inicia el servidor
- `npm run dev` → inicia el servidor en modo watch

## Avatar por defecto

El avatar por defecto vive en:

`public/assets/default-avatar.svg`

Si querés cambiarlo por otra imagen, reemplazá ese archivo manteniendo el mismo nombre/ruta.

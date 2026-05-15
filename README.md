# Proyecto Estadio

Base con Vite y Three.js para construir un mapa de asientos instanciado y conectarlo a ticketing.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Modelo 3D

Coloca el asiento en:

`public/models/seat.glb`

## Demo actual

- Carga el modelo `GLB` como plantilla de asiento.
- Genera `80.000` instancias con nomenclatura por sector, fila y numero.
- Permite seleccion por `raycast` sobre `InstancedMesh`.
- Muestra tres estados visuales: libre, reservado y ocupado.
- Doble click sobre un asiento para rotar su estado en la demo.

## Vercel

El proyecto esta preparado para desplegarse como app Vite. Vercel usara:

- Build command: `npm run build`
- Output directory: `dist`

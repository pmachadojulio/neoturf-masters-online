# NeoTurf Masters Online — MVP

Juego navegador 2D HD fiel a Neo Turf Masters, multijugador por turnos.

## Jugar en local
```
npm install
npm start
# abre http://localhost:3000 en 2 ventanas
# Ventana 1: pon nombre → Crear sala → copia CÓDIGO
# Ventana 2: pon nombre + CÓDIGO → Unirse
```

Controles: mouse o ← → para apuntar, ESPACIO 3 toques (iniciar / potencia / impacto como arcade).

## Jugar cada uno desde su casa (link online)
Opción fácil gratis (2 min):
1. Sube esta carpeta a GitHub
2. Entra a railway.app → New Project → Deploy from GitHub → elige repo
3. Te da URL tipo `https://neoturf.up.railway.app`
4. Pásale esa URL + CÓDIGO de sala a tu amigo. Listo.

Alternativa: render.com → New Web Service → Start `npm start`.

## Qué incluye MVP
- Hoyo Par 4, viento, fairway/rough/bunker/green, agua, árboles HD canvas
- Sistema Neo Turf: potencia + punto dulce de precisión, ganchos/slices, lie afecta
- Palos auto: Driver / Iron / Wedge / Putter
- Salas de 2-4 jugadores con código de 4 letras, turnos, sincronización servidor
- Gráficos mejorados: césped HD, sombras, vuelo con altura, indicador viento

## Siguiente
- [ ] 18 hoyos + generador de campos
- [ ] Regla golf real (juega el más lejos)
- [ ] Match play / skins, chat sala
- [ ] Sonido + sprites jugadores
- [ ] Upgrade 2.5D/3D si quieres

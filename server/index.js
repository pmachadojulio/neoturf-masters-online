const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../client')));

// --- Estado salas ---
// roomCode -> { players: [{socketId,name,x,y,shots,holed}], turnIndex, wind, hole }
const rooms = {};

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// Hoyo 1 base (coordenadas mundo 0..1000 x 0..600)
function newHoleState() {
  return {
    tee: { x: 120, y: 300 },
    hole: { x: 880, y: 300 },
    par: 4,
    wind: { angle: Math.random() * Math.PI * 2, power: 2 + Math.random() * 8 } // m/s arcade
  };
}

io.on('connection', (socket) => {
  console.log('conn', socket.id);

  socket.on('create-room', ({ name }, cb) => {
    const code = makeCode();
    const h = newHoleState();
    rooms[code] = {
      code, hole: h, turnIndex: 0,
      players: [{ socketId: socket.id, name: name || 'Jugador 1', x: h.tee.x, y: h.tee.y, shots: 0, holed: false }]
    };
    socket.join(code);
    socket.data.room = code;
    cb({ code, state: rooms[code] });
    io.to(code).emit('state', rooms[code]);
  });

  socket.on('join-room', ({ code, name }, cb) => {
    code = (code || '').toUpperCase().trim();
    const r = rooms[code];
    if (!r) return cb({ error: 'Sala no existe' });
    if (r.players.length >= 4) return cb({ error: 'Sala llena' });
    // spawn con pequeño offset para no solapar
    const off = r.players.length * 12;
    r.players.push({ socketId: socket.id, name: name || `Jugador ${r.players.length + 1}`, x: r.hole.tee.x, y: r.hole.tee.y + off, shots: 0, holed: false });
    socket.join(code);
    socket.data.room = code;
    cb({ code, state: r });
    io.to(code).emit('state', r);
  });

  // Tiro autoritativo simple: cliente envía resultado simulado, servidor valida turno y lo aplica
  // Para MVP turnos alternos estrictos (luego: juega el más lejos)
  socket.on('shoot', ({ x, y, shots }, cb) => {
    const code = socket.data.room;
    const r = rooms[code];
    if (!r) return;
    const idx = r.players.findIndex(p => p.socketId === socket.id);
    if (idx === -1) return;
    // validar turno (si ya embocaron todos, ignorar)
    if (idx !== r.turnIndex) return cb && cb({ error: 'No es tu turno' });
    const p = r.players[idx];
    p.x = x; p.y = y; p.shots = shots;
    const dHole = Math.hypot(x - r.hole.hole.x, y - r.hole.hole.y);
    if (dHole < 8) p.holed = true;

    // siguiente turno: siguiente jugador no embocado
    const n = r.players.length;
    for (let k = 1; k <= n; k++) {
      const ni = (r.turnIndex + k) % n;
      if (!r.players[ni].holed) { r.turnIndex = ni; break; }
    }
    // si todos embocados -> nuevo hoyo (de momento mismo layout + viento nuevo)
    if (r.players.every(pl => pl.holed)) {
      r.hole = newHoleState();
      r.players.forEach((pl, i) => { pl.x = r.hole.tee.x; pl.y = r.hole.tee.y + i * 12; pl.shots = 0; pl.holed = false; });
      r.turnIndex = 0;
    }
    io.to(code).emit('state', r);
    cb && cb({ ok: true, state: r });
  });

  socket.on('disconnect', () => {
    const code = socket.data.room;
    if (!code || !rooms[code]) return;
    rooms[code].players = rooms[code].players.filter(p => p.socketId !== socket.id);
    if (rooms[code].players.length === 0) delete rooms[code];
    else io.to(code).emit('state', rooms[code]);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`NeoTurf online en http://localhost:${PORT}`));

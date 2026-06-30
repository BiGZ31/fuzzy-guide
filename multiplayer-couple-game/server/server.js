const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;

// Global Game State
let players = {};
let playersCount = 0;
let gameState = {
  status: 'waiting', // 'waiting', 'playing', 'game_over'
  score: 0,
  crepePosee: false,
  temperatureCrepe: 100, // 100 to 0
  stoveCrepeState: 'idle', // 'idle', 'cooking', 'ready', 'burnt'
  stoveCrepeTimer: 0,
  matchaPose: false,
  lucieSpeedBoostTimer: 0,
  energieLucie: 100, // 100 to 0
  gourmandiseLucie: 100,
  laundriesOnFloor: [],
  machineLingeCount: { blanc: 0, couleur: 0 },
  machineState: 'idle', // 'idle', 'washing', 'finished', 'broken'
  machineTimer: 0,
  cleanLaundryCount: 0,
  restartVotes: { Luke: false, Lucie: false },
  gameOverReason: null,
  hackEventActive: false,
  hackEventTimer: 0
};
let laundryIdCounter = 0;

function getAvailableRoles() {
  const takenRoles = Object.values(players).map(p => p.role).filter(r => r !== null);
  const allRoles = ['Luke', 'Lucie'];
  return allRoles.filter(r => !takenRoles.includes(r));
}

function checkGameStart() {
  const takenRoles = Object.values(players).map(p => p.role);
  if (takenRoles.includes('Luke') && takenRoles.includes('Lucie')) {
    gameState.status = 'playing';
    io.emit('game_start');
  } else {
    gameState.status = 'waiting';
    io.emit('game_pause');
  }
}

io.on('connection', (socket) => {
  if (playersCount >= 2) {
    socket.emit('room_full');
    socket.disconnect();
    return;
  }

  players[socket.id] = {
    id: socket.id,
    role: null,
    x: 0,
    z: 0,
    targetX: 0,
    targetZ: 0,
    laundryCarried: { blanc: 0, couleur: 0 },
    cleanLaundryCarried: 0,
    hasCrepe: false,
    hasMatcha: false
  };
  playersCount++;

  console.log(`Player connected: ${socket.id}`);

  socket.emit('init', { id: socket.id, role: null });
  io.emit('available_roles', getAvailableRoles());
  io.emit('players_update', players);

  socket.on('select_role', (data) => {
    const role = data.role;
    const available = getAvailableRoles();
    if (available.includes(role)) {
      players[socket.id].role = role;
      players[socket.id].x = role === 'Luke' ? -2 : 2;
      players[socket.id].targetX = players[socket.id].x;
      
      io.emit('available_roles', getAvailableRoles());
      io.emit('players_update', players);
      
      // Confirm role to the client
      socket.emit('init', { id: socket.id, role: role });
      
      checkGameStart();
    }
  });

  socket.on('move', (data) => {
    if (players[socket.id] && gameState.status === 'playing') {
      players[socket.id].targetX = data.x;
      players[socket.id].targetZ = data.z;
    }
  });

  socket.on('action', (data) => {
    if (!players[socket.id]) return;
    const player = players[socket.id];

    if (gameState.status === 'game_over') {
      if (data.type === 'vote_restart') {
        if (!gameState.restartVotes) gameState.restartVotes = { Luke: false, Lucie: false };
        gameState.restartVotes[player.role] = true;
        
        if (gameState.restartVotes.Luke && gameState.restartVotes.Lucie) {
          gameState.status = 'playing';
          gameState.score = 0;
          gameState.crepePosee = false;
          gameState.temperatureCrepe = 100;
          gameState.stoveCrepeState = 'idle';
          gameState.stoveCrepeTimer = 0;
          gameState.matchaPose = false;
          gameState.lucieSpeedBoostTimer = 0;
          gameState.energieLucie = 100;
          gameState.gourmandiseLucie = 100;
          gameState.laundriesOnFloor = [];
          gameState.machineLingeCount = { blanc: 0, couleur: 0 };
          gameState.machineState = 'idle';
          gameState.machineTimer = 0;
          gameState.cleanLaundryCount = 0;
          gameState.restartVotes = { Luke: false, Lucie: false };
          gameState.gameOverReason = null;
          gameState.hackEventActive = false;
          gameState.hackEventTimer = 0;
          for (let id in players) {
            players[id].laundryCarried = { blanc: 0, couleur: 0 };
            players[id].cleanLaundryCarried = 0;
            players[id].hasCrepe = false;
          }
        }
        io.emit('state_update', { players, gameState });
      }
      return;
    }

    if (gameState.status !== 'playing') return;

    // ACTIONS LUKE: Cuisine & Matcha
    if (data.type === 'cuisiner_crepe_start' && player.role === 'Luke') {
      const dist = Math.sqrt(Math.pow(1 - player.x, 2) + Math.pow(-7 - player.z, 2));
      if (dist < 3.0 && gameState.stoveCrepeState === 'idle') {
        gameState.stoveCrepeState = 'cooking';
        gameState.stoveCrepeTimer = 0;
        io.emit('action_broadcast', { type: 'cuisiner_crepe_start' });
      }
    }
    if (data.type === 'prendre_crepe' && player.role === 'Luke') {
      const dist = Math.sqrt(Math.pow(1 - player.x, 2) + Math.pow(-7 - player.z, 2));
      if (dist < 3.0 && gameState.stoveCrepeState === 'ready' && !player.hasCrepe) {
        gameState.stoveCrepeState = 'idle';
        gameState.stoveCrepeTimer = 0;
        player.hasCrepe = true;
        io.emit('action_broadcast', { type: 'prendre_crepe' });
      }
    }
    if (data.type === 'servir_crepe' && player.role === 'Luke') {
      const dist = Math.sqrt(Math.pow(1.5 - player.x, 2) + Math.pow(6.5 - player.z, 2));
      if (dist < 3.0 && player.hasCrepe && !gameState.crepePosee) {
        player.hasCrepe = false;
        gameState.crepePosee = true;
        gameState.temperatureCrepe = 100;
        io.emit('action_broadcast', { type: 'crepe_posee' });
      }
    }
    if (data.type === 'jeter_crepe_brulee' && player.role === 'Luke') {
      const dist = Math.sqrt(Math.pow(1 - player.x, 2) + Math.pow(-7 - player.z, 2));
      if (dist < 3.0 && gameState.stoveCrepeState === 'burnt') {
        gameState.stoveCrepeState = 'idle';
        gameState.stoveCrepeTimer = 0;
        io.emit('action_broadcast', { type: 'jeter_crepe_brulee' });
      }
    }
    if (data.type === 'preparer_matcha' && player.role === 'Luke') {
      const dist = Math.sqrt(Math.pow(1 - player.x, 2) + Math.pow(-7 - player.z, 2));
      if (dist < 3.0 && !player.hasMatcha) {
        player.hasMatcha = true;
        io.emit('action_broadcast', { type: 'preparer_matcha' });
      }
    }
    if (data.type === 'servir_matcha' && player.role === 'Luke') {
      const dist = Math.sqrt(Math.pow(1.5 - player.x, 2) + Math.pow(6.5 - player.z, 2));
      if (dist < 3.0 && player.hasMatcha && !gameState.matchaPose) {
        player.hasMatcha = false;
        gameState.matchaPose = true;
        io.emit('action_broadcast', { type: 'matcha_pose' });
      }
    }

    if (data.type === 'pirater_film_success' && player.role === 'Luke') {
      const dist = Math.sqrt(Math.pow(7.5 - player.x, 2) + Math.pow(6.5 - player.z, 2));
      if (dist < 3.0 && gameState.hackEventActive) {
        gameState.hackEventActive = false;
        gameState.hackEventTimer = 0;
        gameState.energieLucie = Math.min(100, gameState.energieLucie + 30);
        gameState.score += 100;
        io.emit('action_broadcast', { type: 'pirater_film_success' });
      }
    }

    // ACTIONS LUCIE: Manger/Boire
    if (data.type === 'crepe_mangee' && player.role === 'Lucie') {
      const dist = Math.sqrt(Math.pow(-0.5 - player.x, 2) + Math.pow(6.5 - player.z, 2));
      if (dist < 3.0 && gameState.crepePosee) {
        gameState.crepePosee = false;
        gameState.gourmandiseLucie = Math.min(100, gameState.gourmandiseLucie + 50);
        gameState.score += 50;
        io.emit('action_broadcast', { type: 'crepe_mangee' });
      }
    }
    if (data.type === 'boire_matcha' && player.role === 'Lucie') {
      const dist = Math.sqrt(Math.pow(1.5 - player.x, 2) + Math.pow(6.5 - player.z, 2));
      if (dist < 3.0 && gameState.matchaPose) {
        gameState.matchaPose = false;
        gameState.lucieSpeedBoostTimer = 300; // 10 secondes (300 ticks)
        io.emit('action_broadcast', { type: 'boire_matcha' });
      }
    }
    
    // Bisou
    if (data.type === 'bisou_donne' && player.role === 'Luke') {
      const copine = Object.values(players).find(p => p.role === 'Lucie');
      if (copine) {
        const dx = copine.x - player.x;
        const dz = copine.z - player.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < 2.5) {
          gameState.energieLucie = Math.min(100, gameState.energieLucie + 30);
          io.emit('action_broadcast', { type: 'bisou_donne', x: player.x, z: player.z });
        }
      }
    }

    // ACTIONS LUCIE: Ramasser, Déposer, Lancer, Récupérer, Ranger
    if (data.type === 'ramasser_linge' && player.role === 'Lucie') {
      const totalCarried = player.laundryCarried.blanc + player.laundryCarried.couleur;
      if (totalCarried < 3) {
        const closeIndex = gameState.laundriesOnFloor.findIndex(l => {
          const dx = l.x - player.x;
          const dz = l.z - player.z;
          return Math.sqrt(dx*dx + dz*dz) < 2.0;
        });
        
        if (closeIndex !== -1) {
          const l = gameState.laundriesOnFloor[closeIndex];
          gameState.laundriesOnFloor.splice(closeIndex, 1);
          player.laundryCarried[l.colorType]++;
          io.emit('action_broadcast', { type: 'linge_ramasse' });
        }
      }
    }

    if (data.type === 'ajouter_machine_type' && player.role === 'Lucie') {
      const dx = 7.5 - player.x;
      const dz = -5 - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      const typeLinge = data.colorType; // 'blanc' or 'couleur'
      const totalMachine = gameState.machineLingeCount.blanc + gameState.machineLingeCount.couleur;
      
      if (dist < 3.0 && player.laundryCarried[typeLinge] > 0 && totalMachine < 9 && gameState.machineState === 'idle') {
        gameState.machineLingeCount[typeLinge]++;
        player.laundryCarried[typeLinge]--;
        io.emit('action_broadcast', { type: 'ajouter_machine' });
      }
    }

    if (data.type === 'lancer_machine_prog' && player.role === 'Lucie') {
      const dx = 7.5 - player.x;
      const dz = -5 - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      const prog = data.program; // 'blanc' or 'couleur'
      const totalMachine = gameState.machineLingeCount.blanc + gameState.machineLingeCount.couleur;
      
      if (dist < 3.0 && gameState.machineState === 'idle' && totalMachine > 0) {
        if ((prog === 'blanc' && gameState.machineLingeCount.couleur > 0) ||
            (prog === 'couleur' && gameState.machineLingeCount.blanc > 0)) {
          // ERREUR DE TRI !
          gameState.machineState = 'broken';
          // On recrache le linge par terre
          for (let i=0; i<gameState.machineLingeCount.blanc; i++) {
            gameState.laundriesOnFloor.push({ id: laundryIdCounter++, x: 6 + Math.random()*2, z: -4 - Math.random()*2, colorType: 'blanc' });
          }
          for (let i=0; i<gameState.machineLingeCount.couleur; i++) {
            gameState.laundriesOnFloor.push({ id: laundryIdCounter++, x: 6 + Math.random()*2, z: -4 - Math.random()*2, colorType: 'couleur' });
          }
          gameState.machineLingeCount = { blanc: 0, couleur: 0 };
          io.emit('action_broadcast', { type: 'machine_broken' });
        } else {
          // OK
          gameState.machineState = 'washing';
          gameState.machineTimer = 0;
          io.emit('action_broadcast', { type: 'lancer_machine' });
        }
      }
    }

    if (data.type === 'reparer_machine' && player.role === 'Luke') {
      const dx = 7.5 - player.x;
      const dz = -5 - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < 3.0 && gameState.machineState === 'broken') {
        gameState.machineState = 'idle';
        io.emit('action_broadcast', { type: 'machine_repaired' });
      }
    }

    if (data.type === 'recuperer_linge_propre' && player.role === 'Lucie') {
      const dx = 7.5 - player.x;
      const dz = -5 - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist < 3.0 && gameState.machineState === 'finished') {
        player.cleanLaundryCarried += gameState.cleanLaundryCount;
        gameState.cleanLaundryCount = 0;
        gameState.machineLingeCount = { blanc: 0, couleur: 0 }; // Sécurité
        gameState.machineState = 'idle';
        io.emit('action_broadcast', { type: 'recuperer_linge_propre' });
      }
    }

    if (data.type === 'ranger_armoire' && player.role === 'Lucie') {
      // Armoire est à [-4.5, -1.5]
      const dx = -4.5 - player.x;
      const dz = -1.5 - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);

      if (dist < 3.0 && player.cleanLaundryCarried > 0) {
        gameState.score += player.cleanLaundryCarried * 10;
        player.cleanLaundryCarried = 0;
        io.emit('action_broadcast', { type: 'ranger_armoire' });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    playersCount--;
    
    io.emit('available_roles', getAvailableRoles());
    io.emit('players_update', players);
    checkGameStart();
  });
});

// Zones valides pour spawn du linge (séjour + couloir, accessible à Lucie)
const LAUNDRY_ZONES = [
  { x: 3, z: 3 }, { x: 4, z: 3 }, { x: 3, z: 1 }, { x: 4, z: 1 },   // zone séjour centre-droite
  { x: 3, z: -1 }, { x: 4, z: -1 },                                   // couloir droite
  { x: 1, z: 3 }, { x: 2, z: 3 }, { x: 1, z: 1 }, { x: 2, z: 1 },   // centre séjour
  { x: 0, z: 3 }, { x: 0, z: 1 }, { x: 0, z: -1 },                   // couloir central
  { x: 3, z: 5 }, { x: 4, z: 5 }, { x: 5, z: 5 },                    // zone TV / droite séjour
  { x: 2, z: 5 }, { x: 1, z: 5 },                                     // devant canapé
  { x: 3, z: -3 }, { x: 4, z: -3 }, { x: 5, z: -3 },                 // couloir machine à laver
];

// Génération de linge aléatoire
setInterval(() => {
  if (gameState.status === 'playing' && gameState.machineState !== 'washing') {
    const zone = LAUNDRY_ZONES[Math.floor(Math.random() * LAUNDRY_ZONES.length)];
    const x = zone.x + (Math.random() - 0.5);
    const z = zone.z + (Math.random() - 0.5);
    const colorType = Math.random() > 0.5 ? 'blanc' : 'couleur';
    gameState.laundriesOnFloor.push({ id: laundryIdCounter++, x, z, colorType });
    
    if (gameState.laundriesOnFloor.length >= 12) {
      gameState.status = 'game_over';
      gameState.gameOverReason = 'linge';
      gameState.restartVotes = { Luke: false, Lucie: false };
      io.emit('state_update', { players, gameState });
    }
  }
}, 6000);

const WALLS = [
  { x: 0, z: -8.1, w: 16.2, d: 0.2 },
  { x: 8.1, z: 0, w: 0.2, d: 16.2 },
  { x: 0, z: 8.1, w: 16.2, d: 0.2 },
  { x: -8.1, z: 0, w: 0.2, d: 16.2 },
  { x: -1, z: 4, w: 0.2, d: 8 },
  { x: -4.5, z: -2, w: 7, d: 0.2 },
  { x: 5.5, z: -6, w: 0.2, d: 4 },
  { x: 1, z: -7, w: 3, d: 2 }, // Cuisine
  { x: -0.5, z: 6.5, w: 1.5, d: 3 }, // Canapé
  { x: 1.5, z: 6.5, w: 1.5, d: 2 }, // Table basse
  { x: -4.5, z: -1.5, w: 3, d: 1 }, // Armoire
  { x: -6, z: 5, w: 3, d: 4 }, // Lit
  { x: 7.5, z: -5, w: 1.5, d: 1.5 }, // Machine
  { x: -1, z: -6.6, w: 0.2, d: 3 }, // Mur SDE 1
  { x: -1, z: -2.55, w: 0.2, d: 1.1 }, // Mur SDE 2
  { x: -2, z: -7, w: 1.5, d: 1.5 }, // Douche
  { x: -7.5, z: -7.5, w: 0.6, d: 0.8 }, // Toilettes
  { x: 7.5, z: 6.5, w: 1, d: 3 } // Meuble TV (Piratage)
];

function checkCollision(x, z, radius = 0.4) {
  for (let wall of WALLS) {
    if (x > wall.x - wall.w / 2 - radius &&
        x < wall.x + wall.w / 2 + radius &&
        z > wall.z - wall.d / 2 - radius &&
        z < wall.z + wall.d / 2 + radius) {
      return true;
    }
  }
  return false;
}

// Server Tick Update
setInterval(() => {
  let needsUpdate = false;

  for (let id in players) {
    const p = players[id];
    if (!p.role) continue; // Si le joueur n'a pas encore choisi
    const dx = p.targetX - p.x;
    const dz = p.targetZ - p.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist > 0.05) {
      let speed = 0.15;
      if (p.role === 'Lucie') {
        if (gameState.lucieSpeedBoostTimer > 0) {
          speed = 0.30;
        } else if (gameState.gourmandiseLucie <= 0) {
          speed = 0.05; // Très lente et énervée !
        }
      }
      
      const moveX = (dx / dist) * speed;
      const moveZ = (dz / dist) * speed;
      
      if (!checkCollision(p.x + moveX, p.z)) {
        p.x += moveX;
      } else {
        p.targetX = p.x;
      }
      
      if (!checkCollision(p.x, p.z + moveZ)) {
        p.z += moveZ;
      } else {
        p.targetZ = p.z;
      }
      
      needsUpdate = true;
    } else {
      if (p.x !== p.targetX || p.z !== p.targetZ) {
        p.x = p.targetX;
        p.z = p.targetZ;
        needsUpdate = true;
      }
    }
  }

  if (gameState.status === 'playing') {
    // Win Condition
    if (gameState.score >= 300) {
      gameState.status = 'game_won';
      gameState.restartVotes = { Luke: false, Lucie: false };
      return;
    }

    // Timers Cuisine & Boost
    if (gameState.stoveCrepeState === 'cooking' || gameState.stoveCrepeState === 'ready') {
      gameState.stoveCrepeTimer++;
      if (gameState.stoveCrepeState === 'cooking' && gameState.stoveCrepeTimer >= 100) {
        gameState.stoveCrepeState = 'ready';
      } else if (gameState.stoveCrepeState === 'ready' && gameState.stoveCrepeTimer >= 200) {
        gameState.stoveCrepeState = 'burnt';
      }
    }

    if (gameState.lucieSpeedBoostTimer > 0) {
      gameState.lucieSpeedBoostTimer--;
    }

    if (gameState.crepePosee && gameState.temperatureCrepe > 0) {
      gameState.temperatureCrepe -= 0.1;
      if (gameState.temperatureCrepe <= 0) {
        gameState.temperatureCrepe = 0;
        gameState.status = 'game_over';
        gameState.gameOverReason = 'crepe_froide';
        gameState.restartVotes = { Luke: false, Lucie: false };
      }
    }
    if (gameState.energieLucie > 0) {
      gameState.energieLucie -= 0.05;
      if (gameState.energieLucie <= 0) {
        gameState.energieLucie = 0;
        gameState.status = 'game_over';
        gameState.gameOverReason = 'burnout';
        gameState.restartVotes = { Luke: false, Lucie: false };
      }
    }

    if (gameState.gourmandiseLucie > 0) {
      gameState.gourmandiseLucie -= 0.03; // Baisse un peu plus lente que l'énergie
      if (gameState.gourmandiseLucie <= 0) {
        gameState.gourmandiseLucie = 0;
        // Plus de Game Over ici, juste un malus de vitesse géré plus haut !
      }
    }

    // Update washing machine
    if (gameState.machineState === 'washing') {
      gameState.machineTimer += 0.5; // Prend environ 6.6 secondes pour atteindre 100
      if (gameState.machineTimer >= 100) {
        gameState.machineState = 'finished';
        gameState.cleanLaundryCount = gameState.machineLingeCount.blanc + gameState.machineLingeCount.couleur;
        gameState.machineLingeCount = { blanc: 0, couleur: 0 };
        gameState.machineTimer = 0;
      }
    }

    // Hack Event Timer
    if (gameState.hackEventActive) {
      gameState.hackEventTimer--;
      if (gameState.hackEventTimer <= 0) {
        gameState.hackEventActive = false;
        gameState.status = 'game_over';
        gameState.gameOverReason = 'hack_failed';
        gameState.restartVotes = { Luke: false, Lucie: false };
      }
    } else {
      // 1 chance sur 1500 (environ toutes les 50s à 30 ticks/s) de déclencher le hack
      if (Math.random() < 1 / 1500) {
        gameState.hackEventActive = true;
        gameState.hackEventTimer = 45 * TICK_RATE; // 45 secondes
      }
    }

    needsUpdate = true;
  }

  if (needsUpdate) {
    io.emit('state_update', { players, gameState });
  }

}, TICK_MS);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

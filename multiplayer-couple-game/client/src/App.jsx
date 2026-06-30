import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import GameScene from './GameScene';

// Utilisation d'une variable d'environnement pour l'URL du serveur en production
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const socket = io(SERVER_URL, { autoConnect: false });

// ============================
// Composant Joystick Virtuel
// ============================
function Joystick({ onMove }) {
  const baseRef = useRef(null);
  const isDragging = useRef(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const animRef = useRef(null);
  const dirRef = useRef({ x: 0, y: 0 });
  const MAX_RADIUS = 40;
  const SPEED = 0.25;

  // Convert joystick direction to world movement every frame
  useEffect(() => {
    const loop = () => {
      if (dirRef.current.x !== 0 || dirRef.current.y !== 0) {
        // We need current player position to compute target - we ask via a callback
        onMove(dirRef.current.x, dirRef.current.y);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [onMove]);

  const getPos = (e) => {
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const clamped = Math.min(dist, MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    return {
      kx: Math.cos(angle) * clamped,
      ky: Math.sin(angle) * clamped,
      nx: (Math.cos(angle) * clamped / MAX_RADIUS),
      ny: (Math.sin(angle) * clamped / MAX_RADIUS),
    };
  };

  const onStart = (e) => { e.preventDefault(); isDragging.current = true; };
  const onEnd = () => {
    isDragging.current = false;
    dirRef.current = { x: 0, y: 0 };
    setKnobPos({ x: 0, y: 0 });
  };
  const onDrag = (e) => {
    if (!isDragging.current) return;
    const { kx, ky, nx, ny } = getPos(e);
    setKnobPos({ x: kx, y: ky });
    dirRef.current = { x: nx, y: ny };
  };

  return (
    <div
      ref={baseRef}
      onMouseDown={onStart} onMouseMove={onDrag} onMouseUp={onEnd} onMouseLeave={onEnd}
      onTouchStart={onStart} onTouchMove={onDrag} onTouchEnd={onEnd}
      style={{
        position: 'absolute', bottom: '30px', left: '30px',
        width: '100px', height: '100px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.25)',
        border: '3px solid rgba(255,255,255,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 20, cursor: 'grab', userSelect: 'none', touchAction: 'none',
        pointerEvents: 'auto',
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.8)',
        boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
        transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
        transition: isDragging.current ? 'none' : 'transform 0.2s ease',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState({
    status: 'waiting',
    score: 0,
    crepePosee: false,
    temperatureCrepe: 100,
    energieLucie: 100,
    laundriesOnFloor: [],
    machineLingeCount: 0,
    machineState: 'idle',
    machineTimer: 0,
    cleanLaundryCount: 0,
    gameOverReason: null
  });

  const [kissAnim, setKissAnim] = useState(null);

  // Mini-jeu réparation (Luke)
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairBolts, setRepairBolts] = useState([0, 0, 0]);

  // Mini-jeu Hacker (Luke)
  const [showHackModal, setShowHackModal] = useState(false);
  const [hackChallenge, setHackChallenge] = useState({ question: '', answer: '' });
  const [hackInput, setHackInput] = useState('');
  const [hackError, setHackError] = useState(false);

  const generateHackChallenge = () => {
    const types = ['math', 'binary', 'logic', 'code_c', 'code_js', 'network'];
    const type = types[Math.floor(Math.random() * types.length)];
    if (type === 'math') {
      const a = Math.floor(Math.random() * 50) + 10;
      const b = Math.floor(Math.random() * 5) + 2;
      const c = Math.floor(Math.random() * 20) + 1;
      return { question: `Calculer le reste (modulo) : ${a} % ${b} = ?`, answer: (a % b).toString() };
    } else if (type === 'binary') {
      const num = Math.floor(Math.random() * 50) + 10;
      return { question: `Convertir le nombre décimal ${num} en binaire :`, answer: num.toString(2) };
    } else if (type === 'logic') {
      const scenarios = [
        { question: "(VRAI OU FAUX) ET NON(VRAI ET FAUX) = ?", answer: "VRAI" },
        { question: "NON(FAUX) OU NON(VRAI) = ?", answer: "VRAI" },
        { question: "(VRAI ET VRAI) ET NON(VRAI) = ?", answer: "FAUX" },
      ];
      return scenarios[Math.floor(Math.random() * scenarios.length)];
    } else if (type === 'code_c') {
      const scenarios = [
        { question: `Compléter en C : int main() { printf("Hack"); ______ 0; }`, answer: "return" },
        { question: `Type C pour un entier : _____ x = 42;`, answer: "int" },
        { question: `Boucle C : ____(int i=0; i<10; i++) { }`, answer: "for" }
      ];
      return scenarios[Math.floor(Math.random() * scenarios.length)];
    } else if (type === 'code_js') {
      const scenarios = [
        { question: `JS : Ajouter à la fin d'un tableau : arr.____(5);`, answer: "push" },
        { question: `JS : Déclarer une constante : _____ x = 10;`, answer: "const" },
        { question: `JS : Afficher dans la console : _______.log("Hack");`, answer: "console" }
      ];
      return scenarios[Math.floor(Math.random() * scenarios.length)];
    } else {
      const scenarios = [
        { question: `Réseau : Quel est le port par défaut pour le HTTPS ?`, answer: "443" },
        { question: `Réseau : Quel est le port par défaut pour le HTTP ?`, answer: "80" },
        { question: `Réseau : Quel est le port par défaut pour SSH ?`, answer: "22" }
      ];
      return scenarios[Math.floor(Math.random() * scenarios.length)];
    }
  };

  // Mini-jeu matcha
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [showMatchaModal, setShowMatchaModal] = useState(false);
  const [matchaStep, setMatchaStep] = useState(1);
  const [grassClicks, setGrassClicks] = useState(0);
  const [isMelting, setIsMelting] = useState(false);
  const [meltProgress, setMeltProgress] = useState(0);

  useEffect(() => {
    let interval;
    if (showMatchaModal && matchaStep === 2 && isMelting) {
      interval = setInterval(() => {
        setMeltProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsMelting(false);
            setMatchaStep(3);
            return 100;
          }
          return prev + 2; // Fill in 2.5 seconds
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [showMatchaModal, matchaStep, isMelting]);

  // Mini-jeu crêpe
  const [showCrepeModal, setShowCrepeModal] = useState(false);
  const [crepeBatter, setCrepeBatter] = useState(0);
  const [isPouring, setIsPouring] = useState(false);

  useEffect(() => {
    let interval;
    if (showCrepeModal && isPouring) {
      interval = setInterval(() => {
        setCrepeBatter(prev => {
          if (prev >= 100) {
             clearInterval(interval);
             handleAction('cuisiner_crepe_start');
             setShowCrepeModal(false);
             setIsPouring(false);
             return 100;
          }
          return prev + 2; // Remplissage en 2.5 secondes
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [showCrepeModal, isPouring]);

  useEffect(() => {
    socket.connect();

    socket.on('init', (data) => {
      setRole(data.role); // data.role peut être null au début
      setConnected(true);
    });

    socket.on('available_roles', (roles) => {
      setAvailableRoles(roles);
    });

    socket.on('players_update', (data) => {
      setPlayers(data);
    });

    socket.on('game_start', () => {
      setGameStarted(true);
    });

    socket.on('game_pause', () => {
      setGameStarted(false);
    });

    socket.on('state_update', (data) => {
      setPlayers(data.players);
      setGameState(data.gameState);
      // Sync local player ref for joystick
      const myId = socket.id;
      if (data.players && myId && data.players[myId]) {
        localPlayerRef.current = data.players[myId];
      }
    });

    socket.on('action_broadcast', (data) => {
      if (data.type === 'bisou_donne') {
        setKissAnim({ x: data.x, z: data.z, id: Date.now() });
        setTimeout(() => setKissAnim(null), 2000);
      }
    });

    socket.on('room_full', () => {
      alert("La salle est pleine !");
    });

    return () => {
      socket.off('init');
      socket.off('available_roles');
      socket.off('players_update');
      socket.off('game_start');
      socket.off('game_pause');
      socket.off('state_update');
      socket.off('action_broadcast');
      socket.off('room_full');
      socket.disconnect();
    };
  }, []);

  const handleSelectRole = (selectedRole) => {
    socket.emit('select_role', { role: selectedRole });
  };

  const handleAction = (type, payload = {}) => {
    socket.emit('action', { type, ...payload });
  };

  const handleMove = (x, z) => {
    socket.emit('move', { x, z });
  };

  // Joystick: direction normalisée (nx, ny en coords écran) -> cible relative au joueur
  const localPlayerRef = useRef(null);
  const handleJoystickMove = useCallback((nx, ny) => {
    const p = localPlayerRef.current;
    if (!p) return;
    // Caméra isometrique (vue de (-10,10,10)) - la droite écran = (+x+z) et le bas écran = (+x-z)
    const STEP = 4;
    const wx = (nx + ny) * STEP * 0.5;
    const wz = (ny - nx) * STEP * 0.5;
    socket.emit('move', { x: p.x + wx, z: p.z + wz });
  }, []);

  if (!connected) {
    return <div className="waiting-screen">Connexion au serveur...</div>;
  }

  // ÉCRAN DE SÉLECTION DE PERSONNAGE
  if (!role) {
    return (
      <div className="selection-screen">
        <h1 className="selection-title">Choisissez votre Personnage</h1>
        <div className="cards-container">
          <div className={`character-card luke-card ${!availableRoles.includes('Luke') ? 'disabled' : ''}`}>
            <div className="card-emoji">👦</div>
            <h2>Luke</h2>
            <p>Spécialité : Crêpes & Bisous</p>
            <button 
              className="select-btn luke-btn" 
              onClick={() => handleSelectRole('Luke')}
              disabled={!availableRoles.includes('Luke')}
            >
              {availableRoles.includes('Luke') ? 'Jouer Luke' : 'Déjà pris'}
            </button>
          </div>
          
          <div className={`character-card lucie-card ${!availableRoles.includes('Lucie') ? 'disabled' : ''}`}>
            <div className="card-emoji">👧</div>
            <h2>Lucie</h2>
            <p>Spécialité : Linge & Nettoyage</p>
            <button 
              className="select-btn lucie-btn" 
              onClick={() => handleSelectRole('Lucie')}
              disabled={!availableRoles.includes('Lucie')}
            >
              {availableRoles.includes('Lucie') ? 'Jouer Lucie' : 'Déjà pris'}
            </button>
          </div>
        </div>
        
        <div style={{ marginTop: '40px', background: 'rgba(255,255,255,0.9)', padding: '20px', borderRadius: '10px', maxWidth: '600px', textAlign: 'left', color: '#333' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>📖 Comment Jouer ?</h3>
          <p><strong>Objectif :</strong> Atteignez <strong>300 points</strong> pour sauver votre relation ! Si l'énergie de Lucie tombe à 0 ou que la crêpe refroidit... c'est fini !</p>
          <ul style={{ marginTop: '10px', paddingLeft: '20px', lineHeight: '1.5' }}>
            <li><strong>Luke 👦 :</strong> Prépare des crêpes 🍳, du Matcha 🍵, répare la machine 🔧, et pirate des films 💻 en résolvant des énigmes !</li>
            <li><strong>Lucie 👧 :</strong> Ramasse le linge 👕, gère la machine à laver 🧼, et range dans l'armoire 🚪. Mange les crêpes pour regagner de l'énergie !</li>
            <li><strong>Astuce :</strong> Luke, n'oublie pas de faire un bisou 💋 à Lucie pour lui donner de l'énergie gratuite !</li>
          </ul>
        </div>
      </div>
    );
  }

  // ÉCRAN D'ATTENTE (quand on a un rôle mais l'autre n'est pas là)
  if (!gameStarted) {
    return (
      <div className="waiting-screen">
        <h2>En attente de l'autre joueur...</h2>
        <p style={{ marginTop: '10px' }}>Vous incarnez : <strong>{role}</strong></p>
      </div>
    );
  }

  const localPlayer = players[socket.id];

  const handleOpenCrepeModal = () => {
    if (!localPlayer) return;
    const dist = Math.sqrt(Math.pow(1 - localPlayer.x, 2) + Math.pow(-7 - localPlayer.z, 2));
    if (dist < 3.0) {
      setCrepeBatter(0);
      setIsPouring(false);
      setShowCrepeModal(true);
    } else {
      alert("Approche-toi de la gazinière !");
    }
  };

  const handleOpenMatchaModal = () => {
    if (!localPlayer) return;
    const dist = Math.sqrt(Math.pow(1 - localPlayer.x, 2) + Math.pow(-7 - localPlayer.z, 2));
    if (dist < 3.0) {
      setMatchaStep(1);
      setGrassClicks(0);
      setMeltProgress(0);
      setShowMatchaModal(true);
    } else {
      alert("Approche-toi de la cuisine pour préparer le matcha !");
    }
  };

  const handleOpenMachineModal = () => {
    if (!localPlayer) return;
    const dx = 7.5 - localPlayer.x;
    const dz = -5 - localPlayer.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 3.0) {
      setShowMachineModal(true);
    } else {
      alert("Approche-toi de la machine !");
    }
  };

  const handleOpenRepairModal = () => {
    if (!localPlayer) return;
    const dx = 7.5 - localPlayer.x;
    const dz = -5 - localPlayer.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 3.0) {
      setRepairBolts([0, 0, 0]);
      setShowRepairModal(true);
    } else {
      alert("Approche-toi de la machine pour la réparer !");
    }
  };

  const handleOpenHackModal = () => {
    if (!localPlayer) return;
    const dx = 7.5 - localPlayer.x;
    const dz = 6.5 - localPlayer.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 3.0) {
      setHackChallenge(generateHackChallenge());
      setHackInput('');
      setHackError(false);
      setShowHackModal(true);
    } else {
      alert("Approche-toi du bureau pour pirater !");
    }
  };

  return (
    <>
      {gameState.status === 'game_won' && (
        <div className="game-over-screen" style={{ background: 'rgba(76, 175, 80, 0.9)' }}>
          <h1 style={{ textAlign: 'center', margin: '0 20px', fontSize: '2.5rem', lineHeight: '1.2', color: 'white' }}>
            🎉 VICTOIRE ! LA RELATION EST SAUVÉE ! 🎉
          </h1>
          <p style={{ fontSize: '1.5rem', marginTop: '20px', color: 'white' }}>Vous avez atteint les 300 points ! Quel couple incroyable ! ❤️</p>
          
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            {!gameState.restartVotes?.[role] ? (
              <button 
                className="action-btn" 
                style={{ background: 'white', color: '#4caf50', fontWeight: 'bold' }}
                onClick={() => handleAction('vote_restart')}
              >
                ✅ Rejouer
              </button>
            ) : (
              <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>⏳ En attente de l'autre joueur...</p>
            )}
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '20px', fontSize: '1.5rem', color: 'white' }}>
            <div style={{ opacity: gameState.restartVotes?.Luke ? 1 : 0.5 }}>👦 Luke {gameState.restartVotes?.Luke ? '✔️' : '❌'}</div>
            <div style={{ opacity: gameState.restartVotes?.Lucie ? 1 : 0.5 }}>👧 Lucie {gameState.restartVotes?.Lucie ? '✔️' : '❌'}</div>
          </div>
        </div>
      )}

      {gameState.status === 'game_over' && (
        <div className="game-over-screen">
          <h1 style={{ textAlign: 'center', margin: '0 20px', fontSize: '2rem', lineHeight: '1.2' }}>
            {gameState.gameOverReason === 'linge' 
              ? `"Non mais serieux LUKE avec ton linge on dirait bastien je te quite"`
              : gameState.gameOverReason === 'crepe_froide'
              ? `"Non mais t'es sérieuse, tu as laissé la crêpe refroidir ?! Moi je cuisine plus pour toi ! 💢"`
              : gameState.gameOverReason === 'hack_failed'
              ? `"Ça sert à quoi d'être avec un ingénieur s'il ne sait rien faire... ciao !"`
              : `"LUKE t'es serieux tu me calcules meme pas... je savais que jaurais du rester vegetarienne ... ciao"`}
          </h1>
          <p style={{ fontSize: '1.2rem', marginTop: '20px' }}>Vous n'avez pas réussi à sauver le couple... Réessayer ??</p>
          <h2 style={{ marginTop: '20px', color: '#ff9800' }}>Score Final : {gameState.score}</h2>
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            {!gameState.restartVotes?.[role] ? (
              <button 
                className="action-btn" 
                style={{ background: '#4caf50', color: 'white' }}
                onClick={() => handleAction('vote_restart')}
              >
                ✅ Accepter de recommencer
              </button>
            ) : (
              <p style={{ color: '#4caf50', fontWeight: 'bold', fontSize: '1.2rem' }}>⏳ En attente de l'autre joueur...</p>
            )}
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '20px', fontSize: '1.5rem' }}>
            <div style={{ opacity: gameState.restartVotes?.Luke ? 1 : 0.5 }}>👦 Luke {gameState.restartVotes?.Luke ? '✔️' : '❌'}</div>
            <div style={{ opacity: gameState.restartVotes?.Lucie ? 1 : 0.5 }}>👧 Lucie {gameState.restartVotes?.Lucie ? '✔️' : '❌'}</div>
          </div>
        </div>
      )}

      {gameState.status === 'playing' && (
        <div className="ui-container">
          {/* ALERTE HACK */}
          {gameState.hackEventActive && (
            <div style={{
              position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
              background: '#f44336', color: 'white', padding: '15px 30px', borderRadius: '10px',
              fontSize: '1.2rem', fontWeight: 'bold', zIndex: 1000, boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              animation: 'pulse 1s infinite'
            }}>
              🚨 URGENCE : Lucie veut voir un film ! Vite, pirate-le ! ({Math.ceil(gameState.hackEventTimer / 30)}s)
            </div>
          )}

          <div className="role-badge">
            🎮 {role} | ⭐ Score: {gameState.score}
            {role === 'Lucie' && gameState.lucieSpeedBoostTimer > 0 && " | ⚡ BOOST !"}
          </div>
          
            <div className="gauges">
              <div className="gauge-container gauge-energie">
                ⚡ Énergie de Lucie
                <div className="gauge-bar">
                  <div className="gauge-fill" style={{ width: `${Math.max(0, gameState.energieLucie)}%` }}></div>
                </div>
              </div>
              
              <div className="gauge-container gauge-crepe">
                🧁 Gourmandise Lucie
                <div className="gauge-bar">
                  <div className="gauge-fill" style={{ width: `${Math.max(0, gameState.gourmandiseLucie || 0)}%`, background: 'linear-gradient(90deg, #ff8a80, #ffb300)' }}></div>
                </div>
              </div>
              
              {gameState.crepePosee && (
                <div className="gauge-container gauge-crepe">
                  Température Crêpe
                  <div className="gauge-bar">
                    <div className="gauge-fill" style={{ width: `${Math.max(0, gameState.temperatureCrepe)}%` }}></div>
                  </div>
                </div>
              )}

            <div className="gauge-container info-text">
              🧺 Linge au sol : {gameState.laundriesOnFloor.length} / 10
            </div>

            {role === 'Lucie' && localPlayer && (
              <>
                <div className="gauge-container info-text">
                  👗 Porté : ⚪ {localPlayer.laundryCarried?.blanc || 0} | 🔴 {localPlayer.laundryCarried?.couleur || 0}
                </div>
                <div className="gauge-container info-text">
                  ✨ Linge propre porté : {localPlayer.cleanLaundryCarried}
                </div>
              </>
            )}
          </div>

          {/* Joystick Virtuel */}
          <Joystick onMove={handleJoystickMove} />

          <div className="actions">
            {role === 'Luke' && (
              <>
                {gameState.stoveCrepeState === 'idle' && (
                  <button className="action-btn" onClick={handleOpenCrepeModal}>
                    🍳 Préparer la Pâte
                  </button>
                )}
                {gameState.stoveCrepeState === 'ready' && !localPlayer?.hasCrepe && (
                  <button className="action-btn" style={{ background: '#8bc34a' }} onClick={() => handleAction('prendre_crepe')}>
                    🖐️ Prendre la Crêpe
                  </button>
                )}
                {localPlayer?.hasCrepe && (
                  <button className="action-btn" style={{ background: '#ff9800' }} onClick={() => handleAction('servir_crepe')}>
                    🍽️ Servir au Canapé
                  </button>
                )}
                {gameState.stoveCrepeState === 'burnt' && (
                  <button className="action-btn" style={{ background: '#f44336', color: 'white' }} onClick={() => handleAction('jeter_crepe_brulee')}>
                    🗑️ Jeter Crêpe
                  </button>
                )}
                {!gameState.matchaPose && !localPlayer?.hasMatcha && (
                  <button className="action-btn" style={{ background: '#cddc39' }} onClick={handleOpenMatchaModal}>
                    🍵 Faire Matcha
                  </button>
                )}
                {localPlayer?.hasMatcha && (
                  <button className="action-btn" style={{ background: '#cddc39' }} onClick={() => handleAction('servir_matcha')}>
                    🍵 Servir Matcha au Canapé
                  </button>
                )}
                <button className="action-btn" onClick={() => handleAction('bisou_donne')}>
                  💋 Faire un bisou
                </button>
                {gameState.machineState === 'broken' && (
                  <button className="action-btn" style={{ background: '#f44336', color: 'white' }} onClick={handleOpenRepairModal}>
                    🔧 Réparer la Machine
                  </button>
                )}
                {gameState.hackEventActive && (
                  <button className="action-btn" style={{ background: '#000', color: '#0f0', border: '1px solid #0f0' }} onClick={handleOpenHackModal}>
                    💻 Pirater le Film
                  </button>
                )}
              </>
            )}

            {role === 'Lucie' && (
              <>
                <button className="action-btn" onClick={() => handleAction('ramasser_linge')}>
                  👕 Ramasser Linge
                </button>
                
                {gameState.machineState === 'idle' && (
                  <button className="action-btn action-machine" onClick={handleOpenMachineModal}>
                    🧼 Gérer la Machine
                  </button>
                )}

                {gameState.machineState === 'finished' && (
                  <button className="action-btn action-machine" onClick={() => handleAction('recuperer_linge_propre')}>
                    🧺 Récupérer Linge Propre
                  </button>
                )}

                {localPlayer && localPlayer.cleanLaundryCarried > 0 && (
                  <button className="action-btn action-armoire" onClick={() => handleAction('ranger_armoire')}>
                    🚪 Ranger dans l'Armoire
                  </button>
                )}

                {gameState.crepePosee && (
                  <button className="action-btn" onClick={() => handleAction('crepe_mangee')}>
                    🍽️ Manger Crêpe (sur Canapé)
                  </button>
                )}
                {gameState.matchaPose && (
                  <button className="action-btn" style={{ background: '#cddc39' }} onClick={() => handleAction('boire_matcha')}>
                    🍵 Boire Matcha (sur Canapé)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showCrepeModal && (
        <div className="crepe-modal-overlay">
          <div className="crepe-modal">
            <h2>Prépare la pâte !</h2>
            <p>Maintiens le clic appuyé sur la poêle pour la remplir.</p>
            <div 
              className="pan-container"
              onMouseDown={() => setIsPouring(true)}
              onMouseUp={() => setIsPouring(false)}
              onMouseLeave={() => setIsPouring(false)}
              onTouchStart={() => setIsPouring(true)}
              onTouchEnd={() => setIsPouring(false)}
            >
              <div className="pan-handle"></div>
              <div className="pan-base">
                <div className="batter-fill" style={{ transform: `scale(${crepeBatter / 100})` }}></div>
              </div>
            </div>
            <div className="batter-progress-text">{Math.floor(crepeBatter)}%</div>
            <button className="action-btn" style={{ marginTop: '20px', background: '#f44336', color: 'white' }} onClick={() => setShowCrepeModal(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* MODALE RÉPARATION (LUKE) */}
      {showRepairModal && (
        <div className="crepe-modal-overlay">
          <div className="crepe-modal" style={{ maxWidth: '400px' }}>
            <h2>🔧 Réparation</h2>
            <p>Resserre les 3 boulons à fond !</p>
            <div style={{ display: 'flex', justifyContent: 'space-around', margin: '30px 0' }}>
              {repairBolts.map((clicks, index) => (
                <div key={index} style={{ textAlign: 'center' }}>
                  <button 
                    className="action-btn" 
                    style={{ 
                      background: clicks >= 5 ? '#4caf50' : '#cfd8dc', 
                      color: clicks >= 5 ? 'white' : '#333',
                      width: '60px', 
                      height: '60px', 
                      borderRadius: '50%',
                      fontSize: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: `rotate(${clicks * 72}deg)`,
                      transition: 'transform 0.2s'
                    }}
                    onClick={() => {
                      if (clicks < 5) {
                        const newBolts = [...repairBolts];
                        newBolts[index]++;
                        setRepairBolts(newBolts);
                        if (newBolts[0] >= 5 && newBolts[1] >= 5 && newBolts[2] >= 5) {
                          handleAction('reparer_machine');
                          setShowRepairModal(false);
                        }
                      }
                    }}
                    disabled={clicks >= 5}
                  >
                    🔩
                  </button>
                  <p style={{ marginTop: '10px', fontSize: '0.9rem', color: clicks >= 5 ? '#4caf50' : '#666' }}>
                    {clicks}/5
                  </p>
                </div>
              ))}
            </div>
            <button className="action-btn" style={{ background: '#f44336', color: 'white', width: '100%' }} onClick={() => setShowRepairModal(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* MODALE HACK (LUKE) */}
      {showHackModal && (
        <div className="crepe-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="crepe-modal" style={{ maxWidth: '500px', background: '#111', color: '#0f0', border: '2px solid #0f0', fontFamily: 'monospace' }}>
            <h2>💻 TERMINAL DE PIRATAGE</h2>
            <p style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '20px' }}>Résous ce problème d'ingénieur pour bypasser le pare-feu :</p>
            
            <div style={{ background: '#000', padding: '15px', borderRadius: '5px', border: '1px solid #333', marginBottom: '20px' }}>
              <span style={{ color: '#0f0' }}>root@hack-system:~# </span>
              <span style={{ color: '#fff' }}>{hackChallenge.question}</span>
            </div>

            <input 
              type="text" 
              value={hackInput}
              onChange={(e) => {
                setHackInput(e.target.value);
                setHackError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = hackInput.trim().toUpperCase();
                  if (val === hackChallenge.answer.toUpperCase()) {
                    handleAction('pirater_film_success');
                    setShowHackModal(false);
                  } else {
                    setHackError(true);
                    setHackInput('');
                  }
                }
              }}
              placeholder="Tape la réponse et appuie sur Entrée..."
              style={{
                width: '100%', padding: '15px', fontSize: '1.2rem',
                background: '#000', color: '#0f0', border: '1px solid #0f0',
                outline: 'none', marginBottom: '10px'
              }}
              autoFocus
            />
            
            {hackError && (
              <p style={{ color: '#f44336', fontWeight: 'bold', animation: 'pulse 0.5s' }}>ERREUR : RÉPONSE INCORRECTE ! ACCÈS REFUSÉ.</p>
            )}

            <button 
              className="action-btn" 
              style={{ background: '#0f0', color: '#000', width: '100%', fontWeight: 'bold', marginTop: '10px' }} 
              onClick={() => {
                const val = hackInput.trim().toUpperCase();
                if (val === hackChallenge.answer.toUpperCase()) {
                  handleAction('pirater_film_success');
                  setShowHackModal(false);
                } else {
                  setHackError(true);
                  setHackInput('');
                }
              }}
            >
              Exécuter le Script
            </button>
            <button className="action-btn" style={{ background: '#333', color: 'white', width: '100%', marginTop: '10px' }} onClick={() => setShowHackModal(false)}>
              Abandonner (Fermer)
            </button>
          </div>
        </div>
      )}

      {/* MODALE MACHINE À LAVER */}
      {showMachineModal && (
        <div className="crepe-modal-overlay">
          <div className="crepe-modal" style={{ maxWidth: '400px' }}>
            <h2>🧼 Tri du Linge</h2>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ flex: 1, padding: '10px', background: '#f5f5f5', borderRadius: '10px', marginRight: '10px' }}>
                <h3 style={{ fontSize: '1rem', color: '#757575' }}>Linge Blanc ⚪</h3>
                <p style={{ margin: '5px 0' }}>Porté : {localPlayer?.laundryCarried?.blanc || 0}</p>
                <p style={{ margin: '5px 0' }}>En machine : {gameState.machineLingeCount?.blanc || 0}</p>
                <button 
                  className="action-btn" 
                  style={{ padding: '10px', marginTop: '10px', fontSize: '0.9rem' }} 
                  onClick={() => handleAction('ajouter_machine_type', { colorType: 'blanc' })}
                  disabled={(localPlayer?.laundryCarried?.blanc || 0) === 0}
                >
                  Ajouter ⚪
                </button>
              </div>

              <div style={{ flex: 1, padding: '10px', background: '#fff3e0', borderRadius: '10px' }}>
                <h3 style={{ fontSize: '1rem', color: '#e65100' }}>Couleurs 🔴</h3>
                <p style={{ margin: '5px 0' }}>Porté : {localPlayer?.laundryCarried?.couleur || 0}</p>
                <p style={{ margin: '5px 0' }}>En machine : {gameState.machineLingeCount?.couleur || 0}</p>
                <button 
                  className="action-btn" 
                  style={{ padding: '10px', marginTop: '10px', background: '#ff9800', fontSize: '0.9rem' }} 
                  onClick={() => handleAction('ajouter_machine_type', { colorType: 'couleur' })}
                  disabled={(localPlayer?.laundryCarried?.couleur || 0) === 0}
                >
                  Ajouter 🔴
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Choisir le Programme :</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="action-btn" 
                  style={{ flex: 1, background: '#e0e0e0', color: '#333' }}
                  onClick={() => {
                    handleAction('lancer_machine_prog', { program: 'blanc' });
                    setShowMachineModal(false);
                  }}
                  disabled={((gameState.machineLingeCount?.blanc || 0) + (gameState.machineLingeCount?.couleur || 0)) === 0}
                >
                  Programme Blanc (90°)
                </button>
                <button 
                  className="action-btn" 
                  style={{ flex: 1, background: '#ff9800', color: '#fff' }}
                  onClick={() => {
                    handleAction('lancer_machine_prog', { program: 'couleur' });
                    setShowMachineModal(false);
                  }}
                  disabled={((gameState.machineLingeCount?.blanc || 0) + (gameState.machineLingeCount?.couleur || 0)) === 0}
                >
                  Programme Couleurs (40°)
                </button>
              </div>
            </div>

            <button className="action-btn" style={{ background: '#f44336', color: 'white', width: '100%' }} onClick={() => setShowMachineModal(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* MODALE MATCHA */}
      {showMatchaModal && (
        <div className="crepe-modal-overlay">
          <div className="crepe-modal" style={{ maxWidth: '400px' }}>
            {matchaStep === 1 && (
              <>
                <h2>🌿 Récolte d'Herbe</h2>
                <p>Coupez de l'herbe du jardin en hachant frénétiquement !</p>
                <div style={{ fontSize: '3rem', margin: '20px 0' }}>✂️🌿</div>
                <button 
                  className="action-btn" 
                  style={{ background: '#8bc34a', color: 'white', width: '100%', padding: '20px', userSelect: 'none' }}
                  onClick={() => {
                    if (grassClicks + 1 >= 10) {
                      setMatchaStep(2);
                    } else {
                      setGrassClicks(grassClicks + 1);
                    }
                  }}
                >
                  Hacher ! ({grassClicks}/10)
                </button>
              </>
            )}

            {matchaStep === 2 && (
              <>
                <h2>☢️ L'Alchimie</h2>
                <p>Faites fondre l'herbe au micro-ondes (maintenez appuyé).</p>
                <div 
                  className="pan-container"
                  style={{ background: '#eceff1', borderRadius: '20px', border: '5px solid #cfd8dc' }}
                  onMouseDown={() => setIsMelting(true)}
                  onMouseUp={() => setIsMelting(false)}
                  onMouseLeave={() => setIsMelting(false)}
                  onTouchStart={() => setIsMelting(true)}
                  onTouchEnd={() => setIsMelting(false)}
                >
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '80%', background: '#000', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ 
                      position: 'absolute', bottom: 0, left: 0, width: '100%', 
                      height: `${meltProgress}%`, background: '#76ff03',
                      transition: 'height 0.1s linear'
                    }}></div>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '3rem', opacity: isMelting ? 1 : 0.5 }}>
                      {isMelting ? '🔥' : '🧊'}
                    </div>
                  </div>
                </div>
                <div className="batter-progress-text" style={{ color: '#76ff03' }}>{Math.floor(meltProgress)}%</div>
              </>
            )}

            {matchaStep === 3 && (
              <>
                <h2>🍵 Prêt !</h2>
                <p>Le liquide (euh, le matcha) est prêt à être servi !</p>
                <div style={{ fontSize: '4rem', margin: '20px 0' }}>🍵</div>
                <button 
                  className="action-btn" 
                  style={{ background: '#cddc39', width: '100%', padding: '15px' }}
                  onClick={() => {
                    handleAction('preparer_matcha');
                    setShowMatchaModal(false);
                  }}
                >
                  Servir sur la table
                </button>
              </>
            )}

            <button className="action-btn" style={{ marginTop: '20px', background: 'transparent', color: '#f44336', border: '2px solid #f44336' }} onClick={() => setShowMatchaModal(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Rendu de la scène 3D */}
      <div style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}>
        <GameScene 
          players={players} 
          localId={socket.id} 
          onMove={handleMove} 
          gameState={gameState}
          kissAnim={kissAnim}
        />
      </div>
    </>
  );
}

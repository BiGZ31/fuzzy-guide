import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, Box, Html } from '@react-three/drei';
import * as THREE from 'three';

function Player({ data, isLocal, gameState }) {
  if (!data.role) return null;

  const color = data.role === 'Luke' ? '#7ec8e3' : '#ffb7c5'; // Bleu ciel & rose bonbon
  const darkColor = data.role === 'Luke' ? '#4a9ab5' : '#e0718a';

  return (
    <group position={[data.x, 0.5, data.z]}>
      {/* Corps carré low-poly mignon */}
      <mesh castShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[0.6, 0.7, 0.45]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Tête */}
      <mesh castShadow position={[0, 0.72, 0]}>
        <boxGeometry args={[0.55, 0.5, 0.5]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Joues */}
      <mesh position={[-0.25, 0.7, 0.22]}>
        <circleGeometry args={[0.09, 8]} />
        <meshBasicMaterial color="#ffb3c6" />
      </mesh>
      <mesh position={[0.25, 0.7, 0.22]}>
        <circleGeometry args={[0.09, 8]} />
        <meshBasicMaterial color="#ffb3c6" />
      </mesh>
      
      {/* Yeux mignons - points noirs */}
      <mesh position={[-0.12, 0.75, 0.26]}>
        <boxGeometry args={[0.07, 0.1, 0.04]} />
        <meshBasicMaterial color="#2c1810" />
      </mesh>
      <mesh position={[0.12, 0.75, 0.26]}>
        <boxGeometry args={[0.07, 0.1, 0.04]} />
        <meshBasicMaterial color="#2c1810" />
      </mesh>

      {/* Chapeau Luke / Nœud Lucie */}
      {data.role === 'Luke' && (
        <mesh castShadow position={[0, 1.05, 0]}>
          <boxGeometry args={[0.5, 0.15, 0.45]} />
          <meshToonMaterial color="#5c8a9e" />
        </mesh>
      )}
      {data.role === 'Lucie' && (
        <group position={[0.2, 1.03, 0.1]}>
          <mesh>
            <boxGeometry args={[0.25, 0.15, 0.12]} />
            <meshToonMaterial color="#e83f82" />
          </mesh>
        </group>
      )}

      {isLocal && (
        <mesh position={[0, 1.5, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.15, 0.3, 3]} />
          <meshBasicMaterial color="#ffe066" />
        </mesh>
      )}
      
      {/* Objets dans les mains (Luke) */}
      {data.role === 'Luke' && data.hasCrepe && (
        <group position={[0.3, 0.6, 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.04, 32]} />
            <meshStandardMaterial color="#ffca28" />
          </mesh>
        </group>
      )}
      {data.role === 'Luke' && data.hasMatcha && (
        <group position={[0.3, 0.6, 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
            <meshStandardMaterial color="#cddc39" />
          </mesh>
        </group>
      )}
      
      {/* Linge sale porté (Lucie) */}
      {data.role === 'Lucie' && (data.laundryCarried?.blanc > 0 || data.laundryCarried?.couleur > 0) && (
        <Box position={[0, 1.2, 0]} args={[0.6, 0.2 * ((data.laundryCarried?.blanc || 0) + (data.laundryCarried?.couleur || 0)), 0.6]}>
          <meshStandardMaterial color={data.laundryCarried?.couleur > data.laundryCarried?.blanc ? '#ffb74d' : '#ffffff'} />
        </Box>
      )}

      {/* Linge propre porté (Lucie) */}
      {data.role === 'Lucie' && data.cleanLaundryCarried > 0 && (
        <Box position={[0, 1.6, 0]} args={[0.6, 0.2 * data.cleanLaundryCarried, 0.6]}>
          <meshStandardMaterial color="#aed581" />
        </Box>
      )}

      {/* Énervée car gourmandise à 0 ! */}
      {data.role === 'Lucie' && gameState.gourmandiseLucie <= 0 && (
        <Html position={[0, 2.2, 0]} center zIndexRange={[100, 0]}>
          <div className="speech-bubble">
            J'ai faim ! LUKE ne m'aime plus, il ne me fait plus de crêpes... 💢
          </div>
        </Html>
      )}
    </group>
  );
}

function LaundryItem({ data }) {
  const meshRef = useRef();

  const types = ['sock', 'boxer', 'tshirt'];
  const type = types[data.id % types.length];
  let color = '#ffffff';
  if (data.colorType === 'blanc') {
    const whiteColors = ['#ffffff', '#f5f5f5', '#eeeeee'];
    color = whiteColors[data.id % whiteColors.length];
  } else {
    const brightColors = ['#81d4fa', '#ffb74d', '#a5d6a7', '#ef9a9a'];
    color = brightColors[data.id % brightColors.length];
  }
  const rotationY = (data.id % 4) * (Math.PI / 4);

  useFrame((state) => {
    meshRef.current.position.y = 0.2 + Math.sin(state.clock.elapsedTime * 3 + data.id) * 0.1;
  });

  return (
    <group ref={meshRef} position={[data.x, 0.2, data.z]} rotation={[0, rotationY, 0]}>
      {type === 'sock' && (
        <group>
          {/* Pied */}
          <mesh position={[0.1, 0, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.15, 8, 8]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* Cheville */}
          <mesh position={[-0.05, 0.1, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <capsuleGeometry args={[0.08, 0.15, 8, 8]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        </group>
      )}

      {type === 'boxer' && (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.1, 0.2]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* Trous pour les jambes (décoration) */}
          <mesh position={[-0.1, 0, 0.1]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.12]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0.1, 0, 0.1]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.12]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      )}

      {type === 'tshirt' && (
        <group>
          {/* Corps */}
          <mesh castShadow>
            <boxGeometry args={[0.25, 0.05, 0.3]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* Manches */}
          <mesh position={[-0.15, 0, -0.05]} rotation={[0, -Math.PI / 4, 0]} castShadow>
            <boxGeometry args={[0.1, 0.04, 0.1]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          <mesh position={[0.15, 0, -0.05]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <boxGeometry args={[0.1, 0.04, 0.1]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Environment({ gameState }) {
  return (
    <>
      {/* Murs "Sims" */}
      {/* Murs "Sims" en Crème pastel */}
      {/* Murs extérieurs pleins (Nord et Est) car ils ne bloquent pas la vue depuis la caméra (-10, 10, 10) */}
      <Box position={[0, 1.25, -8.1]} args={[16.2, 2.5, 0.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#fff3e0" roughness={0.8} />
      </Box>
      <Box position={[8.1, 1.25, 0]} args={[0.2, 2.5, 16.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#fff3e0" roughness={0.8} />
      </Box>

      {/* Murs extérieurs demi-hauteur (Sud et Ouest) car ils bloquent la vue */}
      <Box position={[0, 0.4, 8.1]} args={[16.2, 0.8, 0.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#fff3e0" roughness={0.8} />
      </Box>
      <Box position={[-8.1, 0.4, 0]} args={[0.2, 0.8, 16.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#fff3e0" roughness={0.8} />
      </Box>
      
      {/* Demi-murs intérieurs avec portes */}
      
      {/* Séparation Salle de Bain / Séjour (Vertical X = -1) */}
      <Box position={[-1, 0.4, -6.6]} args={[0.2, 0.8, 3]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffe0b2" roughness={0.8} />
      </Box>
      <Box position={[-1, 0.4, -2.55]} args={[0.2, 0.8, 1.1]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffe0b2" roughness={0.8} />
      </Box>
      {/* Porte ouverte SDE - s'ouvre vers l'intérieur SDE (vers la gauche) */}
      <Box position={[-1.7, 1, -4.1]} rotation={[0, Math.PI / 2, 0]} args={[0.1, 2, 0.8]} castShadow>
        <meshStandardMaterial color="#ffcc80" />
      </Box>

      {/* Séparation Chambre / Séjour (Vertical X = -1) avec Porte de 2m près de l'armoire */}
      {/* Mur après la porte (de Z=0 à Z=8) */}
      <Box position={[-1, 0.4, 4]} args={[0.2, 0.8, 8]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffe0b2" roughness={0.8} />
      </Box>

      {/* Porte ouverte Chambre - s'ouvre vers l'intérieur chambre (vers la gauche) */}
      <Box position={[-1.7, 1, -0.1]} rotation={[0, Math.PI / 2, 0]} args={[0.1, 2, 0.8]} castShadow>
        <meshStandardMaterial color="#ffcc80" />
      </Box>

      {/* Séparation Chambre / SDE (Horizontal Z = -2) */}
      <Box position={[-4.5, 0.4, -2]} args={[7, 0.8, 0.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffe0b2" roughness={0.8} />
      </Box>

      {/* Sas Machine à Laver (Vertical X = 5.5) */}
      <Box position={[5.5, 0.4, -6]} args={[0.2, 0.8, 4]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffe0b2" roughness={0.8} />
      </Box>

      {/* Cuisine / Kitchen Détaillée */}
      <group position={[1, 0, -7]}>
        {/* Meuble bas */}
        <Box position={[0, 0.9, 0]} args={[3, 1.8, 2]} castShadow>
          <meshStandardMaterial color="#fff59d" roughness={0.6} />
        </Box>
        {/* Plan de travail (Marbre) */}
        <Box position={[0, 1.85, 0]} args={[3.1, 0.1, 2.1]} castShadow>
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </Box>
        {/* Mini Frigo / Réfrigérateur */}
        <Box position={[2, 0.9, 0]} args={[1, 1.8, 2]} castShadow>
          <meshStandardMaterial color="#eeeeee" roughness={0.2} metalness={0.5} />
        </Box>
        {/* Poignée du frigo */}
        <Box position={[1.6, 1.2, 1.05]} args={[0.1, 0.5, 0.05]}>
          <meshStandardMaterial color="#999999" />
        </Box>

        {/* Machine à Crêpe Pro (Billig) */}
        <group position={[-0.5, 1.9, 0]}>
          {/* Socle */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.4, 0.45, 0.1, 32]} />
            <meshStandardMaterial color="#424242" metalness={0.8} />
          </mesh>
          {/* Plaque chauffante */}
          <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.02, 32]} />
            <meshStandardMaterial color="#111111" roughness={0.9} />
          </mesh>
        </group>
        
        <Html position={[0, 2.5, 0]} center>
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.9)', 
            color: '#5d4037', 
            padding: '6px 12px', 
            borderRadius: '15px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ marginBottom: '4px', color: '#fbc02d' }}>
              🥞 Machine à Crêpes
            </div>
            {gameState.stoveCrepeState === 'idle' && 'Vide'}
            {gameState.stoveCrepeState === 'cooking' && (
              <>
                Cuisson...
                <div style={{ width: '100%', height: '6px', background: '#e0e0e0', marginTop: '4px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${gameState.stoveCrepeTimer}%`, height: '100%', background: '#ffca28' }}></div>
                </div>
              </>
            )}
            {gameState.stoveCrepeState === 'ready' && <span style={{ color: '#66bb6a' }}>Prête !</span>}
            {gameState.stoveCrepeState === 'burnt' && <span style={{ color: '#ef5350' }}>Brûlée ! 🔥</span>}
          </div>
        </Html>
      </group>

      {/* Matcha */}
      {gameState.matchaPose && (
        <group position={[1.5, 0.65, 6.2]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
            <meshStandardMaterial color="#cddc39" />
          </mesh>
        </group>
      )}

      {/* Crêpe sur la table */}
      {gameState.crepePosee && (
        <group position={[1.5, 0.62, 6.8]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 32]} />
            <meshStandardMaterial color="#ffca28" />
          </mesh>
        </group>
      )}

      {/* Lit / Bed (Rose Pastel) */}
      <Box position={[-6, 0.5, 5]} args={[3, 1, 4]} castShadow>
        <meshStandardMaterial color="#f8bbd0" roughness={0.4} />
      </Box>

      {/* Canapé / Sofa (Orange Pastel) - Déplacé vers le bas pour dégager la porte */}
      <group position={[-0.5, 0, 6.5]}>
        {/* Assise */}
        <Box position={[0, 0.4, 0]} args={[1.5, 0.8, 3]} castShadow>
          <meshStandardMaterial color="#ffe0b2" roughness={0.7} />
        </Box>
        {/* Dossier */}
        <Box position={[-0.6, 1.0, 0]} args={[0.3, 1.2, 3]} castShadow>
          <meshStandardMaterial color="#ffcc80" roughness={0.7} />
        </Box>
        {/* Accoudoirs */}
        <Box position={[0, 0.8, -1.6]} args={[1.5, 0.8, 0.3]} castShadow>
          <meshStandardMaterial color="#ffcc80" roughness={0.7} />
        </Box>
        <Box position={[0, 0.8, 1.6]} args={[1.5, 0.8, 0.3]} castShadow>
          <meshStandardMaterial color="#ffcc80" roughness={0.7} />
        </Box>
      </group>

      {/* Table Basse devant le canapé */}
      <Box position={[1.5, 0.3, 6.5]} args={[1.5, 0.6, 2]} castShadow>
        <meshStandardMaterial color="#d7ccc8" roughness={0.7} />
      </Box>

      {/* Armoire / Wardrobe (Bleu Pastel) - Déplacée dans la chambre */}
      <Box position={[-4.5, 1.5, -1.5]} args={[3, 3, 1]} castShadow>
        <meshStandardMaterial color="#bbdefb" roughness={0.5} />
        {/* Poignées d'armoire */}
        <Box position={[-0.2, 0, 0.51]} args={[0.1, 0.4, 0.1]}>
          <meshStandardMaterial color="#fff" />
        </Box>
        <Box position={[0.2, 0, 0.51]} args={[0.1, 0.4, 0.1]}>
          <meshStandardMaterial color="#fff" />
        </Box>
      </Box>

      {/* Salle de Bain / Bathroom */}
      <group position={[-5.5, 0, -5]}>
        {/* Douche Vitrée / Shower */}
        <group position={[3.5, 0, -2]}>
          {/* Receveur de douche */}
          <Box position={[0, 0.1, 0]} args={[1.5, 0.2, 1.5]} castShadow>
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </Box>
          {/* Vitres */}
          <Box position={[0, 1.2, 0.75]} args={[1.5, 2, 0.05]} castShadow>
            <meshStandardMaterial color="#e3f2fd" roughness={0.1} transparent opacity={0.4} />
          </Box>
          <Box position={[-0.75, 1.2, 0]} args={[0.05, 2, 1.5]} castShadow>
            <meshStandardMaterial color="#e3f2fd" roughness={0.1} transparent opacity={0.4} />
          </Box>
          {/* Pommeau de douche */}
          <mesh position={[0, 2, -0.6]} rotation={[Math.PI / 4, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.05, 16]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.8} />
          </mesh>
          <mesh position={[0, 1.5, -0.7]}>
            <cylinderGeometry args={[0.02, 0.02, 1, 16]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.8} />
          </mesh>
        </group>
        
        {/* Toilettes / Toilet */}
        <group position={[-2, 0, -2.5]} rotation={[0, 0, 0]}>
          {/* Base / Cuvette */}
          <Box position={[0, 0.3, 0]} args={[0.5, 0.6, 0.7]} castShadow>
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </Box>
          {/* Réservoir d'eau */}
          <Box position={[0, 0.8, -0.2]} args={[0.6, 0.5, 0.3]} castShadow>
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </Box>
          {/* Bouton chasse d'eau */}
          <Box position={[0, 1.05, -0.2]} args={[0.15, 0.05, 0.1]} castShadow>
            <meshStandardMaterial color="#e0e0e0" metalness={0.8} />
          </Box>
          {/* Abattant */}
          <Box position={[0, 0.62, 0.1]} args={[0.5, 0.05, 0.5]} castShadow>
            <meshStandardMaterial color="#eeeeee" roughness={0.2} />
          </Box>
        </group>
      </group>

      {/* Machine à Laver (Rose Pastel) */}
      <Box position={[7.5, 0.5, -5]} rotation={[0, -Math.PI / 2, 0]} args={[1.5, 1.5, 1.5]} castShadow>
        <meshStandardMaterial color={gameState.machineState === 'finished' ? '#c5e1a5' : '#f8bbd0'} roughness={0.5} />
        <mesh position={[0, 0, 0.76]}>
          <circleGeometry args={[0.5, 32]} />
          <meshStandardMaterial color={gameState.machineState === 'washing' ? '#03a9f4' : '#2196f3'} />
        </mesh>
        
        {/* Chargement de la machine au-dessus */}
        <Html position={[0, 2.0, 0]} center>
          <div style={{ 
            background: 'rgba(255,255,255,0.9)', 
            color: '#5d4037', 
            padding: '6px 12px', 
            borderRadius: '15px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            {gameState.machineState === 'idle' && `Lave-linge: ${(gameState.machineLingeCount?.blanc || 0) + (gameState.machineLingeCount?.couleur || 0)}/9`}
            {gameState.machineState === 'broken' && <span style={{ color: '#f44336' }}>En Panne ! 🔧</span>}
            {gameState.machineState === 'washing' && (
              <>
                Lavage... 🫧
                <div style={{ width: '100%', height: '6px', background: '#e0e0e0', marginTop: '4px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${gameState.machineTimer}%`, height: '100%', background: '#64b5f6' }}></div>
                </div>
              </>
            )}
            {gameState.machineState === 'finished' && `Propre: ${gameState.cleanLaundryCount} ✨`}
          </div>
        </Html>
      </Box>

      {/* Meuble TV (Piratage) */}
      <group position={[7.5, 0, 6.5]} rotation={[0, -Math.PI / 2, 0]}>
        {/* Meuble bas (Console) */}
        <Box position={[0, 0.25, 0]} args={[2.5, 0.5, 0.6]} castShadow>
          <meshStandardMaterial color="#eeeeee" roughness={0.5} />
        </Box>
        
        {/* Écran TV Plat */}
        <group position={[0, 1.2, -0.2]}>
          {/* Pied TV */}
          <Box position={[0, -0.5, 0.1]} args={[0.6, 0.05, 0.3]} castShadow>
            <meshStandardMaterial color="#111111" />
          </Box>
          <Box position={[0, -0.25, 0.15]} args={[0.1, 0.5, 0.05]} castShadow>
            <meshStandardMaterial color="#111111" />
          </Box>
          {/* Écran */}
          <Box position={[0, 0, 0]} args={[2.2, 1.2, 0.05]} castShadow>
            <meshStandardMaterial 
              color="#000000" 
              emissive={gameState.hackEventActive ? "#ff0000" : "#111111"} 
              emissiveIntensity={gameState.hackEventActive ? 0.8 : 0} 
            />
          </Box>
        </group>
        
        {/* Alerte de Piratage */}
        {gameState.hackEventActive && (
          <Html position={[0, 2, 0]} center>
            <div style={{
              background: '#f44336', color: 'white', padding: '5px 10px', borderRadius: '5px',
              fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap',
              animation: 'pulse 1s infinite'
            }}>
              ⚠️ {Math.ceil(gameState.hackEventTimer / 30)}s
            </div>
          </Html>
        )}
      </group>
    </>
  );
}

function Ground({ onMove }) {
  const handlePointerDown = (e) => {
    e.stopPropagation();
    onMove(e.point.x, e.point.z);
  };

  return (
    <group>
      {/* Sol intérieur uniquement - taille de la maison (16x16) */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
        onPointerDown={handlePointerDown}
      >
        <planeGeometry args={[16, 16]} />
        <meshToonMaterial color="#f9e4b7" />
      </mesh>
      {/* Motif parquet low-poly - couvre uniquement l'intérieur */}
      {Array.from({ length: 4 }, (_, i) =>
        Array.from({ length: 4 }, (_, j) => (
          <mesh
            key={`${i}-${j}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[(i - 1.5) * 4, 0.005, (j - 1.5) * 4]}
          >
            <planeGeometry args={[3.8, 3.8]} />
            <meshToonMaterial color={(i + j) % 2 === 0 ? '#f5d89a' : '#f0cb85'} />
          </mesh>
        ))
      ).flat()}
    </group>
  );
}

function KissAnimation({ position }) {
  return (
    <Html position={[position.x, 2, position.z]} center>
      <div className="kiss-anim">❤️</div>
    </Html>
  );
}

function CameraFollower({ localPlayer }) {
  useFrame((state) => {
    if (localPlayer) {
      // Offset isometrico: decale de (-10, 10, 10) par rapport au joueur
      const targetPos = new THREE.Vector3(localPlayer.x - 10, 10, localPlayer.z + 10);
      const lookAtPos = new THREE.Vector3(localPlayer.x, 0, localPlayer.z);
      
      state.camera.position.lerp(targetPos, 0.1);
      state.camera.lookAt(lookAtPos);
    }
  });
  return null;
}

export default function GameScene({ players, localId, onMove, gameState, kissAnim }) {
  const localPlayer = players[localId];

  return (
    <Canvas shadows>
      <OrthographicCamera 
        makeDefault 
        position={[-10, 10, 10]} 
        zoom={40} 
        near={-100} 
        far={100}
      />
      
      <CameraFollower localPlayer={localPlayer} />
      
      <ambientLight intensity={1.1} color="#fff5e6" />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={1.2} 
        color="#ffe5b4"
        castShadow 
        shadow-mapSize={[1024, 1024]}
      />
      {/* Doux remplissage des ombres */}
      <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#d4f0ff" />

      <Ground onMove={onMove} />
      <Environment gameState={gameState} />

      {/* Rendu du linge par terre */}
      {gameState.laundriesOnFloor && gameState.laundriesOnFloor.map(l => (
        <LaundryItem key={l.id} data={l} />
      ))}

      {Object.values(players).map(p => (
        <Player key={p.id} data={p} isLocal={p.id === localId} gameState={gameState} />
      ))}

      {kissAnim && <KissAnimation position={{ x: kissAnim.x, z: kissAnim.z }} />}
    </Canvas>
  );
}

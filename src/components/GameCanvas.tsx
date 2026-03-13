import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Bullet, Enemy, Item, Particle, FloatingText, GameState } from '../types';
import { checkCollision as collisionUtil } from '../utils/gameEngine';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const PLAYER_SIZE = 40;
const BOSS_SCORE_THRESHOLD = 5000;

interface Star { x: number; y: number; size: number; speed: number; color: string; }
interface Shockwave { x: number; y: number; radius: number; maxRadius: number; color: string; alpha: number; }

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('START');
  const [isBossActive, setIsBossActive] = useState(false);

  // Engine Refs
  const scoreRef = useRef(0);
  const gameStateRef = useRef<GameState>('START');
  const playerRef = useRef<Player & { flicker: number }>({
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 100,
    width: PLAYER_SIZE, height: PLAYER_SIZE, speed: 5, hp: 100, maxHp: 100, power: 1, bombs: 3, flicker: 0,
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<(Enemy & { flicker: number })[]>([]);
  const bossRef = useRef<(Enemy & { flicker: number }) | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  
  const lastShotTimeRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const shakeRef = useRef(0);
  const bossSpawnedRef = useRef(false);

  const syncState = useCallback(() => {
    setScore(scoreRef.current);
    setGameState(gameStateRef.current);
    setIsBossActive(!!bossRef.current);
  }, []);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    gameStateRef.current = 'PLAYING';
    bossSpawnedRef.current = false;
    playerRef.current = {
      x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 100,
      width: PLAYER_SIZE, height: PLAYER_SIZE, speed: 5, hp: 100, maxHp: 100, power: 1, bombs: 3, flicker: 0,
    };
    bulletsRef.current = []; enemiesRef.current = []; bossRef.current = null;
    itemsRef.current = []; particlesRef.current = []; shockwavesRef.current = [];
    floatingTextsRef.current = []; shakeRef.current = 0;
    syncState();
  }, [syncState]);

  const addFloatingText = (x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({ x, y, text, life: 1, color });
  };

  const createExplosion = (x: number, y: number, count: number, color: string, isBomb: boolean = false) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isBomb ? 18 : 6) + 1;
      particlesRef.current.push({
        x, y, width: Math.random() * 4 + 1, height: 0,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        speed: 0, life: 1, color
      });
    }
    shockwavesRef.current.push({ x, y, radius: 0, maxRadius: isBomb ? 500 : 60, color, alpha: 1 });
    shakeRef.current = Math.max(shakeRef.current, isBomb ? 15 : 5);
  };

  const useBomb = useCallback(() => {
    const p = playerRef.current;
    if (p.bombs > 0 && p.hp > 0 && gameStateRef.current === 'PLAYING') {
      p.bombs--;
      createExplosion(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 120, '#fff', true);
      enemiesRef.current.forEach(e => { scoreRef.current += 50; addFloatingText(e.x, e.y, '+50', '#ff0'); });
      enemiesRef.current = [];
      bulletsRef.current = bulletsRef.current.filter(b => b.isPlayerBullet); 
      if (bossRef.current) { bossRef.current.hp -= 50; bossRef.current.flicker = 10; }
      syncState();
    }
  }, [syncState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if ((gameStateRef.current !== 'PLAYING') && (e.code === 'Space' || e.code === 'Enter')) resetGame();
      if (gameStateRef.current === 'PLAYING' && e.code === 'KeyX') useBomb();
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    const handleBlur = () => { Object.keys(keysRef.current).forEach(k => keysRef.current[k] = false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('blur', handleBlur); };
  }, [resetGame, useBomb]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    starsRef.current = Array.from({length: 100}, () => ({ x: Math.random()*CANVAS_WIDTH, y: Math.random()*CANVAS_HEIGHT, size: Math.random()*2, speed: Math.random()*3+1, color: '#fff' }));

    const update = (t: number) => {
      const dt = lastFrameTimeRef.current ? Math.min(2, (t - lastFrameTimeRef.current) / 16.67) : 1;
      lastFrameTimeRef.current = t;

      starsRef.current.forEach(s => { s.y += s.speed * dt; if (s.y > CANVAS_HEIGHT) s.y = 0; });

      if (gameStateRef.current !== 'PLAYING') { syncState(); return; }

      const p = playerRef.current;
      if (p.hp <= 0 && p.flicker === -1) { gameStateRef.current = 'GAMEOVER'; syncState(); return; }

      // Player Movement
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p.y -= p.speed * dt;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p.y += p.speed * dt;
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p.x -= p.speed * dt;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p.x += p.speed * dt;
      p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
      p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));

      // Player Shooting
      if (t - lastShotTimeRef.current > 120) {
        const px = p.x + p.width/2;
        const dmg = 10;
        bulletsRef.current.push({ x: px-4, y: p.y, width: 8, height: 20, speed: 14, damage: dmg, isPlayerBullet: true });
        if (p.power >= 2) {
          bulletsRef.current.push({ x: px-20, y: p.y+10, width: 8, height: 20, speed: 14, damage: dmg, isPlayerBullet: true });
          bulletsRef.current.push({ x: px+12, y: p.y+10, width: 8, height: 20, speed: 14, damage: dmg, isPlayerBullet: true });
        }
        lastShotTimeRef.current = t;
      }

      // Enemy Spawning
      if (!bossRef.current && t - lastSpawnTimeRef.current > 1000 - Math.min(800, scoreRef.current/50)) {
        enemiesRef.current.push({ x: Math.random()*(CANVAS_WIDTH-40), y: -40, width: 40, height: 40, speed: 2 + Math.random(), hp: 20, maxHp: 20, type: 'basic', lastShotTime: t, flicker: 0 });
        lastSpawnTimeRef.current = t;
      }

      // Boss Spawning
      if (scoreRef.current >= BOSS_SCORE_THRESHOLD && !bossSpawnedRef.current) {
        bossSpawnedRef.current = true;
        bossRef.current = { x: CANVAS_WIDTH/2 - 60, y: -120, width: 120, height: 80, speed: 1.5, hp: 1000, maxHp: 1000, type: 'boss', lastShotTime: 0, flicker: 0 };
      }

      // Bullets Update
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.y += (b.isPlayerBullet ? -b.speed : b.speed) * dt;
        if (b.angle) b.x += Math.sin(b.angle) * b.speed * dt;
        
        if (!b.isPlayerBullet && p.hp > 0 && collisionUtil(b, p)) {
          p.hp -= 10; p.flicker = 10; shakeRef.current = 5;
          createExplosion(b.x, b.y, 5, '#fff');
          if (p.hp <= 0) { createExplosion(p.x+20, p.y+20, 50, '#0ff'); p.flicker = -1; }
          return false;
        }
        return b.y > -50 && b.y < CANVAS_HEIGHT + 50;
      });

      // Enemies Update
      enemiesRef.current = enemiesRef.current.filter(e => {
        e.y += e.speed * dt;
        if (e.flicker > 0) e.flicker--;

        // Enemy Shoot
        if (t - e.lastShotTime > 2000 && e.y > 0 && e.y < 400) {
          const angle = Math.atan2(p.y - e.y, (p.x+20) - (e.x+20));
          bulletsRef.current.push({ x: e.x+16, y: e.y+40, width: 8, height: 8, speed: 4, damage: 10, isPlayerBullet: false, angle });
          e.lastShotTime = t;
        }

        // Enemy Hit by Player Bullet
        bulletsRef.current.forEach(b => {
          if (b.isPlayerBullet && b.y > -50 && collisionUtil(b, e)) {
            e.hp -= b.damage; e.flicker = 5; b.y = -1000;
            if (e.hp <= 0) {
              scoreRef.current += 100; addFloatingText(e.x, e.y, '+100', '#0ff');
              createExplosion(e.x+20, e.y+20, 15, '#f50');
              if (Math.random() < 0.15) itemsRef.current.push({ x: e.x, y: e.y, width: 24, height: 24, speed: 1.5, type: Math.random() < 0.5 ? 'power' : (Math.random() < 0.5 ? 'health' : 'bomb') });
            }
          }
        });

        if (p.hp > 0 && collisionUtil(e, p)) {
          p.hp -= 20; p.flicker = 15; e.hp = 0;
          createExplosion(e.x+20, e.y+20, 20, '#f50');
          if (p.hp <= 0) { createExplosion(p.x+20, p.y+20, 50, '#0ff'); p.flicker = -1; }
        }
        return e.y < CANVAS_HEIGHT && e.hp > 0;
      });

      // Boss Update
      if (bossRef.current) {
        const b = bossRef.current;
        if (b.y < 80) b.y += 0.5 * dt;
        else {
          b.x += b.speed * dt;
          if (b.x <= 0 || b.x > CANVAS_WIDTH - b.width) b.speed *= -1;
          if (t - b.lastShotTime > 1000) {
            for(let i=-2; i<=2; i++) bulletsRef.current.push({ x: b.x+b.width/2, y: b.y+b.height, width: 10, height: 10, speed: 4, damage: 20, isPlayerBullet: false, angle: (Math.PI/2) + i*0.3 });
            b.lastShotTime = t;
          }
        }
        if (b.flicker > 0) b.flicker--;
        bulletsRef.current.forEach(pb => {
          if (pb.isPlayerBullet && pb.y > -50 && collisionUtil(pb, b)) {
            b.hp -= pb.damage; b.flicker = 3; pb.y = -1000;
            if (b.hp <= 0) {
              scoreRef.current += 10000;
              createExplosion(b.x+b.width/2, b.y+b.height/2, 100, '#ff0', true);
              gameStateRef.current = 'WON'; bossRef.current = null;
            }
          }
        });
      }

      // Items Update
      itemsRef.current = itemsRef.current.filter(item => {
        item.y += item.speed * dt;
        if (p.hp > 0 && collisionUtil(item, p)) {
          if (item.type === 'power') { p.power = Math.min(p.power+1, 3); addFloatingText(item.x, item.y, 'POWER UP!', '#f0f'); }
          if (item.type === 'health') { p.hp = Math.min(p.hp+30, 100); addFloatingText(item.x, item.y, '+30 HP', '#0f0'); }
          if (item.type === 'bomb') { p.bombs++; addFloatingText(item.x, item.y, '+1 BOMB', '#f80'); }
          return false;
        }
        return item.y < CANVAS_HEIGHT;
      });

      // VFX Update
      particlesRef.current = particlesRef.current.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt; return p.life > 0; });
      shockwavesRef.current = shockwavesRef.current.filter(s => { s.radius += 5 * dt; s.alpha -= 0.02 * dt; return s.alpha > 0; });
      floatingTextsRef.current = floatingTextsRef.current.filter(ft => { ft.y -= 1 * dt; ft.life -= 0.02 * dt; return ft.life > 0; });
      if (shakeRef.current > 0) shakeRef.current *= 0.9;
      if (p.flicker > 0) p.flicker--;

      syncState();
    };

    const draw = () => {
      ctx.save();
      if (shakeRef.current > 0.5) ctx.translate((Math.random()-0.5)*shakeRef.current, (Math.random()-0.5)*shakeRef.current);
      
      // Background
      const g = ctx.createLinearGradient(0,0,0,CANVAS_HEIGHT); g.addColorStop(0, '#000b1e'); g.addColorStop(1, '#001a3d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Stars
      ctx.fillStyle = '#fff'; starsRef.current.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));

      if (gameStateRef.current === 'START') {
        ctx.textAlign = 'center'; ctx.fillStyle = '#0ff'; ctx.font = 'bold 45px Arial'; ctx.shadowBlur = 15; ctx.shadowColor = '#0ff';
        ctx.fillText('WARPLANE 1945', CANVAS_WIDTH/2, 250);
        ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.shadowBlur = 0;
        if (Math.floor(Date.now()/500)%2===0) ctx.fillText('PRESS SPACE TO START', CANVAS_WIDTH/2, 400);
        ctx.restore(); return;
      }

      // Draw Bullets
      bulletsRef.current.forEach(b => {
        ctx.fillStyle = b.isPlayerBullet ? '#0ff' : '#f44';
        ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
        if (b.isPlayerBullet) { ctx.beginPath(); ctx.ellipse(b.x+b.width/2, b.y+b.height/2, b.width/2, b.height/2, 0, 0, Math.PI*2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(b.x+b.width/2, b.y+b.height/2, b.width/2, 0, Math.PI*2); ctx.fill(); }
      });
      ctx.shadowBlur = 0;

      // Draw Enemies
      enemiesRef.current.forEach(e => {
        ctx.save(); ctx.translate(e.x+20, e.y+20); if (e.flicker > 0) ctx.filter = 'brightness(300%)';
        ctx.fillStyle = '#9b2226'; ctx.beginPath(); ctx.moveTo(0,15); ctx.lineTo(15,-10); ctx.lineTo(5,-15); ctx.lineTo(-5,-15); ctx.lineTo(-15,-10); ctx.fill();
        ctx.restore();
      });

      // Draw Boss
      if (bossRef.current) {
        const b = bossRef.current; ctx.save(); ctx.translate(b.x+b.width/2, b.y+b.height/2); if (b.flicker > 0) ctx.filter = 'brightness(200%)';
        ctx.fillStyle = '#212529'; ctx.beginPath(); ctx.moveTo(0,-40); ctx.lineTo(60,-20); ctx.lineTo(45,30); ctx.lineTo(0,40); ctx.lineTo(-45,30); ctx.lineTo(-60,-20); ctx.fill();
        ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill(); ctx.restore();
      }

      // Draw Items
      itemsRef.current.forEach(item => {
        ctx.fillStyle = item.type === 'power' ? '#f0f' : item.type === 'health' ? '#0f0' : '#f80';
        ctx.beginPath(); ctx.arc(item.x+12, item.y+12, 12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign='center'; ctx.fillText(item.type[0].toUpperCase(), item.x+12, item.y+16);
      });

      // Draw Player
      const p = playerRef.current;
      if (p.hp > 0 && (p.flicker <= 0 || Math.floor(Date.now()/50)%2 === 0)) {
        ctx.save(); ctx.translate(p.x+20, p.y+20);
        // Flame
        ctx.fillStyle = `rgba(255, ${100+Math.random()*155}, 0, 0.8)`;
        ctx.beginPath(); ctx.moveTo(-5, 15); ctx.lineTo(5, 15); ctx.lineTo(0, 25+Math.random()*10); ctx.fill();
        // Body
        ctx.fillStyle = '#023e8a'; ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(20,10); ctx.lineTo(15,15); ctx.lineTo(0,5); ctx.lineTo(-15,15); ctx.lineTo(-20,10); ctx.fill();
        ctx.fillStyle = '#e0e1dd'; ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(8,0); ctx.lineTo(5,15); ctx.lineTo(-5,15); ctx.lineTo(-8,0); ctx.fill();
        ctx.restore();
      }

      // VFX
      particlesRef.current.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.width, 0, Math.PI*2); ctx.fill(); });
      shockwavesRef.current.forEach(s => { ctx.globalAlpha = s.alpha; ctx.strokeStyle = s.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2); ctx.stroke(); });
      floatingTextsRef.current.forEach(ft => { ctx.globalAlpha = ft.life; ctx.fillStyle = ft.color; ctx.font = 'bold 16px Arial'; ctx.fillText(ft.text, ft.x, ft.y); });
      ctx.globalAlpha = 1; ctx.restore();

      // UI
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,CANVAS_WIDTH, 40);
      ctx.fillStyle = '#fff'; ctx.font = '18px Arial'; ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${scoreRef.current}`, 10, 28);
      ctx.fillText(`BOMBS: ${p.bombs}`, 150, 28);
      ctx.fillStyle = p.hp > 30 ? '#0f0' : '#f00'; ctx.fillRect(350, 15, p.hp, 12);
      ctx.strokeStyle = '#fff'; ctx.strokeRect(350, 15, 100, 12);

      if (bossRef.current) {
        ctx.fillStyle = '#f00'; ctx.fillRect(CANVAS_WIDTH/2 - 100, 50, 200 * (bossRef.current.hp / 1000), 10);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(CANVAS_WIDTH/2 - 100, 50, 200, 10);
      }

      if (gameStateRef.current === 'GAMEOVER' || gameStateRef.current === 'WON') {
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
        ctx.textAlign = 'center'; ctx.fillStyle = gameStateRef.current === 'WON' ? '#0f0' : '#f00'; ctx.font = 'bold 40px Arial';
        ctx.fillText(gameStateRef.current === 'WON' ? 'MISSION COMPLETE' : 'GAME OVER', CANVAS_WIDTH/2, 300);
        ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.fillText(`FINAL SCORE: ${scoreRef.current}`, CANVAS_WIDTH/2, 360);
        ctx.fillText('PRESS SPACE TO RESTART', CANVAS_WIDTH/2, 420);
      }
    };

    let frameId: number;
    const loop = (t: number) => { update(t); draw(); frameId = requestAnimationFrame(loop); };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [syncState, resetGame]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000', fontFamily: 'Arial' }}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ border: '4px solid #333', borderRadius: '8px', boxShadow: '0 0 20px rgba(0,255,255,0.2)' }} />
    </div>
  );
};

export default GameCanvas;

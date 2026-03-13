import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Bullet, Enemy, Item, Particle, FloatingText, GameState } from '../types';

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

  const scoreRef = useRef(0);
  const gameStateRef = useRef<GameState>('START');
  const isBossActiveRef = useRef(false);
  const bossSpawnedRef = useRef(false);
  
  const playerRef = useRef<Player & { flicker: number }>({
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2,
    y: CANVAS_HEIGHT - 100,
    width: PLAYER_SIZE, height: PLAYER_SIZE,
    speed: 5, hp: 100, maxHp: 100, power: 1, bombs: 3, flicker: 0,
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<(Enemy & { flicker: number })[]>([]);
  const bossRef = useRef<(Enemy & { flicker: number }) | null>(null);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  
  const lastShotTimeRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const shakeRef = useRef<number>(0);

  const syncState = useCallback(() => {
    setScore(scoreRef.current);
    setGameState(gameStateRef.current);
    setIsBossActive(isBossActiveRef.current);
  }, []);

  const checkCollision = (obj1: any, obj2: any, margin: number = 0) => {
    return (
      obj1.x + margin < obj2.x + obj2.width - margin &&
      obj1.x + obj1.width - margin > obj2.x + margin &&
      obj1.y + margin < obj2.y + obj2.height - margin &&
      obj1.y + obj1.height - margin > obj2.y + margin
    );
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

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    gameStateRef.current = 'PLAYING';
    isBossActiveRef.current = false;
    bossSpawnedRef.current = false;
    playerRef.current = {
      x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 100,
      width: PLAYER_SIZE, height: PLAYER_SIZE, speed: 5, hp: 100, maxHp: 100, power: 1, bombs: 3, flicker: 0,
    };
    bulletsRef.current = []; enemiesRef.current = []; bossRef.current = null;
    particlesRef.current = []; shockwavesRef.current = [];
    floatingTextsRef.current = []; shakeRef.current = 0;
    syncState();
  }, [syncState]);

  const useBomb = useCallback(() => {
    const player = playerRef.current;
    if (player.bombs > 0 && player.hp > 0 && gameStateRef.current === 'PLAYING') {
      player.bombs--;
      createExplosion(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 100, '#fff', true);
      scoreRef.current += enemiesRef.current.length * 50;
      enemiesRef.current = [];
      bulletsRef.current = bulletsRef.current.filter(b => b.isPlayerBullet); 
      if (bossRef.current) { bossRef.current.hp -= 50; bossRef.current.flicker = 10; }
      syncState();
    }
  }, [syncState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      keysRef.current[e.code] = true; 
      if (gameStateRef.current === 'START' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ')) resetGame();
      else if ((gameStateRef.current === 'WON' || gameStateRef.current === 'GAMEOVER') && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyR')) resetGame();
      else if (gameStateRef.current === 'PLAYING' && e.code === 'KeyX') useBomb(); 
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [resetGame, useBomb]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars: Star[] = [];
    for (let i = 0; i < 100; i++) {
      stars.push({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT, size: Math.random() * 2, speed: Math.random() * 2 + 1, color: '#fff' });
    }

    let animationFrameId: number;

    const update = (timestamp: number) => {
      const dt = lastFrameTimeRef.current ? Math.min(2, (timestamp - lastFrameTimeRef.current) / 16.67) : 1;
      lastFrameTimeRef.current = timestamp;

      stars.forEach(s => { s.y += s.speed * dt; if (s.y > CANVAS_HEIGHT) s.y = 0; });

      if (gameStateRef.current !== 'PLAYING') { syncState(); return; }

      const p = playerRef.current;
      if (p.hp <= 0) { gameStateRef.current = 'GAMEOVER'; syncState(); return; }

      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p.y -= p.speed * dt;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p.y += p.speed * dt;
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p.x -= p.speed * dt;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p.x += p.speed * dt;
      p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
      p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));

      if (keysRef.current['Space'] || keysRef.current['KeyZ']) {
        if (timestamp - lastShotTimeRef.current > 120) {
          const px = p.x + p.width/2;
          bulletsRef.current.push({ x: px-4, y: p.y, width: 8, height: 20, speed: 12, damage: 10, isPlayerBullet: true });
          if (p.power >= 2) bulletsRef.current.push({ x: px-20, y: p.y+10, width: 8, height: 20, speed: 12, damage: 10, isPlayerBullet: true });
          if (p.power >= 3) bulletsRef.current.push({ x: px+12, y: p.y+10, width: 8, height: 20, speed: 12, damage: 10, isPlayerBullet: true });
          lastShotTimeRef.current = timestamp;
        }
      }

      if (!bossRef.current && timestamp - lastSpawnTimeRef.current > 1000) {
        enemiesRef.current.push({ x: Math.random() * (CANVAS_WIDTH - 40), y: -40, width: 40, height: 40, speed: 2, hp: 10, maxHp: 10, type: 'basic', lastShotTime: timestamp, flicker: 0 });
        lastSpawnTimeRef.current = timestamp;
      }

      if (scoreRef.current >= BOSS_SCORE_THRESHOLD && !bossSpawnedRef.current) {
        bossSpawnedRef.current = true; isBossActiveRef.current = true;
        bossRef.current = { x: CANVAS_WIDTH/2 - 60, y: -100, width: 120, height: 80, speed: 1, hp: 500, maxHp: 500, type: 'boss', lastShotTime: 0, flicker: 0 };
      }

      bulletsRef.current.forEach(b => { b.y += (b.isPlayerBullet ? -b.speed : b.speed) * dt; });
      enemiesRef.current.forEach(e => { e.y += e.speed * dt; if (e.flicker > 0) e.flicker--; });
      if (bossRef.current) {
        const b = bossRef.current; b.y = Math.min(60, b.y + 1 * dt);
        b.x += b.speed * dt; if (b.x <= 0 || b.x > CANVAS_WIDTH - b.width) b.speed *= -1;
        if (b.flicker > 0) b.flicker--;
      }

      bulletsRef.current.forEach(b => {
        if (b.isPlayerBullet) {
          enemiesRef.current.forEach(e => {
            if (e.hp > 0 && checkCollision(b, e)) { e.hp -= b.damage; e.flicker = 5; b.y = -1000; }
          });
          if (bossRef.current && checkCollision(b, bossRef.current)) { bossRef.current.hp -= b.damage; bossRef.current.flicker = 5; b.y = -1000; }
        } else {
          if (checkCollision(b, p, 5)) { p.hp -= 10; p.flicker = 10; b.y = 1000; }
        }
      });

      enemiesRef.current = enemiesRef.current.filter(e => {
        if (e.hp <= 0) { scoreRef.current += 100; createExplosion(e.x+e.width/2, e.y+e.height/2, 20, '#f50'); return false; }
        return e.y < CANVAS_HEIGHT;
      });
      if (bossRef.current && bossRef.current.hp <= 0) {
        scoreRef.current += 10000; createExplosion(bossRef.current.x+60, bossRef.current.y+40, 100, '#ff0', true);
        bossRef.current = null; gameStateRef.current = 'WON';
      }
      bulletsRef.current = bulletsRef.current.filter(b => b.y > -50 && b.y < CANVAS_HEIGHT + 50);
      if (shakeRef.current > 0) shakeRef.current *= 0.9;
      if (p.flicker > 0) p.flicker--;
      syncState();
    };

    const draw = () => {
      ctx.save();
      if (shakeRef.current > 0.5) ctx.translate((Math.random()-0.5)*shakeRef.current, (Math.random()-0.5)*shakeRef.current);
      ctx.fillStyle = '#000b1e'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#fff'; stars.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));

      if (gameStateRef.current === 'START') {
        ctx.textAlign = 'center'; ctx.fillStyle = '#0ff'; ctx.font = 'bold 40px Arial'; ctx.fillText('WARPLANE 1945', CANVAS_WIDTH/2, 250);
        ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.fillText('PRESS SPACE TO START', CANVAS_WIDTH/2, 400);
        ctx.restore(); return;
      }

      bulletsRef.current.forEach(b => { ctx.fillStyle = b.isPlayerBullet ? '#0ff' : '#f00'; ctx.fillRect(b.x, b.y, b.width, b.height); });
      enemiesRef.current.forEach(e => { ctx.fillStyle = e.flicker > 0 ? '#fff' : '#f44'; ctx.fillRect(e.x, e.y, e.width, e.height); });
      if (bossRef.current) { ctx.fillStyle = bossRef.current.flicker > 0 ? '#fff' : '#800'; ctx.fillRect(bossRef.current.x, bossRef.current.y, bossRef.current.width, bossRef.current.height); }

      const p = playerRef.current;
      if (p.hp > 0 && (p.flicker === 0 || Math.floor(Date.now()/50)%2 === 0)) { ctx.fillStyle = '#0af'; ctx.fillRect(p.x, p.y, p.width, p.height); }

      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${scoreRef.current}`, 10, 30);
      ctx.fillText(`HP: ${Math.max(0, p.hp)}`, 10, 60);
      if (bossRef.current) { ctx.fillStyle = '#f00'; ctx.fillRect(140, 20, 200 * (bossRef.current.hp / 500), 10); }

      if (gameStateRef.current === 'GAMEOVER' || gameStateRef.current === 'WON') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
        ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '40px Arial';
        ctx.fillText(gameStateRef.current === 'WON' ? 'MISSION COMPLETE' : 'GAME OVER', CANVAS_WIDTH/2, 300);
        ctx.font = '20px Arial'; ctx.fillText('PRESS R TO RESTART', CANVAS_WIDTH/2, 400);
      }
    };

    const loop = (t: number) => { update(t); draw(); animationFrameId = requestAnimationFrame(loop); };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [syncState, resetGame]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000' }}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ border: '2px solid #fff' }} />
    </div>
  );
};

export default GameCanvas;

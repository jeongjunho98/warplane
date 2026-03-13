import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Bullet, Enemy, Item, Particle, FloatingText, GameState } from '../types';
import { checkCollision } from '../utils/gameEngine';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const PLAYER_SIZE = 40;

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('START');

  const scoreRef = useRef(0);
  const gameStateRef = useRef<GameState>('START');
  const playerRef = useRef<Player & { flicker: number }>({
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 100,
    width: PLAYER_SIZE, height: PLAYER_SIZE, speed: 5, hp: 100, maxHp: 100, power: 1, bombs: 3, flicker: 0,
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<(Enemy & { flicker: number })[]>([]);
  const starsRef = useRef<{x:number, y:number, s:number}[]>([]);
  const lastShotTimeRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    gameStateRef.current = 'PLAYING';
    playerRef.current = {
      x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 100,
      width: PLAYER_SIZE, height: PLAYER_SIZE, speed: 5, hp: 100, maxHp: 100, power: 1, bombs: 3, flicker: 0,
    };
    bulletsRef.current = [];
    enemiesRef.current = [];
    setScore(0);
    setGameState('PLAYING');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (gameStateRef.current !== 'PLAYING' && (e.code === 'Space' || e.code === 'Enter')) resetGame();
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { 
      window.removeEventListener('keydown', handleKeyDown); 
      window.removeEventListener('keyup', handleKeyUp); 
    };
  }, [resetGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    starsRef.current = Array.from({length: 80}, () => ({ 
      x: Math.random()*CANVAS_WIDTH, 
      y: Math.random()*CANVAS_HEIGHT, 
      s: Math.random()*2+1 
    }));

    const update = (t: number) => {
      const dt = lastFrameTimeRef.current ? Math.min(2, (t - lastFrameTimeRef.current) / 16.67) : 1;
      lastFrameTimeRef.current = t;
      starsRef.current.forEach(s => { s.y += s.s * dt; if (s.y > CANVAS_HEIGHT) s.y = 0; });

      if (gameStateRef.current !== 'PLAYING') return;

      const p = playerRef.current;
      if (p.hp <= 0) {
        gameStateRef.current = 'GAMEOVER';
        setGameState('GAMEOVER');
        return;
      }

      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p.y -= p.speed * dt;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p.y += p.speed * dt;
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p.x -= p.speed * dt;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p.x += p.speed * dt;
      p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
      p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));

      if (t - lastShotTimeRef.current > 150) {
        bulletsRef.current.push({ x: p.x + p.width/2 - 5, y: p.y, width: 10, height: 25, speed: 12, damage: 100, isPlayerBullet: true });
        lastShotTimeRef.current = t;
      }

      if (t - lastSpawnTimeRef.current > 1000) {
        enemiesRef.current.push({ x: Math.random()*(CANVAS_WIDTH-40), y: -40, width: 40, height: 40, speed: 2, hp: 10, maxHp: 10, type: 'basic', lastShotTime: t, flicker: 0 });
        lastSpawnTimeRef.current = t;
      }

      bulletsRef.current.forEach(b => { b.y += (b.isPlayerBullet ? -b.speed : b.speed) * dt; });
      enemiesRef.current.forEach(e => {
        e.y += e.speed * dt;
        if (checkCollision(e, p)) { p.hp -= 0.5; p.flicker = 5; }
      });

      bulletsRef.current.forEach(b => {
        if (b.isPlayerBullet) {
          enemiesRef.current.forEach(e => {
            if (e.hp > 0 && checkCollision(b, e)) {
              e.hp = 0; b.y = -1000;
              scoreRef.current += 100;
              setScore(scoreRef.current);
            }
          });
        }
      });

      enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0 && e.y < CANVAS_HEIGHT);
      bulletsRef.current = bulletsRef.current.filter(b => b.y > -50 && b.y < CANVAS_HEIGHT + 50);
    };

    const draw = () => {
      ctx.fillStyle = '#000b1e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      ctx.fillStyle = '#fff';
      starsRef.current.forEach(s => ctx.fillRect(s.x, s.y, 1, 1));

      if (gameStateRef.current === 'START') {
        ctx.textAlign = 'center'; ctx.fillStyle = '#0ff'; ctx.font = 'bold 40px Arial';
        ctx.fillText('WARPLANE 1945', CANVAS_WIDTH/2, 300);
        ctx.fillStyle = '#fff'; ctx.font = '20px Arial';
        ctx.fillText('PRESS SPACE TO START', CANVAS_WIDTH/2, 400);
        return;
      }

      const p = playerRef.current;
      ctx.fillStyle = p.flicker > 0 ? '#fff' : '#0af';
      if (p.flicker > 0) p.flicker--;
      ctx.fillRect(p.x, p.y, p.width, p.height);

      ctx.fillStyle = '#f44';
      enemiesRef.current.forEach(e => ctx.fillRect(e.x, e.y, e.width, e.height));

      ctx.fillStyle = '#0ff';
      bulletsRef.current.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

      ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${scoreRef.current}`, 10, 30);
      ctx.fillText(`HP: ${Math.max(0, Math.ceil(p.hp))}`, 10, 60);

      if (gameStateRef.current === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
        ctx.textAlign = 'center'; ctx.fillStyle = '#f00'; ctx.font = '40px Arial';
        ctx.fillText('GAME OVER', CANVAS_WIDTH/2, 300);
        ctx.fillStyle = '#fff'; ctx.font = '20px Arial';
        ctx.fillText('PRESS SPACE TO RESTART', CANVAS_WIDTH/2, 400);
      }
    };

    let frameId: number;
    const loop = (t: number) => { update(t); draw(); frameId = requestAnimationFrame(loop); };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000' }}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ border: '2px solid #fff' }} />
    </div>
  );
};

export default GameCanvas;

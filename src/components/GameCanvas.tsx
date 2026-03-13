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
  const scoreRef = useRef(0);
  const [gameState, setGameState] = useState<GameState>('START');
  const [isBossActive, setIsBossActive] = useState(false);

  // Sync scoreRef with score state for the loop
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Refs for performance & state
  const playerRef = useRef<Player & { flicker: number }>({
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2,
    y: CANVAS_HEIGHT - 100,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    speed: 5,
    hp: 100,
    maxHp: 100,
    power: 1,
    bombs: 3,
    flicker: 0,
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<(Enemy & { flicker: number })[]>([]);
  const bossRef = useRef<(Enemy & { flicker: number }) | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const shakeRef = useRef<number>(0);
  const bossSpawnedRef = useRef<boolean>(false);
  
  const lastShotTimeRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  const resetGame = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setIsBossActive(false);
    bossSpawnedRef.current = false;
    playerRef.current = {
      x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2,
      y: CANVAS_HEIGHT - 100,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      speed: 5,
      hp: 100,
      maxHp: 100,
      power: 1,
      bombs: 3,
      flicker: 0,
    };
    bulletsRef.current = [];
    enemiesRef.current = [];
    bossRef.current = null;
    itemsRef.current = [];
    particlesRef.current = [];
    shockwavesRef.current = [];
    floatingTextsRef.current = [];
    shakeRef.current = 0;
    setGameState('PLAYING');
  }, []);

  useEffect(() => {
    if (score >= BOSS_SCORE_THRESHOLD && !bossSpawnedRef.current && gameState === 'PLAYING') {
      bossSpawnedRef.current = true;
      setIsBossActive(true);
      shakeRef.current = 20;
      bossRef.current = {
        x: CANVAS_WIDTH / 2 - 60,
        y: -150,
        width: 120,
        height: 80,
        speed: 1,
        hp: 150,
        maxHp: 150,
        type: 'boss',
        lastShotTime: 0,
        flicker: 0,
      };
    }
  }, [score, gameState]);

  useEffect(() => {
    const stars: Star[] = [];
    const colors = ['#ffffff', '#a8d8ea', '#fcbf49'];
    for (let i = 0; i < 120; i++) {
      stars.push({ 
        x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT, 
        size: Math.random() * 1.5 + 0.5, speed: Math.random() * 3 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    starsRef.current = stars;

    const handleKeyDown = (e: KeyboardEvent) => { 
      keysRef.current[e.code] = true; 
      if (gameState === 'START' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ')) {
        setGameState('PLAYING');
      } else if ((gameState === 'WON' || gameState === 'GAMEOVER') && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyR')) {
        resetGame();
      } else if (gameState === 'PLAYING' && e.code === 'Space') {
        useBomb(); 
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    const handleBlur = () => { Object.keys(keysRef.current).forEach(key => keysRef.current[key] = false); };
    
    const useBomb = () => {
      const player = playerRef.current;
      if (player.bombs > 0 && player.hp > 0 && gameState === 'PLAYING') {
        player.bombs--;
        shakeRef.current = 15;
        createExplosion(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 120, '#fff', true);
        setScore(prev => prev + enemiesRef.current.length * 50);
        enemiesRef.current.forEach(e => addFloatingText(e.x, e.y, '+50', '#ff0'));
        enemiesRef.current = [];
        bulletsRef.current = bulletsRef.current.filter(b => b.isPlayerBullet); 
        if (bossRef.current) bossRef.current.hp -= 30;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => { 
      window.removeEventListener('keydown', handleKeyDown); 
      window.removeEventListener('keyup', handleKeyUp); 
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState, resetGame]);

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
    shockwavesRef.current.push({ x, y, radius: 0, maxRadius: isBomb ? 500 : (count > 20 ? 100 : 40), color, alpha: 1 });
    if (!isBomb) shakeRef.current = Math.min(10, shakeRef.current + (count / 10));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const spawnEnemy = (timestamp: number) => {
      if (isBossActive || gameState !== 'PLAYING') return;
      if (timestamp - lastSpawnTimeRef.current > 1000 - Math.min(750, score / 80)) {
        enemiesRef.current.push({
          x: Math.random() * (CANVAS_WIDTH - 40) + 5, y: -40, width: 35, height: 35,
          speed: 1.5 + Math.random() * 2, hp: 2, maxHp: 2, type: 'basic', lastShotTime: timestamp, flicker: 0
        });
        lastSpawnTimeRef.current = timestamp;
      }
    };

    const update = (timestamp: number) => {
      const dt = lastFrameTimeRef.current ? (timestamp - lastFrameTimeRef.current) / 16.67 : 1;
      lastFrameTimeRef.current = timestamp;

      starsRef.current.forEach(s => { s.y += s.speed * dt; if (s.y > CANVAS_HEIGHT) s.y = 0; });

      if (gameState !== 'PLAYING') return;

      const player = playerRef.current;
      if (player.hp <= 0 && player.flicker === -1) {
        setGameState('GAMEOVER');
        return;
      }

      if (player.flicker > 0) player.flicker--;
      if (shakeRef.current > 0) shakeRef.current *= 0.9;

      if (player.hp > 0) {
        if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) player.y -= player.speed * dt;
        if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) player.y += player.speed * dt;
        if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) player.x -= player.speed * dt;
        if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) player.x += player.speed * dt;
        player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.width, player.x));
        player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.height, player.y));

        if (timestamp - lastShotTimeRef.current > 110) {
          const py = player.y, px = player.x + player.width / 2;
          if (player.power === 1) bulletsRef.current.push({ x: px-2, y: py, width: 4, height: 16, speed: 12, damage: 1, isPlayerBullet: true });
          else if (player.power === 2) {
            bulletsRef.current.push({ x: px-14, y: py+5, width: 5, height: 18, speed: 12, damage: 1, isPlayerBullet: true });
            bulletsRef.current.push({ x: px+9, y: py+5, width: 5, height: 18, speed: 12, damage: 1, isPlayerBullet: true });
          } else {
            bulletsRef.current.push({ x: px-3, y: py-5, width: 6, height: 20, speed: 14, damage: 1.5, isPlayerBullet: true });
            bulletsRef.current.push({ x: px-22, y: py+12, width: 4, height: 18, speed: 12, damage: 1, isPlayerBullet: true, angle: -0.18 });
            bulletsRef.current.push({ x: px+18, y: py+12, width: 4, height: 18, speed: 12, damage: 1, isPlayerBullet: true, angle: 0.18 });
          }
          lastShotTimeRef.current = timestamp;
        }
      }

      floatingTextsRef.current = floatingTextsRef.current.filter(t => { t.y -= 1.5 * dt; t.life -= 0.02 * dt; return t.life > 0; });
      particlesRef.current = particlesRef.current.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt; return p.life > 0; });
      shockwavesRef.current = shockwavesRef.current.filter(s => { s.radius += (s.maxRadius - s.radius) * 0.12 * dt + 1.5; s.alpha -= 0.035 * dt; return s.alpha > 0; });

      bulletsRef.current = bulletsRef.current.filter(b => {
        b.y += (b.isPlayerBullet ? -b.speed : b.speed) * dt;
        if (b.angle) b.x += b.angle * b.speed * dt;
        if (!b.isPlayerBullet && player.hp > 0 && collisionUtil(b, player, 2)) {
          player.hp -= 8; player.flicker = 12; shakeRef.current = 5;
          createExplosion(b.x, b.y, 6, '#fff');
          if (player.hp <= 0) { createExplosion(player.x+player.width/2, player.y+player.height/2, 80, '#0ff'); player.flicker = -1; }
          return false;
        }
        return b.y > -50 && b.y < CANVAS_HEIGHT + 50 && b.x > -50 && b.x < CANVAS_WIDTH + 50;
      });

      if (bossRef.current) {
        const boss = bossRef.current; if (boss.flicker > 0) boss.flicker--;
        if (boss.y < 60) boss.y += 0.6 * dt;
        else {
          boss.x += boss.speed * dt; if (boss.x > CANVAS_WIDTH - boss.width || boss.x < 0) boss.speed *= -1;
          if (timestamp - boss.lastShotTime > 750) {
            for (let i = -3; i <= 3; i++) bulletsRef.current.push({ x: boss.x+boss.width/2, y: boss.y+boss.height-25, width: 10, height: 10, speed: 5.5, damage: 10, isPlayerBullet: false, angle: i*0.28 });
            boss.lastShotTime = timestamp;
          }
        }
        bulletsRef.current.filter(b => b.isPlayerBullet).forEach(b => {
          if (collisionUtil(b, boss, 0)) {
            boss.hp -= b.damage; boss.flicker = 3; createExplosion(b.x, b.y, 4, '#fff'); b.y = -100;
            if (boss.hp <= 0) { setScore(prev => prev+10000); createExplosion(boss.x+boss.width/2, boss.y+boss.height/2, 120, '#ff0'); setGameState('WON'); bossRef.current = null; }
          }
        });
      }

      spawnEnemy(timestamp);
      enemiesRef.current = enemiesRef.current.filter(e => {
        e.y += e.speed * dt; if (e.flicker > 0) e.flicker--;
        if (timestamp - e.lastShotTime > 1400 && e.y > 0 && e.y < CANVAS_HEIGHT-120) {
          const dx = (player.x+player.width/2)-(e.x+e.width/2), dy = (player.y+player.height/2)-(e.y+e.height);
          bulletsRef.current.push({ x: e.x+e.width/2-4, y: e.y+e.height, width: 7, height: 7, speed: 4.5, damage: 5, isPlayerBullet: false, angle: Math.atan2(dy, dx)-Math.PI/2 });
          e.lastShotTime = timestamp;
        }
        if (player.hp > 0 && collisionUtil(player, e, 6)) {
          player.hp -= 20; player.flicker = 18; shakeRef.current = 10;
          createExplosion(e.x+e.width/2, e.y+e.height/2, 20, '#f50');
          if (player.hp <= 0) { createExplosion(player.x+player.width/2, player.y+player.height/2, 80, '#0ff'); player.flicker = -1; }
          return false;
        }
        bulletsRef.current.filter(b => b.isPlayerBullet).forEach(b => {
          if (collisionUtil(b, e, 0)) {
            e.hp -= b.damage; e.flicker = 3; b.y = -100;
            if (e.hp <= 0) { setScore(prev => prev+100); addFloatingText(e.x, e.y, '+100', '#0ff'); createExplosion(e.x+e.width/2, e.y+e.height/2, 18, '#f50'); if (Math.random() < 0.22) spawnItem(e.x, e.y); e.y = CANVAS_HEIGHT+250; }
          }
        });
        return e.y < CANVAS_HEIGHT;
      });

      itemsRef.current = itemsRef.current.filter(item => {
        item.y += item.speed * dt;
        if (player.hp > 0 && collisionUtil(player, item, 0)) {
          if (item.type === 'power') { player.power = Math.min(player.power+1, 3); addFloatingText(item.x, item.y, 'POWER UP!', '#f0f'); }
          if (item.type === 'health') { player.hp = Math.min(player.hp+30, player.maxHp); addFloatingText(item.x, item.y, '+30 HP', '#0f0'); }
          if (item.type === 'bomb') { player.bombs++; addFloatingText(item.x, item.y, '+1 BOMB', '#f80'); }
          return false;
        }
        return item.y < CANVAS_HEIGHT;
      });
    };

    const spawnItem = (x: number, y: number) => {
      const types: ('power' | 'health' | 'bomb')[] = ['power', 'health', 'bomb'];
      itemsRef.current.push({ x, y, width: 22, height: 22, speed: 1.3, type: types[Math.floor(Math.random()*3)] });
    };

    const draw = (timestamp: number) => {
      ctx.save();
      if (shakeRef.current > 0.5) ctx.translate((Math.random()-0.5)*shakeRef.current, (Math.random()-0.5)*shakeRef.current);
      
      const grad = ctx.createLinearGradient(0,0,0,CANVAS_HEIGHT); grad.addColorStop(0, '#020014'); grad.addColorStop(1, '#090924');
      ctx.fillStyle = grad; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);

      starsRef.current.forEach(s => { ctx.fillStyle = s.color; ctx.globalAlpha = s.speed/4.5; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill(); });
      ctx.globalAlpha = 1;

      if (gameState === 'START') {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 50px Arial';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#0ff';
        ctx.fillText('WARPLANE 1945', CANVAS_WIDTH / 2, 200);
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px monospace';
        if (Math.floor(timestamp / 500) % 2 === 0) {
          ctx.fillText('PRESS START', CANVAS_WIDTH / 2, 450);
        }
        
        ctx.font = '14px Arial';
        ctx.fillStyle = '#aaa';
        ctx.fillText('USE WASD/ARROWS TO MOVE', CANVAS_WIDTH / 2, 500);
        ctx.fillText('SPACE TO USE BOMB', CANVAS_WIDTH / 2, 520);
        ctx.restore();
        return;
      }

      ctx.globalCompositeOperation = 'lighter';
      itemsRef.current.forEach(item => {
        ctx.fillStyle = item.type === 'power' ? '#f0f' : item.type === 'health' ? '#0f0' : '#f80';
        ctx.shadowBlur = 12; ctx.shadowColor = ctx.fillStyle; ctx.beginPath(); ctx.arc(item.x+11, item.y+11, 11, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign='center'; ctx.fillText(item.type[0].toUpperCase(), item.x+11, item.y+16);
      });

      bulletsRef.current.forEach(b => {
        ctx.save(); ctx.translate(b.x+b.width/2, b.y+b.height/2); ctx.rotate(b.angle || 0); ctx.shadowBlur = 15;
        if (b.isPlayerBullet) { ctx.shadowColor = '#0ff'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0,0,b.width/2, b.height/2, 0, 0, Math.PI*2); ctx.fill(); }
        else { ctx.shadowColor = '#f20'; ctx.fillStyle = '#fa0'; ctx.beginPath(); ctx.arc(0,0,b.width/2+1, 0, Math.PI*2); ctx.fill(); }
        ctx.restore();
      });

      particlesRef.current.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.width, 0, Math.PI*2); ctx.fill(); });
      shockwavesRef.current.forEach(s => { ctx.globalAlpha = s.alpha; ctx.strokeStyle = s.color; ctx.lineWidth = 4*s.alpha; ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2); ctx.stroke(); });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

      enemiesRef.current.forEach(e => {
        ctx.save(); ctx.translate(e.x+e.width/2, e.y+e.height/2); if (e.flicker > 0) ctx.filter = 'brightness(300%)';
        ctx.fillStyle = '#9b2226'; ctx.beginPath(); ctx.moveTo(0,18); ctx.lineTo(18,-12); ctx.lineTo(6,-18); ctx.lineTo(-6,-18); ctx.lineTo(-18,-12); ctx.fill();
        ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill(); ctx.restore();
      });

      if (bossRef.current) {
        const b = bossRef.current; ctx.save(); ctx.translate(b.x+b.width/2, b.y+b.height/2); if (b.flicker > 0) ctx.filter = 'brightness(200%)';
        ctx.fillStyle = '#212529'; ctx.beginPath(); ctx.moveTo(0,-45); ctx.lineTo(70,-25); ctx.lineTo(50,35); ctx.lineTo(0,50); ctx.lineTo(-50,35); ctx.lineTo(-70,-25); ctx.fill();
        ctx.shadowBlur = 20; ctx.shadowColor = '#f00'; ctx.fillStyle = '#e63946'; const pulse = Math.sin(timestamp/150)*4;
        ctx.beginPath(); ctx.arc(-30,0,10+pulse,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(30,0,10+pulse,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(0,20,15+pulse,0,Math.PI*2); ctx.fill(); ctx.restore();
      }

      const p = playerRef.current;
      if (p.hp > 0) {
        ctx.save(); ctx.translate(p.x+p.width/2, p.y+p.height/2); if (p.flicker > 0 && Math.floor(timestamp/40)%2 === 0) { ctx.restore(); } else {
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(0, 255, 255, ${0.5+Math.random()*0.5})`;
          ctx.beginPath(); ctx.moveTo(-7,18); ctx.lineTo(7,18); ctx.lineTo(0, 30+Math.random()*20); ctx.fill();
          ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#023e8a'; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(24,18); ctx.lineTo(18,22); ctx.lineTo(0,6); ctx.lineTo(-18,22); ctx.lineTo(-24,18); ctx.fill();
          ctx.fillStyle = '#e0e1dd'; ctx.beginPath(); ctx.moveTo(0,-24); ctx.lineTo(10,0); ctx.lineTo(6,22); ctx.lineTo(-6,22); ctx.lineTo(-10,0); ctx.fill();
          ctx.fillStyle = '#fca311'; ctx.beginPath(); ctx.ellipse(0,-3, 5, 10, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
        }
      }

      floatingTextsRef.current.forEach(t => { ctx.globalAlpha = t.life; ctx.fillStyle = t.color; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.fillText(t.text, t.x, t.y); });
      ctx.globalAlpha = 1; ctx.restore();

      // HUD
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
      ctx.fillStyle = '#0ff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.fillText(`SCORE: ${score.toString().padStart(6, '0')}`, 10, 32);
      
      // Boss Distance Bar
      if (!isBossActive && gameState === 'PLAYING') {
        ctx.fillStyle = '#222'; ctx.fillRect(130, 15, 220, 6); ctx.fillStyle = '#333';
        const prog = Math.min(1, score / BOSS_SCORE_THRESHOLD); ctx.fillStyle = '#0f0'; ctx.fillRect(130, 15, 220 * prog, 6);
        ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.fillText('BOSS DISTANCE', 130, 12);
      } else if (isBossActive && bossRef.current) {
        ctx.fillStyle = '#f00'; ctx.font = 'bold 12px Arial'; ctx.fillText('BOSS HP', 130, 12);
        ctx.fillStyle = '#222'; ctx.fillRect(130, 15, 220, 10); ctx.fillStyle = '#f00'; ctx.fillRect(130, 15, 220 * (bossRef.current.hp / bossRef.current.maxHp), 10);
      }

      // HP Bar & Icons
      ctx.fillStyle = p.hp > 30 ? '#0f0' : (Math.floor(timestamp/200)%2 === 0 ? '#f00' : '#400');
      ctx.fillRect(360, 20, p.hp, 15); ctx.strokeStyle = '#fff'; ctx.strokeRect(360, 20, 100, 15);
      ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.fillText('PLAYER HP', 360, 15);

      ctx.fillStyle = '#fa0'; ctx.fillText(`💣 ${playerRef.current.bombs}`, 10, 60);
      ctx.fillStyle = '#f0f'; ctx.fillText(`⚡ PWR ${playerRef.current.power}`, 60, 60);

      // Low HP Warning Overlay
      if (p.hp > 0 && p.hp < 30) {
        ctx.globalAlpha = Math.sin(timestamp/150)*0.2; ctx.strokeStyle = '#f00'; ctx.lineWidth = 15; ctx.strokeRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); ctx.globalAlpha = 1;
      }

      if (gameState === 'WON' || gameState === 'GAMEOVER') {
        const gameWon = gameState === 'WON';
        ctx.fillStyle = 'rgba(0, 10, 30, 0.9)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); ctx.textAlign = 'center'; 
        ctx.shadowBlur = 20; ctx.shadowColor = gameWon ? '#0f0' : '#f00'; ctx.fillStyle = gameWon ? '#0f0' : '#f00';
        ctx.font = 'bold 45px Arial'; ctx.fillText(gameWon ? 'MISSION COMPLETE' : 'MISSION FAILED', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '22px Arial'; ctx.fillText(`FINAL SCORE: ${score.toString().padStart(6, '0')}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 60);
        ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#fff';
        if (Math.floor(timestamp / 500) % 2 === 0) {
          ctx.fillText('PRESS ANY KEY TO RESTART', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 100);
        }
      }
    };

    const loop = (timestamp: number) => { update(timestamp); draw(timestamp); animationFrameId = requestAnimationFrame(loop); };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [score, gameState, isBossActive]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#050505', backgroundImage: 'radial-gradient(circle, #111 0%, #000 100%)' }}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ border: '4px solid #222', borderRadius: '8px', boxShadow: '0 0 60px rgba(0,255,255,0.15)' }} />
    </div>
  );
};

export default GameCanvas;

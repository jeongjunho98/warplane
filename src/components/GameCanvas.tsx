import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Bullet, Enemy, Item, Particle, FloatingText, GameState } from '../types';
import { checkCollision as collisionUtil } from '../utils/gameEngine';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const PLAYER_SIZE = 40;
const BOSS_SCORE_THRESHOLD = 5000;

class SoundManager {
  private ctx: AudioContext | null = null;
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
  private playTone(freq: number, type: OscillatorType, duration: number, volume: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + duration);
  }
  playShoot() { this.playTone(800, 'square', 0.1, 0.05); }
  playExplosion() { this.playTone(100, 'sawtooth', 0.3, 0.1); }
  playPowerUp() { this.playTone(880, 'sine', 0.2, 0.1); }
  playHurt() { this.playTone(150, 'triangle', 0.2, 0.1); }
}
const sounds = new SoundManager();

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
  const bossRef = useRef<(Enemy & { flicker: number }) | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const starsRef = useRef<{x:number, y:number, s:number}[]>([]);
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
  }, []);

  const createExplosion = (x: number, y: number, count: number, color: string, isBomb: boolean = false) => {
    sounds.playExplosion();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isBomb ? 15 : 5) + 1;
      particlesRef.current.push({ x, y, width: Math.random() * 3 + 1, height: 0, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed: 0, life: 1, color });
    }
    shockwavesRef.current.push({ x, y, radius: 0, maxRadius: isBomb ? 400 : 50, color, alpha: 1 });
    shakeRef.current = Math.max(shakeRef.current, isBomb ? 15 : 5);
  };

  const resetGame = useCallback(() => {
    sounds.init();
    scoreRef.current = 0; gameStateRef.current = 'PLAYING'; bossSpawnedRef.current = false;
    playerRef.current = { x: CANVAS_WIDTH/2-20, y: CANVAS_HEIGHT-100, width: 40, height: 40, speed: 5, hp: 100, maxHp: 100, power: 1, bombs: 3, flicker: 0 };
    bulletsRef.current = []; enemiesRef.current = []; bossRef.current = null; itemsRef.current = [];
    particlesRef.current = []; shockwavesRef.current = []; floatingTextsRef.current = []; shakeRef.current = 0;
    syncState();
  }, [syncState]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (gameStateRef.current !== 'PLAYING' && (e.code === 'Space' || e.code === 'Enter')) resetGame();
      if (gameStateRef.current === 'PLAYING' && e.code === 'KeyX') {
        const p = playerRef.current;
        if (p.bombs > 0) {
          p.bombs--; createExplosion(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 100, '#fff', true);
          enemiesRef.current.forEach(e => { scoreRef.current += 50; }); enemiesRef.current = [];
          bulletsRef.current = bulletsRef.current.filter(b => b.isPlayerBullet);
          if (bossRef.current) { bossRef.current.hp -= 100; bossRef.current.flicker = 10; }
        }
      }
    };
    const ku = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [resetGame]);

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    starsRef.current = Array.from({length: 80}, () => ({ x: Math.random()*CANVAS_WIDTH, y: Math.random()*CANVAS_HEIGHT, s: Math.random()*2+1 }));
    let frameId: number;
    const update = (t: number) => {
      const dt = lastFrameTimeRef.current ? Math.min(2, (t - lastFrameTimeRef.current) / 16.67) : 1;
      lastFrameTimeRef.current = t;
      starsRef.current.forEach(s => { s.y += s.s * dt; if (s.y > CANVAS_HEIGHT) s.y = 0; });
      if (gameStateRef.current !== 'PLAYING') { syncState(); return; }
      const p = playerRef.current;
      if (p.hp <= 0) { gameStateRef.current = 'GAMEOVER'; syncState(); return; }
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p.y -= p.speed * dt;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p.y += p.speed * dt;
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p.x -= p.speed * dt;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p.x += p.speed * dt;
      p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x)); p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));
      if (t - lastShotTimeRef.current > 120) {
        sounds.playShoot(); const px = p.x + p.width/2;
        bulletsRef.current.push({ x: px-4, y: p.y, width: 8, height: 20, speed: 14, damage: 10, isPlayerBullet: true });
        if (p.power >= 2) {
          bulletsRef.current.push({ x: px-20, y: p.y+10, width: 8, height: 20, speed: 14, damage: 10, isPlayerBullet: true });
          bulletsRef.current.push({ x: px+12, y: p.y+10, width: 8, height: 20, speed: 14, damage: 10, isPlayerBullet: true });
        }
        lastShotTimeRef.current = t;
      }
      if (!bossRef.current && t - lastSpawnTimeRef.current > 1000 - Math.min(800, scoreRef.current/50)) {
        enemiesRef.current.push({ x: Math.random()*(CANVAS_WIDTH-40), y: -40, width: 40, height: 40, speed: 2, hp: 20, maxHp: 20, type: 'basic', lastShotTime: t, flicker: 0 });
        lastSpawnTimeRef.current = t;
      }
      if (scoreRef.current >= BOSS_SCORE_THRESHOLD && !bossSpawnedRef.current) {
        bossSpawnedRef.current = true;
        bossRef.current = { x: CANVAS_WIDTH/2-60, y: -100, width: 120, height: 80, speed: 1.5, hp: 1000, maxHp: 1000, type: 'boss', lastShotTime: 0, flicker: 0 };
      }
      bulletsRef.current = bulletsRef.current.filter(b => {
        if (b.isPlayerBullet) b.y -= b.speed * dt;
        else { const ang = b.angle ?? Math.PI/2; b.x += Math.cos(ang)*b.speed*dt; b.y += Math.sin(ang)*b.speed*dt; }
        if (!b.isPlayerBullet && collisionUtil(b, p)) { p.hp -= 10; p.flicker = 10; sounds.playHurt(); return false; }
        return b.y > -50 && b.y < CANVAS_HEIGHT+50 && b.x > -50 && b.x < CANVAS_WIDTH+50;
      });
      enemiesRef.current = enemiesRef.current.filter(e => {
        e.y += e.speed * dt; if (e.flicker > 0) e.flicker--;
        if (t - e.lastShotTime > 1500 && e.y > 0 && e.y < 400) {
          const ang = Math.atan2((p.y+20)-(e.y+20), (p.x+20)-(e.x+20));
          bulletsRef.current.push({ x: e.x+16, y: e.y+40, width: 8, height: 8, speed: 5, damage: 10, isPlayerBullet: false, angle: ang });
          e.lastShotTime = t;
        }
        bulletsRef.current.forEach(b => {
          if (b.isPlayerBullet && collisionUtil(b, e)) {
            e.hp -= b.damage; e.flicker = 5; b.y = -1000;
            if (e.hp <= 0) { scoreRef.current += 100; createExplosion(e.x+20, e.y+20, 15, '#f50'); if (Math.random()<0.1) itemsRef.current.push({x:e.x,y:e.y,width:20,height:20,speed:1.5,type:'power'}); }
          }
        });
        return e.y < CANVAS_HEIGHT && e.hp > 0;
      });
      if (bossRef.current) {
        const b = bossRef.current; b.y = Math.min(60, b.y+0.5*dt); b.x += b.speed*dt;
        if (b.x <= 0 || b.x > CANVAS_WIDTH-b.width) b.speed *= -1;
        if (t - b.lastShotTime > 1000) {
          for(let i=-2; i<=2; i++) bulletsRef.current.push({ x: b.x+b.width/2, y: b.y+b.height, width: 10, height: 10, speed: 4, damage: 20, isPlayerBullet: false, angle: (Math.PI/2)+i*0.4 });
          b.lastShotTime = t;
        }
        if (b.flicker > 0) b.flicker--;
        bulletsRef.current.forEach(pb => {
          if (pb.isPlayerBullet && collisionUtil(pb, b)) {
            b.hp -= pb.damage; b.flicker = 3; pb.y = -1000;
            if (b.hp <= 0) { scoreRef.current += 10000; createExplosion(b.x+60, b.y+40, 100, '#ff0', true); gameStateRef.current = 'WON'; bossRef.current = null; }
          }
        });
      }
      itemsRef.current = itemsRef.current.filter(it => {
        it.y += it.speed*dt;
        if (collisionUtil(it, p)) { sounds.playPowerUp(); p.power = Math.min(p.power+1, 3); return false; }
        return it.y < CANVAS_HEIGHT;
      });
      particlesRef.current = particlesRef.current.filter(pa => { pa.x += pa.vx*dt; pa.y += pa.vy*dt; pa.life -= 0.02*dt; return pa.life > 0; });
      shockwavesRef.current = shockwavesRef.current.filter(sh => { sh.radius += 5*dt; sh.alpha -= 0.02*dt; return sh.alpha > 0; });
      if (shakeRef.current > 0) shakeRef.current *= 0.9;
      syncState();
    };
    const draw = () => {
      ctx.save(); if (shakeRef.current > 0.5) ctx.translate((Math.random()-0.5)*shakeRef.current, (Math.random()-0.5)*shakeRef.current);
      ctx.fillStyle = '#000b1e'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#fff'; starsRef.current.forEach(s => ctx.fillRect(s.x, s.y, 1, 1));
      if (gameStateRef.current === 'START') {
        ctx.textAlign = 'center'; ctx.fillStyle = '#0ff'; ctx.font = 'bold 40px Arial'; ctx.fillText('WARPLANE 1945', CANVAS_WIDTH/2, 250);
        ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.fillText('PRESS SPACE TO START', CANVAS_WIDTH/2, 400);
        ctx.restore(); return;
      }
      bulletsRef.current.forEach(b => { ctx.fillStyle = b.isPlayerBullet ? '#0ff' : '#f44'; ctx.fillRect(b.x, b.y, b.width, b.height); });
      enemiesRef.current.forEach(e => {
        ctx.save(); ctx.translate(e.x+20, e.y+20); if (e.flicker > 0) ctx.filter = 'brightness(300%)';
        ctx.fillStyle = '#9b2226'; ctx.beginPath(); ctx.moveTo(0,15); ctx.lineTo(15,-10); ctx.lineTo(5,-15); ctx.lineTo(-5,-15); ctx.lineTo(-15,-10); ctx.fill(); ctx.restore();
      });
      if (bossRef.current) {
        const b = bossRef.current; ctx.save(); ctx.translate(b.x+b.width/2, b.y+b.height/2); if (b.flicker > 0) ctx.filter = 'brightness(200%)';
        ctx.fillStyle = '#212529'; ctx.beginPath(); ctx.moveTo(0,-40); ctx.lineTo(60,-20); ctx.lineTo(45,30); ctx.lineTo(0,40); ctx.lineTo(-45,30); ctx.lineTo(-60,-20); ctx.fill(); ctx.restore();
      }
      const p = playerRef.current;
      if (p.hp > 0 && (p.flicker <= 0 || Math.floor(Date.now()/50)%2 === 0)) {
        ctx.save(); ctx.translate(p.x+20, p.y+20);
        ctx.fillStyle = '#f50'; ctx.beginPath(); ctx.moveTo(-5, 15); ctx.lineTo(5, 15); ctx.lineTo(0, 25); ctx.fill();
        ctx.fillStyle = '#023e8a'; ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(20,10); ctx.lineTo(15,15); ctx.lineTo(0,5); ctx.lineTo(-15,15); ctx.lineTo(-20,10); ctx.fill();
        ctx.fillStyle = '#e0e1dd'; ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(8,0); ctx.lineTo(5,15); ctx.lineTo(-5,15); ctx.lineTo(-8,0); ctx.fill(); ctx.restore();
      }
      particlesRef.current.forEach(pa => { ctx.globalAlpha = pa.life; ctx.fillStyle = pa.color; ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.width, 0, Math.PI*2); ctx.fill(); });
      shockwavesRef.current.forEach(sh => { ctx.globalAlpha = sh.alpha; ctx.strokeStyle = sh.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sh.x, sh.y, sh.radius, 0, Math.PI*2); ctx.stroke(); });
      ctx.globalAlpha = 1; ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '18px Arial'; ctx.fillText(`SCORE: ${scoreRef.current}`, 10, 25);
      ctx.fillText(`HP: ${Math.ceil(p.hp)}`, 10, 50);
      if (gameStateRef.current !== 'PLAYING') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px Arial'; ctx.fillText(gameStateRef.current === 'WON' ? 'WON!' : 'GAME OVER', CANVAS_WIDTH/2, 300);
        ctx.font = '20px Arial'; ctx.fillText('PRESS SPACE TO RESTART', CANVAS_WIDTH/2, 400);
      }
    };
    const loop = (t: number) => { update(t); draw(); frameId = requestAnimationFrame(loop); };
    frameId = requestAnimationFrame(loop); return () => cancelAnimationFrame(frameId);
  }, [syncState, resetGame]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000' }}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ border: '2px solid #fff' }} />
    </div>
  );
};

export default GameCanvas;

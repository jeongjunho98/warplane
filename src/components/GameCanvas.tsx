import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Bullet, Enemy, Item, Particle, FloatingText, GameState } from '../types';
import { checkCollision as collisionUtil } from '../utils/gameEngine';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const PLAYER_SIZE = 40;
const BOSS_SCORE_THRESHOLD = 5000;

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmInterval: any = null;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
  }

  private playTone(f: number, t: OscillatorType, d: number, v: number, slide: boolean = false) {
    if (!this.ctx || !this.masterGain) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = t;
    o.frequency.setValueAtTime(f, this.ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + d);
    g.gain.setValueAtTime(v, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + d);
    o.connect(g); g.connect(this.masterGain);
    o.start(); o.stop(this.ctx.currentTime + d);
  }

  playShoot() { this.playTone(600, 'square', 0.1, 0.05); }
  playExplosion() { this.playTone(100, 'sawtooth', 0.4, 0.15, true); }
  playPowerUp() { 
    this.playTone(440, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(880, 'sine', 0.2, 0.1), 100);
  }
  playHurt() { this.playTone(200, 'triangle', 0.3, 0.2); }

  startBGM() {
    if (!this.ctx || this.bgmInterval) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    let step = 0;
    const playStep = () => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const bassNotes = [55, 55, 65, 41, 55, 55, 82, 73]; // High energy bass
      const freq = bassNotes[step % bassNotes.length];
      
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.04, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      o.connect(g); g.connect(this.masterGain);
      o.start(now); o.stop(now + 0.2);
      
      if (step % 4 === 0) { // Snare-ish sound
        const no = this.ctx.createOscillator();
        const ng = this.ctx.createGain();
        no.type = 'triangle';
        no.frequency.setValueAtTime(100, now);
        ng.gain.setValueAtTime(0.03, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        no.connect(ng); ng.connect(this.masterGain);
        no.start(now); no.stop(now + 0.1);
      }
      step++;
    };
    this.bgmInterval = setInterval(playStep, 150);
  }

  stopBGM() {
    if (this.bgmInterval) { clearInterval(this.bgmInterval); this.bgmInterval = null; }
  }
}
const sounds = new SoundManager();

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('START');
  
  const scoreRef = useRef(0);
  const gameStateRef = useRef<GameState>('START');
  const playerRef = useRef<Player & { flicker: number }>({ x: 220, y: 540, width: 40, height: 40, speed: 5, hp: 100, maxHp: 100, power: 1, bombs: 3, flicker: 0 });
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<(Enemy & { flicker: number })[]>([]);
  const bossRef = useRef<(Enemy & { flicker: number }) | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const starsRef = useRef<{x:number, y:number, s:number}[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<{x:number, y:number, radius:number, alpha:number, color:string}[]>([]);
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

  const resetGame = useCallback(() => {
    sounds.init();
    sounds.stopBGM();
    sounds.startBGM();
    scoreRef.current = 0; gameStateRef.current = 'PLAYING'; bossSpawnedRef.current = false;
    playerRef.current = { x: 220, y: 540, width: 40, height: 40, speed: 5, hp: 100, maxHp: 100, power: 1, bombs: 3, flicker: 0 };
    bulletsRef.current = []; enemiesRef.current = []; bossRef.current = null; itemsRef.current = [];
    particlesRef.current = []; shockwavesRef.current = []; shakeRef.current = 0;
    syncState();
  }, [syncState]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (gameStateRef.current !== 'PLAYING' && (e.code === 'Space' || e.code === 'Enter')) resetGame();
      if (gameStateRef.current === 'PLAYING' && e.code === 'KeyX' && playerRef.current.bombs > 0) {
        playerRef.current.bombs--; shakeRef.current = 15; sounds.playExplosion();
        enemiesRef.current.forEach(e => { scoreRef.current += 50; }); enemiesRef.current = [];
        bulletsRef.current = bulletsRef.current.filter(b => b.isPlayerBullet);
        if (bossRef.current) { bossRef.current.hp -= 100; bossRef.current.flicker = 10; }
      }
    };
    const ku = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); sounds.stopBGM(); };
  }, [resetGame]);

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    starsRef.current = Array.from({length: 80}, () => ({ x: Math.random()*480, y: Math.random()*640, s: Math.random()*2+1 }));
    let frameId: number;
    
    const update = (t: number) => {
      const dt = lastFrameTimeRef.current ? Math.min(2, (t - lastFrameTimeRef.current) / 16.67) : 1;
      lastFrameTimeRef.current = t;
      starsRef.current.forEach(s => { s.y += s.s * dt; if (s.y > 640) s.y = 0; });
      if (gameStateRef.current !== 'PLAYING') return;
      const p = playerRef.current;
      if (p.hp <= 0) { gameStateRef.current = 'GAMEOVER'; sounds.stopBGM(); syncState(); return; }
      
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p.y -= p.speed * dt;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p.y += p.speed * dt;
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p.x -= p.speed * dt;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p.x += p.speed * dt;
      p.x = Math.max(0, Math.min(440, p.x)); p.y = Math.max(0, Math.min(600, p.y));
      
      if (t - lastShotTimeRef.current > 120) {
        sounds.playShoot(); const px = p.x + 20;
        bulletsRef.current.push({ x: px-4, y: p.y, width: 8, height: 20, speed: 14, damage: 10, isPlayerBullet: true });
        if (p.power >= 2) { bulletsRef.current.push({ x: px-20, y: p.y+10, width: 8, height: 20, speed: 14, damage: 10, isPlayerBullet: true }); bulletsRef.current.push({ x: px+12, y: p.y+10, width: 8, height: 20, speed: 14, damage: 10, isPlayerBullet: true }); }
        lastShotTimeRef.current = t;
      }
      if (!bossRef.current && t - lastSpawnTimeRef.current > 1000 - Math.min(800, scoreRef.current/50)) {
        enemiesRef.current.push({ x: Math.random()*440, y: -40, width: 40, height: 40, speed: 2, hp: 20, maxHp: 20, type: 'basic', lastShotTime: t, flicker: 0 });
        lastSpawnTimeRef.current = t;
      }
      if (scoreRef.current >= 5000 && !bossSpawnedRef.current) {
        bossSpawnedRef.current = true;
        bossRef.current = { x: 180, y: -100, width: 120, height: 80, speed: 1.5, hp: 1000, maxHp: 1000, type: 'boss', lastShotTime: 0, flicker: 0 };
      }
      bulletsRef.current = bulletsRef.current.filter(b => {
        if (b.isPlayerBullet) b.y -= b.speed * dt;
        else { const ang = b.angle ?? Math.PI/2; b.x += Math.cos(ang)*b.speed*dt; b.y += Math.sin(ang)*b.speed*dt; }
        if (!b.isPlayerBullet && collisionUtil(b, p)) { p.hp -= 5; p.flicker = 10; sounds.playHurt(); return false; }
        return b.y > -50 && b.y < 690 && b.x > -50 && b.x < 530;
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
            if (e.hp <= 0) { scoreRef.current += 100; sounds.playExplosion(); if (Math.random()<0.1) itemsRef.current.push({x:e.x,y:e.y,width:20,height:20,speed:1.5,type:'power'}); }
          }
        });
        return e.y < 640 && e.hp > 0;
      });
      if (bossRef.current) {
        const b = bossRef.current; b.y = Math.min(60, b.y+0.5*dt); b.x += b.speed*dt;
        if (b.x <= 0 || b.x > 360) b.speed *= -1;
        if (t - b.lastShotTime > 1000) {
          for(let i=-2; i<=2; i++) bulletsRef.current.push({ x: b.x+60, y: b.y+80, width: 10, height: 10, speed: 4, damage: 20, isPlayerBullet: false, angle: (Math.PI/2)+i*0.4 });
          b.lastShotTime = t;
        }
        if (b.flicker > 0) b.flicker--;
        bulletsRef.current.forEach(pb => {
          if (pb.isPlayerBullet && collisionUtil(pb, b)) {
            b.hp -= pb.damage; b.flicker = 3; pb.y = -1000;
            if (b.hp <= 0) { scoreRef.current += 10000; sounds.playExplosion(); gameStateRef.current = 'WON'; sounds.stopBGM(); bossRef.current = null; }
          }
        });
      }
      itemsRef.current = itemsRef.current.filter(it => {
        it.y += it.speed*dt; if (collisionUtil(it, p)) { sounds.playPowerUp(); p.power = Math.min(p.power+1, 3); return false; }
        return it.y < 640;
      });
      particlesRef.current = particlesRef.current.filter(pa => { pa.x += pa.vx*dt; pa.y += pa.vy*dt; pa.life -= 0.02*dt; return pa.life > 0; });
      shockwavesRef.current = shockwavesRef.current.filter(sh => { sh.radius += 5*dt; sh.alpha -= 0.02*dt; return sh.alpha > 0; });
      if (shakeRef.current > 0) shakeRef.current *= 0.9;
      if (Math.floor(t) % 15 === 0) syncState();
    };

    const draw = () => {
      ctx.save(); if (shakeRef.current > 0.5) ctx.translate((Math.random()-0.5)*shakeRef.current, (Math.random()-0.5)*shakeRef.current);
      ctx.fillStyle = '#000b1e'; ctx.fillRect(0, 0, 480, 640);
      ctx.fillStyle = '#fff'; starsRef.current.forEach(s => ctx.fillRect(s.x, s.y, 1, 1));
      
      if (gameStateRef.current === 'START') {
        ctx.textAlign = 'center'; ctx.fillStyle = '#0ff'; ctx.font = 'bold 40px Arial'; ctx.fillText('WARPLANE 1945', 240, 250);
        ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.fillText('PRESS SPACE TO START', 240, 400);
        ctx.restore(); return;
      }

      bulletsRef.current.forEach(b => { ctx.fillStyle = b.isPlayerBullet ? '#0ff' : '#f44'; ctx.fillRect(b.x, b.y, b.width, b.height); });
      enemiesRef.current.forEach(e => {
        ctx.save(); ctx.translate(e.x+20, e.y+20); if (e.flicker > 0) ctx.filter = 'brightness(300%)';
        ctx.fillStyle = '#9b2226'; ctx.beginPath(); ctx.moveTo(0,15); ctx.lineTo(15,-10); ctx.lineTo(5,-15); ctx.lineTo(-5,-15); ctx.lineTo(-15,-10); ctx.fill(); ctx.restore();
      });
      if (bossRef.current) {
        const b = bossRef.current; ctx.save(); ctx.translate(b.x+60, b.y+40); if (b.flicker > 0) ctx.filter = 'brightness(200%)';
        ctx.fillStyle = '#212529'; ctx.beginPath(); ctx.moveTo(0,-40); ctx.lineTo(60,-20); ctx.lineTo(45,30); ctx.lineTo(0,40); ctx.lineTo(-45,30); ctx.lineTo(-60,-20); ctx.fill(); ctx.restore();
      }
      
      const p = playerRef.current;
      if (p.hp > 0) {
        ctx.save(); ctx.translate(p.x+20, p.y+20);
        if (p.flicker > 0) {
          ctx.filter = 'brightness(300%)'; // NO DISAPPEARING, JUST GLOW
          p.flicker--;
        }
        ctx.fillStyle = '#f50'; ctx.beginPath(); ctx.moveTo(-5, 15); ctx.lineTo(5, 15); ctx.lineTo(0, 25); ctx.fill();
        ctx.fillStyle = '#023e8a'; ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(20,10); ctx.lineTo(15,15); ctx.lineTo(0,5); ctx.lineTo(-15,15); ctx.lineTo(-20,10); ctx.fill();
        ctx.fillStyle = '#e0e1dd'; ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(8,0); ctx.lineTo(5,15); ctx.lineTo(-5,15); ctx.lineTo(-8,0); ctx.fill();
        ctx.restore();
      }
      
      particlesRef.current.forEach(pa => { ctx.globalAlpha = pa.life; ctx.fillStyle = pa.color; ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.width, 0, Math.PI*2); ctx.fill(); });
      shockwavesRef.current.forEach(sh => { ctx.globalAlpha = sh.alpha; ctx.strokeStyle = sh.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sh.x, sh.y, sh.radius, 0, Math.PI*2); ctx.stroke(); });
      ctx.globalAlpha = 1; ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '18px Arial'; ctx.fillText(`SCORE: ${scoreRef.current}`, 10, 25);
      ctx.fillText(`HP: ${Math.max(0, Math.ceil(p.hp))}`, 10, 50);
      if (gameStateRef.current !== 'PLAYING') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,480,640); ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px Arial'; ctx.fillText(gameStateRef.current === 'WON' ? 'WON!' : 'GAME OVER', 240, 300);
        ctx.font = '20px Arial'; ctx.fillText('PRESS SPACE TO RESTART', 240, 400);
      }
    };
    
    const loop = (t: number) => { update(t); draw(); frameId = requestAnimationFrame(loop); };
    frameId = requestAnimationFrame(loop); return () => { cancelAnimationFrame(frameId); sounds.stopBGM(); };
  }, [syncState, resetGame]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000' }}>
      <canvas ref={canvasRef} width={480} height={640} style={{ border: '2px solid #fff' }} />
    </div>
  );
};

export default GameCanvas;

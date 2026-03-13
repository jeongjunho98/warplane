export type GameState = 'START' | 'PLAYING' | 'GAMEOVER' | 'WON';

export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

export interface Player extends GameObject {
  hp: number;
  maxHp: number;
  power: number;
  bombs: number;
}

export interface Bullet extends GameObject {
  damage: number;
  isPlayerBullet: boolean;
  angle?: number; // For enemy spread shots
}

export interface Enemy extends GameObject {
  hp: number;
  maxHp: number;
  type: 'basic' | 'medium' | 'boss';
  lastShotTime: number;
}

export interface Particle extends GameObject {
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export interface Item extends GameObject {
  type: 'power' | 'health' | 'bomb';
}

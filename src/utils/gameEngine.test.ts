import { describe, it, expect } from 'vitest';
import { updatePosition, checkCollision, applyItemEffect } from './gameEngine';
import { GameObject, Player } from '../types';

describe('gameEngine', () => {
  it('should update position correctly within bounds', () => {
    const obj: GameObject = { x: 100, y: 100, width: 40, height: 40, speed: 5 };
    const keys = { ArrowUp: true, ArrowRight: true };
    const bounds = { width: 480, height: 640 };
    const newPos = updatePosition(obj, keys, 1, bounds);
    
    expect(newPos.x).toBe(105);
    expect(newPos.y).toBe(95);
  });

  it('should detect collision correctly (AABB)', () => {
    const obj1: GameObject = { x: 0, y: 0, width: 50, height: 50, speed: 0 };
    const obj2: GameObject = { x: 40, y: 40, width: 50, height: 50, speed: 0 };
    const obj3: GameObject = { x: 100, y: 100, width: 50, height: 50, speed: 0 };

    expect(checkCollision(obj1, obj2)).toBe(true);
    expect(checkCollision(obj1, obj3)).toBe(false);
  });

  it('should apply item effects correctly', () => {
    const player: Player = { 
      x: 0, y: 0, width: 40, height: 40, speed: 5, 
      hp: 50, maxHp: 100, power: 1, bombs: 1 
    };
    
    const poweredUp = applyItemEffect(player, 'power');
    expect(poweredUp.power).toBe(2);
    
    const healed = applyItemEffect(player, 'health');
    expect(healed.hp).toBe(75);
    
    const bombAdded = applyItemEffect(player, 'bomb');
    expect(bombAdded.bombs).toBe(2);
  });
});

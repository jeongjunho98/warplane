import { describe, it, expect } from 'vitest';
import { updatePosition, checkCollision, applyItemEffect, shouldSpawnBoss } from './gameEngine';
import { Player } from '../types';

describe('Warplane 1945 Core Engine Tests', () => {
  
  it('플레이어 이동 및 캔버스 경계 체크 검증', () => {
    const player = { x: 10, y: 10, speed: 5, width: 40, height: 40 };
    const bounds = { width: 480, height: 640 };
    
    // 왼쪽 위로 나가려 할 때 0에서 멈추는지
    const pos = updatePosition(player, { 'KeyW': true, 'KeyA': true }, 1, bounds);
    expect(pos.x).toBe(5); // 10 - 5 = 5 (아직 경계 안쪽)
    expect(pos.y).toBe(5);

    // 극단적인 경계 밖 이동 시도
    const outPos = updatePosition({ ...player, x: 2 }, { 'KeyA': true }, 2, bounds);
    expect(outPos.x).toBe(0); // 2 - (5*2) = -8 이지만 0으로 제한
  });

  it('정밀 충돌 판정 검증 (Margin 적용)', () => {
    const obj1 = { x: 0, y: 0, width: 20, height: 20, speed: 0 };
    const obj2 = { x: 18, y: 18, width: 20, height: 20, speed: 0 };
    
    // 마진 5를 적용했을 때, 18픽셀 거리는 충돌이 아니어야 함 (20 - 5 = 15까지만 유효 판정)
    expect(checkCollision(obj1, obj2, 5)).toBe(false);
    
    // 더 가까워지면 충돌
    const obj3 = { x: 5, y: 5, width: 20, height: 20, speed: 0 };
    expect(checkCollision(obj1, obj3, 5)).toBe(true);
  });

  it('아이템 효과가 정확히 중첩되는지 검증', () => {
    let player: Player = { x: 0, y: 0, width: 40, height: 40, speed: 5, hp: 50, maxHp: 100, power: 1, bombs: 1 };
    
    // 파워업
    player = applyItemEffect(player, 'power');
    expect(player.power).toBe(2);
    
    // 체력 회복 (최대 체력 초과 불가)
    player = applyItemEffect(player, 'health');
    player = applyItemEffect(player, 'health'); // +25 +25 = +50 -> 100
    expect(player.hp).toBe(100);
    
    player = applyItemEffect(player, 'health'); // 다시 획득해도 100 유지
    expect(player.hp).toBe(100);
  });

  it('보스 등장 트리거(5000점) 검증', () => {
    expect(shouldSpawnBoss(4900, false, false)).toBe(false);
    expect(shouldSpawnBoss(5000, false, false)).toBe(true);
    expect(shouldSpawnBoss(5100, true, false)).toBe(false); // 이미 등장 중이면 다시 생성 안함
  });
});

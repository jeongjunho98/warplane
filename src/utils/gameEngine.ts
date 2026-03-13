import { GameObject, Player, Bullet, Enemy, Item } from '../types';

/**
 * 8방향 이동 및 경계 체크 로직
 */
export const updatePosition = (
  obj: GameObject,
  keys: { [key: string]: boolean },
  dt: number,
  bounds: { width: number; height: number }
): { x: number; y: number } => {
  let { x, y, speed, width, height } = obj;
  if (keys['ArrowUp'] || keys['KeyW']) y -= speed * dt;
  if (keys['ArrowDown'] || keys['KeyS']) y += speed * dt;
  if (keys['ArrowLeft'] || keys['KeyA']) x -= speed * dt;
  if (keys['ArrowRight'] || keys['KeyD']) x += speed * dt;

  return {
    x: Math.max(0, Math.min(bounds.width - width, x)),
    y: Math.max(0, Math.min(bounds.height - height, y))
  };
};

/**
 * 정밀 충돌 판정 (여백 적용)
 */
export const checkCollision = (rect1: GameObject, rect2: GameObject, margin: number = 0): boolean => {
  return (
    rect1.x + margin < rect2.x + rect2.width - margin &&
    rect1.x + rect1.width - margin > rect2.x + margin &&
    rect1.y + margin < rect2.y + rect2.height - margin &&
    rect1.y + rect1.height - margin > rect2.y + margin
  );
};

/**
 * 아이템 획득 효과 처리
 */
export const applyItemEffect = (player: Player, itemType: Item['type']): Player => {
  const newPlayer = { ...player };
  if (itemType === 'power') newPlayer.power = Math.min(newPlayer.power + 1, 3);
  if (itemType === 'health') newPlayer.hp = Math.min(newPlayer.hp + 25, newPlayer.maxHp);
  if (itemType === 'bomb') newPlayer.bombs++;
  return newPlayer;
};

/**
 * 보스 등장 조건 확인 (5000점 기준)
 */
export const shouldSpawnBoss = (score: number, isBossActive: boolean, gameWon: boolean): boolean => {
  return score >= 5000 && !isBossActive && !gameWon;
};

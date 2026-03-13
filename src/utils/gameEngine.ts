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
 * 정밀 충돌 판정 (AABB)
 * margin이 클수록 히트박스가 작아짐 (판정이 엄격해짐)
 * margin이 0이면 이미지 전체, 음수면 이미지보다 넓은 판정
 */
export const checkCollision = (obj1: GameObject, obj2: GameObject, margin: number = 0): boolean => {
  return (
    obj1.x + margin < obj2.x + obj2.width - margin &&
    obj1.x + obj1.width - margin > obj2.x + margin &&
    obj1.y + margin < obj2.y + obj2.height - margin &&
    obj1.y + obj1.height - margin > obj2.y + margin
  );
};

export const applyItemEffect = (player: Player, itemType: Item['type']): Player => {
  const newPlayer = { ...player };
  if (itemType === 'power') newPlayer.power = Math.min(newPlayer.power + 1, 3);
  if (itemType === 'health') newPlayer.hp = Math.min(newPlayer.hp + 25, newPlayer.maxHp);
  if (itemType === 'bomb') newPlayer.bombs++;
  return newPlayer;
};

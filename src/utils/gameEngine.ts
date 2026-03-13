import { GameObject, Player, Bullet, Enemy, Item } from '../types';

/**
 * Standard AABB Collision Detection (No margins, absolute accuracy)
 */
export const checkCollision = (a: GameObject, b: GameObject): boolean => {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
};

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

export const applyItemEffect = (player: Player, itemType: Item['type']): Player => {
  const newPlayer = { ...player };
  if (itemType === 'power') newPlayer.power = Math.min(newPlayer.power + 1, 3);
  if (itemType === 'health') newPlayer.hp = Math.min(newPlayer.hp + 25, newPlayer.maxHp);
  if (itemType === 'bomb') newPlayer.bombs++;
  return newPlayer;
};

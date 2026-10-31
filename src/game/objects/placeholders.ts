import Phaser from 'phaser';
import { HEIGHT, SIM_CONFIG, VISUAL, WIDTH } from '../config';

export const headKey = (i: number): string => `head_${String(i + 1).padStart(2, '0')}`;

// Grip and string-tip positions inside the bow texture. Placeholder only.
export const BOW_SIZE = { w: 360, h: 120, gripY: 10, tipX: 170, tipY: 100 };
export const ARROW_SIZE = { w: 20, h: 220 };

/** Draws a gray-box texture for every key that the manifest did not load. */
export function makePlaceholders(scene: Phaser.Scene): void {
  const missing = (key: string) => !scene.textures.exists(key);
  const g = scene.make.graphics({}, false);
  const bake = (key: string, w: number, h: number, draw: () => void) => {
    if (!missing(key)) return;
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  bake('bg_battlefield', WIDTH, HEIGHT, () => {
    g.fillStyle(0x2a1610).fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(0x1a0d09).fillRect(0, VISUAL.bossFeetY, WIDTH, HEIGHT - VISUAL.bossFeetY);
  });

  bake('boss_body', 480, VISUAL.bossHeight, () => {
    g.fillStyle(0x5a1a14);
    g.fillRoundedRect(90, 20, 300, 320, 60); // torso
    g.fillRoundedRect(0, 30, 90, 300, 40); // arms
    g.fillRoundedRect(390, 30, 90, 300, 40);
    g.fillRoundedRect(110, 320, 110, 240, 30); // legs
    g.fillRoundedRect(260, 320, 110, 240, 30);
    g.fillStyle(0xc8922e).fillRect(90, 300, 300, 24); // belt
  });

  const size = SIM_CONFIG.headWidth;
  const r = size / 2;
  for (let i = 0; i < SIM_CONFIG.heads; i++) {
    bake(headKey(i), size, size, () => {
      g.fillStyle(Phaser.Display.Color.HSLToColor(i / SIM_CONFIG.heads, 0.6, 0.5).color);
      g.fillCircle(r, r, r - 2);
      g.fillStyle(0xffffff)
        .fillCircle(r - 24, r - 14, 13)
        .fillCircle(r + 24, r - 14, 13);
      g.fillStyle(0x000000)
        .fillCircle(r - 24, r - 14, 6)
        .fillCircle(r + 24, r - 14, 6);
      g.fillStyle(0x000000).fillRoundedRect(r - 28, r + 22, 56, 14, 7);
    });
  }

  bake('bow', BOW_SIZE.w, BOW_SIZE.h, () => {
    const { w, gripY, tipY, tipX } = BOW_SIZE;
    const mid = w / 2;
    // Control point sits 2 * tipY above the tips so the curve peaks at gripY.
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(mid - tipX, gripY + tipY),
      new Phaser.Math.Vector2(mid, gripY - tipY),
      new Phaser.Math.Vector2(mid + tipX, gripY + tipY),
    );
    g.lineStyle(14, 0xc8922e);
    curve.draw(g, 32);
  });

  bake('arrow', ARROW_SIZE.w, ARROW_SIZE.h, () => {
    const { w, h } = ARROW_SIZE;
    g.fillStyle(0xe8d8b0).fillRect(w / 2 - 3, 20, 6, h - 20);
    g.fillStyle(0xff7a1a).fillTriangle(w / 2, 0, 0, 30, w, 30);
  });

  const dot = (key: string, radius: number, color: number) =>
    bake(key, radius * 2, radius * 2, () => {
      g.fillStyle(color, 0.35).fillCircle(radius, radius, radius);
      g.fillStyle(color, 1).fillCircle(radius, radius, radius * 0.5);
    });
  dot('fx_ember', 16, 0xffa52a);
  dot('fx_spark', 10, 0xffe08a);
  dot('fx_smoke', 28, 0x665a52);

  g.destroy();

  if (missing('vignette')) {
    const texture = scene.textures.createCanvas('vignette', WIDTH, HEIGHT)!;
    const ctx = texture.getContext();
    const edge = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.3,
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.62,
    );
    edge.addColorStop(0, 'rgba(255, 0, 0, 0)');
    edge.addColorStop(1, 'rgba(255, 0, 0, 0.7)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    texture.refresh();
  }
}

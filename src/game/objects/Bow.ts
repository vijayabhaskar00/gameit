import Phaser from 'phaser';
import { SIM_CONFIG, VISUAL } from '../config';
import { ARROW_SIZE, BOW_SIZE } from './placeholders';

/** Aim is opposite the drag, in degrees clockwise from straight up, rounded to 0.1. */
export function aimFromDrag(dx: number, dy: number): number {
  const deg = (Math.atan2(-dx, dy) * 180) / Math.PI;
  const clamped = Phaser.Math.Clamp(deg, -SIM_CONFIG.maxAimDeg, SIM_CONFIG.maxAimDeg);
  return Math.round(clamped * 10) / 10;
}

export class Bow {
  angle = 0;
  pull = 0;
  private sprite: Phaser.GameObjects.Image;
  private string: Phaser.GameObjects.Graphics;
  private nocked: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    const { bowX: x, bowY: y } = SIM_CONFIG;
    this.string = scene.add.graphics();
    this.nocked = scene.add.image(x, y, 'arrow').setOrigin(0.5, 0);
    this.sprite = scene.add.image(x, y, 'bow').setOrigin(0.5, BOW_SIZE.gripY / BOW_SIZE.h);
  }

  draw(hasArrow: boolean): void {
    const { bowX: x, bowY: y } = SIM_CONFIG;
    const rad = Phaser.Math.DegToRad(this.angle);
    const nockY = BOW_SIZE.tipY + Math.min(this.pull, VISUAL.maxPullPx);
    const point = (px: number, py: number) => ({
      x: x + px * Math.cos(rad) - py * Math.sin(rad),
      y: y + px * Math.sin(rad) + py * Math.cos(rad),
    });

    this.sprite.setRotation(rad);

    const tipL = point(-BOW_SIZE.tipX, BOW_SIZE.tipY);
    const tipR = point(BOW_SIZE.tipX, BOW_SIZE.tipY);
    const nock = point(0, nockY);
    this.string.clear().lineStyle(4, 0xffffff, 0.8);
    this.string.lineBetween(tipL.x, tipL.y, nock.x, nock.y);
    this.string.lineBetween(nock.x, nock.y, tipR.x, tipR.y);

    const tip = point(0, nockY - ARROW_SIZE.h);
    this.nocked.setVisible(hasArrow).setPosition(tip.x, tip.y).setRotation(rad);
  }
}

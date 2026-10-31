import Phaser from 'phaser';
import { campaign } from '../../config/campaign';
import { readStorage, writeStorage } from '../../lib/storage';
import { VISUAL, WIDTH } from '../config';

const SOUND_KEY = 'sound_muted';
const TOP = 40;
const LEFT = 48;
const COLUMN = 210;
const SPEAKER_SIZE = 140;
const HEADS_HALF_WIDTH = 75;
const NUMBER_HALF_HEIGHT = 42;

export class Hud {
  private heads: Phaser.GameObjects.Text;
  private time: Phaser.GameObjects.Text;
  private arrows: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private totalHeads: number,
  ) {
    const copy = campaign.game;
    const column = (i: number, label: string) => {
      const x = LEFT + i * COLUMN;
      scene.add.text(x, TOP, label, {
        fontFamily: 'sans-serif',
        fontSize: '34px',
        color: VISUAL.hudGrey,
      });
      return scene.add.text(x, TOP + 44, '', {
        fontFamily: 'sans-serif',
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#FFFFFF',
      });
    };
    this.heads = column(0, copy.heads).setOrigin(0.5);
    this.heads.setPosition(LEFT + HEADS_HALF_WIDTH, TOP + 44 + NUMBER_HALF_HEIGHT);
    this.time = column(1, copy.time);
    this.arrows = column(2, copy.arrows);

    let muted = readStorage(SOUND_KEY) === '1';
    scene.sound.mute = muted;
    const speaker = scene.add
      .text(WIDTH - LEFT - SPEAKER_SIZE / 2, TOP + SPEAKER_SIZE / 2, '', { fontSize: '64px' })
      .setOrigin(0.5)
      .setPadding(38)
      .setInteractive({ useHandCursor: true });
    const paint = () => speaker.setText(muted ? copy.soundOff : copy.soundOn);
    paint();
    speaker.on('pointerdown', () => {
      muted = !muted;
      scene.sound.mute = muted;
      writeStorage(SOUND_KEY, muted ? '1' : '0');
      paint();
    });
  }

  headsCounterPosition(): { x: number; y: number } {
    return { x: this.heads.x + 60, y: this.heads.y + 50 };
  }

  bounceHeads(): void {
    this.scene.tweens.killTweensOf(this.heads);
    this.heads.setScale(VISUAL.headsBounceScale);
    this.scene.tweens.add({ targets: this.heads, scale: 1, duration: VISUAL.headsBounceMs });
  }

  draw(hits: number, seconds: number, arrows: number): void {
    this.heads.setText(`${hits}/${this.totalHeads}`);
    this.time.setText(String(seconds));
    this.arrows.setText(String(arrows));
    let color: string = '#FFFFFF';
    if (seconds <= VISUAL.timerDangerSec) color = VISUAL.timerDangerColor;
    else if (seconds <= VISUAL.timerWarnSec) color = VISUAL.timerWarnColor;
    this.time.setColor(color);
  }
}

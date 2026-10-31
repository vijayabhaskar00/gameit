import Phaser from 'phaser';
import { HEIGHT, VISUAL, WIDTH } from '../config';
import { makePlaceholders } from '../objects/placeholders';

interface Manifest {
  basePath: string;
  images: {
    key: string;
    file: string;
    ready: boolean;
    frame?: { frameWidth: number; frameHeight: number };
  }[];
  audio: { key: string; files: string[]; ready: boolean }[];
}

const BAR_WIDTH = 640;
const BAR_HEIGHT = 16;

/** Loads what assets.json flags ready, then fills the gaps with placeholders. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.json('assets', '/assets/assets.json');
  }

  create(): void {
    const left = (WIDTH - BAR_WIDTH) / 2;
    const top = HEIGHT / 2;
    this.add.rectangle(left, top, BAR_WIDTH, BAR_HEIGHT, 0x33261f).setOrigin(0);
    const fill = this.add
      .rectangle(left, top, BAR_WIDTH, BAR_HEIGHT, Number(`0x${VISUAL.gold.slice(1)}`))
      .setOrigin(0)
      .setScale(0, 1);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => fill.setScale(value, 1));

    const manifest = this.cache.json.get('assets') as Manifest;
    this.load.setPath(manifest.basePath);
    for (const { key, file, ready, frame } of manifest.images) {
      if (!ready) continue;
      if (frame) this.load.spritesheet(key, file, frame);
      else this.load.image(key, file);
    }
    for (const { key, files, ready } of manifest.audio) if (ready) this.load.audio(key, files);

    // A missing file falls back to its placeholder rather than stopping the round.
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      makePlaceholders(this);
      this.scene.start('Game');
    });
    this.load.start();
  }
}

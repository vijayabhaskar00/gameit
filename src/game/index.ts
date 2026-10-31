import Phaser from 'phaser';
import type { EndReason, Shot, SimConfig } from '@sim';
import { getAudioContext } from '../lib/audio';
import { HEIGHT, VISUAL, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

export interface RoundEnd {
  seed: number;
  score: number;
  reason: EndReason;
  shotLog: Shot[];
  durationMs: number;
  replayMatches: boolean;
}

export interface GameOptions {
  seed: number;
  config: SimConfig;
  debug: boolean;
  onShot: () => void;
  onEnd: (end: RoundEnd) => void;
}

export function createGame(parent: HTMLElement, options: GameOptions): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: VISUAL.letterbox,
    banner: false,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { context: getAudioContext() },
    scene: [BootScene, GameScene],
  });
  game.registry.set('options', options);
  return game;
}

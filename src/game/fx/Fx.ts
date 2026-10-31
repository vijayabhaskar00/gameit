import Phaser from 'phaser';
import { HEIGHT, VISUAL, WIDTH } from '../config';

const HIT_BURST = 'hit_burst';

/** Everything that decorates the simulation. Nothing here feeds back into it. */
export class Fx {
  private trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private burst: Phaser.GameObjects.Particles.ParticleEmitter;
  private shards: Phaser.GameObjects.Particles.ParticleEmitter;
  private vignette: Phaser.GameObjects.Image;
  private plusOne: Phaser.GameObjects.Text;
  private music?: Phaser.Sound.BaseSound;

  constructor(private scene: Phaser.Scene) {
    const fire = { blendMode: Phaser.BlendModes.ADD, emitting: false };
    this.trail = scene.add.particles(0, 0, 'fx_ember', {
      ...fire,
      lifespan: 280,
      speed: { min: 10, max: 60 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xff8a1a, 0xffd23c],
      frequency: VISUAL.trailEveryMs,
    });
    this.burst = scene.add.particles(0, 0, 'fx_ember', {
      ...fire,
      lifespan: 450,
      speed: { min: 120, max: 520 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xff5a1a, 0xffd23c],
    });
    this.shards = scene.add.particles(0, 0, 'fx_spark', {
      emitting: false,
      lifespan: 650,
      speed: { min: 260, max: 620 },
      gravityY: 1400,
      scale: { start: 1.3, end: 0.5 },
      rotate: { min: 0, max: 360 },
    });
    this.vignette = scene.add
      .image(WIDTH / 2, HEIGHT / 2, 'vignette')
      .setAlpha(0)
      .setDepth(10);
    this.plusOne = scene.add
      .text(0, 0, '+1', {
        fontFamily: 'sans-serif',
        fontSize: '56px',
        fontStyle: 'bold',
        color: VISUAL.gold,
      })
      .setAlpha(0)
      .setDepth(11);

    if (scene.textures.exists(HIT_BURST) && !scene.anims.exists(HIT_BURST)) {
      scene.anims.create({
        key: HIT_BURST,
        frames: scene.anims.generateFrameNumbers(HIT_BURST),
        frameRate: 30,
      });
    }
  }

  play(key: string): void {
    if (this.scene.cache.audio.exists(key)) this.scene.sound.play(key);
  }

  startMusic(): void {
    if (!this.scene.cache.audio.exists('bgm_loop')) return;
    this.music = this.scene.sound.add('bgm_loop', { loop: true, volume: VISUAL.musicVolume });
    this.music.play();
  }

  fadeMusic(): void {
    if (!this.music) return;
    this.scene.tweens.add({
      targets: this.music,
      volume: 0,
      duration: VISUAL.musicFadeMs,
      onComplete: () => this.music?.stop(),
    });
  }

  arrowAt(x: number, y: number): void {
    this.trail.setPosition(x, y);
    if (!this.trail.emitting) this.trail.start();
  }

  arrowGone(): void {
    this.trail.stop();
  }

  hit(x: number, y: number, floatX: number, floatY: number): void {
    this.burst.explode(VISUAL.burstParticles, x, y);
    this.shards.explode(VISUAL.shards, x, y);
    if (this.scene.textures.exists(HIT_BURST)) {
      const sprite = this.scene.add.sprite(x, y, HIT_BURST).setBlendMode(Phaser.BlendModes.ADD);
      sprite.play(HIT_BURST).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        sprite.destroy();
      });
    }
    this.scene.cameras.main.shake(
      VISUAL.shakeMs,
      new Phaser.Math.Vector2(VISUAL.shakePx / WIDTH, VISUAL.shakePx / HEIGHT),
    );
    this.scene.tweens.killTweensOf(this.plusOne);
    this.plusOne.setPosition(floatX, floatY).setAlpha(1);
    this.scene.tweens.add({
      targets: this.plusOne,
      y: floatY - VISUAL.plusOneRisePx,
      alpha: 0,
      duration: VISUAL.plusOneMs,
    });
    navigator.vibrate?.(VISUAL.vibrateMs);
    this.play('sfx_hit');
  }

  dangerPulse(): void {
    this.vignette.setAlpha(1);
    this.scene.tweens.add({
      targets: this.vignette,
      alpha: 0,
      duration: VISUAL.vignettePulseMs,
    });
    this.play('sfx_tick');
  }
}

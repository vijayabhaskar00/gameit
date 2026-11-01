import Phaser from 'phaser';
import { canFire, createSim, simulate, stepSim, type SimConfig, type SimState } from '@sim';
import { campaign } from '../../config/campaign';
import { HEIGHT, VISUAL, WIDTH } from '../config';
import { Fx } from '../fx/Fx';
import type { GameOptions } from '../index';
import { aimFromDrag, Bow } from '../objects/Bow';
import { Hud } from '../objects/Hud';
import { headKey } from '../objects/placeholders';

export class GameScene extends Phaser.Scene {
  private opts!: GameOptions;
  private cfg!: SimConfig;
  private stepMs = 0;
  private sim!: SimState;
  private heads: Phaser.GameObjects.Image[] = [];
  private arrow!: Phaser.GameObjects.Image;
  private bow!: Bow;
  private hud!: Hud;
  private fx!: Fx;
  private debugText?: Phaser.GameObjects.Text;
  private debugGfx?: Phaser.GameObjects.Graphics;
  private running = false;
  private ended = false;
  private accumulator = 0;
  private pendingAngle?: number;
  private drag: { id: number; x: number; y: number } | null = null;
  private seenHits = 0;
  private hadArrow = false;
  private lastSecond = 0;
  private startedAt = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    this.opts = this.registry.get('options') as GameOptions;
    this.cfg = this.opts.config;
    this.stepMs = 1000 / this.cfg.tickRate;
    this.sim = createSim(this.opts.seed, this.cfg);
    this.lastSecond = this.cfg.roundSeconds;

    this.add.image(WIDTH / 2, HEIGHT / 2, 'bg_battlefield').setDisplaySize(WIDTH, HEIGHT);

    const boss = this.add.image(WIDTH / 2, VISUAL.bossFeetY, 'boss_body').setOrigin(0.5, 1);
    boss.setScale(VISUAL.bossHeight / boss.height);
    this.tweens.add({
      targets: boss,
      scaleY: boss.scaleY * VISUAL.breatheScaleY,
      duration: VISUAL.breatheMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.heads = this.sim.heads.map((h, i) => {
      const head = this.add.image(h.x, h.y, headKey(i));
      return head.setScale(this.cfg.headWidth / head.width);
    });

    this.fx = new Fx(this);
    this.arrow = this.add.image(0, 0, 'arrow').setOrigin(0.5, 0).setVisible(false);
    this.bow = new Bow(this);
    this.hud = new Hud(this, this.cfg.heads);

    if (this.opts.debug) {
      this.debugGfx = this.add.graphics();
      this.debugText = this.add.text(48, 200, '', { fontSize: '36px', color: '#00FF88' });
    }

    this.bindInput();
    this.bindVisibility();
    this.countdown(() => {
      this.popHeads();
      this.fx.startMusic();
      this.startedAt = performance.now();
      this.running = true;
    });
  }

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.running || this.drag || p.y < VISUAL.inputTopY) return;
      this.drag = { id: p.id, x: p.x, y: p.y };
      this.fx.play('sfx_draw');
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.drag?.id) return;
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      this.bow.angle = aimFromDrag(dx, dy);
      this.bow.pull = Math.hypot(dx, dy);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.drag?.id) return;
      if (this.bow.pull >= VISUAL.minDragPx && canFire(this.sim)) {
        this.pendingAngle = this.bow.angle;
        this.fx.play('sfx_release');
        this.opts.onShot();
      }
      this.cancelDrag();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  private cancelDrag(): void {
    this.drag = null;
    this.bow.pull = 0;
  }

  private bindVisibility(): void {
    let hiddenAt: number | null = null;
    const onChange = () => {
      if (document.hidden) {
        hiddenAt = performance.now();
        // The finger-up may never arrive, and a stuck drag blocks every later shot.
        this.cancelDrag();
        return;
      }
      if (hiddenAt === null) return;
      const away = performance.now() - hiddenAt;
      hiddenAt = null;
      if (!this.running || away <= VISUAL.hiddenPauseMs) return;
      this.running = false;
      this.accumulator = 0;
      this.cancelDrag();
      this.countdown(() => {
        this.running = true;
      });
    };
    document.addEventListener('visibilitychange', onChange);
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      document.removeEventListener('visibilitychange', onChange);
    });
  }

  /** Shows 3, 2, 1, GO! and calls onGo as GO! appears. */
  private countdown(onGo: () => void): void {
    const copy = campaign.game;
    const y = HEIGHT * 0.34;
    const style = { fontFamily: 'sans-serif', fontStyle: 'bold', color: '#FFFFFF' };
    const big = this.add.text(WIDTH / 2, y, '', { ...style, fontSize: '220px' }).setOrigin(0.5);
    const caption = this.add
      .text(WIDTH / 2, y + 170, copy.getReady, { ...style, fontSize: '48px' })
      .setOrigin(0.5);

    const show = (step: number) => {
      const isGo = step === 3;
      big.setText(isGo ? copy.go : String(3 - step));
      big.setColor(isGo ? VISUAL.gold : '#FFFFFF');
      big.setScale(VISUAL.countdownStartScale).setAlpha(1);
      caption.setVisible(!isGo);
      this.fx.play(isGo ? 'sfx_go' : 'sfx_countdown');
      if (isGo) onGo();
      this.tweens.add({
        targets: big,
        scale: 1,
        alpha: 0,
        duration: isGo ? VISUAL.goMs : VISUAL.countdownStepMs,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          if (!isGo) return show(step + 1);
          big.destroy();
          caption.destroy();
        },
      });
    };
    show(0);
  }

  private popHeads(): void {
    for (const head of this.heads) {
      this.tweens.add({
        targets: head,
        scale: head.scale * VISUAL.headPopScale,
        duration: VISUAL.headPopMs / 2,
        yoyo: true,
      });
    }
  }

  update(_time: number, delta: number): void {
    if (this.running) {
      this.accumulator += delta;
      let steps = 0;
      while (this.accumulator >= this.stepMs && !this.sim.endReason) {
        stepSim(this.sim, this.cfg, this.pendingAngle);
        this.pendingAngle = undefined;
        this.accumulator -= this.stepMs;
        // ponytail: a very slow device loses game time rather than spiralling.
        if (++steps === VISUAL.maxStepsPerFrame) this.accumulator = 0;
      }
    }
    this.draw();
    if (this.sim.endReason && !this.ended) this.finish();
  }

  private draw(): void {
    const s = this.sim;
    this.heads.forEach((sprite, i) => {
      const h = s.heads[i]!;
      if (!h.alive && sprite.visible) {
        const float = this.hud.headsCounterPosition();
        this.fx.hit(h.x, h.y, float.x, float.y);
        this.hud.bounceHeads();
      }
      sprite.setVisible(h.alive);
      if (!h.alive) return;
      sprite.setPosition(h.x, h.y);
      sprite.setAngle(VISUAL.headRotationDeg * Math.sin(s.tau * VISUAL.headRotationSpeed + i * 2));
    });

    this.arrow.setVisible(s.arrow !== null);
    if (s.arrow) {
      this.arrow.setPosition(s.arrow.x, s.arrow.y).setAngle(s.arrow.angle);
      this.fx.arrowAt(s.arrow.x, s.arrow.y);
    } else if (this.hadArrow) {
      this.fx.arrowGone();
      if (s.hits === this.seenHits) this.fx.play('sfx_miss');
    }
    this.hadArrow = s.arrow !== null;
    this.seenHits = s.hits;

    this.bow.draw(canFire(s));

    const ticksLeft = this.cfg.roundSeconds * this.cfg.tickRate - s.tick;
    const seconds = Math.ceil(ticksLeft / this.cfg.tickRate);
    this.hud.draw(s.hits, seconds, s.arrowsLeft);
    if (seconds !== this.lastSecond) {
      this.lastSecond = seconds;
      if (seconds > 0 && seconds <= VISUAL.timerDangerSec) this.fx.dangerPulse();
    }

    if (this.debugText && this.debugGfx) {
      const fps = this.game.loop.actualFps.toFixed(0);
      this.debugText.setText(`fps ${fps}\nseed ${this.opts.seed}\ntick ${s.tick}`);
      this.debugGfx.clear().lineStyle(3, 0x00ff88);
      const radius = this.cfg.headWidth * this.cfg.hitRadiusFactor;
      for (const h of s.heads) if (h.alive) this.debugGfx.strokeCircle(h.x, h.y, radius);
    }
  }

  private finish(): void {
    this.ended = true;
    this.running = false;
    this.cancelDrag();
    this.fx.arrowGone();
    this.fx.fadeMusic();
    const s = this.sim;
    const won = s.endReason === 'win';
    this.fx.play(won ? 'sfx_win' : 'sfx_lose_laugh');
    if (!won && this.textures.exists('head_laugh')) {
      this.heads.forEach((sprite) => sprite.setTexture('head_laugh'));
    }
    const replay = simulate(this.opts.seed, this.cfg, s.shotLog);
    this.opts.onEnd({
      seed: this.opts.seed,
      score: s.hits,
      reason: s.endReason!,
      shotLog: s.shotLog,
      durationMs: performance.now() - this.startedAt,
      replayMatches: replay.score === s.hits && replay.reason === s.endReason,
    });
  }
}

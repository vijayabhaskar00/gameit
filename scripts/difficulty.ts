// Plays bot rounds and prints the score distribution.
// pnpm difficulty [scale ...]   scale multiplies speedStart and speedEnd, default 1
import { SIM_CONFIG } from '../supabase/functions/_shared/simConfig.ts';
import { humanBot } from '../tests/bot.ts';

const ROUNDS = 1000;
const bot = { errorDeg: 6, reactionTicks: 18 }; // 300 ms at 60 Hz

const scales = process.argv.slice(2).map(Number);
for (const scale of scales.length ? scales : [1]) {
  const config = {
    ...SIM_CONFIG,
    speedStart: SIM_CONFIG.speedStart * scale,
    speedEnd: SIM_CONFIG.speedEnd * scale,
  };
  const counts = new Array<number>(config.heads + 1).fill(0);
  for (let seed = 1; seed <= ROUNDS; seed++) counts[humanBot(seed, config, bot).hits]!++;
  const mean = counts.reduce((sum, n, score) => sum + n * score, 0) / ROUNDS;
  console.log(
    `speed ${config.speedStart.toFixed(0)}->${config.speedEnd.toFixed(0)} px/s  ` +
      `win ${((counts[config.heads]! / ROUNDS) * 100).toFixed(1)}%  mean ${mean.toFixed(2)}`,
  );
  console.log('  ' + counts.map((n, score) => `${score}:${n}`).join(' '));
}

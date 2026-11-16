import './style.css';
import { Game } from './game/Game';

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('WebGL canvas #game-canvas not found');
  }
  const game = new Game(canvas);
  await game.init();
}

void bootstrap().catch((err) => {
  console.error('Starforge boot failure:', err);
  const log = document.getElementById('boot-log');
  if (log) {
    const line = document.createElement('div');
    line.textContent = `[ERROR] ${err instanceof Error ? err.message : String(err)}`;
    log.appendChild(line);
  }
});

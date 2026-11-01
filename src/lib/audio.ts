let context: AudioContext | undefined;

export function getAudioContext(): AudioContext {
  context ??= new AudioContext();
  return context;
}

/** iOS only starts audio inside a user gesture, and the game mounts after the tap. */
export function unlockAudio(): void {
  void getAudioContext().resume();
}

/** Covers a direct /play load with no earlier tap, and iOS stopping audio on an app switch. */
export function keepAudioUnlocked(): void {
  const resume = () => {
    if (context && context.state !== 'running') context.resume().catch(() => {});
  };
  for (const event of ['pointerup', 'touchend', 'click']) {
    window.addEventListener(event, resume, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resume();
  });
}

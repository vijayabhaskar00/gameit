let context: AudioContext | undefined;

export function getAudioContext(): AudioContext {
  context ??= new AudioContext();
  return context;
}

/** iOS only starts audio inside a user gesture, and the game mounts after the tap. */
export function unlockAudio(): void {
  void getAudioContext().resume();
}

/** "What's the pet currently saying" - a single timed speech-bubble line. */
export class SpeechController {
  private text: string | null = null;
  private remainingMs = 0;

  say(text: string, durationMs: number) {
    this.text = text;
    this.remainingMs = durationMs;
  }

  update(dtMs: number) {
    if (this.text === null) return;
    this.remainingMs -= dtMs;
    if (this.remainingMs <= 0) this.text = null;
  }

  get current(): string | null {
    return this.text;
  }
}

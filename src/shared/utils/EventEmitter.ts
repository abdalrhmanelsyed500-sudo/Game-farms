/**
 * Minimal typed event emitter with zero dependencies.
 *
 * Pure game-logic modules (world, chunks, state) use this instead of Phaser's
 * EventEmitter so they stay unit-testable in Node without a Phaser import.
 */

export type EventHandler<T = void> = (payload: T) => void;

export class TypedEventEmitter<Events extends object> {
  private readonly handlers = new Map<keyof Events, Set<EventHandler<never>>>();

  public on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<never>);
    return () => this.off(event, handler);
  }

  public off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<never>);
  }

  public emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    // Copy to tolerate handlers that unsubscribe mid-emit.
    for (const handler of [...set]) {
      (handler as EventHandler<Events[K]>)(payload);
    }
  }

  public removeAllListeners(event?: keyof Events): void {
    if (event === undefined) {
      this.handlers.clear();
    } else {
      this.handlers.delete(event);
    }
  }
}

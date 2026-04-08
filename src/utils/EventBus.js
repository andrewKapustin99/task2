export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, listener) {
    if (typeof listener !== "function") {
      throw new TypeError(
        `EventBus.on: listener must be a function, got ${typeof listener}`,
      );
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }

    this._listeners.get(event).add(listener);

    return () => this.off(event, listener);
  }

  once(event, listener) {
    const wrapper = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event, listener) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return;

    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (err) {
        console.error(
          `EventBus: uncaught error in listener for "${event}"`,
          err,
        );
      }
    }
  }

  clear(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  listenerCount(event) {
    return this._listeners.get(event)?.size ?? 0;
  }
}

export const eventBus = new EventBus();

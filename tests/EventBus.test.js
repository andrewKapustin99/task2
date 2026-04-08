import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../src/utils/EventBus.js";

describe("EventBus", () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe("on() + emit()", () => {
    it("calls the listener when the matching event is emitted", () => {
      const spy = vi.fn();
      bus.on("test:event", spy);
      bus.emit("test:event", { value: 42 });
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith({ value: 42 });
    });

    it("calls multiple listeners for the same event", () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      bus.on("multi", spy1);
      bus.on("multi", spy2);
      bus.emit("multi", "payload");
      expect(spy1).toHaveBeenCalledOnce();
      expect(spy2).toHaveBeenCalledOnce();
    });

    it("does NOT call listeners registered for a different event", () => {
      const spy = vi.fn();
      bus.on("event:a", spy);
      bus.emit("event:b", {});
      expect(spy).not.toHaveBeenCalled();
    });

    it("does nothing when emitting an event with no listeners", () => {
      expect(() => bus.emit("no-listeners", {})).not.toThrow();
    });

    it("passes the payload object through unchanged", () => {
      const payload = { score: 7, total: 10 };
      const spy = vi.fn();
      bus.on("score:updated", spy);
      bus.emit("score:updated", payload);
      expect(spy).toHaveBeenCalledWith(payload);
    });

    it("throws TypeError when listener is not a function", () => {
      expect(() => bus.on("bad", "not-a-function")).toThrow(TypeError);
      expect(() => bus.on("bad", null)).toThrow(TypeError);
    });
  });

  describe("unsubscribe function returned by on()", () => {
    it("stops the listener from receiving future events", () => {
      const spy = vi.fn();
      const off = bus.on("unsub", spy);

      bus.emit("unsub", 1);
      expect(spy).toHaveBeenCalledTimes(1);

      off();

      bus.emit("unsub", 2);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("removes the event key from the registry when the last listener is removed", () => {
      const off = bus.on("solo", vi.fn());
      expect(bus.listenerCount("solo")).toBe(1);
      off();
      expect(bus.listenerCount("solo")).toBe(0);
    });
  });

  describe("off()", () => {
    it("removes a specific listener by reference", () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      bus.on("ev", spy1);
      bus.on("ev", spy2);

      bus.off("ev", spy1);
      bus.emit("ev", {});

      expect(spy1).not.toHaveBeenCalled();
      expect(spy2).toHaveBeenCalledOnce();
    });

    it("is a no-op when the event does not exist", () => {
      expect(() => bus.off("ghost", vi.fn())).not.toThrow();
    });
  });

  describe("once()", () => {
    it("calls the listener exactly once even when emitted multiple times", () => {
      const spy = vi.fn();
      bus.once("ping", spy);

      bus.emit("ping", "a");
      bus.emit("ping", "b");
      bus.emit("ping", "c");

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith("a");
    });

    it("auto-removes itself so listenerCount drops to 0 after first emit", () => {
      bus.once("single", vi.fn());
      expect(bus.listenerCount("single")).toBe(1);
      bus.emit("single", null);
      expect(bus.listenerCount("single")).toBe(0);
    });

    it("can be unsubscribed before it fires via the returned function", () => {
      const spy = vi.fn();
      const off = bus.once("cancelable", spy);
      off();
      bus.emit("cancelable", {});
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("clear()", () => {
    it("removes all listeners for a specific event", () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      bus.on("x", spy1);
      bus.on("x", spy2);

      bus.clear("x");
      bus.emit("x", {});

      expect(spy1).not.toHaveBeenCalled();
      expect(spy2).not.toHaveBeenCalled();
    });

    it("removes ALL listeners when called without an argument", () => {
      const spyA = vi.fn();
      const spyB = vi.fn();
      bus.on("a", spyA);
      bus.on("b", spyB);

      bus.clear();

      bus.emit("a", {});
      bus.emit("b", {});

      expect(spyA).not.toHaveBeenCalled();
      expect(spyB).not.toHaveBeenCalled();
    });
  });

  describe("listener error isolation", () => {
    it("continues calling remaining listeners even if one throws", () => {
      const good = vi.fn();
      const bad = vi.fn(() => {
        throw new Error("boom");
      });

      bus.on("ev", bad);
      bus.on("ev", good);

      expect(() => bus.emit("ev", {})).not.toThrow();
      expect(good).toHaveBeenCalledOnce();
    });
  });

  describe("listenerCount()", () => {
    it("returns 0 for an event with no listeners", () => {
      expect(bus.listenerCount("nonexistent")).toBe(0);
    });

    it("returns the correct count as listeners are added and removed", () => {
      const a = vi.fn();
      const b = vi.fn();

      bus.on("cnt", a);
      expect(bus.listenerCount("cnt")).toBe(1);

      bus.on("cnt", b);
      expect(bus.listenerCount("cnt")).toBe(2);

      bus.off("cnt", a);
      expect(bus.listenerCount("cnt")).toBe(1);
    });

    it("does not count the same function twice if registered twice", () => {
      const spy = vi.fn();
      bus.on("dedup", spy);
      bus.on("dedup", spy);
      expect(bus.listenerCount("dedup")).toBe(1);
    });
  });
});

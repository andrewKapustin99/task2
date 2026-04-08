import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuizModel, QuizState } from "../src/models/QuizModel.js";
import { eventBus } from "../src/utils/EventBus.js";

function makeQuestion(overrides = {}) {
  return {
    id: "q0-Who_is",
    type: "multiple",
    difficulty: "medium",
    category: "General Knowledge",
    text: "Who is the current president?",
    correctAnswer: "Alice",
    allAnswers: ["Alice", "Bob", "Carol", "Dave"],
    ...overrides,
  };
}

function makeMockApi(questions = [makeQuestion(), makeQuestion({ id: "q1" })]) {
  return {
    fetchQuestions: vi.fn().mockResolvedValue(questions),
  };
}

async function loadAndStart(model) {
  await model.loadQuestions();
  model.start();
}

describe("QuizModel", () => {
  let model;
  let mockApi;

  beforeEach(() => {
    mockApi = makeMockApi();
    model = new QuizModel(mockApi);
    eventBus.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("starts in IDLE state", () => {
      expect(model.state).toBe(QuizState.IDLE);
    });

    it("has no questions, zero score, and index 0", () => {
      expect(model.questions).toHaveLength(0);
      expect(model.score).toBe(0);
      expect(model.currentIndex).toBe(0);
      expect(model.currentQuestion).toBeNull();
    });
  });

  describe("loadQuestions()", () => {
    it("transitions IDLE → LOADING → READY on success", async () => {
      const states = [];
      eventBus.on("quiz:loading", () => states.push("loading"));
      eventBus.on("quiz:ready", () => states.push("ready"));

      await model.loadQuestions();

      expect(states).toEqual(["loading", "ready"]);
      expect(model.state).toBe(QuizState.READY);
    });

    it("populates the questions array after a successful fetch", async () => {
      await model.loadQuestions();
      expect(model.questions).toHaveLength(2);
      expect(model.total).toBe(2);
    });

    it("transitions to ERROR and emits quiz:error when fetch fails", async () => {
      mockApi.fetchQuestions.mockRejectedValue(new Error("Network error"));

      const errorSpy = vi.fn();
      eventBus.on("quiz:error", errorSpy);

      await model.loadQuestions();

      expect(model.state).toBe(QuizState.ERROR);
      expect(errorSpy).toHaveBeenCalledOnce();
      expect(errorSpy).toHaveBeenCalledWith({ message: "Network error" });
    });

    it("is idempotent — does not re-fetch while already loading", async () => {
      const first = model.loadQuestions();
      model.loadQuestions();
      await first;
      expect(mockApi.fetchQuestions).toHaveBeenCalledOnce();
    });
  });

  describe("start()", () => {
    it("transitions READY → ACTIVE", async () => {
      await model.loadQuestions();
      model.start();
      expect(model.state).toBe(QuizState.ACTIVE);
    });

    it("emits quiz:started then quiz:question with the first question", async () => {
      const order = [];
      eventBus.on("quiz:started", () => order.push("started"));
      eventBus.on("quiz:question", (payload) =>
        order.push({ index: payload.index }),
      );

      await model.loadQuestions();
      model.start();

      expect(order).toEqual(["started", { index: 0 }]);
    });

    it("resets score to 0 each time start() is called", async () => {
      await model.loadQuestions();
      model.start();
      model.answer("Alice");
      mockApi = makeMockApi();
      model = new QuizModel(mockApi);
      await model.loadQuestions();
      model.start();
      expect(model.score).toBe(0);
    });

    it("warns (but does not throw) if called before READY", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      model.start();
      expect(warn).toHaveBeenCalled();
      expect(model.state).toBe(QuizState.IDLE);
    });
  });

  describe("answer()", () => {
    beforeEach(async () => {
      await loadAndStart(model);
    });

    it("increments score by 1 for a correct answer", () => {
      const question = model.currentQuestion;
      model.answer(question.correctAnswer);
      expect(model.score).toBe(1);
    });

    it("does NOT increment score for a wrong answer", () => {
      const question = model.currentQuestion;
      const wrong = question.allAnswers.find(
        (a) => a !== question.correctAnswer,
      );
      model.answer(wrong);
      expect(model.score).toBe(0);
    });

    it("does NOT increment score when null is passed (timeout)", () => {
      model.answer(null);
      expect(model.score).toBe(0);
    });

    it("emits quiz:answered with correct=true for a correct answer", () => {
      const spy = vi.fn();
      eventBus.on("quiz:answered", spy);

      const { correctAnswer } = model.currentQuestion;
      model.answer(correctAnswer);

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ correct: true, score: 1 }),
      );
    });

    it("emits quiz:answered with correct=false for a wrong answer", () => {
      const spy = vi.fn();
      eventBus.on("quiz:answered", spy);

      model.answer("completely-wrong-answer");

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ correct: false, score: 0 }),
      );
    });

    it("returns null and warns if called outside ACTIVE state", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const freshModel = new QuizModel(mockApi);
      const result = freshModel.answer("Alice");
      expect(result).toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it("accumulates score correctly over multiple correct answers", async () => {
      const q1 = makeQuestion({
        id: "q0",
        correctAnswer: "A",
        allAnswers: ["A", "B", "C", "D"],
      });
      const q2 = makeQuestion({
        id: "q1",
        correctAnswer: "B",
        allAnswers: ["A", "B", "C", "D"],
      });
      const q3 = makeQuestion({
        id: "q2",
        correctAnswer: "C",
        allAnswers: ["A", "B", "C", "D"],
      });
      const api = makeMockApi([q1, q2, q3]);
      const m = new QuizModel(api);

      await m.loadQuestions();
      m.start();

      m.answer("A");
      m.advance();
      m.answer("B");
      m.advance();
      m.answer("X");

      expect(m.score).toBe(2);
    });
  });

  describe("advance()", () => {
    beforeEach(async () => {
      await loadAndStart(model);
    });

    it("increments currentIndex after answering", () => {
      expect(model.currentIndex).toBe(0);
      model.answer(null);
      model.advance();
      expect(model.currentIndex).toBe(1);
    });

    it("emits quiz:question with the new index after advancing", () => {
      const spy = vi.fn();
      eventBus.on("quiz:question", spy);

      model.answer(null);
      model.advance();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ index: 1, total: 2 }),
      );
    });

    it("transitions to FINISHED and emits quiz:finished after the last question", () => {
      const finishedSpy = vi.fn();
      eventBus.on("quiz:finished", finishedSpy);

      model.answer("Alice");
      model.advance();

      model.answer(null);
      model.advance();

      expect(model.state).toBe(QuizState.FINISHED);
      expect(finishedSpy).toHaveBeenCalledWith({ score: 1, total: 2 });
    });

    it("hasNext is true while questions remain, false at the end", () => {
      expect(model.hasNext).toBe(true);
      model.answer(null);
      model.advance();
      expect(model.hasNext).toBe(false);
    });
  });

  describe("restart()", () => {
    it("resets state to IDLE then kicks off a new load cycle", async () => {
      await loadAndStart(model);
      model.answer("Alice");
      await model.restart();

      expect(model.state).toBe(QuizState.READY);
      expect(model.score).toBe(0);
      expect(model.currentIndex).toBe(0);
    });

    it("emits quiz:restarted before the new load", async () => {
      await loadAndStart(model);
      const spy = vi.fn();
      eventBus.on("quiz:restarted", spy);

      await model.restart();

      expect(spy).toHaveBeenCalledOnce();
    });

    it("calls fetchQuestions a second time on restart", async () => {
      await model.loadQuestions();
      await model.restart();
      expect(mockApi.fetchQuestions).toHaveBeenCalledTimes(2);
    });
  });
});

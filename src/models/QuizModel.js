import { eventBus } from "../utils/EventBus.js";

export const QuizState = {
  IDLE: "IDLE",
  LOADING: "LOADING",
  ERROR: "ERROR",
  READY: "READY",
  ACTIVE: "ACTIVE",
  FINISHED: "FINISHED",
};

export class QuizModel {
  constructor(apiService) {
    this._api = apiService;
    this._reset();
  }

  get state() {
    return this._state;
  }
  get questions() {
    return [...this._questions];
  }
  get currentQuestion() {
    return this._questions[this._currentIndex] ?? null;
  }
  get currentIndex() {
    return this._currentIndex;
  }
  get total() {
    return this._questions.length;
  }
  get score() {
    return this._score;
  }
  get isActive() {
    return this._state === QuizState.ACTIVE;
  }
  get hasNext() {
    return this._currentIndex < this._questions.length - 1;
  }

  async loadQuestions() {
    if (this._state === QuizState.LOADING) return;

    this._setState(QuizState.LOADING);
    eventBus.emit("quiz:loading");

    try {
      this._questions = await this._api.fetchQuestions();
      this._setState(QuizState.READY);
      eventBus.emit("quiz:ready");
    } catch (err) {
      this._setState(QuizState.ERROR);
      eventBus.emit("quiz:error", { message: err.message });
    }
  }

  start() {
    if (this._state !== QuizState.READY) {
      console.warn(`QuizModel.start() called in invalid state: ${this._state}`);
      return;
    }

    this._currentIndex = 0;
    this._score = 0;
    this._setState(QuizState.ACTIVE);
    eventBus.emit("quiz:started");
    this._emitCurrentQuestion();
  }

  answer(selectedAnswer) {
    if (this._state !== QuizState.ACTIVE) {
      console.warn(
        `QuizModel.answer() called in invalid state: ${this._state}`,
      );
      return null;
    }

    const question = this.currentQuestion;
    const correct = selectedAnswer === question.correctAnswer;

    if (correct) {
      this._score += 1;
    }

    const result = {
      correct,
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      score: this._score,
    };

    eventBus.emit("quiz:answered", result);
    return result;
  }

  advance() {
    if (this._state !== QuizState.ACTIVE) return;

    if (this.hasNext) {
      this._currentIndex += 1;
      this._emitCurrentQuestion();
    } else {
      this._finish();
    }
  }

  async restart() {
    this._reset();
    eventBus.emit("quiz:restarted");
    await this.loadQuestions();
  }

  _reset() {
    this._state = QuizState.IDLE;
    this._questions = [];
    this._currentIndex = 0;
    this._score = 0;
  }

  _setState(newState) {
    if (import.meta.env?.DEV) {
      console.debug(`[QuizModel] ${this._state} → ${newState}`);
    }
    this._state = newState;
  }

  _emitCurrentQuestion() {
    eventBus.emit("quiz:question", {
      question: this.currentQuestion,
      index: this._currentIndex,
      total: this._questions.length,
    });
  }

  _finish() {
    this._setState(QuizState.FINISHED);
    eventBus.emit("quiz:finished", {
      score: this._score,
      total: this._questions.length,
    });
  }
}

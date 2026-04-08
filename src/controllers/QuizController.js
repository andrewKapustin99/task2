import { eventBus } from "../utils/EventBus.js";

export const TIMER_DURATION = 10;

const REVEAL_DELAY_MS = 2000;

export class QuizController {
  constructor(model, view) {
    this._model = model;
    this._view = view;
    this._worker = null;
    this._answered = false;
    this._advanceTimer = null;
    this._unsubscribers = [];
    this._init();
  }

  _init() {
    this._sub("quiz:loading", () => this._onLoading());
    this._sub("quiz:error", ({ message }) => this._onError(message));
    this._sub("quiz:ready", () => this._onReady());
    this._sub("quiz:started", () => this._onStarted());
    this._sub("quiz:question", (payload) => this._onQuestion(payload));
    this._sub("quiz:answered", (payload) => this._onAnswered(payload));
    this._sub("quiz:finished", (payload) => this._onFinished(payload));
    this._sub("quiz:restarted", () => this._onRestarted());

    this._view.bindStart(() => this._model.start());
    this._view.bindRetry(() => this._model.loadQuestions());
    this._view.bindRestart(() => this._model.restart());
    this._view.bindAnswer((answer) => this._handleAnswer(answer));
  }

  _sub(event, handler) {
    this._unsubscribers.push(eventBus.on(event, handler));
  }

  destroy() {
    this._unsubscribers.forEach((off) => off());
    this._unsubscribers = [];
    this._terminateWorker();
    clearTimeout(this._advanceTimer);
  }

  _onLoading() {
    this._view.showScreen("loading");
  }

  _onError(message) {
    this._view.renderError(message);
  }

  _onReady() {
    this._view.showScreen("start");
  }

  _onStarted() {
    this._view.showScreen("quiz");
    this._view.renderScore(0);
  }

  _onQuestion({ question, index, total }) {
    this._answered = false;
    this._view.renderQuestion(question, index, total);
    this._view.startTimerBar();
    this._startWorker();
  }

  _onAnswered({ correctAnswer, selectedAnswer, score }) {
    this._stopWorker();
    this._view.stopTimerBar();
    this._view.renderAnswerReveal(correctAnswer, selectedAnswer);
    this._view.renderScore(score);
    this._scheduleAdvance();
  }

  _onFinished({ score, total }) {
    this._terminateWorker();
    this._view.renderResults(score, total);
  }

  _onRestarted() {
    clearTimeout(this._advanceTimer);
    this._terminateWorker();
    this._view.showScreen("loading");
    this._view.renderScore(0);
  }

  _handleAnswer(answer) {
    if (this._answered || !this._model.isActive) return;
    this._answered = true;
    this._model.answer(answer);
  }

  _startWorker() {
    this._terminateWorker();
    this._worker = new Worker(
      new URL("../workers/timer.worker.js", import.meta.url),
      { type: "module" },
    );
    this._worker.onmessage = (e) => this._handleWorkerMessage(e.data);
    this._worker.onerror = (e) =>
      console.error("[QuizController] Worker error:", e.message);
    this._worker.postMessage({ type: "START", duration: TIMER_DURATION });
  }

  _stopWorker() {
    this._worker?.postMessage({ type: "STOP" });
  }

  _terminateWorker() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  }

  _handleWorkerMessage(data) {
    switch (data.type) {
      case "TICK":
        this._view.renderTimer(data.remaining);
        break;
      case "EXPIRED":
        if (!this._answered) {
          this._answered = true;
          this._model.answer(null);
        }
        break;
      default:
        console.warn("[QuizController] Unknown worker message:", data.type);
    }
  }

  _scheduleAdvance() {
    clearTimeout(this._advanceTimer);
    this._advanceTimer = setTimeout(() => {
      this._model.advance();
    }, REVEAL_DELAY_MS);
  }
}

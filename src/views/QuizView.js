import { TIMER_DURATION } from "../controllers/QuizController.js";

const OPTION_LETTERS = ["A", "B", "C", "D"];

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export class QuizView {
  constructor() {
    this.$screenStart = this._qs("#screen-start");
    this.$screenLoading = this._qs("#screen-loading");
    this.$screenError = this._qs("#screen-error");
    this.$screenQuiz = this._qs("#screen-quiz");
    this.$screenResults = this._qs("#screen-results");

    this.$scoreBadge = this._qs("#score-badge");
    this.$scoreValue = this._qs("#score-value");

    this.$btnStart = this._qs("#btn-start");

    this.$btnRetry = this._qs("#btn-retry");
    this.$errorMessage = this._qs("#error-message");

    this.$questionIndex = this._qs("#question-index");
    this.$questionTotal = this._qs("#question-total");
    this.$quizProgress = this._qs("#quiz-progress");
    this.$timerDisplay = this._qs("#timer-display");
    this.$quizTimer = this._qs("#quiz-timer");
    this.$timerBar = this._qs("#timer-bar");

    this.$questionCategory = this._qs("#question-category");
    this.$questionText = this._qs("#question-text");
    this.$optionsList = this._qs("#options-list");

    this.$resultsBadge = this._qs("#results-badge");
    this.$resultsScore = this._qs("#results-score");
    this.$resultsTotal = this._qs("#results-total");
    this.$resultsMessage = this._qs("#results-message");
    this.$resultsBar = this._qs("#results-bar");
    this.$resultsLabel = this._qs("#results-breakdown-label");
    this.$btnRestart = this._qs("#btn-restart");
  }

  showScreen(name) {
    const map = {
      start: this.$screenStart,
      loading: this.$screenLoading,
      error: this.$screenError,
      quiz: this.$screenQuiz,
      results: this.$screenResults,
    };

    Object.entries(map).forEach(([key, el]) => {
      el.hidden = key !== name;
    });

    this.$scoreBadge.hidden = name !== "quiz";
  }

  bindStart(handler) {
    this.$btnStart.addEventListener("click", handler);
  }

  bindRetry(handler) {
    this.$btnRetry.addEventListener("click", handler);
  }

  bindRestart(handler) {
    this.$btnRestart.addEventListener("click", handler);
  }

  bindAnswer(handler) {
    const debouncedHandler = debounce((answer) => handler(answer), 200);

    this.$optionsList.addEventListener("click", (e) => {
      const btn = e.target.closest(".option-btn");
      if (!btn || btn.disabled) return;
      debouncedHandler(btn.dataset.answer);
    });

    this.$optionsList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const btn = e.target.closest(".option-btn");
      if (!btn || btn.disabled) return;
      e.preventDefault();
      debouncedHandler(btn.dataset.answer);
    });
  }

  renderError(message) {
    this.$errorMessage.textContent = message;
    this.showScreen("error");
  }

  renderQuestion(question, index, total) {
    const humanIndex = index + 1;
    this.$questionIndex.textContent = String(humanIndex);
    this.$questionTotal.textContent = String(total);
    this.$quizProgress.max = total;
    this.$quizProgress.value = humanIndex;
    this.$quizProgress.setAttribute("aria-valuenow", humanIndex);

    this.$questionCategory.textContent = question.category;
    this.$questionText.textContent = question.text;

    const fragment = document.createDocumentFragment();

    question.allAnswers.forEach((answer, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "listitem");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.dataset.answer = answer;
      btn.setAttribute("aria-pressed", "false");
      btn.style.setProperty("--option-index", String(i));

      const letter = document.createElement("span");
      letter.className = "option-btn__letter";
      letter.setAttribute("aria-hidden", "true");
      letter.textContent = OPTION_LETTERS[i] ?? String(i + 1);

      const text = document.createElement("span");
      text.className = "option-btn__text";
      text.textContent = answer;

      btn.append(letter, text);
      li.appendChild(btn);
      fragment.appendChild(li);
    });

    this.$optionsList.replaceChildren(fragment);

    this.$questionText.focus();
    requestAnimationFrame(() => {
      const firstBtn = this.$optionsList.querySelector(".option-btn");
      firstBtn?.focus();
    });
  }

  renderAnswerReveal(correctAnswer, selectedAnswer) {
    const buttons = this.$optionsList.querySelectorAll(".option-btn");

    buttons.forEach((btn) => {
      btn.disabled = true;
      btn.setAttribute("aria-pressed", "false");

      const answer = btn.dataset.answer;

      if (answer === correctAnswer) {
        btn.classList.add("option-btn--correct");
        btn.setAttribute("aria-label", `${answer} — correct`);
      } else if (answer === selectedAnswer) {
        btn.classList.add("option-btn--wrong");
        btn.setAttribute("aria-label", `${answer} — incorrect`);
      } else {
        btn.classList.add("option-btn--dimmed");
      }
    });

    const correctBtn = this.$optionsList.querySelector(".option-btn--correct");
    correctBtn?.focus();
  }

  renderScore(score) {
    this.$scoreValue.textContent = String(score);
  }

  renderTimer(remaining) {
    this.$timerDisplay.textContent = String(remaining);
    this.$timerDisplay.setAttribute("datetime", `PT${remaining}S`);

    const isDanger = remaining <= 3 && remaining > 0;
    this.$quizTimer.classList.toggle("quiz-timer--danger", isDanger);
    this.$timerBar.classList.toggle("timer-bar--danger", isDanger);
  }

  startTimerBar() {
    this.$timerBar.classList.remove("timer-bar--running", "timer-bar--danger");
    void this.$timerBar.offsetWidth;
    this.$timerBar.classList.add("timer-bar--running");
  }

  stopTimerBar() {
    this.$timerBar.classList.remove("timer-bar--running");
  }

  renderResults(score, total) {
    this.$resultsScore.textContent = String(score);
    this.$resultsTotal.textContent = String(total);

    const pct = total > 0 ? score / total : 0;
    const { badge, message } = this._getResultsTier(pct);

    this.$resultsBadge.textContent = badge;
    this.$resultsMessage.textContent = message;

    this.$resultsBar.style.width = "0%";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.$resultsBar.style.width = `${pct * 100}%`;
      });
    });

    this.$resultsLabel.textContent = `${score} correct out of ${total} questions`;

    this.showScreen("results");

    requestAnimationFrame(() => this.$btnRestart.focus());
  }

  _qs(selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`QuizView: element not found — "${selector}"`);
    return el;
  }

  _getResultsTier(pct) {
    if (pct === 1)
      return { badge: "🏆", message: "Perfect score! You're a trivia genius!" };
    if (pct >= 0.8)
      return { badge: "🥇", message: "Excellent! You really know your stuff." };
    if (pct >= 0.6)
      return { badge: "🥈", message: "Great job! A solid performance." };
    if (pct >= 0.4)
      return { badge: "🥉", message: "Not bad! Keep practising." };
    return {
      badge: "📚",
      message: "Keep learning — you'll do better next time!",
    };
  }
}

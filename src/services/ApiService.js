const API_BASE_URL = "https://opentdb.com/api.php";

const RESPONSE_CODE = {
  SUCCESS: 0,
  NO_RESULTS: 1,
  INVALID_PARAM: 2,
  TOKEN_NOT_FOUND: 3,
  TOKEN_EMPTY: 4,
};

function decodeHtml(html) {
  if (typeof document === "undefined") return html;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeQuestion(raw, index) {
  const text = decodeHtml(raw.question);
  const correctAnswer = decodeHtml(raw.correct_answer);
  const incorrect = raw.incorrect_answers.map(decodeHtml);

  return {
    id: `q${index}-${text.slice(0, 8).replace(/\s/g, "_")}`,
    type: raw.type,
    difficulty: raw.difficulty,
    category: decodeHtml(raw.category),
    text,
    correctAnswer,
    allAnswers: shuffleArray([correctAnswer, ...incorrect]),
  };
}

export class ApiService {
  constructor({ amount = 10, timeoutMs = 8000 } = {}) {
    this.amount = amount;
    this.timeoutMs = timeoutMs;
  }

  async fetchQuestions() {
    const url = this._buildUrl();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(
          "Request timed out. Please check your connection and try again.",
        );
      }
      throw new Error("Network error. Please check your internet connection.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(
        `Server error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    this._assertResponseCode(data.response_code);

    if (!Array.isArray(data.results) || data.results.length === 0) {
      throw new Error("No questions were returned. Please try again.");
    }

    return data.results.map(normalizeQuestion);
  }

  _buildUrl() {
    const params = new URLSearchParams({
      amount: String(this.amount),
      type: "multiple",
    });
    return `${API_BASE_URL}?${params}`;
  }

  _assertResponseCode(code) {
    if (code === RESPONSE_CODE.SUCCESS) return;

    const messages = {
      [RESPONSE_CODE.NO_RESULTS]:
        "Not enough questions available. Try again with different settings.",
      [RESPONSE_CODE.INVALID_PARAM]: "Invalid request parameters.",
      [RESPONSE_CODE.TOKEN_NOT_FOUND]:
        "Session token not found. Please restart.",
      [RESPONSE_CODE.TOKEN_EMPTY]:
        "All available questions have been used. Please restart.",
    };

    throw new Error(messages[code] ?? `Unknown API error (code ${code}).`);
  }
}

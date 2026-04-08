import "./style.css";

import { ApiService } from "./services/ApiService.js";
import { QuizModel } from "./models/QuizModel.js";
import { QuizView } from "./views/QuizView.js";
import { QuizController } from "./controllers/QuizController.js";

function bootstrap() {
  const apiService = new ApiService({ amount: 10 });
  const model = new QuizModel(apiService);
  const view = new QuizView();
  const controller = new QuizController(model, view);

  if (import.meta.env?.DEV) {
    window.__quiz = { model, view, controller };
    console.info("[QuizApp] Debug handle available at window.__quiz");
  }

  model.loadQuestions();

  window.addEventListener("beforeunload", () => controller.destroy(), {
    once: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}

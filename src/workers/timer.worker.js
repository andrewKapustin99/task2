let intervalId = null;
let remaining = 0;

function startTimer(duration) {
  stopTimer();
  remaining = duration;
  self.postMessage({ type: "TICK", remaining });

  intervalId = setInterval(() => {
    remaining -= 1;

    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      remaining = 0;
      self.postMessage({ type: "TICK", remaining: 0 });
      self.postMessage({ type: "EXPIRED" });
    } else {
      self.postMessage({ type: "TICK", remaining });
    }
  }, 1000);
}

function stopTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  remaining = 0;
}

self.onmessage = function handleMessage(event) {
  const { type, duration } = event.data;

  switch (type) {
    case "START":
      if (typeof duration !== "number" || duration <= 0) {
        console.error(
          "[timer.worker] START requires a positive numeric duration",
        );
        return;
      }
      startTimer(duration);
      break;

    case "STOP":
      stopTimer();
      break;

    default:
      console.warn(`[timer.worker] Unknown message type: "${type}"`);
  }
};

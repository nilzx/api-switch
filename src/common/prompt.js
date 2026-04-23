"use strict";

const readline = require("node:readline");

async function promptSelection(options, streams = {}) {
  const input = streams.input ?? process.stdin;
  const output = streams.output ?? process.stdout;

  if (options.length === 0) {
    output.write("No providers available.\n");
    return null;
  }

  output.write("Available providers:\n");
  options.forEach((option, index) => {
    output.write(`${index}. ${option.label}\n`);
  });
  output.write("Press Enter, q, or Esc to cancel.\n");

  if (isInteractiveTty(input)) {
    return promptSelectionFromTty(options, input, output);
  }

  return promptSelectionFromLineInput(options, input, output);
}

function promptSelectionFromTty(options, input, output) {
  return new Promise((resolve) => {
    let buffer = "";
    const previousRawMode = input.isRaw;

    readline.emitKeypressEvents(input);
    if (typeof input.resume === "function") {
      input.resume();
    }
    input.setRawMode(true);
    renderPrompt(output, buffer);

    const cleanup = () => {
      input.off("keypress", onKeypress);
      input.setRawMode(previousRawMode === true);
      if (typeof input.pause === "function") {
        input.pause();
      }
    };

    const cancel = () => {
      output.write("\n");
      cleanup();
      resolve(null);
    };

    const select = (option) => {
      rewritePrompt(output, option.label);
      cleanup();
      resolve(option);
    };

    const resetWithError = () => {
      output.write("\nInvalid selection.\n");
      buffer = "";
      renderPrompt(output, buffer);
    };

    const onKeypress = (character, key = {}) => {
      if (key.sequence === "\u0003") {
        cleanup();
        process.kill(process.pid, "SIGINT");
        return;
      }

      if (key.name === "escape") {
        cancel();
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        if (!buffer) {
          cancel();
          return;
        }

        const selectedIndex = Number.parseInt(buffer, 10);
        if (
          Number.isInteger(selectedIndex) &&
          selectedIndex >= 0 &&
          selectedIndex < options.length
        ) {
          select(options[selectedIndex]);
          return;
        }

        resetWithError();
        return;
      }

      if (key.name === "backspace") {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          renderPrompt(output, buffer);
        }
        return;
      }

      if (character === "q" || character === "Q") {
        cancel();
        return;
      }

      if (/^[0-9]$/.test(character)) {
        buffer += character;
        renderPrompt(output, buffer);
      }
    };

    input.on("keypress", onKeypress);
  });
}

async function promptSelectionFromLineInput(options, input, output) {
  const rl = readline.createInterface({
    input,
    output
  });

  try {
    while (true) {
      const answer = (await askQuestion(rl, "Select a provider: ")).trim();

      if (!answer || answer.toLowerCase() === "q" || answer === "\u001b") {
        return null;
      }

      const selectedIndex = Number.parseInt(answer, 10);
      if (
        Number.isInteger(selectedIndex) &&
        selectedIndex >= 0 &&
        selectedIndex < options.length
      ) {
        output.write(`Selected provider: ${options[selectedIndex].label}\n`);
        return options[selectedIndex];
      }

      output.write("Invalid selection.\n");
    }
  } finally {
    rl.close();
  }
}

function askQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function renderPrompt(output, buffer) {
  output.write(`\r\x1b[2KSelect a provider: ${buffer}`);
}

function rewritePrompt(output, label) {
  output.write(`\r\x1b[2KSelect a provider: ${label}\n`);
}

function isInteractiveTty(input) {
  return Boolean(input && input.isTTY && typeof input.setRawMode === "function");
}

module.exports = {
  promptSelection
};

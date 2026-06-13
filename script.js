const boardEl = document.querySelector("#board");
const timerEl = document.querySelector("#timer");
const mistakesEl = document.querySelector("#mistakes");
const messageEl = document.querySelector("#message");
const difficultyEl = document.querySelector("#difficulty");
const notesBtn = document.querySelector("#notes");
const newGameBtn = document.querySelector("#new-game");
const eraseBtn = document.querySelector("#erase");
const hintBtn = document.querySelector("#hint");
const checkBtn = document.querySelector("#check");

const difficultyBlanks = {
  easy: 36,
  medium: 45,
  hard: 52,
  expert: 58,
};

let solution = [];
let puzzle = [];
let entries = [];
let notes = [];
let selected = null;
let mistakes = 0;
let notesMode = false;
let startedAt = Date.now();
let timerId = null;
let locked = false;

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pattern(row, col) {
  return (row * 3 + Math.floor(row / 3) + col) % 9;
}

function makeSolution() {
  const rows = shuffle([0, 1, 2]).flatMap((band) => shuffle([0, 1, 2]).map((row) => band * 3 + row));
  const cols = shuffle([0, 1, 2]).flatMap((stack) => shuffle([0, 1, 2]).map((col) => stack * 3 + col));
  const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  return rows.map((row) => cols.map((col) => numbers[pattern(row, col)]));
}

function makePuzzle(fullBoard, blanks) {
  const nextPuzzle = fullBoard.map((row) => [...row]);
  const positions = shuffle(Array.from({ length: 81 }, (_, index) => index));
  positions.slice(0, blanks).forEach((index) => {
    nextPuzzle[Math.floor(index / 9)][index % 9] = 0;
  });
  return nextPuzzle;
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startTimer() {
  clearInterval(timerId);
  startedAt = Date.now();
  timerEl.textContent = "00:00";
  timerId = setInterval(() => {
    timerEl.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000));
  }, 1000);
}

function setMessage(text, tone = "neutral") {
  messageEl.textContent = text;
  messageEl.dataset.tone = tone;
}

function isGiven(row, col) {
  return puzzle[row][col] !== 0;
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);
      cell.addEventListener("click", () => selectCell(row, col));
      boardEl.append(cell);
    }
  }
  paintBoard();
}

function paintBoard() {
  [...boardEl.children].forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const value = entries[row][col];
    cell.className = "cell";
    cell.textContent = "";
    cell.removeAttribute("aria-current");

    if (isGiven(row, col)) cell.classList.add("given");
    if (selected) {
      const sameBox = Math.floor(row / 3) === Math.floor(selected.row / 3) && Math.floor(col / 3) === Math.floor(selected.col / 3);
      if (row === selected.row && col === selected.col) {
        cell.classList.add("selected");
        cell.setAttribute("aria-current", "true");
      } else if (row === selected.row || col === selected.col || sameBox) {
        cell.classList.add("related");
      }
      if (value && value === entries[selected.row][selected.col]) cell.classList.add("same");
    }
    if (value && value !== solution[row][col]) cell.classList.add("error");

    if (value) {
      cell.textContent = value;
      return;
    }

    const cellNotes = notes[row][col];
    if (cellNotes.size) {
      const grid = document.createElement("span");
      grid.className = "notes-grid";
      for (let number = 1; number <= 9; number += 1) {
        const note = document.createElement("span");
        note.textContent = cellNotes.has(number) ? number : "";
        grid.append(note);
      }
      cell.append(grid);
    }
  });
}

function selectCell(row, col) {
  if (locked) return;
  selected = { row, col };
  paintBoard();
}

function removeNumberFromPeers(row, col, number) {
  for (let index = 0; index < 9; index += 1) {
    notes[row][index].delete(number);
    notes[index][col].delete(number);
  }

  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let peerRow = startRow; peerRow < startRow + 3; peerRow += 1) {
    for (let peerCol = startCol; peerCol < startCol + 3; peerCol += 1) {
      notes[peerRow][peerCol].delete(number);
    }
  }
}

function enterNumber(number) {
  if (!selected || locked) return;
  const { row, col } = selected;
  if (isGiven(row, col)) return;

  if (notesMode) {
    if (entries[row][col]) return;
    if (notes[row][col].has(number)) notes[row][col].delete(number);
    else notes[row][col].add(number);
    paintBoard();
    return;
  }

  entries[row][col] = number;
  notes[row][col].clear();

  if (number === solution[row][col]) {
    removeNumberFromPeers(row, col, number);
    setMessage("Nice. That one fits.");
  } else {
    mistakes += 1;
    mistakesEl.textContent = mistakes;
    setMessage(mistakes >= 3 ? "Three mistakes. Start a fresh board when you are ready." : "That square does not work there.", "bad");
    if (mistakes >= 3) locked = true;
  }

  paintBoard();
  checkWin();
}

function eraseSelected() {
  if (!selected || locked) return;
  const { row, col } = selected;
  if (isGiven(row, col)) return;
  entries[row][col] = 0;
  notes[row][col].clear();
  setMessage("Square cleared.");
  paintBoard();
}

function giveHint() {
  if (locked) return;
  const empty = [];
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (!entries[row][col]) empty.push({ row, col });
    }
  }
  if (!empty.length) return;
  const target = selected && !entries[selected.row][selected.col] && !isGiven(selected.row, selected.col)
    ? selected
    : empty[Math.floor(Math.random() * empty.length)];
  entries[target.row][target.col] = solution[target.row][target.col];
  notes[target.row][target.col].clear();
  removeNumberFromPeers(target.row, target.col, entries[target.row][target.col]);
  selected = target;
  setMessage("Hint placed.");
  paintBoard();
  checkWin();
}

function checkBoard() {
  if (locked) return;
  let open = 0;
  let wrong = 0;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (!entries[row][col]) open += 1;
      else if (entries[row][col] !== solution[row][col]) wrong += 1;
    }
  }

  if (wrong) setMessage(`${wrong} square${wrong === 1 ? "" : "s"} need another look.`, "bad");
  else if (open) setMessage(`${open} open square${open === 1 ? "" : "s"} left.`);
  else checkWin();
  paintBoard();
}

function checkWin() {
  const solved = entries.every((row, rowIndex) => row.every((value, colIndex) => value === solution[rowIndex][colIndex]));
  if (!solved) return;
  locked = true;
  clearInterval(timerId);
  boardEl.classList.add("finished");
  setMessage(`Solved in ${timerEl.textContent}. Clean work.`, "good");
}

function newGame() {
  solution = makeSolution();
  puzzle = makePuzzle(solution, difficultyBlanks[difficultyEl.value]);
  entries = puzzle.map((row) => [...row]);
  notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  selected = null;
  mistakes = 0;
  locked = false;
  mistakesEl.textContent = "0";
  boardEl.classList.remove("finished");
  setMessage("Pick a square to begin.");
  startTimer();
  renderBoard();
}

document.querySelectorAll("[data-number]").forEach((button) => {
  button.addEventListener("click", () => enterNumber(Number(button.dataset.number)));
});

document.addEventListener("keydown", (event) => {
  if (event.key >= "1" && event.key <= "9") enterNumber(Number(event.key));
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") eraseSelected();
  if (!selected) return;

  const movement = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  }[event.key];

  if (movement) {
    event.preventDefault();
    selected = {
      row: Math.max(0, Math.min(8, selected.row + movement[0])),
      col: Math.max(0, Math.min(8, selected.col + movement[1])),
    };
    paintBoard();
  }
});

notesBtn.addEventListener("click", () => {
  notesMode = !notesMode;
  notesBtn.classList.toggle("active", notesMode);
  notesBtn.setAttribute("aria-pressed", String(notesMode));
  setMessage(notesMode ? "Notes mode on." : "Notes mode off.");
});

eraseBtn.addEventListener("click", eraseSelected);
hintBtn.addEventListener("click", giveHint);
checkBtn.addEventListener("click", checkBoard);
newGameBtn.addEventListener("click", newGame);
difficultyEl.addEventListener("change", newGame);

newGame();

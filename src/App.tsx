// app.tsx
import { useEffect, useState } from "react";

type Board = number[][];
type Dir = "left" | "right" | "up" | "down";

const SIZE = 4;
const LS_KEY = "2048:v1"; // 저장 키

type SaveState = {
  board: Board;
  score: number;
  gameOver: boolean; // 128 도달 시 true
};

// -------------------- 유틸 --------------------
function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneBoard(b: Board): Board {
  return b.map((r) => r.slice());
}

function getEmptyCells(b: Board): Array<{ r: number; c: number }> {
  const cells: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c] === 0) cells.push({ r, c });
    }
  }
  return cells;
}

function addRandomTile(b: Board): Board {
  const empties = getEmptyCells(b);
  if (empties.length === 0) return b;
  const idx = Math.floor(Math.random() * empties.length);
  const { r, c } = empties[idx];
  // 90% 확률로 2, 10% 확률로 4
  const val = Math.random() < 0.9 ? 2 : 4;
  const nb = cloneBoard(b);
  nb[r][c] = val;
  return nb;
}

function initBoard(): Board {
  let b = emptyBoard();
  b = addRandomTile(b);
  b = addRandomTile(b);
  return b;
}

function has128(b: Board): boolean {
  return b.some((row) => row.some((v) => v >= 128));
}

function canMove(b: Board): boolean {
  // 빈칸이 있으면 가능
  if (getEmptyCells(b).length > 0) return true;
  // 인접 합체 가능성 검사
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = b[r][c];
      if (r + 1 < SIZE && b[r + 1][c] === v) return true;
      if (c + 1 < SIZE && b[r][c + 1] === v) return true;
    }
  }
  return false;
}

// 한 줄을 왼쪽으로 미는 로직(2048 규칙)
function moveLineLeft(line: number[]): { next: number[]; gained: number } {
  const filtered = line.filter((x) => x !== 0);
  const merged: number[] = [];
  let gained = 0;
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const sum = filtered[i] + filtered[i + 1];
      merged.push(sum);
      gained += sum;
      i++; // 다음 하나 건너뜀(합쳐졌으니까)
    } else {
      merged.push(filtered[i]);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { next: merged, gained };
}

function moveBoard(b: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  let gained = 0;
  let moved = false;
  const nb = cloneBoard(b);

  const applyRow = (row: number[]): number[] => {
    const { next, gained: g } = moveLineLeft(row);
    gained += g;
    return next;
  };

  if (dir === "left") {
    for (let r = 0; r < SIZE; r++) {
      const before = nb[r].slice();
      const after = applyRow(nb[r]);
      nb[r] = after;
      if (!moved && before.some((v, i) => v !== after[i])) moved = true;
    }
  } else if (dir === "right") {
    for (let r = 0; r < SIZE; r++) {
      const before = nb[r].slice();
      const reversed = nb[r].slice().reverse();
      const after = applyRow(reversed).reverse();
      nb[r] = after;
      if (!moved && before.some((v, i) => v !== after[i])) moved = true;
    }
  } else if (dir === "up") {
    for (let c = 0; c < SIZE; c++) {
      const col = Array.from({ length: SIZE }, (_, r) => nb[r][c]);
      const before = col.slice();
      const after = applyRow(col);
      for (let r = 0; r < SIZE; r++) nb[r][c] = after[r];
      if (!moved && before.some((v, i) => v !== after[i])) moved = true;
    }
  } else if (dir === "down") {
    for (let c = 0; c < SIZE; c++) {
      const col = Array.from({ length: SIZE }, (_, r) => nb[r][c]).reverse();
      const before = col.slice().reverse();
      const after = applyRow(col).reverse();
      for (let r = 0; r < SIZE; r++) nb[r][c] = after[r];
      if (!moved && before.some((v, i) => v !== after[i])) moved = true;
    }
  }

  return { board: nb, gained, moved };
}

// -------------------- 로컬스토리지 훅 --------------------
function useLocalStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // 용량 초과 등의 예외는 무시
    }
  }, [key, state]);

  return [state, setState] as const;
}

// -------------------- 컴포넌트 --------------------
export default function App() {
  const [save, setSave] = useLocalStorageState<SaveState>(LS_KEY, {
    board: initBoard(),
    score: 0,
    gameOver: false,
  });

  const { board, score, gameOver } = save;

  // 방향키 이벤트
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver) return;
      let dir: Dir | null = null;
      if (e.key === "ArrowLeft") dir = "left";
      else if (e.key === "ArrowRight") dir = "right";
      else if (e.key === "ArrowUp") dir = "up";
      else if (e.key === "ArrowDown") dir = "down";
      if (!dir) return;

      e.preventDefault();

      const { board: movedBoard, gained, moved } = moveBoard(board, dir);
      if (!moved) return;

      const next = addRandomTile(movedBoard);
      const nextScore = score + gained;

      const reached128 = has128(next);
      const noMoves = !canMove(next);

      setSave({
        board: next,
        score: nextScore,
        gameOver: reached128 || noMoves,
      });
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [board, score, gameOver, setSave]);

  const newGame = () => {
    setSave({
      board: initBoard(),
      score: 0,
      gameOver: false,
    });
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", display: "grid", gap: 12, placeItems: "center", padding: 20 }}>
      <h1 style={{ margin: 0 }}>2048</h1>

      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Score: {score}</div>
        <button onClick={newGame} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>
          New Game
        </button>
      </div>

      <div
        style={{
          position: "relative",
          padding: 12,
          background: "#bbada0",
          borderRadius: 12,
          display: "grid",
          gridTemplateColumns: `repeat(${SIZE}, 90px)`,
          gridTemplateRows: `repeat(${SIZE}, 90px)`,
          gap: 12,
          userSelect: "none",
        }}
      >
        {board.map((row, r) =>
          row.map((v, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                width: 90,
                height: 90,
                background: tileBg(v),
                color: v <= 4 ? "#776e65" : "#f9f6f2",
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                fontSize: v >= 1024 ? 30 : v >= 128 ? 32 : v >= 16 ? 34 : 36,
                fontWeight: 800,
                boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.05)",
              }}
            >
              {v !== 0 ? v : ""}
            </div>
          ))
        )}


        {gameOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "20px 24px",
                borderRadius: 12,
                textAlign: "center",
                minWidth: 260,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>You reached 128! 🎉</div>
              <div style={{ marginBottom: 16 }}>게임이 종료되었습니다.</div>
              <button onClick={newGame} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>
                New Game
              </button>
            </div>
          </div>
        )}
      </div>

      <p style={{ opacity: 0.7, marginTop: 4 }}>방향키로 조작하세요. 128이 나오면 종료됩니다.</p>
    </div>
  );
}

// -------------------- 타일 색상 --------------------
function tileBg(v: number): string {
  const map: Record<number, string> = {
    0: "#cdc1b4",
    2: "#eee4da",
    4: "#ede0c8",
    8: "#f2b179",
    16: "#f59563",
    32: "#f67c5f",
    64: "#f65e3b",
    128: "#edcf72",
    256: "#edcc61",
    512: "#edc850",
    1024: "#edc53f",
    2048: "#edc22e",
  };
  return map[v] ?? "#3c3a32";
}

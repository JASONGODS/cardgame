import { useEffect, useMemo, useReducer, useState } from "react";
import "./App.css";
import { sfx, isMuted, setMuted } from "./sound";
import { SHAPE_IDS, Shape } from "./shapes";
import { supabase } from "./supabase";
import { useRoom } from "./useRoom";
import { ProfileBar, Setup, Lobby } from "./Versus";

const SYMBOLS = SHAPE_IDS; // 20 bentuk SVG, lihat shapes.jsx

const LEVELS = {
  mudah: { label: "Mudah", size: "4×3", pairs: 6, cols: 4 },
  sedang: { label: "Sedang", size: "4×4", pairs: 8, cols: 4 },
  sulit: { label: "Sulit", size: "6×6", pairs: 18, cols: 6 },
};

const STORAGE_KEY = "memory-game-best";
const NAME_KEY = "memory-game-name";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa O/0/I/1 agar tidak membingungkan
const EMPTY_OPP = { pairs: 0, score: 0, streak: 0, best: 0, done: false, time: 0 };

// Posisi confetti dibuat tetap (tanpa random) supaya render stabil
const CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 10) * 0.1,
  dur: 2.2 + (i % 4) * 0.4,
  color: ["--pink", "--sun", "--mint", "--sky", "--violet"][i % 5],
}));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createDeck(pairs) {
  const picked = shuffle(SYMBOLS).slice(0, pairs);
  return shuffle([...picked, ...picked]).map((symbol, id) => ({ id, symbol }));
}

const makeCode = () =>
  Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

function formatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || "Pemain";
  } catch {
    return "Pemain";
  }
}

// Link ajakan: ?room=ABCD
const urlRoom = (new URLSearchParams(window.location.search).get("room") || "").toUpperCase().slice(0, 4);

/* ---------- Logika game (murni, tanpa efek samping) ---------- */

function initState(level, cards) {
  return {
    level,
    cards,
    flipped: [], // index kartu yang sedang terbuka (maks 2)
    matched: [], // index kartu yang sudah cocok
    moves: 0,
    streak: 0, // pasangan cocok berturut-turut
    bestCombo: 0, // combo tertinggi di game ini
    score: 0, // tiap pasangan = 10 x combo saat itu
    started: false,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "NEW_GAME":
      return initState(action.level, action.cards);

    case "FLIP": {
      const i = action.index;
      if (state.flipped.length >= 2 || state.flipped.includes(i) || state.matched.includes(i)) {
        return state;
      }
      const flipped = [...state.flipped, i];
      if (flipped.length < 2) return { ...state, flipped, started: true };

      const [a, b] = flipped;
      const moves = state.moves + 1;
      if (state.cards[a].symbol === state.cards[b].symbol) {
        const streak = state.streak + 1;
        return {
          ...state,
          flipped: [],
          matched: [...state.matched, a, b],
          moves,
          streak,
          bestCombo: Math.max(state.bestCombo, streak),
          score: state.score + 10 * streak,
        };
      }
      return { ...state, flipped, moves, streak: 0 }; // tidak cocok: tunggu aksi HIDE
    }

    case "HIDE":
      return { ...state, flipped: [] };

    default:
      return state;
  }
}

/* ---------- Tampilan ---------- */

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, () =>
    initState("sedang", createDeck(LEVELS.sedang.pairs))
  );
  const { level, cards, flipped, matched, moves, streak, bestCombo, score, started } = state;

  const [seconds, setSeconds] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [newRecord, setNewRecord] = useState(false);
  const [muted, setMutedState] = useState(isMuted);

  // Multiplayer
  const [mode, setMode] = useState(urlRoom ? "versus" : "solo"); // "solo" | "versus"
  const [name, setName] = useState(loadName);
  const [joinCode, setJoinCode] = useState(urlRoom);
  const [code, setCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [phase, setPhase] = useState("lobby"); // lobby | countdown | playing | result
  const [count, setCount] = useState(3);
  const [lobbyLevel, setLobbyLevel] = useState("sedang");
  const [opp, setOpp] = useState(EMPTY_OPP);
  const [myId] = useState(() => Math.random().toString(36).slice(2, 10));
  const [joinedAt] = useState(() => Date.now());

  const me = useMemo(
    () => ({ id: myId, name: name.trim() || "Pemain", avatar: isHost ? "bintang" : "hati", isHost, joinedAt }),
    [myId, name, isHost, joinedAt]
  );

  const versus = mode === "versus";
  const won = cards.length > 0 && matched.length === cards.length;

  function beginMatch(lvl, deck) {
    dispatch({ type: "NEW_GAME", level: lvl, cards: deck });
    setSeconds(0);
    setNewRecord(false);
    setOpp(EMPTY_OPP);
    setCount(3);
    setPhase("countdown");
  }

  function handleMessage(msg) {
    if (msg.type === "start") beginMatch(msg.level, msg.cards);
    else if (msg.type === "progress") setOpp(msg);
  }

  const room = useRoom({ code, me, onMessage: handleMessage });
  const opponent = room.players.find((p) => p.id !== myId);
  const full = room.players.length > 2 && !room.players.slice(0, 2).some((p) => p.id === myId);

  function newGame(lvl = level) {
    dispatch({ type: "NEW_GAME", level: lvl, cards: createDeck(LEVELS[lvl].pairs) });
    setSeconds(0);
    setNewRecord(false);
  }

  function leaveRoom() {
    setCode("");
    setIsHost(false);
    setPhase("lobby");
    setOpp(EMPTY_OPP);
  }

  function switchMode(next) {
    if (next === mode) return;
    leaveRoom();
    setMode(next);
    if (next === "solo") newGame();
  }

  function createRoom() {
    setIsHost(true);
    setCode(makeCode());
    setPhase("lobby");
  }

  function joinRoom() {
    setIsHost(false);
    setCode(joinCode);
    setPhase("lobby");
  }

  function startMatch() {
    const deck = createDeck(LEVELS[lobbyLevel].pairs);
    room.send({ type: "start", level: lobbyLevel, cards: deck });
    beginMatch(lobbyLevel, deck);
  }

  const canPlay = !versus || phase === "playing";

  function handleFlip(i) {
    if (!canPlay || flipped.length >= 2 || flipped.includes(i) || matched.includes(i)) return;
    sfx.flip();
    dispatch({ type: "FLIP", index: i });
  }

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) sfx.flip();
  }

  // Dua kartu tidak cocok: bunyi "miss", lalu tutup lagi setelah 800 ms
  useEffect(() => {
    if (flipped.length !== 2) return;
    sfx.miss();
    const t = setTimeout(() => dispatch({ type: "HIDE" }), 800);
    return () => clearTimeout(t);
  }, [flipped]);

  // Pasangan cocok (atau menang): bunyi sesuai kondisi
  useEffect(() => {
    if (matched.length === 0) return;
    if (matched.length === cards.length) sfx.win();
    else sfx.match(streak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched.length]);

  // Timer
  useEffect(() => {
    if (!started || won) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started, won]);

  // Hitung mundur 3-2-1 sebelum game multiplayer dimulai
  useEffect(() => {
    if (!versus || phase !== "countdown") return;
    const t = setTimeout(
      () => (count <= 0 ? setPhase("playing") : setCount((c) => c - 1)),
      count <= 0 ? 600 : 900
    );
    return () => clearTimeout(t);
  }, [versus, phase, count]);

  // Kirim progres ke teman setiap ada pasangan baru, combo berubah, atau selesai
  useEffect(() => {
    if (!versus || phase !== "playing") return;
    room.send({ type: "progress", pairs: matched.length / 2, score, streak, best: bestCombo, done: won, time: seconds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versus, phase, matched.length, streak, score, won]);

  // Kalau aku dan teman sama-sama selesai: tampilkan hasil
  useEffect(() => {
    if (versus && phase === "playing" && won && opp.done) setPhase("result");
  }, [versus, phase, won, opp.done]);

  // Solo: simpan rekor (langkah paling sedikit)
  useEffect(() => {
    if (!won || versus) return;
    const current = best[level];
    if (!current || moves < current.moves) {
      setNewRecord(true);
      setBest((prev) => ({ ...prev, [level]: { moves, seconds } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
    } catch {
      /* abaikan jika storage tidak tersedia */
    }
  }, [best]);

  useEffect(() => {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* abaikan */
    }
  }, [name]);

  const bestNow = best[level];
  const inRoom = versus && code;
  const showBoard = !versus || (code && phase !== "lobby");
  const total = showBoard ? cards.length / 2 : 0;
  const opponentGone = versus && (phase === "countdown" || phase === "playing") && !opponent;
  const draw = score === opp.score && seconds === opp.time;
  const iWin = score > opp.score || (score === opp.score && seconds < opp.time);
  const resultTitle = draw ? "Seri!" : iWin ? "Kamu menang!" : `${opponent?.name ?? "Teman"} menang!`;

  return (
    <main className="app">
      <div className="deco" aria-hidden="true">
        <Shape id="bintang" className="d1" />
        <Shape id="segitiga" className="d2" />
        <Shape id="cincin" className="d3" />
      </div>

      <h1 className="title">Cocokkan Kartu</h1>

      <div className="toolbar">
        <div className="levels" role="group" aria-label="Mode permainan">
          <button className="btn level" aria-pressed={!versus} onClick={() => switchMode("solo")}>
            Main sendiri
          </button>
          <button className="btn level" aria-pressed={versus} onClick={() => switchMode("versus")}>
            Main bareng
          </button>
        </div>
        <button className="btn sound" aria-pressed={!muted} onClick={toggleSound}>
          {muted ? "🔇 Suara mati" : "🔊 Suara nyala"}
        </button>
      </div>

      {!versus && (
        <div className="levels" role="group" aria-label="Tingkat kesulitan">
          {Object.entries(LEVELS).map(([key, l]) => (
            <button key={key} className="btn level" aria-pressed={level === key} onClick={() => newGame(key)}>
              {l.label} <span>{l.size}</span>
            </button>
          ))}
        </div>
      )}

      {versus && !code && (
        <Setup
          ready={!!supabase}
          name={name}
          setName={setName}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          onCreate={createRoom}
          onJoin={joinRoom}
        />
      )}

      {inRoom && (
        <ProfileBar
          me={me}
          opp={opponent}
          total={total}
          mine={{ score, pairs: matched.length / 2, streak }}
          theirs={{ score: opp.score, pairs: opp.pairs, streak: opp.streak }}
        />
      )}

      {inRoom && phase === "lobby" && (
        <Lobby
          code={code}
          isHost={isHost}
          status={full ? "full" : room.status}
          players={room.players}
          levels={LEVELS}
          level={lobbyLevel}
          setLevel={setLobbyLevel}
          onStart={startMatch}
          onLeave={leaveRoom}
        />
      )}

      {inRoom && full && <p className="note">Room penuh, maksimal 2 pemain.</p>}

      {showBoard && (
        <>
          <dl className="stats">
            <div>
              <dt>Langkah</dt>
              <dd>{moves}</dd>
            </div>
            <div>
              <dt>Waktu</dt>
              <dd>{formatTime(seconds)}</dd>
            </div>
            {versus ? (
              <div className="record-cell">
                <dt>Combo terbaik</dt>
                <dd>×{bestCombo}</dd>
              </div>
            ) : (
              <div className="record-cell">
                <dt>Rekor</dt>
                <dd>{bestNow ? `${bestNow.moves} langkah` : "-"}</dd>
              </div>
            )}
          </dl>

          {!versus && (
            <div className="combo-slot" aria-live="polite">
              {streak >= 2 && (
                <span key={streak} className="combo">
                  Combo ×{streak}!
                </span>
              )}
            </div>
          )}

          {versus && phase === "playing" && won && !opp.done && (
            <p className="note">Selesai! Menunggu {opponent?.name ?? "teman"} menyelesaikan kartunya...</p>
          )}

          <section className="panel" style={{ "--cols": LEVELS[level].cols }} aria-label="Papan kartu">
            <div className="panel-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>
                Level {LEVELS[level].label} ({LEVELS[level].size})
              </span>
            </div>
            <div className="board">
              {cards.map((card, i) => {
                const isMatched = matched.includes(i);
                const isOpen = isMatched || flipped.includes(i);
                const isWrong = flipped.length === 2 && flipped.includes(i);
                return (
                  <button
                    key={card.id}
                    className={`card${isOpen ? " open" : ""}${isMatched ? " matched" : ""}${isWrong ? " wrong" : ""}`}
                    onClick={() => handleFlip(i)}
                    aria-label={isOpen ? card.symbol : "Kartu tertutup"}
                  >
                    <span className="inner">
                      <span className="face cover" />
                      <span className="face symbol">
                        <Shape id={card.symbol} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {!versus && (
            <button className="btn restart" onClick={() => newGame()}>
              Acak ulang
            </button>
          )}
        </>
      )}

      {versus && phase === "countdown" && !opponentGone && (
        <div className="overlay" aria-live="assertive">
          <div key={count} className="countdown">
            {count > 0 ? count : "Mulai!"}
          </div>
        </div>
      )}

      {opponentGone && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Teman keluar">
          <div className="dialog">
            <h2>Teman keluar dari room</h2>
            <button className="btn restart" onClick={() => setPhase("lobby")} autoFocus>
              Kembali ke lobby
            </button>
          </div>
        </div>
      )}

      {versus && phase === "result" && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Hasil pertandingan">
          {iWin && !draw && (
            <div className="confetti" aria-hidden="true">
              {CONFETTI.map((c, i) => (
                <span key={i} style={{ "--l": `${c.left}%`, "--dl": `${c.delay}s`, "--d": `${c.dur}s`, "--c": `var(${c.color})` }} />
              ))}
            </div>
          )}
          <div className="dialog">
            <h2>{resultTitle}</h2>
            <p>
              {me.name}: {score} poin, combo terbaik ×{bestCombo}
            </p>
            <p>
              {opponent?.name ?? "Teman"}: {opp.score} poin, combo terbaik ×{opp.best}
            </p>
            <button className="btn restart" onClick={() => setPhase("lobby")} autoFocus>
              Kembali ke lobby
            </button>
          </div>
        </div>
      )}

      {!versus && won && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Permainan selesai">
          <div className="confetti" aria-hidden="true">
            {CONFETTI.map((c, i) => (
              <span key={i} style={{ "--l": `${c.left}%`, "--dl": `${c.delay}s`, "--d": `${c.dur}s`, "--c": `var(${c.color})` }} />
            ))}
          </div>
          <div className="dialog">
            <h2>Semua pasangan ketemu!</h2>
            <p>
              {moves} langkah dalam {formatTime(seconds)}
            </p>
            {newRecord && <p className="new-record">Rekor baru untuk tingkat {LEVELS[level].label}!</p>}
            <button className="btn restart" onClick={() => newGame()} autoFocus>
              Main lagi
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
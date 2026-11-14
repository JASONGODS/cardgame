import { useState } from "react";
import { Shape } from "./shapes";

/* Efek combo di dekat profil: cincin, serpihan, dan lencana ×N */
function ComboBurst({ streak }) {
  return (
    <span className={`burst lv${Math.min(streak, 5)}`} aria-hidden="true">
      <span className="ring" />
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} style={{ "--a": `${i * 45}deg` }} />
      ))}
      <b>×{streak}</b>
    </span>
  );
}

function Profile({ name, avatar, score = 0, pairs = 0, total = 0, streak = 0, empty }) {
  const hot = streak >= 2;
  return (
    <div className="profile">
      {/* key berubah tiap combo naik, jadi animasi diputar ulang */}
      <div
        key={hot ? streak : "idle"}
        className={`avatar${hot ? ` hot lv${Math.min(streak, 5)}` : ""}${empty ? " empty" : ""}`}
      >
        {empty ? <span>?</span> : <Shape id={avatar} />}
        {hot && <ComboBurst streak={streak} />}
      </div>
      <strong className="pname">{empty ? "Menunggu..." : name}</strong>
      {!empty && total > 0 && (
        <span className="pscore">
          {score} poin <small>{pairs}/{total}</small>
        </span>
      )}
    </div>
  );
}

export function ProfileBar({ me, opp, mine, theirs, total }) {
  return (
    <div className="vs-bar">
      <Profile name={me.name} avatar={me.avatar} total={total} {...mine} />
      <span className="vs">VS</span>
      <Profile name={opp?.name} avatar={opp?.avatar} total={total} empty={!opp} {...theirs} />
    </div>
  );
}

export function Setup({ ready, name, setName, joinCode, setJoinCode, onCreate, onJoin }) {
  const okName = name.trim().length > 0;
  return (
    <section className="panel setup">
      <div className="panel-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>Main bareng</span>
      </div>
      <div className="room-body">
        {!ready && (
          <p className="note">
            Multiplayer belum aktif. Isi kunci Supabase di <code>.env.local</code>, lalu jalankan
            ulang <code>npm run dev</code>.
          </p>
        )}
        <label>
          Nama kamu
          <input className="input" value={name} maxLength={10} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn restart" disabled={!ready || !okName} onClick={onCreate}>
          Buat room
        </button>
        <div className="or">atau gabung ke room teman</div>
        <div className="join-row">
          <input
            className="input code"
            aria-label="Kode room"
            placeholder="KODE"
            value={joinCode}
            maxLength={4}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button className="btn" disabled={!ready || !okName || joinCode.length !== 4} onClick={onJoin}>
            Gabung
          </button>
        </div>
      </div>
    </section>
  );
}

export function Lobby({ code, isHost, status, players, levels, level, setLevel, onStart, onLeave }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?room=${code}`;
  const hostHere = players.some((p) => p.isHost);
  const both = players.length >= 2;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard tidak tersedia */
    }
  }

  let message = "";
  if (status === "connecting") message = "Menghubungkan ke server...";
  else if (status === "error") message = "Gagal terhubung. Cek kunci Supabase dan koneksi internet.";
  else if (isHost && !both) message = "Bagikan kode atau link ini ke temanmu. Menunggu teman masuk...";
  else if (!isHost && !hostHere) message = "Host belum ada di room ini. Cek lagi kodenya.";
  else if (!isHost) message = "Menunggu host memulai game...";

  return (
    <section className="panel lobby">
      <div className="panel-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>Lobby</span>
      </div>
      <div className="room-body">
        <div className="code-sticker" aria-label={`Kode room ${code}`}>
          {code}
        </div>
        <button className="btn" onClick={copy}>
          {copied ? "Tersalin!" : "Salin link ajakan"}
        </button>
        {message && <p className="note">{message}</p>}
        {isHost && both && (
          <>
            <div className="levels" role="group" aria-label="Tingkat kesulitan">
              {Object.entries(levels).map(([key, l]) => (
                <button key={key} className="btn level" aria-pressed={level === key} onClick={() => setLevel(key)}>
                  {l.label} <span>{l.size}</span>
                </button>
              ))}
            </div>
            <button className="btn restart" onClick={onStart}>
              Mulai!
            </button>
          </>
        )}
        <button className="btn" onClick={onLeave}>
          Keluar room
        </button>
      </div>
    </section>
  );
}
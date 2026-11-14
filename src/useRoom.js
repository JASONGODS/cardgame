import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

// Satu room = satu channel Supabase Realtime.
// Presence = siapa saja yang ada di room. Broadcast = pesan game ("start", "progress").
export function useRoom({ code, me, onMessage }) {
  const [status, setStatus] = useState("idle"); // idle | connecting | connected | error
  const [players, setPlayers] = useState([]);
  const channelRef = useRef(null);
  const messageRef = useRef(onMessage);

  useEffect(() => {
    messageRef.current = onMessage; // selalu pakai handler terbaru
  });

  useEffect(() => {
    if (!code || !supabase) return;
    setStatus("connecting");

    const channel = supabase.channel(`memory-${code}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const list = Object.values(channel.presenceState()).flat();
        list.sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.joinedAt - b.joinedAt);
        setPlayers(list);
      })
      .on("broadcast", { event: "game" }, ({ payload }) => messageRef.current?.(payload))
      .subscribe(async (s) => {
        if (s === "SUBSCRIBED") {
          await channel.track(me);
          setStatus("connected");
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus("error");
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setPlayers([]);
      setStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, me.id]);

  const send = useCallback((payload) => {
    channelRef.current?.send({ type: "broadcast", event: "game", payload });
  }, []);

  return { status, players, send };
}
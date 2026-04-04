import { getClientId } from "./clientId";

export type LobbyPlayer = {
  clientId: string;
  name: string;
  joinedAt: number;
};

function lobbyKey(roomId: string) {
  return `dialed-lobby-${roomId}`;
}

function hostKey(roomId: string) {
  return `dialed-host-${roomId}`;
}

function goKey(roomId: string) {
  return `dialed-go-${roomId}`;
}

export function setRoomHost(roomId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(hostKey(roomId), getClientId());
}

export function isRoomHost(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(hostKey(roomId)) === getClientId();
}

export function readLobbyPlayers(roomId: string): LobbyPlayer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(lobbyKey(roomId));
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (p): p is LobbyPlayer =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as LobbyPlayer).clientId === "string" &&
        typeof (p as LobbyPlayer).name === "string"
    );
  } catch {
    return [];
  }
}

export function upsertLobbyPlayer(roomId: string, name: string): void {
  if (typeof window === "undefined") return;
  const clientId = getClientId();
  const list = readLobbyPlayers(roomId);
  const next: LobbyPlayer = {
    clientId,
    name: name.trim() || "Joueur",
    joinedAt: Date.now(),
  };
  const idx = list.findIndex((p) => p.clientId === clientId);
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  localStorage.setItem(lobbyKey(roomId), JSON.stringify(list));
  getLobbyChannel(roomId).postMessage({ type: "lobby-update" });
}

function getLobbyChannel(roomId: string): BroadcastChannel {
  return new BroadcastChannel(`dialed-lobby-${roomId}`);
}

export type GameVariantPayload = "color" | "sound";

export function signalGameStart(roomId: string, variant: GameVariantPayload): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    goKey(roomId),
    JSON.stringify({ variant, t: Date.now() })
  );
  getLobbyChannel(roomId).postMessage({ type: "game-start", variant });
}

export function readGameStartPayload(
  roomId: string
): { variant: GameVariantPayload } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(goKey(roomId));
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { variant?: string };
    if (o.variant === "sound" || o.variant === "color") {
      return { variant: o.variant };
    }
  } catch {
    /* legacy: timestamp only */
    return { variant: "color" };
  }
  return { variant: "color" };
}

export function clearRoomSignals(roomId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(goKey(roomId));
}

export function subscribeLobbyAndGo(
  roomId: string,
  onLobby: () => void,
  onGo: () => void
): () => void {
  if (typeof window === "undefined" || !roomId) return () => {};

  const ch = getLobbyChannel(roomId);
  const onMsg = (ev: MessageEvent) => {
    if (ev.data?.type === "lobby-update") onLobby();
    if (ev.data?.type === "game-start") onGo();
  };
  ch.addEventListener("message", onMsg);

  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    if (e.key === lobbyKey(roomId)) onLobby();
    if (e.key === goKey(roomId) && e.newValue) onGo();
  };
  window.addEventListener("storage", onStorage);

  const poll = setInterval(() => {
    onLobby();
  }, 1200);

  return () => {
    ch.removeEventListener("message", onMsg);
    ch.close();
    window.removeEventListener("storage", onStorage);
    clearInterval(poll);
  };
}

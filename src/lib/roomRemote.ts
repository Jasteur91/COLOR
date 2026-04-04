import { getClientId } from "./clientId";
import type { RoundsCount } from "./gameConstants";
import { getSupabaseBrowser } from "./supabase/client";

export type RemoteLobbyPlayer = {
  clientId: string;
  name: string;
  joinedAt: number;
};

export type RemoteRoomRow = {
  id: string;
  code: string;
  host_session_id: string;
  variant: "color" | "sound";
  rounds: RoundsCount;
  difficulty: "easy" | "hard";
  status: "lobby" | "playing" | "finished";
};

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export async function fetchRoomByCode(
  code: string
): Promise<{ room: RemoteRoomRow } | { error: string }> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { error: "Supabase non configuré" };
  const c = normalizeRoomCode(code);
  if (!c) return { error: "Code invalide" };
  const { data, error } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("code", c)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Salle introuvable" };
  const room = data as RemoteRoomRow;
  return { room };
}

export async function createRoomRemote(params: {
  code: string;
  variant: "color" | "sound";
  rounds: RoundsCount;
  difficulty: "easy" | "hard";
}): Promise<{ room: RemoteRoomRow } | { error: string }> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { error: "Supabase non configuré" };
  const host_session_id = getClientId();
  const code = normalizeRoomCode(params.code);
  const { data, error } = await supabase
    .from("game_rooms")
    .insert({
      code,
      host_session_id,
      variant: params.variant,
      rounds: params.rounds,
      difficulty: params.difficulty,
      status: "lobby",
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { room: data as RemoteRoomRow };
}

export async function upsertRemotePlayer(
  roomId: string,
  name: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { error: "Supabase non configuré" };
  const session_id = getClientId();
  const { error } = await supabase.from("game_room_players").upsert(
    {
      room_id: roomId,
      session_id,
      name: name.trim() || "Joueur",
    },
    { onConflict: "room_id,session_id" }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function fetchRemotePlayers(
  roomId: string
): Promise<RemoteLobbyPlayer[]> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("game_room_players")
    .select("session_id, name, joined_at")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    clientId: row.session_id as string,
    name: row.name as string,
    joinedAt: new Date(row.joined_at as string).getTime(),
  }));
}

export function isRemoteHost(room: RemoteRoomRow): boolean {
  return getClientId() === room.host_session_id;
}

export async function signalRemoteGameStart(
  roomId: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { error: "Supabase non configuré" };
  const { error } = await supabase
    .from("game_rooms")
    .update({ status: "playing", started_at: new Date().toISOString() })
    .eq("id", roomId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function submitRemoteResult(params: {
  roomId: string;
  playerName: string;
  total: number;
  roundScores: number[];
}): Promise<{ ok: true } | { error: string }> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { error: "Supabase non configuré" };
  const session_id = getClientId();
  const { error } = await supabase.from("game_room_results").upsert(
    {
      room_id: params.roomId,
      session_id,
      player_name: params.playerName.trim() || "Anonyme",
      total: params.total,
      round_scores: params.roundScores,
      finished_at: new Date().toISOString(),
    },
    { onConflict: "room_id,session_id" }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export type LeaderboardRow = {
  rank: number;
  name: string;
  total: number;
  finishedAt: number;
};

export async function fetchRemoteLeaderboard(
  roomId: string
): Promise<LeaderboardRow[]> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("game_room_results")
    .select("player_name, total, finished_at")
    .eq("room_id", roomId)
    .order("total", { ascending: false })
    .order("finished_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row, i) => ({
    rank: i + 1,
    name: row.player_name as string,
    total: Number(row.total),
    finishedAt: new Date(row.finished_at as string).getTime(),
  }));
}

export function subscribeRemoteRoom(
  roomId: string,
  onPlayers: () => void,
  onRoomUpdate: (row: RemoteRoomRow | null) => void
): () => void {
  const supabase = getSupabaseBrowser();
  if (!supabase) return () => {};

  const ch = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_room_players",
        filter: `room_id=eq.${roomId}`,
      },
      () => onPlayers()
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "game_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        onRoomUpdate(payload.new as RemoteRoomRow);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(ch);
  };
}

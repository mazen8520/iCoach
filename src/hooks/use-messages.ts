import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/** Coach: every conversation with a linked client, newest activity first. */
export function useConversations() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const idColumn = profile?.role === "coach" ? "coach_id" : "client_id";
      const otherColumn = profile?.role === "coach" ? "client_id" : "coach_id";
      const { data, error } = await supabase
        .from("conversations")
        .select(`*, other:${otherColumn}(id, full_name, avatar_url)`)
        .eq(idColumn, user!.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conversations:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () =>
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return query;
}

/** Ensure a conversation exists between the coach and client, returning its id. */
export function useEnsureConversation() {
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const coach_id = profile?.role === "coach" ? user!.id : otherUserId;
      const client_id = profile?.role === "coach" ? otherUserId : user!.id;
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("coach_id", coach_id)
        .eq("client_id", client_id)
        .maybeSingle();
      if (existing) return existing.id;
      const { data, error } = await supabase
        .from("conversations")
        .insert({ coach_id, client_id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
  });
}

export function useMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !user || !query.data) return;
    const unread = query.data.filter((m) => m.sender_id !== user.id && !m.read_at);
    if (unread.length === 0) return;
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        unread.map((m) => m.id),
      )
      .then(() => queryClient.invalidateQueries({ queryKey: ["notifications", user.id] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id, query.data]);

  return query;
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, body }: { conversationId: string; body: string }) => {
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, sender_id: user!.id, body });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["messages", vars.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

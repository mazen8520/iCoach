import { createFileRoute } from "@tanstack/react-router";
import { adminClient } from "@/lib/server/supabase";
import { handleZoomEvent } from "@/lib/server/zoom/events";
import {
  urlValidationResponse,
  verifyZoomWebhook,
  type ZoomWebhookEvent,
} from "@/lib/server/zoom/webhook";

export const Route = createFileRoute("/api/zoom/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["ZOOM_WEBHOOK_SECRET_TOKEN"] ?? "";
        // The signature covers the exact bytes Zoom sent, so read the raw body before parsing.
        const rawBody = await request.text();
        const valid = verifyZoomWebhook({
          secret,
          timestamp: request.headers.get("x-zm-request-timestamp"),
          signature: request.headers.get("x-zm-signature"),
          rawBody,
        });
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let event: ZoomWebhookEvent;
        try {
          event = JSON.parse(rawBody) as ZoomWebhookEvent;
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        if (event.event === "endpoint.url_validation") {
          const plainToken = event.payload?.plainToken;
          if (!plainToken) return new Response("Bad request", { status: 400 });
          return Response.json(urlValidationResponse(secret, plainToken));
        }

        try {
          await handleZoomEvent(adminClient(), event);
        } catch (err) {
          // 500 makes Zoom retry later.
          console.error(
            `Zoom webhook ${event.event} failed:`,
            err instanceof Error ? err.message : err,
          );
          return new Response("Error", { status: 500 });
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});

import express from "express";
import cors from "cors";
import { AccessToken, EgressClient } from "livekit-server-sdk";
import { StreamProtocol } from "@livekit/protocol";
import dotenv from "dotenv";
import path from "path";

// Load .env from project root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const app = express();
const PORT = 3001;

app.use(cors({ origin: true }));
app.use(express.json());

// Initialize EgressClient for YouTube streaming
const egressClient = new EgressClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/token", async (req, res) => {
  const { room, participantName } = req.body;

  if (!room || !participantName) {
    return res.status(400).json({ error: "room and participantName are required" });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "LiveKit credentials not configured" });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  res.json({ token: await token.toJwt() });
});

app.post("/api/token/ai-cohost", async (req, res) => {
  const { room } = req.body;

  if (!room) {
    return res.status(400).json({ error: "room is required" });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "LiveKit credentials not configured" });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: "ai-cohost",
    name: "AI Co-Host",
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: false,
    canPublishData: false,
  });

  res.json({ token: await token.toJwt() });
});

app.post("/api/openai/session", async (req, res) => {
  const apiKey = process.env.OPENAI_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy"
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    res.json({ client_secret: data.client_secret.value });
  } catch (error) {
    console.error("OpenAI session creation failed:", error);
    res.status(500).json({ error: "Failed to create OpenAI session" });
  }
});

// Start YouTube RTMP streaming via LiveKit Egress
app.post("/api/streaming/start", async (req, res) => {
  const { room } = req.body;

  if (!room) {
    return res.status(400).json({ error: "room is required" });
  }

  const rtmpKey = process.env.YOUTUBE_RTMP_KEY;
  if (!rtmpKey) {
    return res.status(500).json({ error: "YOUTUBE_RTMP_KEY not configured in .env" });
  }

  const rtmpUrl = `rtmp://a.rtmp.youtube.com/live2/${rtmpKey}`;

  try {
    console.log(`[Streaming] Starting RoomComposite egress for room: ${room}`);
    const egress = await egressClient.startRoomCompositeEgress(room, {
      stream: {
        protocol: StreamProtocol.RTMP,
        urls: [rtmpUrl],
      },
    });

    console.log(`[Streaming] Egress started successfully. ID: ${egress.egressId}`);
    res.json({
      egressId: egress.egressId,
      status: egress.status,
    });
  } catch (error) {
    console.error("[Streaming] Failed to start egress:", error);
    res.status(500).json({
      error: "Failed to start streaming",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Stop YouTube RTMP streaming
app.post("/api/streaming/stop", async (req, res) => {
  const { egressId } = req.body;

  if (!egressId) {
    return res.status(400).json({ error: "egressId is required" });
  }

  try {
    console.log(`[Streaming] Stopping egress: ${egressId}`);
    const info = await egressClient.stopEgress(egressId);
    console.log(`[Streaming] Egress stopped successfully`);
    res.json({
      success: true,
      status: info.status,
    });
  } catch (error) {
    console.error("[Streaming] Failed to stop egress:", error);
    res.status(500).json({
      error: "Failed to stop streaming",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

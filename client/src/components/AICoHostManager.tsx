import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitRoom, useRoomContext, useTracks } from "@livekit/components-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { useOpenAIRealtime } from "../hooks/useOpenAIRealtime";

interface AICoHostManagerProps {
  children: React.ReactNode;
  serverUrl: string;
  token: string;
  onDisconnected: () => void;
}

// Inner component that has access to room context
function AICoHostControls({
  onMicTrackReady,
  onAiAudioTrack,
  onError
}: {
  onMicTrackReady: (track: MediaStreamTrack) => void;
  onAiAudioTrack: (track: MediaStreamTrack) => void;
  onError: (error: Error) => void;
}) {
  const room = useRoomContext();
  const aiRoomRef = useRef<Room | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [localMicTrack, setLocalMicTrack] = useState<MediaStreamTrack | null>(null);
  const [aiAudioTrack, setAiAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store callbacks in refs to avoid triggering effects on every render
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onMicTrackReadyRef = useRef(onMicTrackReady);
  onMicTrackReadyRef.current = onMicTrackReady;
  const onAiAudioTrackRef = useRef(onAiAudioTrack);
  onAiAudioTrackRef.current = onAiAudioTrack;

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStreamingLoading, setIsStreamingLoading] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [streamingError, setStreamingError] = useState<string | null>(null);

  // Get local microphone track using useTracks hook
  const tracks = useTracks([Track.Source.Microphone], {
    onlySubscribed: false,
  });

  // Extract local mic track when available
  const localMicRef = useRef<string | null>(null);
  useEffect(() => {
    const micTrack = tracks.find(
      t => t.source === Track.Source.Microphone && t.participant.identity === room.localParticipant.identity
    );
    if (micTrack?.publication?.track) {
      const mediaStreamTrack = micTrack.publication.track.mediaStreamTrack;
      // Only update if the track actually changed
      if (localMicRef.current === mediaStreamTrack.id) return;
      localMicRef.current = mediaStreamTrack.id;
      console.log("[AICoHost] Local mic track set:", mediaStreamTrack.id);
      setLocalMicTrack(mediaStreamTrack);
      onMicTrackReadyRef.current(mediaStreamTrack);
    }
  }, [tracks, room.localParticipant.identity]);

  // Host should ignore the AI Co-Host's tracks (we already hear AI locally)
  useEffect(() => {
    if (!room) return;

    function unsubscribeAiTracks(participant: import("livekit-client").RemoteParticipant) {
      if (participant.identity !== "ai-cohost") return;
      participant.trackPublications.forEach((pub) => {
        if (pub.isSubscribed) {
          pub.setSubscribed(false);
        }
      });
    }

    function onTrackSubscribed(
      _track: import("livekit-client").RemoteTrack,
      pub: import("livekit-client").RemoteTrackPublication,
      participant: import("livekit-client").RemoteParticipant,
    ) {
      if (participant.identity === "ai-cohost") {
        pub.setSubscribed(false);
      }
    }

    // Unsubscribe from any already-connected AI participant
    room.remoteParticipants.forEach(unsubscribeAiTracks);

    // Handle future connections / subscriptions
    room.on(RoomEvent.ParticipantConnected, unsubscribeAiTracks);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);

    return () => {
      room.off(RoomEvent.ParticipantConnected, unsubscribeAiTracks);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    };
  }, [room]);

  // Clear AI audio track when AI is disabled
  useEffect(() => {
    if (!aiEnabled) {
      setAiAudioTrack(null);
    }
  }, [aiEnabled]);

  // Connect a separate "AI Co-Host" participant and publish AI audio through it
  useEffect(() => {
    if (!aiAudioTrack) {
      // Disconnect existing AI room if track was cleared
      if (aiRoomRef.current) {
        console.log("[AICoHost] AI audio track cleared, disconnecting AI Co-Host");
        aiRoomRef.current.disconnect();
        aiRoomRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const aiRoom = new Room();
    aiRoomRef.current = aiRoom;

    async function connectAndPublish() {
      try {
        console.log("[AICoHost] Fetching AI Co-Host token...");
        const res = await fetch("/api/token/ai-cohost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: "main-room" }),
        });
        if (!res.ok) throw new Error("Failed to get AI co-host token");
        const { token } = await res.json();

        if (cancelled) return;

        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
        console.log("[AICoHost] Connecting AI Co-Host participant...");
        await aiRoom.connect(livekitUrl, token, {
          autoSubscribe: false,
        });

        if (cancelled) {
          aiRoom.disconnect();
          return;
        }

        console.log("[AICoHost] Publishing AI audio track as AI Co-Host...");
        await aiRoom.localParticipant.publishTrack(aiAudioTrack, {
          name: "ai-cohost-audio",
          source: Track.Source.Microphone,
        });
        console.log("[AICoHost] AI audio track published via separate participant");
      } catch (err) {
        console.error("[AICoHost] Failed to connect/publish AI participant:", err);
        setError("Failed to publish AI audio as separate participant");
        onErrorRef.current(err as Error);
      }
    }

    connectAndPublish();

    return () => {
      cancelled = true;
      console.log("[AICoHost] Disconnecting AI Co-Host participant");
      aiRoom.disconnect();
      aiRoomRef.current = null;
    };
  }, [aiAudioTrack]);

  const handleAiTrackReady = useCallback((track: MediaStreamTrack) => {
    setAiAudioTrack(track);
    onAiAudioTrackRef.current(track);
  }, []);

  const handleAiError = useCallback((err: Error) => {
    setError(err.message);
    onErrorRef.current(err);
  }, []);

  const { isConnected, isSpeaking } = useOpenAIRealtime({
    enabled: aiEnabled,
    localAudioTrack: localMicTrack,
    onAudioTrackReady: handleAiTrackReady,
    onError: handleAiError,
  });

  // Start YouTube streaming handler
  const handleStartStreaming = async () => {
    if (isStreaming) {
      console.log("[Streaming] Already streaming, ignoring duplicate request");
      return;
    }

    setIsStreamingLoading(true);
    setStreamingError(null);

    try {
      const response = await fetch("/api/streaming/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: "main-room" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start streaming");
      }

      const data = await response.json();
      setEgressId(data.egressId);
      setIsStreaming(true);
      console.log("[Streaming] Started successfully. Egress ID:", data.egressId);
    } catch (err) {
      console.error("[Streaming] Start failed:", err);
      setStreamingError(err instanceof Error ? err.message : "Failed to start streaming");
    } finally {
      setIsStreamingLoading(false);
    }
  };

  // Stop YouTube streaming handler
  const handleStopStreaming = async () => {
    if (!egressId) {
      console.log("[Streaming] No egress ID, cannot stop");
      return;
    }

    setIsStreamingLoading(true);
    setStreamingError(null);

    try {
      const response = await fetch("/api/streaming/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ egressId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to stop streaming");
      }

      setIsStreaming(false);
      setEgressId(null);
      console.log("[Streaming] Stopped successfully");
    } catch (err) {
      console.error("[Streaming] Stop failed:", err);
      setStreamingError(err instanceof Error ? err.message : "Failed to stop streaming");
    } finally {
      setIsStreamingLoading(false);
    }
  };

  // Auto-cleanup on component unmount or room disconnect
  useEffect(() => {
    return () => {
      if (isStreaming && egressId) {
        console.log("[Streaming] Cleanup: stopping streaming on unmount");
        fetch("/api/streaming/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ egressId }),
        }).catch(err => console.error("[Streaming] Cleanup failed:", err));
      }
    };
  }, [isStreaming, egressId]);

  return (
    <>
      {/* AI Controls Overlay */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        {/* YouTube Streaming Button */}
        <button
          onClick={isStreaming ? handleStopStreaming : handleStartStreaming}
          disabled={isStreamingLoading || !room}
          className={`px-4 py-2 rounded-lg font-semibold text-white ${
            isStreaming
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-blue-600 hover:bg-blue-700'
          } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        >
          {isStreamingLoading ? 'Loading...' : (isStreaming ? 'Stop Stream' : 'Stream to YouTube')}
        </button>

        {/* LIVE Indicator */}
        {isStreaming && (
          <div className="px-4 py-2 bg-red-600 rounded-lg flex items-center gap-2 text-white">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-bold">LIVE</span>
          </div>
        )}

        {/* AI Co-Host Toggle */}
        <button
          onClick={() => setAiEnabled(!aiEnabled)}
          disabled={!localMicTrack}
          className={`px-4 py-2 rounded-lg font-semibold text-white ${
            aiEnabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-gray-600 hover:bg-gray-700'
          } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        >
          AI Co-Host: {aiEnabled ? 'ON' : 'OFF'}
        </button>

        {/* AI Status Indicator */}
        {isConnected && (
          <div className="px-4 py-2 bg-blue-600 rounded-lg flex items-center gap-2 text-white">
            <div className={`w-2 h-2 rounded-full ${
              isSpeaking ? 'bg-red-500 animate-pulse' : 'bg-green-500'
            }`} />
            <span className="text-sm font-semibold">
              {isSpeaking ? 'AI Speaking' : 'AI Listening'}
            </span>
          </div>
        )}
      </div>

      {/* AI Error Display */}
      {error && (
        <div className="absolute top-16 right-4 z-50 max-w-sm p-3 bg-red-600 rounded-lg text-sm text-white">
          <strong>AI Error:</strong> {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Streaming Error Display */}
      {streamingError && (
        <div className="absolute top-28 right-4 z-50 max-w-sm p-3 bg-red-600 rounded-lg text-sm text-white">
          <strong>Streaming Error:</strong> {streamingError}
          <button
            onClick={() => setStreamingError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

// Outer wrapper component
export default function AICoHostManager({
  children,
  serverUrl,
  token,
  onDisconnected
}: AICoHostManagerProps) {
  const [micTrack, setMicTrack] = useState<MediaStreamTrack | null>(null);
  const [aiTrack, setAiTrack] = useState<MediaStreamTrack | null>(null);
  const handleError = useCallback((err: Error) => console.error("AI Error:", err), []);

  return (
    <div className="relative w-full">
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={true}
        audio={true}
        video={true}
        onDisconnected={onDisconnected}
      >
        <AICoHostControls
          onMicTrackReady={setMicTrack}
          onAiAudioTrack={setAiTrack}
          onError={handleError}
        />
        {children}
      </LiveKitRoom>
    </div>
  );
}

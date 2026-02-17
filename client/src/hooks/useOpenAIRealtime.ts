import { useEffect, useRef, useState, useCallback } from 'react';

interface UseOpenAIRealtimeOptions {
  enabled: boolean;
  localAudioTrack: MediaStreamTrack | null;
  onAudioTrackReady: (track: MediaStreamTrack) => void;
  onError: (error: Error) => void;
}

export function useOpenAIRealtime({
  enabled,
  localAudioTrack,
  onAudioTrackReady,
  onError
}: UseOpenAIRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Store callbacks in refs so they don't trigger effect re-runs
  const onAudioTrackReadyRef = useRef(onAudioTrackReady);
  onAudioTrackReadyRef.current = onAudioTrackReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled || !localAudioTrack) {
      console.log("[OpenAI] Not starting - enabled:", enabled, "localAudioTrack:", !!localAudioTrack);
      return;
    }

    console.log("[OpenAI] Effect triggered - enabled and have mic track");
    let pc: RTCPeerConnection;
    let cleanup = false;

    async function setupOpenAI() {
      try {
        console.log("[OpenAI] Starting connection setup...");

        // 1. Get ephemeral key from our server
        const response = await fetch("/api/openai/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[OpenAI] Session fetch failed:", response.status, errorText);
          throw new Error("Failed to get OpenAI session");
        }
        const { client_secret } = await response.json();
        console.log("[OpenAI] Got session token");

        if (cleanup) return;

        // 2. Create RTCPeerConnection
        pc = new RTCPeerConnection();
        peerConnectionRef.current = pc;
        console.log("[OpenAI] Created peer connection");

        // 3. Set up audio playback for OpenAI responses (local only)
        const audioElement = document.createElement("audio");
        audioElement.autoplay = true;
        audioElementRef.current = audioElement;

        pc.ontrack = (event) => {
          console.log("[OpenAI] Received audio track from OpenAI");
          audioElement.srcObject = event.streams[0];
          // Clone the track to publish to LiveKit
          const clonedTrack = event.track.clone();
          onAudioTrackReadyRef.current(clonedTrack);
        };

        // 4. Add host microphone to send to OpenAI
        pc.addTrack(localAudioTrack);
        console.log("[OpenAI] Added local microphone track");

        // 5. Set up data channel for events
        const dc = pc.createDataChannel("oai-events");
        dataChannelRef.current = dc;

        dc.onopen = () => {
          console.log("[OpenAI] Data channel opened - sending session config");
          setIsConnected(true);
          dc.send(JSON.stringify({
            type: "session.update",
            session: {
              instructions: "You are an enthusiastic podcast host. You will respond in a fun manner. Ask engaging questions, show genuine interest, and help make the conversation flow naturally. Keep responses concise (2-3 sentences). You can also help me introduce people and companies.",
              voice: "alloy",
              input_audio_transcription: { model: "whisper-1" },
              turn_detection: {
                type: "server_vad",
                threshold: 0.8,
                prefix_padding_ms: 500,
                silence_duration_ms: 1000,
              },
            }
          }));
        };

        dc.onerror = (error) => {
          console.error("[OpenAI] Data channel error:", error);
        };

        dc.onclose = () => {
          console.log("[OpenAI] Data channel closed");
        };

        dc.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "response.audio.delta") {
            setIsSpeaking(true);
          } else if (msg.type === "response.done") {
            setIsSpeaking(false);
          }
        };

        // 6. Create offer and set local description
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("[OpenAI] Created and set local SDP offer");

        if (cleanup) return;

        // 7. Send offer to OpenAI and get answer
        console.log("[OpenAI] Sending SDP offer to OpenAI Realtime API...");
        const sdpResponse = await fetch("https://api.openai.com/v1/realtime", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        });

        if (!sdpResponse.ok) {
          const errorText = await sdpResponse.text();
          console.error("[OpenAI] Realtime API error:", sdpResponse.status, errorText);
          throw new Error(`Failed to connect to OpenAI: ${sdpResponse.status}`);
        }

        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        });
        console.log("[OpenAI] Set remote SDP answer - connection established");

        pc.onconnectionstatechange = () => {
          console.log("[OpenAI] Connection state:", pc.connectionState);
        };

        pc.oniceconnectionstatechange = () => {
          console.log("[OpenAI] ICE connection state:", pc.iceConnectionState);
        };

      } catch (error) {
        if (!cleanup) {
          console.error("[OpenAI] Setup failed:", error);
          onErrorRef.current(error as Error);
          setIsConnected(false);
        }
      }
    }

    setupOpenAI();

    // Cleanup
    return () => {
      cleanup = true;
      dataChannelRef.current?.close();
      peerConnectionRef.current?.close();
      audioElementRef.current?.remove();
      setIsConnected(false);
      setIsSpeaking(false);
    };
  }, [enabled, localAudioTrack]);

  const disconnect = useCallback(() => {
    peerConnectionRef.current?.close();
    dataChannelRef.current?.close();
    audioElementRef.current?.remove();
    setIsConnected(false);
  }, []);

  return {
    isConnected,
    isSpeaking,
    disconnect,
  };
}

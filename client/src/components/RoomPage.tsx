import { useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import AICoHostManager from './AICoHostManager';

interface RoomPageProps {
  role: "host" | "guest";
}

const ROOM_NAME = "main-room";

function generateParticipantName(role: "host" | "guest"): string {
  if (role === "host") {
    return "Host";
  }
  // Generate random 4-digit number for guest
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `Guest-${randomNum}`;
}

export default function RoomPage({ role }: RoomPageProps) {
  const [token, setToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const participantName = generateParticipantName(role);

  const handleJoinRoom = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:3001/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room: ROOM_NAME,
          participantName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get token");
      }

      const data = await response.json();
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setToken(null);
    setIsConnecting(false);
  };

  // Check if LiveKit URL is configured
  if (!import.meta.env.VITE_LIVEKIT_URL) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="max-w-md w-full p-8 bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4 text-center text-red-500">Configuration Error</h1>
          <p className="text-gray-300 mb-4">
            LiveKit URL not configured. Check that the .env file exists with VITE_LIVEKIT_URL set.
          </p>
          <code className="block p-2 bg-gray-900 rounded text-sm">
            VITE_LIVEKIT_URL: {String(import.meta.env.VITE_LIVEKIT_URL)}
          </code>
        </div>
      </div>
    );
  }

  if (token) {
    // For host: use AI-enhanced version
    if (role === 'host') {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
          <h1 className="text-2xl font-bold text-white mb-4">AI Livestream - Host</h1>
          <div className="w-full max-w-4xl">
            <AICoHostManager
              serverUrl={import.meta.env.VITE_LIVEKIT_URL}
              token={token}
              onDisconnected={handleDisconnect}
            >
              <VideoConference />
            </AICoHostManager>
          </div>
        </div>
      );
    }

    // For guests: use standard LiveKitRoom (unchanged)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
        <h1 className="text-2xl font-bold text-white mb-4">AI Livestream - Guest</h1>
        <div className="w-full max-w-4xl">
          <LiveKitRoom
            serverUrl={import.meta.env.VITE_LIVEKIT_URL}
            token={token}
            connect={true}
            audio={true}
            video={true}
            onDisconnected={handleDisconnect}
          >
            <VideoConference />
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="max-w-md w-full p-8 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center">
          {role === "host" ? "Host Room" : "Guest Room"}
        </h1>

        <div className="mb-6 p-4 bg-gray-700 rounded">
          <p className="text-sm text-gray-300 mb-1">Room:</p>
          <p className="font-semibold">{ROOM_NAME}</p>
          <p className="text-sm text-gray-300 mt-3 mb-1">Your name:</p>
          <p className="font-semibold">{participantName}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-600 rounded text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleJoinRoom}
          disabled={isConnecting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {isConnecting ? "Connecting..." : "Join Room"}
        </button>
      </div>
    </div>
  );
}

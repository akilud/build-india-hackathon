# AI Livestream MVP - 4 Hour Hackathon Plan

## Project Overview
Build an AI-enabled live streaming platform where OpenAI Realtime Voice acts as a co-host, streaming to YouTube with live comment integration.

---

## ✅ Pre-Hackathon Setup - COMPLETED

- [x] LiveKit Cloud credentials obtained
- [x] OpenAI API key obtained
- [x] YouTube Stream key obtained
- [x] All credentials added to .env file
- [x] Project initialized

---

## Hour-by-Hour Execution Plan

## HOUR 1: Basic LiveKit Room (Host Video/Audio)

### Goal: Get yourself on camera in a LiveKit room
Create a LiveKitRoom component that:
1. Connects to LiveKit using credentials from .env
2. Displays local video and audio from host's camera/mic
3. Shows a simple UI with connection status
4. Has join/leave room buttons
Use @livekit/components-react library

### Test Checklist:
- [ ] Can see yourself on camera
- [ ] Can hear yourself (test with headphones to avoid feedback)
- [ ] Connection status shows "Connected"
- [ ] Can join/leave room

**If this doesn't work in 45 min, debug before moving on**

### Common Issues:
- Camera permissions not granted
- Wrong LiveKit URL format (should be wss://...)
- .env variables not loading

---

## HOUR 1.5-2: OpenAI Realtime + Clone to LiveKit

### Goal: AI co-host talks to you locally, audio cloned to LiveKit room
Add OpenAI Realtime API integration:
1. Create WebRTC connection to OpenAI Realtime API using credentials from .env
2. Send host microphone audio to OpenAI
3. Play OpenAI responses through host's local speakers
4. Clone the OpenAI audio output stream
5. Publish the cloned stream to LiveKit room as a track named 'ai-cohost'
6. Add toggle button to mute/unmute AI
7. Set AI personality to be a podcast co-host/interviewer
Use the low-level WebRTC integration for OpenAI Realtime

### Test Checklist:
- [ ] Can talk to AI and hear responses locally
- [ ] Open room in second browser tab - can hear AI voice there
- [ ] AI audio is in sync (< 2 sec delay)
- [ ] Can toggle AI on/off
- [ ] AI sounds natural and conversational

**Budget 1-1.5 hours for this - it's the hardest part**

### AI Personality Prompt Suggestion:
"You are an enthusiastic podcast co-host. Ask engaging questions, show genuine interest, and help make the conversation flow naturally. Keep responses concise (2-3 sentences)."

---

## HOUR 2-2.5: YouTube RTMP Streaming

### Goal: Stream the LiveKit room to YouTube
Add LiveKit Egress to stream to YouTube:
1. Create a function to start RoomComposite egress
2. Configure RTMP output using YouTube credentials from .env.local (VITE_YOUTUBE_RTMP_URL and VITE_YOUTUBE_STREAM_KEY)
3. Add 'Start Streaming' and 'Stop Streaming' buttons
4. Show streaming status indicator (LIVE badge when active)
5. Handle egress errors gracefully
Use @livekit/server-sdk or REST API for egress calls. The RTMP URL format is: rtmp://a.rtmp.youtube.com/live2/[STREAM_KEY]"


### Test Checklist:
- [ ] Click "Start Streaming"
- [ ] Check YouTube Studio - stream appears within 30 seconds
- [ ] Both host video and AI audio are in the stream
- [ ] Can stop streaming cleanly
- [ ] Status indicator updates correctly

---

## HOUR 2.5-3.5: YouTube Comments Integration

### Goal: Show live comments in the interface

**Simple version - DO THIS FIRST (15 min):**
Embed YouTube live chat iframe in the page. The iframe URL format is:
https://www.youtube.com/live_chat?v=[VIDEO_ID]&embed_domain=localhost

Style it to appear in a sidebar next to the video. Add a title 'Live Comments' above it."

**Advanced version - ONLY if time allows (45 min):**
claude code "Use YouTube Live Streaming API v3 to:
1. Fetch live chat messages using liveChatId
2. Display them in a custom styled component
3. Auto-refresh every 5 seconds using polling
4. Show username, message text, and timestamp
5. Add auto-scroll to latest message
Will need to enable YouTube Data API v3 in Google Cloud Console"


### Test Checklist:
- [ ] Comments appear in the interface
- [ ] Updates in real-time (or near real-time)
- [ ] Layout doesn't break if iframe fails to load
- [ ] Can resize/hide comment section

**If short on time: Just do the iframe embed - it's good enough for demo**

---

## HOUR 3.5-4: Polish + Demo Prep

### Polish Tasks:
Add polish and production-ready features:
1. Clean UI layout with Tailwind CSS
2. Add app title 'AI Livestream' and minimal branding
3. Disable buttons when not ready (e.g., can't stream if not connected to room)
4. Add participant count display
5. Add visual indicator when AI is speaking
6. Make it mobile-responsive (bonus)"
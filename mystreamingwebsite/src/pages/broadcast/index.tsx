'use client';

import { useRef, useState } from 'react';

export default function BroadcastPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState('idle');

  async function startBroadcast() {
    try {
      setStatus('requesting screen...');

      // Ask the browser for screen capture.
      // The user still has to manually choose the monitor/window/tab.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus('connecting websocket...');

      const ws = new WebSocket('ws://localhost:8000/ws/broadcast');
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected, starting recorder...');

        // Browser support varies by codec/container.
        // webm/vp8 is the safest starting point for MediaRecorder in Chromium.
        const mimeType = 'video/webm;codecs=vp8';

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 4_000_000,
        });

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const buf = await event.data.arrayBuffer();
            ws.send(buf);
          }
        };

        recorder.onstop = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stop' }));
            ws.close();
          }
        };

        // Send small chunks every second.
        recorder.start(1000);
        setStreaming(true);
        setStatus('broadcasting');
      };

      ws.onerror = () => {
        setStatus('websocket error');
      };

      ws.onclose = () => {
        setStatus('socket closed');
      };

      const [track] = stream.getVideoTracks();
      if (track) {
        track.onended = () => {
          stopBroadcast();
        };
      }
    } catch (err) {
      console.error(err);
      setStatus('failed to start');
    }
  }

  function stopBroadcast() {
    mediaRecorderRef.current?.stop();

    const src = videoRef.current?.srcObject;
    if (src instanceof MediaStream) {
      src.getTracks().forEach((t) => t.stop());
    }

    videoRef.current && (videoRef.current.srcObject = null);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    setStreaming(false);
    setStatus('stopped');
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Broadcast Screen</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={startBroadcast} disabled={streaming}>
          Start
        </button>
        <button onClick={stopBroadcast} disabled={!streaming}>
          Stop
        </button>
      </div>

      <p>Status: {status}</p>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', maxWidth: 900, border: '1px solid #444' }}
      />
    </main>
  );
}
'use client';

// import { useEffect, useRef } from 'react';
// import Hls from 'hls.js';
import ReactPlayer from 'react-player'

export default function WatchPage() {
//   const videoRef = useRef<HTMLVideoElement | null>(null);

//   useEffect(() => {
//     const video = videoRef.current;
//     if (!video) return;

//     const src = 'http://localhost:8000/hls/stream.m3u8';

//     if (Hls.isSupported()) {
//       const hls = new Hls({
//         lowLatencyMode: true,
//       });

//       hls.loadSource(src);
//       hls.attachMedia(video);

//       hls.on(Hls.Events.MANIFEST_PARSED, () => {
//         video.play().catch(() => {});
//       });

//       return () => {
//         hls.destroy();
//       };
//     }

//     // Safari / native HLS fallback
//     if (video.canPlayType('application/vnd.apple.mpegurl')) {
//       video.src = src;
//       video.play().catch(() => {});
//     }
//   }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Watch Stream</h1>
      <ReactPlayer src='http://localhost:8000/hls/stream.m3u8' playing muted={true}/>
    </main>
  );
}
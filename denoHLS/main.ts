const HLS_DIR = `${Deno.cwd()}/public/hls`;
await Deno.mkdir(HLS_DIR, { recursive: true });

let ffmpegProcess: Deno.ChildProcess | null = null;
let ffmpegWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

function createCorsHeaders(extra: HeadersInit = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

async function startFfmpeg() {
  // Clean old HLS output
  for await (const entry of Deno.readDir(HLS_DIR)) {
    await Deno.remove(`${HLS_DIR}/${entry.name}`);
  }

  const command = new Deno.Command('ffmpeg', {
    args: [
      '-y',

      // Input from stdin
      '-f', 'webm',
      '-i', 'pipe:0',

      // Transcode to H.264 for broad HLS compatibility
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p',
      '-g', '60',
      '-keyint_min', '60',

      // No audio in this example
      '-an',

      // HLS output
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list+omit_endlist',
      '-hls_segment_filename', `${HLS_DIR}/segment_%03d.ts`,
      `${HLS_DIR}/stream.m3u8`,
    ],
    stdin: 'piped',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  ffmpegProcess = command.spawn();
  ffmpegWriter = ffmpegProcess.stdin.getWriter();
}

async function stopFfmpeg() {
  try {
    await ffmpegWriter?.close();
  } catch {
    // ignore
  }
  ffmpegWriter = null;

  try {
    await ffmpegProcess?.status;
  } catch {
    // ignore
  }
  ffmpegProcess = null;
}

function contentType(path: string) {
  if (path.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (path.endsWith('.ts')) return 'video/mp2t';
  return 'application/octet-stream';
}

Deno.serve({ port: 8000 }, async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: createCorsHeaders() });
  }

  // WebSocket ingest endpoint
  if (url.pathname === '/ws/broadcast') {
    if (req.headers.get('upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = async () => {
      console.log('Broadcaster connected');
      await startFfmpeg();
    };

    socket.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          if (msg.type === 'stop') {
            await stopFfmpeg();
          }
          return;
        }

        if (event.data instanceof ArrayBuffer) {
          if (!ffmpegWriter) return;
          await ffmpegWriter.write(new Uint8Array(event.data));
          return;
        }

        if (event.data instanceof Blob) {
          if (!ffmpegWriter) return;
          const buf = await event.data.arrayBuffer();
          await ffmpegWriter.write(new Uint8Array(buf));
        }
      } catch (err) {
        console.error('message error', err);
      }
    };

    socket.onclose = async () => {
      console.log('Broadcaster disconnected');
      await stopFfmpeg();
    };

    socket.onerror = (err) => {
      console.error('ws error', err);
    };

    return response;
  }

  // Serve HLS files
  if (url.pathname.startsWith('/hls/')) {
    const filePath = `${Deno.cwd()}/public${url.pathname}`;

    try {
      const file = await Deno.readFile(filePath);
      return new Response(file, {
        headers: createCorsHeaders({
          'Content-Type': contentType(filePath),
          'Cache-Control': 'no-store',
        }),
      });
    } catch {
      return new Response('Not found', { status: 404, headers: createCorsHeaders() });
    }
  }

  return new Response('OK', {
    headers: createCorsHeaders({ 'Content-Type': 'text/plain' }),
  });
});
// Afterlight — Kiroween 2026 entry
// Analog contact sheets for forgotten digital footage.
// Browser ES module. No external dependencies.

/* ── Constants ─────────────────────────────────────────── */

const META_TIMEOUT = 20000;
const SEEK_TIMEOUT = 20000;
const MAX_FRAME_WIDTH = 480;
const MAX_FRAME_HEIGHT = 480;
const FRAME_JPEG_QUALITY = 0.9;
const SHEET_JPEG_QUALITY = 0.92;

/* ── Time formatting ───────────────────────────────────── */

function formatTimestamp(seconds) {
  const s = typeof seconds === "number" && isFinite(seconds) ? seconds : 0;
  const totalMs = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const sec = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  const pad = (n, l) => String(n).padStart(l, "0");
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(sec, 2)}.${pad(ms, 3)}`;
}

/* ── AbortError factory ────────────────────────────────── */

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

/* ── Text layout helpers ───────────────────────────────── */

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (
      ctx.measureText(characters.slice(0, middle).join("") + "\u2026").width <=
      maxWidth
    ) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return characters.slice(0, low).join("") + "\u2026";
}

function wrapToWidth(ctx, text, maxWidth, maxLines) {
  if (!text || maxLines <= 0) return [];
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  let idx = 0;

  while (idx < words.length && lines.length < maxLines) {
    const word = words[idx];
    const candidate = current ? current + " " + word : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      idx++;
    } else if (current) {
      // Word doesn't fit on current line — start a new one
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) break;
    } else {
      // Single word wider than maxWidth — truncate it
      lines.push(truncateToWidth(ctx, word, maxWidth));
      idx++;
      if (lines.length >= maxLines) break;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);

  // If words remain and we're at maxLines, truncate the last visible line
  if (idx < words.length && lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (!last.endsWith("\u2026")) {
      lines[maxLines - 1] = truncateToWidth(ctx, last + "\u2026", maxWidth);
    }
  }

  return lines;
}

/* ── Image loading ────────────────────────────────────── */

function loadImage(src, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    if (
      typeof src !== "string" ||
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)
    ) {
      return reject(
        new Error(
          "The contact sheet requires embedded JPEG, PNG, or WebP frame images.",
        ),
      );
    }
    if (src.length > 4 * 1024 * 1024)
      return reject(new Error("A frame image exceeds the 4 MB limit."));
    const img = new Image();
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      img.onload = null;
      img.onerror = null;
      if (error) {
        img.removeAttribute("src");
        reject(error);
      } else resolve(img);
    };
    const onAbort = () => finish(abortError());
    const timer = setTimeout(
      () => finish(new Error("Timed out decoding a frame image.")),
      META_TIMEOUT,
    );
    img.onload = () =>
      finish(
        img.naturalWidth && img.naturalHeight
          ? null
          : new Error("Frame image has zero dimensions."),
      );
    img.onerror = () => finish(new Error("Failed to decode frame image."));
    signal?.addEventListener("abort", onAbort, { once: true });
    img.src = src;
  });
}

/* ── Video element lifecycle ──────────────────────────── */

function createVideoElement(file) {
  if (!(file instanceof Blob) || file.size === 0) {
    throw new Error("Choose a non-empty video file.");
  }
  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "metadata";
  const url = URL.createObjectURL(file);
  video.src = url;
  return { video, url };
}

function releaseVideo(video, url) {
  try {
    video.pause();
    video.removeAttribute("src");
    video.load();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function videoError(video) {
  const code = video.error?.code;
  if (code === 4)
    return new Error(
      "This browser cannot decode the video format. Try an MP4 encoded with H.264, or a supported WebM file.",
    );
  if (code === 3)
    return new Error(
      "The video could not be decoded. The file may be damaged or use an unsupported codec.",
    );
  return new Error(
    `The browser could not read this video${code ? ` (media error ${code})` : ""}.`,
  );
}

/** Install before triggering load/seek so even an immediate event is observed. */
function waitForVideo(video, events, ready, signal, description, start) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    if (video.error) return reject(videoError(video));
    let settled = false;
    let timer = null;
    const settle = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const event of events) video.removeEventListener(event, onReady);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onReady = () => {
      if (ready()) settle();
    };
    const onError = () => settle(videoError(video));
    const onAbort = () => settle(abortError());
    for (const event of events) video.addEventListener(event, onReady);
    video.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(
      () =>
        settle(
          new Error(
            `Timed out ${description} after 20 seconds. Try another browser or re-encode this video.`,
          ),
        ),
      SEEK_TIMEOUT,
    );
    try {
      start?.();
      onReady();
    } catch (error) {
      settle(error);
    }
  });
}

async function loadMetadata(video, signal) {
  await waitForVideo(
    video,
    ["loadedmetadata", "durationchange"],
    () => video.readyState >= 1,
    signal,
    "reading video metadata",
  );
  if (getValidDuration(video.duration) === null) {
    throw new Error(
      "This file has no finite positive duration. Re-encode a live recording before importing it.",
    );
  }
  if (!video.videoWidth || !video.videoHeight)
    throw new Error("This file has no decodable video track.");
  // Metadata-only preload can otherwise leave a paused video waiting for data.
  video.preload = "auto";
}

async function seekToTime(video, targetTime, signal) {
  let seekCompleted = video.currentTime === targetTime && !video.seeking;
  const markComplete = () => {
    seekCompleted = true;
  };
  video.addEventListener("seeked", markComplete);
  try {
    await waitForVideo(
      video,
      ["seeked", "loadeddata", "canplay"],
      () => seekCompleted && !video.seeking && video.readyState >= 2,
      signal,
      `decoding the frame at ${formatTimestamp(targetTime)}`,
      () => {
        if (!seekCompleted) video.currentTime = targetTime;
      },
    );
  } finally {
    video.removeEventListener("seeked", markComplete);
  }
}

/**
 * Draw the current decoded video frame to a canvas at max width 480,
 * preserving aspect ratio. Returns a JPEG data URL.
 */
function captureFrame(video) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Video has zero dimensions");
  if (video.seeking || video.readyState < 2 || video.error)
    throw new Error("The current video frame is not ready to capture.");
  const scale = Math.min(1, MAX_FRAME_WIDTH / vw, MAX_FRAME_HEIGHT / vh);
  const cw = Math.max(1, Math.round(vw * scale));
  const ch = Math.max(1, Math.round(vh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D canvas context");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(video, 0, 0, cw, ch);
  const image = canvas.toDataURL("image/jpeg", FRAME_JPEG_QUALITY);
  if (!image.startsWith("data:image/jpeg;base64,"))
    throw new Error("The browser could not encode a frame thumbnail.");
  canvas.width = 1;
  canvas.height = 1;
  return image;
}

/* ── Validation & computation ──────────────────────────── */

function validateFrameCount(value) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("frameCount must be an integer");
  }
  return Math.min(24, Math.max(1, value));
}

function getValidDuration(duration) {
  if (typeof duration !== "number" || !isFinite(duration) || duration <= 0) {
    return null;
  }
  return duration;
}

/** Uniformly distributed interior positions: duration * (i + 0.5) / count */
function computeSeekPositions(duration, count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    positions.push((duration * (i + 0.5)) / count);
  }
  return positions;
}

/* ── Exports ───────────────────────────────────────────── */

/**
 * Inspect a video file: read metadata and extract representative frames.
 *
 * @param {Blob|File} file - The video file to inspect.
 * @param {Object}   opts
 * @param {AbortSignal} opts.signal    - Abort the operation.
 * @param {Function} opts.onProgress   - Called with {completed,total} after each frame.
 * @param {number}   opts.frameCount=12 - Number of frames to extract (1..24).
 * @returns {Promise<{duration:number,width:number,height:number,
 *                     frames:Array<{time:number,image:string}>,poster:string}>}
 */
export async function inspectVideo(
  file,
  { signal, onProgress, frameCount = 12 } = {},
) {
  if (signal?.aborted) throw abortError();
  const count = validateFrameCount(frameCount);

  const { video, url } = createVideoElement(file);

  try {
    if (signal?.aborted) throw abortError();

    await loadMetadata(video, signal);

    // Duration must be finite and positive
    const duration = getValidDuration(video.duration);
    if (duration === null) {
      throw new Error(`Invalid video duration: ${video.duration}`);
    }

    // Non-zero dimensions indicate the codec was actually decoded
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      throw new Error("Video has zero dimensions (unsupported codec?)");
    }

    // Seek to interior positions, draw each decoded frame
    const positions = computeSeekPositions(duration, count);
    const frames = [];
    let poster = null;

    for (let i = 0; i < positions.length; i++) {
      if (signal?.aborted) throw abortError();

      await seekToTime(video, positions[i], signal);
      if (signal?.aborted) throw abortError();
      const image = captureFrame(video);
      frames.push({ time: video.currentTime, image });
      if (i === 0) poster = image;

      if (typeof onProgress === "function") {
        onProgress({ completed: i + 1, total: count });
      }
    }
    if (signal?.aborted) throw abortError();
    return { duration, width, height, frames, poster };
  } finally {
    releaseVideo(video, url);
  }
}

/**
 * Extract a single frame at a specific timestamp.
 *
 * @param {Blob|File} file - The video file.
 * @param {number}   time  - Seek target in seconds, clamped safely before the end.
 * @param {Object}   opts
 * @param {AbortSignal} opts.signal - Abort the operation.
 * @returns {Promise<{time:number,image:string}>}
 */
export async function extractFrame(file, time, { signal } = {}) {
  if (signal?.aborted) throw abortError();
  if (typeof time !== "number" || !Number.isFinite(time))
    throw new Error("Choose a finite frame time in seconds.");

  const { video, url } = createVideoElement(file);

  try {
    if (signal?.aborted) throw abortError();

    await loadMetadata(video, signal);

    const duration = getValidDuration(video.duration);
    if (duration === null) {
      throw new Error(`Invalid video duration: ${video.duration}`);
    }

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Video has zero dimensions (unsupported codec?)");
    }

    // Clamp to valid range — returned time represents the actual seek target
    const lastSafeTime = duration - Math.min(0.05, duration / 2);
    const clampedTime = Math.max(0, Math.min(time, lastSafeTime));
    await seekToTime(video, clampedTime, signal);
    if (signal?.aborted) throw abortError();
    const image = captureFrame(video);
    return { time: video.currentTime, image };
  } finally {
    releaseVideo(video, url);
  }
}

/**
 * Generate a printable 3-column contact sheet from decoded frames.
 *
 * @param {Object} clip - Contains name/fileName/title, duration, and frames[].
 * @param {Object} opts
 * @param {string} opts.title - User-provided title for the header.
 * @returns {Promise<Blob>} JPEG image blob.
 */
export async function makeContactSheet(clip, { title, signal } = {}) {
  if (signal?.aborted) throw abortError();
  if (!clip || !Array.isArray(clip.frames) || clip.frames.length === 0) {
    throw new Error("clip must contain a non-empty frames array");
  }
  if (clip.frames.length > 24)
    throw new Error("A contact sheet supports up to 24 frames.");

  // Decode all frame images before drawing anything
  const frameData = [];
  for (let i = 0; i < clip.frames.length; i++) {
    const f = clip.frames[i];
    if (!f || !f.image || !Number.isFinite(f.time) || f.time < 0) {
      throw new Error(`Frame ${i} is missing image data`);
    }
    try {
      const img = await loadImage(f.image, signal);
      frameData.push({ time: f.time, image: img });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw new Error(`Failed to decode frame ${i}: ${err.message}`);
    }
  }

  /* ── Layout constants ──────────────────────────────── */
  const PAD = 48;
  const CANVAS_W = 1800;
  const COLS = 3;
  const CELL_W = 540;
  const CELL_H = 304;
  const CAPTION_H = 44;
  const COL_GAP = (CANVAS_W - 2 * PAD - COLS * CELL_W) / (COLS - 1); // 42
  const ROW_GAP = 42;
  const rows = Math.ceil(frameData.length / COLS);

  /* ── Palette ───────────────────────────────────────── */
  const BG = "#0f1e2e"; // dark navy
  const HEADER_CLR = "#f0e6d2"; // warm off-white
  const SUB_CLR = "#c0b69a"; // dimmer warm
  const AMBER = "#e8a838"; // amber
  const CELL_BG = "#162638"; // slightly lighter navy
  const BORDER = "#2a3f5f"; // subtle border

  /* ── Header text ───────────────────────────────────── */
  const headerTitle = String(
    title || clip.title || clip.name || clip.fileName || "Untitled",
  ).slice(0, 500);
  const fileName = String(clip.fileName || clip.name || "unknown").slice(
    0,
    500,
  );
  const durationText =
    typeof clip.duration === "number" &&
    isFinite(clip.duration) &&
    clip.duration > 0
      ? formatTimestamp(clip.duration)
      : "\u2014"; // em dash
  const subtitle = `${fileName}  \u00b7  ${durationText}`;

  /* ── Fonts ─────────────────────────────────────────── */
  const TITLE_FONT =
    'bold 44px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const SUB_FONT =
    '24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const TS_FONT =
    '19px "SF Mono", "Cascadia Code", Consolas, "Courier New", monospace';

  /* ── Create canvas (need context for text measurement) ─ */
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D canvas context");

  // Measure header to compute total canvas height
  ctx.font = TITLE_FONT;
  const titleLines = wrapToWidth(ctx, headerTitle, CANVAS_W - 2 * PAD, 2);
  const TITLE_LH = 54;
  const SUB_LH = 36;
  const headerContentH = titleLines.length * TITLE_LH + 12 + SUB_LH;
  const gridTop = PAD + headerContentH + ROW_GAP;
  const gridH = rows * (CELL_H + CAPTION_H) + (rows - 1) * ROW_GAP;
  const totalH = gridTop + gridH + PAD;
  canvas.height = totalH;

  /* ── Draw background ────────────────────────────────── */
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CANVAS_W, totalH);

  /* ── Draw header ────────────────────────────────────── */
  ctx.textBaseline = "top";

  ctx.fillStyle = HEADER_CLR;
  ctx.font = TITLE_FONT;
  let y = PAD;
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y);
    y += TITLE_LH;
  }

  y += 4;
  ctx.fillStyle = SUB_CLR;
  ctx.font = SUB_FONT;
  ctx.fillText(truncateToWidth(ctx, subtitle, CANVAS_W - 2 * PAD), PAD, y);

  // Separator line
  y += SUB_LH + 8;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(CANVAS_W - PAD, y);
  ctx.stroke();

  /* ── Draw frame grid ────────────────────────────────── */
  for (let i = 0; i < frameData.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PAD + col * (CELL_W + COL_GAP);
    const cellY = gridTop + row * (CELL_H + CAPTION_H + ROW_GAP);

    // Cell background
    ctx.fillStyle = CELL_BG;
    ctx.fillRect(x, cellY, CELL_W, CELL_H);

    // Cell border (offset 0.5px for crisp 1px line)
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, cellY + 0.5, CELL_W - 1, CELL_H - 1);

    // Frame image — contained within cell, centered, aspect ratio preserved
    const img = frameData[i].image;
    const scale = Math.min(CELL_W / img.width, CELL_H / img.height);
    const dw = Math.max(1, Math.round(img.width * scale));
    const dh = Math.max(1, Math.round(img.height * scale));
    const dx = x + Math.round((CELL_W - dw) / 2);
    const dy = cellY + Math.round((CELL_H - dh) / 2);
    ctx.drawImage(img, dx, dy, dw, dh);

    // Caption — timestamp in amber
    ctx.fillStyle = AMBER;
    ctx.font = TS_FONT;
    ctx.fillText(
      formatTimestamp(frameData[i].time),
      x + 2,
      cellY + CELL_H + 14,
    );
  }

  /* ── Export as JPEG blob ─────────────────────────────── */
  if (signal?.aborted) throw abortError();
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, blob) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve(blob);
    };
    const onAbort = () => finish(abortError());
    const timer = setTimeout(
      () => finish(new Error("Timed out encoding the contact sheet.")),
      META_TIMEOUT,
    );
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob)
            finish(new Error("Failed to generate image blob from canvas"));
          else finish(null, blob);
          canvas.width = 1;
          canvas.height = 1;
        },
        "image/jpeg",
        SHEET_JPEG_QUALITY,
      );
    } catch (error) {
      finish(error);
    }
  });
}

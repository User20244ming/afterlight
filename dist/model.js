export const id = () => crypto.randomUUID();
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export function timecode(seconds) {
  const ticks = Math.round(Math.max(0, Number(seconds) || 0) * 1000);
  return `${String(Math.floor(ticks / 3600000)).padStart(2, "0")}:${String(Math.floor(ticks / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ticks / 1000) % 60).padStart(2, "0")}.${String(ticks % 1000).padStart(3, "0")}`;
}
export function shortTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
export function emptyProject() {
  return { version: 1, title: "Untitled collection", clips: [], cuts: [] };
}
export function validateProject(data) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.clips) ||
    !Array.isArray(data.cuts)
  )
    fail("Choose an Afterlight version 1 project backup.");
  if (data.clips.length > 60 || data.cuts.length > 500)
    fail("A project supports 60 clips and 500 selections.");
  const text = (value, max) =>
    typeof value === "string" ? value.slice(0, max) : "";
  const clipIds = new Set();
  const clips = data.clips.map((clip) => {
    if (
      !clip ||
      typeof clip.id !== "string" ||
      !clip.id ||
      clipIds.has(clip.id)
    )
      fail("The backup contains an invalid or duplicate clip identifier.");
    clipIds.add(clip.id);
    if (
      !Number.isFinite(clip.duration) ||
      clip.duration <= 0 ||
      !Array.isArray(clip.frames) ||
      !clip.frames.length ||
      clip.frames.length > 24
    )
      fail("The backup contains invalid media metadata.");
    const frames = clip.frames.map((frame) => {
      if (
        !frame ||
        !Number.isFinite(frame.time) ||
        frame.time < 0 ||
        frame.time > clip.duration ||
        typeof frame.image !== "string" ||
        !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(frame.image) ||
        frame.image.length > 500000
      )
        fail("The backup contains an invalid frame.");
      return { time: frame.time, image: frame.image };
    });
    return {
      id: clip.id,
      name: text(clip.name, 1024) || "Untitled clip",
      size: Math.max(0, Number(clip.size) || 0),
      lastModified: Math.max(0, Number(clip.lastModified) || 0),
      duration: clip.duration,
      width: Math.max(1, Number(clip.width) || 1),
      height: Math.max(1, Number(clip.height) || 1),
      frames,
      note: text(clip.note, 4000),
      label: ["none", "amber", "blue", "green", "rose"].includes(clip.label)
        ? clip.label
        : "none",
      favorite: clip.favorite === true,
      demo: ["coast", "cinema", "arrival"].includes(clip.demo)
        ? clip.demo
        : null,
    };
  });
  const cutIds = new Set();
  const cuts = data.cuts.map((cut) => {
    const clip = clips.find((item) => item.id === cut?.clipId);
    if (
      !clip ||
      typeof cut.id !== "string" ||
      !cut.id ||
      cutIds.has(cut.id) ||
      !Number.isFinite(cut.in) ||
      !Number.isFinite(cut.out) ||
      cut.in < 0 ||
      cut.in >= clip.duration ||
      Math.min(cut.out, clip.duration) <= cut.in ||
      cut.out > clip.duration + 0.001
    )
      fail("The backup contains an invalid selection range.");
    cutIds.add(cut.id);
    return {
      id: cut.id,
      clipId: cut.clipId,
      in: cut.in,
      out: Math.min(cut.out, clip.duration),
      note: text(cut.note, 2000),
    };
  });
  return {
    version: 1,
    title: text(data.title, 100) || "Untitled collection",
    clips,
    cuts,
  };
}
export function csv(project) {
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      "Order",
      "Source file",
      "Source in",
      "Source out",
      "Duration seconds",
      "Note",
    ],
  ];
  project.cuts.forEach((cut, i) =>
    rows.push([
      i + 1,
      project.clips.find((c) => c.id === cut.clipId).name,
      timecode(cut.in),
      timecode(cut.out),
      (cut.out - cut.in).toFixed(3),
      cut.note,
    ]),
  );
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
export function markdown(project) {
  const plain = (value) =>
    String(value)
      .replace(/[\r\n]+/g, " ")
      .replace(/[\\`*_{}\[\]<>#|]/g, "\\$&");
  const lines = [
    `# ${plain(project.title)}`,
    "",
    "Paper edit exported from Afterlight. Times refer to the original source files.",
    "",
  ];
  project.cuts.forEach((cut, i) => {
    const clip = project.clips.find((c) => c.id === cut.clipId);
    lines.push(
      `## ${i + 1}. ${plain(clip.name)}`,
      `${timecode(cut.in)} → ${timecode(cut.out)} · ${(cut.out - cut.in).toFixed(3)} seconds`,
      "",
      plain(cut.note || clip.note || "No note."),
      "",
    );
  });
  return lines.join("\n");
}
export function contactHTML(project) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(project.title)} — Afterlight</title><style>body{font:14px system-ui;background:#f2eee5;color:#26251f;margin:0;padding:40px;max-width:1600px}h1{font:48px Georgia}h2{margin-top:45px}header,p{color:#68645d}.frames{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}figure{margin:0;background:#242421;color:#e3d5a6;padding:7px}img{width:100%;aspect-ratio:16/9;object-fit:contain;background:#161616}figcaption{padding:6px;font:11px monospace}.note{white-space:pre-wrap}@media(max-width:700px){body{padding:18px}.frames{grid-template-columns:repeat(2,minmax(0,1fr))}}@media print{body{background:white;padding:0}section{break-inside:avoid}figure{print-color-adjust:exact}}</style><header>AFTERLIGHT / CONTACT SHEET</header><h1>${escapeHTML(project.title)}</h1><p>${project.clips.length} source clips · Uniformly sampled frames · Source timestamps</p>${project.clips.map((clip) => `<section><h2>${escapeHTML(clip.name)}</h2><p>${timecode(clip.duration)} · ${clip.width} × ${clip.height}</p><p class="note">${escapeHTML(clip.note)}</p><div class="frames">${clip.frames.map((frame, i) => `<figure><img src="${frame.image}" alt="Frame ${i + 1}"><figcaption>${String(i + 1).padStart(2, "0")} / ${timecode(frame.time)}</figcaption></figure>`).join("")}</div></section>`).join("")}</html>`;
}

import { inspectVideo, makeContactSheet } from "./media.js";
import {
  id,
  escapeHTML as esc,
  timecode,
  shortTime,
  emptyProject,
  validateProject,
  csv,
  markdown,
  contactHTML,
} from "./model.js";
import { openStorage, readProject, saveProject } from "./storage.js";
const $ = (selector) => document.querySelector(selector);
const labels = {
  none: "Unlabeled",
  amber: "Establishing",
  blue: "Detail",
  green: "Character",
  rose: "Atmosphere",
};
const demoFiles = [
  {
    key: "coast",
    name: "01 — The coast.mp4",
    label: "amber",
    note: "Start with a place. Let the road pull us toward the cinema.",
  },
  {
    key: "cinema",
    name: "02 — A light still on.mp4",
    label: "blue",
    note: "The entrance is still glowing. A close detail for the middle of the sequence.",
  },
  {
    key: "arrival",
    name: "03 — The way back.mp4",
    label: "rose",
    note: "Return to the road and the water. Leave the ending open.",
  },
];
let project = emptyProject(),
  view = "library",
  filter = "all",
  active = null,
  processing = null,
  toastTimer,
  saveTimer,
  relinkTarget = null;
let canWrite = true,
  persistedRevision = 0,
  saveQueue = Promise.resolve(),
  revision = 0,
  history = [],
  previewIndex = -1,
  previewURL = null;
const sources = new Map();
const channel =
  "BroadcastChannel" in window
    ? new BroadcastChannel("afterlight-changes")
    : null;
const sessionId = id();
channel?.addEventListener("message", (event) => {
  if (event.data !== sessionId) {
    clearTimeout(saveTimer);
    canWrite = false;
    $("#save-status").textContent = "Another tab saved · reload to edit";
    notify(
      "Another tab changed this collection. Export this tab’s copy if needed, then reload.",
    );
  }
});
function notify(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 6500);
}
function writable() {
  if (canWrite) return true;
  notify(
    "Reload this tab before making more changes. You can export your current copy.",
  );
  return false;
}
function save() {
  clearTimeout(saveTimer);
  if (!canWrite) return;
  const snapshot = structuredClone(project),
    thisRevision = ++revision;
  $("#save-status").textContent = "Saving locally…";
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      if (!canWrite)
        throw Object.assign(new Error("Another tab changed this collection."), {
          name: "ConflictError",
        });
      persistedRevision = await saveProject(snapshot, persistedRevision);
    })
    .then(() => {
      if (thisRevision === revision)
        $("#save-status").textContent = "Saved on this device";
      channel?.postMessage(sessionId);
    })
    .catch((error) => {
      if (error.name === "ConflictError") {
        canWrite = false;
        clearTimeout(saveTimer);
        $("#save-status").textContent = "Another tab saved · reload to edit";
        notify(
          "Another tab changed this collection. Export this tab’s copy if needed, then reload.",
        );
        return;
      }
      $("#save-status").textContent = "Save failed · export a backup";
      notify(
        "Browser storage is unavailable or full. Your work is still in this tab. Export a JSON backup before leaving.",
      );
    });
}
function remember() {
  history.push(structuredClone(project));
  if (history.length > 20) history.shift();
}
function mutate(fn, { undo = true } = {}) {
  if (!writable()) return false;
  if (undo) remember();
  fn();
  save();
  render();
  return true;
}
function ask(message) {
  $("#confirm-copy").textContent = message;
  $("#confirm-dialog").showModal();
  return new Promise((resolve) => {
    const done = (value) => {
      $("#confirm-dialog").close();
      $("#confirm-no").onclick = null;
      $("#confirm-yes").onclick = null;
      $("#confirm-dialog").removeEventListener("cancel", cancel);
      resolve(value);
    };
    const cancel = (event) => {
      event.preventDefault();
      done(false);
    };
    $("#confirm-no").onclick = () => done(false);
    $("#confirm-yes").onclick = () => done(true);
    $("#confirm-dialog").addEventListener("cancel", cancel);
  });
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function slug() {
  return (
    project.title
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .trim()
      .slice(0, 70) || "afterlight"
  );
}
function totalTime() {
  return project.cuts.reduce((sum, cut) => sum + cut.out - cut.in, 0);
}
function clipCard(clip, index) {
  const frames = clip.frames.filter((_, i) => i % 2 === 0).slice(0, 6);
  return `<article class="clip-card"><div class="film-frame"><div class="film-head"><span>AFTERLIGHT / ${String(index + 1).padStart(2, "0")}</span><span>${clip.width} × ${clip.height}</span></div><div class="film-images">${frames.map((frame, i) => `<button class="frame-button" data-open="${esc(clip.id)}" data-time="${frame.time}" aria-label="Open ${esc(clip.name)} at ${timecode(frame.time)}"><img src="${frame.image}" alt="" loading="lazy"><span>${timecode(frame.time)}</span></button>`).join("")}</div><div class="film-foot"><span>${clip.frames.length} CONTACT FRAMES</span><span>${shortTime(clip.duration)} / ${sources.has(clip.id) ? "LINKED" : "RELINK TO PLAY"}</span></div><div class="sprockets"></div></div><div class="card-info"><div><button class="card-name" data-open="${esc(clip.id)}">${esc(clip.name)}</button><div class="card-detail"><i class="label-dot ${clip.label}"></i>${labels[clip.label]}${clip.demo ? '<span class="badge">GENERATED SAMPLE</span>' : ""}</div>${clip.note ? `<p class="card-note">${esc(clip.note)}</p>` : ""}</div><button class="card-star ${clip.favorite ? "on" : ""}" data-star="${esc(clip.id)}" aria-label="${clip.favorite ? "Unstar" : "Star"} ${esc(clip.name)}">${clip.favorite ? "★" : "☆"}</button></div></article>`;
}
function render() {
  $("#project-title").textContent = project.title;
  $("#clip-count").textContent = project.clips.length;
  $("#star-count").textContent = project.clips.filter((c) => c.favorite).length;
  $("#cut-count").textContent = project.cuts.length;
  document
    .querySelectorAll("[data-view]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.view === view),
    );
  document
    .querySelectorAll("[data-filter]")
    .forEach((button) =>
      button.classList.toggle("selected", button.dataset.filter === filter),
    );
  $("#view-title").innerHTML =
    view === "edit"
      ? "The paper edit<span>.</span>"
      : view === "favorites"
        ? "Worth another look<span>.</span>"
        : "The collection<span>.</span>";
  $("#collection-kicker").textContent =
    view === "edit" ? "PUT THE MOMENTS IN ORDER" : "ON YOUR LIGHT TABLE";
  $("#search").disabled = view === "edit";
  $("#sort").disabled = view === "edit";
  if (view === "edit") {
    renderEdit();
    return;
  }
  const query = $("#search").value.trim().toLowerCase();
  let clips = project.clips.filter(
    (c) =>
      (view !== "favorites" || c.favorite) &&
      (filter === "all" || c.label === filter) &&
      `${c.name} ${c.note} ${labels[c.label]}`.toLowerCase().includes(query),
  );
  const sort = $("#sort").value;
  if (sort === "name") clips.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "duration") clips.sort((a, b) => b.duration - a.duration);
  else clips.reverse();
  $("#summary").textContent =
    `${clips.length} clips · ${shortTime(clips.reduce((sum, c) => sum + c.duration, 0))} of footage`;
  $("#content").innerHTML = clips.length
    ? `<div class="clips-grid">${clips.map(clipCard).join("")}</div>`
    : `<div class="empty"><div class="empty-mark">▧</div><h3>${project.clips.length ? "A little too quiet here." : "Your next story starts here."}</h3><p>${project.clips.length ? "Try a different search or label." : "Drop your video files onto this light table, or explore the sample collection to see how it works."}</p>${project.clips.length ? "" : '<button class="button primary" data-demo>Explore The Last Screening ↗</button>'}</div>`;
}
function renderEdit() {
  $("#summary").textContent = `${project.cuts.length} selections`;
  const intro = `<div class="paper-intro"><span><b class="paper-duration">${shortTime(totalTime())}</b> selected · Source timestamps</span><div><button class="button subtle" id="undo" ${history.length ? "" : "disabled"}>↶ Undo</button> <button class="button primary" id="preview-edit" ${project.cuts.length ? "" : "disabled"}>▶ Preview sequence</button></div></div>`;
  $("#content").innerHTML =
    intro +
    (project.cuts.length
      ? project.cuts
          .map((cut, i) => {
            const clip = project.clips.find((c) => c.id === cut.clipId);
            const frame = clip.frames.reduce((best, item) =>
              Math.abs(item.time - cut.in) < Math.abs(best.time - cut.in)
                ? item
                : best,
            );
            return `<article class="cut-row"><span class="cut-index">${String(i + 1).padStart(2, "0")}</span><button class="frame-button" data-open="${esc(clip.id)}" data-time="${cut.in}" aria-label="Open ${esc(clip.name)}"><img class="cut-thumb" src="${frame.image}" alt=""></button><div class="cut-text"><h3>${esc(clip.name)}</h3><div class="cut-times">${timecode(cut.in)} → ${timecode(cut.out)} · ${(cut.out - cut.in).toFixed(2)}s</div><p>${esc(cut.note)}</p></div><div class="cut-controls"><button data-move="${i}" data-direction="-1" aria-label="Move selection ${i + 1} earlier" ${i === 0 ? "disabled" : ""}>↑</button><button data-move="${i}" data-direction="1" aria-label="Move selection ${i + 1} later" ${i === project.cuts.length - 1 ? "disabled" : ""}>↓</button><button data-remove-cut="${esc(cut.id)}" aria-label="Remove selection ${i + 1}">×</button></div></article>`;
          })
          .join("")
      : '<div class="empty"><div class="empty-mark">≋</div><h3>Find the thread between frames.</h3><p>Open a clip, mark an in and out point, and add a selection. Your story takes shape here.</p><button class="button subtle" data-view="library">Back to contact sheets</button></div>');
}
function beginProgress(title) {
  $("#import-progress").hidden = false;
  $("#progress-title").textContent = title;
  $("#progress-text").textContent = "";
  $("#progress-bar").value = 0;
  for (const button of document.querySelectorAll(
    "#load-demo,#intro-demo,#import-main,#import-more,#backup-import",
  ))
    button.disabled = true;
}
function finishProgress() {
  processing = null;
  $("#import-progress").hidden = true;
  for (const button of document.querySelectorAll(
    "#load-demo,#intro-demo,#import-main,#import-more,#backup-import",
  ))
    button.disabled = false;
}
async function ingest(files, demos = [], targetId = null) {
  if (processing || !writable()) return;
  const list = Array.from(files);
  if (!list.length) return;
  processing = new AbortController();
  beginProgress("Developing your contact sheets");
  let imported = 0,
    relinked = 0;
  const errors = [];
  for (let index = 0; index < list.length; index++) {
    const file = list[index],
      demo = demos[index] || null;
    try {
      if (file.size > 2 * 1024 ** 3)
        throw new Error("exceeds the 2 GB per-file limit");
      if (!file.size) throw new Error("empty file");
      if (
        !file.type.startsWith("video/") &&
        !/\.(mp4|mov|webm|m4v|mkv|ogv)$/i.test(file.name)
      )
        throw new Error("choose a browser-supported video");
      const existing = targetId
        ? project.clips.find((c) => c.id === targetId)
        : project.clips.find((c) =>
            demo
              ? c.demo === demo.key
              : !c.demo &&
                c.name === file.name &&
                c.size === file.size &&
                c.lastModified === file.lastModified,
          );
      if (
        targetId &&
        (!existing ||
          file.name !== existing.name ||
          file.size !== existing.size)
      ) {
        throw new Error("choose the original file with the same name and size");
      }
      if (!existing && project.clips.length >= 60)
        throw new Error("collection limit of 60 clips reached");
      if (existing && sources.has(existing.id)) {
        relinked++;
        continue;
      }
      const result = await inspectVideo(file, {
        signal: processing.signal,
        onProgress: (progress) => {
          $("#progress-text").textContent =
            `${index + 1} / ${list.length} · ${file.name}`;
          $("#progress-bar").value =
            (index +
              (typeof progress === "number"
                ? progress
                : progress.completed / progress.total)) /
            list.length;
        },
      });
      if (processing.signal.aborted) break;
      if (!writable()) break;
      if (existing) {
        if (
          Math.abs(existing.duration - result.duration) > 0.1 ||
          existing.width !== result.width ||
          existing.height !== result.height
        )
          throw new Error(
            "the original metadata differs; this file cannot be relinked",
          );
        if (targetId && existing.lastModified !== file.lastModified) {
          if (
            !(await ask(
              "This file has the same name, size, duration and dimensions, but its modification date changed. Confirm it is the original source before relinking.",
            ))
          )
            continue;
        }
        sources.set(existing.id, file);
        existing.lastModified = file.lastModified;
        relinked++;
      } else {
        const clip = {
          id: id(),
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          duration: result.duration,
          width: result.width,
          height: result.height,
          frames: result.frames,
          note: demo?.note || "",
          label: demo?.label || "none",
          favorite: false,
          demo: demo?.key || null,
        };
        remember();
        project.clips.push(clip);
        sources.set(clip.id, file);
        imported++;
      }
      save();
      render();
    } catch (error) {
      if (error.name === "AbortError") break;
      errors.push(`${file.name}: ${error.message}`);
    }
  }
  const canceled = processing.signal.aborted;
  finishProgress();
  notify(
    `${imported} clips added · ${relinked} files linked${canceled ? " · Import stopped" : ""}${errors.length ? "\n" + errors.slice(0, 3).join("\n") : ""}`,
  );
  if (active && $("#clip-dialog").open) {
    const c = project.clips.find((c) => c.id === active);
    if (c) await setSource(c, 0);
  }
}
async function loadDemo() {
  if (processing || !writable()) return;
  processing = new AbortController();
  beginProgress("Opening The Last Screening");
  try {
    const signal = processing.signal;
    const files = [];
    for (const entry of demoFiles) {
      $("#progress-text").textContent = entry.name;
      const response = await fetch(`assets/${entry.key}.mp4`, { signal });
      if (!response.ok) throw new Error("The sample file could not be loaded.");
      const blob = await response.blob();
      files.push(
        new File([blob], entry.name, { type: "video/mp4", lastModified: 0 }),
      );
    }
    finishProgress();
    if (!project.clips.length) project.title = "The Last Screening";
    await ingest(files, demoFiles);
  } catch (error) {
    finishProgress();
    if (error.name !== "AbortError") notify(error.message);
  }
}
let sourceURL = null;
async function setSource(clip, time) {
  const player = $("#player");
  player.pause();
  player.removeAttribute("src");
  player.load();
  if (sourceURL) URL.revokeObjectURL(sourceURL);
  sourceURL = null;
  if (!sources.has(clip.id) && clip.demo) {
    try {
      const response = await fetch(`assets/${clip.demo}.mp4`);
      if (response.ok) sources.set(clip.id, await response.blob());
    } catch {}
  }
  if (active !== clip.id) return;
  const source = sources.get(clip.id);
  $("#relink-panel").hidden = !!source;
  player.hidden = !source;
  $("#offline-poster").src = clip.frames[0].image;
  if (source) {
    sourceURL = URL.createObjectURL(source);
    player.src = sourceURL;
    player.onloadedmetadata = () => {
      player.currentTime = Math.min(
        Math.max(0, time),
        Math.max(0, player.duration - 0.03),
      );
    };
  }
  $("#mark-in").disabled = !source;
  $("#mark-out").disabled = !source;
}
async function openClip(clipId, time = 0) {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return;
  active = clipId;
  $("#clip-heading").textContent = clip.name;
  $("#source-meta").textContent =
    `${clip.width} × ${clip.height} / ${timecode(clip.duration)} / ${clip.frames.length} sampled frames`;
  $("#clip-note").value = clip.note;
  $("#clip-label").value = clip.label;
  $("#favorite").textContent = clip.favorite ? "★ Starred" : "☆ Star clip";
  $("#range-in").value = Number(time.toFixed(3));
  $("#range-out").value = Number(clip.duration.toFixed(3));
  $("#cut-note").value = "";
  $("#range-message").textContent = "";
  $("#viewer-frames").innerHTML = clip.frames
    .map(
      (frame) =>
        `<button class="frame-button" data-seek="${frame.time}" aria-label="Seek to ${timecode(frame.time)}"><img src="${frame.image}" alt=""><span>${timecode(frame.time)}</span></button>`,
    )
    .join("");
  if (!$("#clip-dialog").open) $("#clip-dialog").showModal();
  await setSource(clip, time);
}
$("#player").addEventListener("error", () => {
  if (active)
    notify("The source could not be played. Relink a browser-compatible copy.");
});
$("#clip-dialog").addEventListener("close", () => {
  clearTimeout(saveTimer);
  if (active && writable()) {
    const clip = project.clips.find((c) => c.id === active);
    if (clip) {
      clip.note = $("#clip-note").value;
      save();
    }
  }
  $("#player").pause();
  $("#player").removeAttribute("src");
  $("#player").load();
  if (sourceURL) URL.revokeObjectURL(sourceURL);
  sourceURL = null;
  active = null;
  render();
});
$("#clip-note").addEventListener("focus", () => {
  if (writable()) remember();
});
$("#clip-note").addEventListener("input", () => {
  if (!writable()) return;
  const clip = project.clips.find((c) => c.id === active);
  if (!clip) return;
  clip.note = $("#clip-note").value;
  $("#save-status").textContent = "Unsaved note…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    save();
    render();
  }, 400);
});
$("#clip-label").addEventListener("change", (event) =>
  mutate(() => {
    project.clips.find((c) => c.id === active).label = event.target.value;
  }),
);
$("#favorite").onclick = () => {
  mutate(() => {
    const clip = project.clips.find((c) => c.id === active);
    clip.favorite = !clip.favorite;
    $("#favorite").textContent = clip.favorite ? "★ Starred" : "☆ Star clip";
  });
};
function mark(bound) {
  if (!sources.has(active)) return;
  $("#range-" + bound).value = Number($("#player").currentTime.toFixed(3));
}
$("#mark-in").onclick = () => mark("in");
$("#mark-out").onclick = () => mark("out");
$("#add-cut").onclick = () => {
  const clip = project.clips.find((c) => c.id === active);
  const start = Number($("#range-in").value),
    end = Number($("#range-out").value);
  if (
    !clip ||
    !$("#range-in").value ||
    !$("#range-out").value ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= clip.duration ||
    Math.min(end, clip.duration) <= start ||
    end > clip.duration + 0.001
  ) {
    $("#range-message").textContent =
      `Choose 0 ≤ In < Out ≤ ${clip?.duration.toFixed(3)} seconds.`;
    return;
  }
  if (project.cuts.length >= 500) {
    notify("This project supports up to 500 selections.");
    return;
  }
  if (
    mutate(() =>
      project.cuts.push({
        id: id(),
        clipId: active,
        in: start,
        out: Math.min(end, clip.duration),
        note: $("#cut-note").value,
      }),
    )
  ) {
    $("#range-message").textContent = "Added to your paper edit.";
    notify("A moment saved. Open Paper edit to shape the sequence.");
  }
};
$("#remove-clip").onclick = async () => {
  const clip = project.clips.find((c) => c.id === active);
  if (!clip) return;
  if (
    await ask(
      `Remove ${clip.name} and its paper-edit selections from this collection? You can undo this from Paper edit.`,
    )
  ) {
    const clipId = active;
    if (
      mutate(() => {
        project.clips = project.clips.filter((c) => c.id !== clipId);
        project.cuts = project.cuts.filter((c) => c.clipId !== clipId);
      })
    ) {
      $("#clip-dialog").close();
    }
  }
};
$("#save-sheet").onclick = async () => {
  const clip = project.clips.find((c) => c.id === active);
  if (!clip) return;
  $("#save-sheet").disabled = true;
  try {
    download(
      await makeContactSheet(clip, { title: project.title }),
      clip.name.replace(/\.[^.]+$/, "") + "-contact-sheet.jpg",
    );
  } catch (error) {
    notify(error.message);
  } finally {
    $("#save-sheet").disabled = false;
  }
};
$("#relink").onclick = () => {
  relinkTarget = active;
  $("#video-files").multiple = false;
  $("#video-files").click();
};
$("#video-files").onchange = (event) => {
  ingest(event.target.files, [], relinkTarget);
  relinkTarget = null;
  event.target.multiple = true;
  event.target.value = "";
};
for (const selector of ["#import-main", "#import-more"])
  $(selector).onclick = () => {
    relinkTarget = null;
    $("#video-files").multiple = true;
    $("#video-files").click();
  };
$("#cancel-import").onclick = () => processing?.abort();
$("#load-demo").onclick = loadDemo;
$("#intro-demo").onclick = loadDemo;
$("#search").oninput = render;
$("#sort").onchange = render;
$("#rename").onclick = () => {
  $("#name-input").value = project.title;
  $("#name-dialog").showModal();
};
$("#name-form").onsubmit = (event) => {
  event.preventDefault();
  const name = $("#name-input").value.trim();
  if (!name) return;
  if (
    mutate(() => {
      project.title = name;
    })
  )
    $("#name-dialog").close();
};
$("#help").onclick = () => $("#help-dialog").showModal();
$("#export-open").onclick = () => $("#export-dialog").showModal();
for (const button of document.querySelectorAll("[data-close]"))
  button.onclick = () => button.closest("dialog").close();
document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav) {
    view = nav.dataset.view;
    render();
  }
  const label = event.target.closest("[data-filter]");
  if (label) {
    filter = label.dataset.filter;
    view = "library";
    render();
  }
  const open = event.target.closest("[data-open]");
  if (open) openClip(open.dataset.open, Number(open.dataset.time) || 0);
  const star = event.target.closest("[data-star]");
  if (star)
    mutate(() => {
      const clip = project.clips.find((c) => c.id === star.dataset.star);
      clip.favorite = !clip.favorite;
    });
  const seek = event.target.closest("[data-seek]");
  if (seek) {
    if (sources.has(active))
      $("#player").currentTime = Number(seek.dataset.seek);
    else notify("Relink the original file to seek and play.");
  }
  const move = event.target.closest("[data-move]");
  if (move)
    mutate(() => {
      const index = Number(move.dataset.move),
        target = index + Number(move.dataset.direction);
      if (target >= 0 && target < project.cuts.length)
        [project.cuts[index], project.cuts[target]] = [
          project.cuts[target],
          project.cuts[index],
        ];
    });
  const remove = event.target.closest("[data-remove-cut]");
  if (remove)
    mutate(() => {
      project.cuts = project.cuts.filter(
        (c) => c.id !== remove.dataset.removeCut,
      );
    });
  if (event.target.closest("[data-demo]")) loadDemo();
  if (event.target.closest("#undo") && history.length && writable()) {
    project = history.pop();
    save();
    render();
    notify("Last change undone.");
  }
  if (event.target.closest("#preview-edit")) startPreview();
  const exporter = event.target.closest("[data-export]");
  if (exporter) {
    const type = exporter.dataset.export;
    if ((type === "csv" || type === "md") && !project.cuts.length) {
      notify("Add a selection to the paper edit first.");
      return;
    }
    const content =
      type === "json"
        ? JSON.stringify(project)
        : type === "csv"
          ? csv(project)
          : type === "md"
            ? markdown(project)
            : contactHTML(project);
    download(
      new Blob([content], {
        type: {
          json: "application/json",
          csv: "text/csv;charset=utf-8",
          md: "text/markdown;charset=utf-8",
          html: "text/html;charset=utf-8",
        }[type],
      }),
      `${slug()}.${type === "md" ? "md" : type}`,
    );
  }
});
$(".logo").onclick = (event) => {
  event.preventDefault();
  view = "library";
  filter = "all";
  $("#search").value = "";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
};
$("#backup-import").onclick = () => $("#project-file").click();
$("#project-file").onchange = async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || !writable()) return;
  try {
    if (file.size > 150 * 1024 ** 2)
      throw new Error("Choose a project smaller than 150 MB.");
    const restored = validateProject(JSON.parse(await file.text()));
    if (
      await ask(
        `Restore “${restored.title}” with ${restored.clips.length} clips? Export your current collection first to keep a copy.`,
      )
    ) {
      if (
        mutate(() => {
          project = restored;
        })
      ) {
        notify("Project restored. Add the original videos to relink playback.");
      }
    }
  } catch (error) {
    notify(
      error instanceof SyntaxError
        ? "This file contains invalid JSON. Choose an Afterlight project."
        : error.message,
    );
  }
};
let dragDepth = 0;
window.addEventListener("dragenter", (event) => {
  if (event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
    dragDepth++;
    $("#drop-overlay").hidden = false;
  }
});
window.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    $("#drop-overlay").hidden = true;
  }
});
window.addEventListener("dragover", (event) => {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
});
window.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  $("#drop-overlay").hidden = true;
  if (processing) {
    notify("Wait for the current import to finish.");
    return;
  }
  if (document.querySelector("dialog[open]")) {
    notify("Close the current dialog before dropping files.");
    return;
  }
  ingest(event.dataTransfer.files);
});
document.addEventListener("keydown", (event) => {
  if (
    !$("#clip-dialog").open ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  if (event.key.toLowerCase() === "i") {
    event.preventDefault();
    mark("in");
  }
  if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    mark("out");
  }
});
window.addEventListener("beforeunload", (event) => {
  if (
    processing ||
    ($("#save-status").textContent !== "Saved on this device" &&
      project.clips.length)
  ) {
    event.preventDefault();
    event.returnValue = "";
  }
});

const sequence = document.createElement("dialog");
sequence.id = "sequence-dialog";
sequence.innerHTML =
  '<div class="dialog-top"><div><span class="eyebrow">PAPER EDIT PREVIEW</span><h2 id="sequence-title"></h2></div><button class="close" id="close-sequence" aria-label="Close sequence preview">×</button></div><video id="sequence-player" controls playsinline style="width:100%;background:#17211b;aspect-ratio:16/9"></video><p id="sequence-note"></p><div class="confirm-actions"><button id="sequence-prev" class="button subtle">← Previous</button><button id="sequence-next" class="button primary">Next →</button></div><p class="small">Sequential source playback. Transitions may pause while the next file loads.</p>';
document.body.append(sequence);
$("#close-sequence").onclick = () => sequence.close();
sequence.addEventListener("close", () => {
  previewIndex = -1;
  $("#sequence-player").pause();
  $("#sequence-player").removeAttribute("src");
  $("#sequence-player").load();
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = null;
});
async function startPreview() {
  if (!project.cuts.length) return;
  const missing = project.cuts.find(
    (c) =>
      !sources.has(c.clipId) &&
      !project.clips.find((clip) => clip.id === c.clipId)?.demo,
  );
  if (missing) {
    notify("Relink all source clips in this paper edit before previewing.");
    return;
  }
  sequence.showModal();
  await playCut(0);
}
let changingCut = false;
let playbackReady = false;
async function playCut(index) {
  if (index < 0 || index >= project.cuts.length) {
    playbackReady = false;
    $("#sequence-next").textContent = "Replay sequence ↺";
    $("#sequence-player").pause();
    $("#sequence-note").textContent =
      "End of your paper edit. Every moment has a place.";
    return;
  }
  if (changingCut) return;
  changingCut = true;
  playbackReady = false;
  previewIndex = index;
  $("#sequence-next").textContent = "Next →";
  const cut = project.cuts[index],
    clip = project.clips.find((c) => c.id === cut.clipId),
    player = $("#sequence-player");
  player.pause();
  try {
    if (!sources.has(clip.id) && clip.demo) {
      const r = await fetch(`assets/${clip.demo}.mp4`);
      if (!r.ok) throw new Error("Sample unavailable.");
      sources.set(clip.id, await r.blob());
    }
    if (!sequence.open) return;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(sources.get(clip.id));
    $("#sequence-title").textContent =
      `${index + 1} / ${project.cuts.length} · ${clip.name}`;
    $("#sequence-note").textContent = cut.note || clip.note;
    $("#sequence-prev").disabled = index === 0;
    player.onloadedmetadata = () => {
      player.currentTime = cut.in;
      playbackReady = true;
      player.play().catch(() => notify("Press play to start the sequence."));
    };
    player.src = previewURL;
  } catch (error) {
    notify(error.message);
    sequence.close();
  } finally {
    changingCut = false;
  }
}
$("#sequence-player").addEventListener("timeupdate", () => {
  const cut = project.cuts[previewIndex];
  if (playbackReady && cut && $("#sequence-player").currentTime < cut.in)
    $("#sequence-player").currentTime = cut.in;
  if (playbackReady && cut && $("#sequence-player").currentTime >= cut.out) {
    playbackReady = false;
    $("#sequence-player").pause();
    playCut(previewIndex + 1);
  }
});
$("#sequence-player").addEventListener("ended", () => {
  if (playbackReady) {
    playbackReady = false;
    playCut(previewIndex + 1);
  }
});
$("#sequence-player").addEventListener("error", () => {
  if (sequence.open)
    notify("This source could not be played. Relink it and try again.");
});
$("#sequence-prev").onclick = () => playCut(previewIndex - 1);
$("#sequence-next").onclick = () =>
  playCut(
    previewIndex >= project.cuts.length - 1 && !playbackReady
      ? 0
      : previewIndex + 1,
  );
$("#sequence-player").addEventListener("play", () => {
  if (!playbackReady && !changingCut && previewIndex >= 0) {
    $("#sequence-player").currentTime = project.cuts[previewIndex].in;
    playbackReady = true;
  }
});
try {
  await openStorage();
  const saved = await readProject();
  persistedRevision = saved.revision;
  if (saved.project) project = validateProject(saved.project);
  $("#save-status").textContent = "Saved on this device";
} catch (error) {
  $("#save-status").textContent = "Storage issue · export backups";
  notify(error.message || "Browser storage could not be opened.");
}
render();

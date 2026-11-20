import {
  createTask,
  formatTaskDate,
  localDateKey,
  parseSpokenTask,
  parseShortcut,
  selectTasks,
  taskProgress,
} from "./logic.js";
import { initImporter } from "./importer.js";
const KEY = "mio.tasks.v1",
  $ = (s) => document.querySelector(s);
let tasks = load(),
  filter = "pending",
  installPrompt;
const timers = new Map();
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}
function today() {
  return localDateKey();
}
function esc(v) {
  const n = document.createElement("span");
  n.textContent = v;
  return n.innerHTML;
}
function markup(t) {
  const meta = [formatTaskDate(t.date, t.time), t.notes]
    .filter(Boolean)
    .join(" · ");
  return `<article class="task ${t.done ? "done" : ""}"><input class="check" type="checkbox" data-toggle="${t.id}" ${t.done ? "checked" : ""}><div class="copy"><strong>${esc(t.title)}</strong>${meta ? `<small>${esc(meta)}</small>` : ""}</div><button class="delete" data-delete="${t.id}">×</button><span class="dot ${t.priority}"></span></article>`;
}
function list(el, ts, msg) {
  el.innerHTML = ts.length
    ? ts.map(markup).join("")
    : `<div class="empty">${msg}</div>`;
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(tasks));
  render();
  reminders();
}
function render() {
  const day = today(),
    pending = selectTasks(tasks, { date: day, done: false }),
    all = selectTasks(tasks, { date: day }),
    future = tasks
      .filter((t) => !t.done && t.date > day)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  list(
    $("#todayList"),
    pending,
    "Tu día está despejado. Añade algo cuando quieras.",
  );
  list($("#upcomingList"), future, "Nada programado todavía.");
  list(
    $("#allTasksList"),
    selectTasks(tasks, { state: filter }),
    "No hay tareas en esta lista.",
  );
  const p = taskProgress(all);
  $("#progressValue").textContent = `${p}%`;
  $("#ring").style.setProperty("--progress", `${p * 3.6}deg`);
  $("#progressTitle").textContent = all.length
    ? p === 100
      ? "Día completado"
      : `${pending.length} ${pending.length === 1 ? "tarea pendiente" : "tareas pendientes"}`
    : "Todo por empezar";
}
function open(prefill = {}) {
  $("#taskForm").reset();
  $("#taskDate").value = prefill.date || today();
  $("#taskTitle").value = prefill.title || "";
  $("#taskTime").value = prefill.time || "";
  $("#taskPriority").value = prefill.priority || "normal";
  $("#taskDialog").showModal();
}
function processVoiceText() {
  const input = $("#voiceInput");
  const draft = parseSpokenTask(input.value);
  if (!draft.title) {
    toast("Decime qué tarea querés agregar");
    input.focus();
    return;
  }
  open(draft);
}
function toast(m, action) {
  const n = $("#toast");
  n.replaceChildren(document.createTextNode(m));
  n.classList.toggle("has-action", Boolean(action));
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.onclick = () => {
      clearTimeout(toast.t);
      action.run();
    };
    n.append(button);
  }
  n.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => n.classList.remove("show"), 2200);
}
function navigate() {
  const id = location.hash.slice(1) || "today";
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === id));
  document
    .querySelectorAll("nav a")
    .forEach((a) => a.classList.toggle("active", a.hash === `#${id}`));
}
function reminders() {
  timers.forEach(clearTimeout);
  timers.clear();
  tasks
    .filter((t) => !t.done && t.date && t.time)
    .forEach((t) => {
      const d = new Date(`${t.date}T${t.time}`).getTime() - Date.now();
      if (d > 0 && d < 2147483647)
        timers.set(
          t.id,
          setTimeout(() => {
            if ("Notification" in window && Notification.permission === "granted")
              new Notification("MIO te recuerda", {
                body: t.title,
                icon: "./icon.svg",
              });
            toast(`Recordatorio: ${t.title}`);
          }, d),
        );
    });
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-toggle]"),
    d = e.target.closest("[data-delete]");
  if (a) {
    const t = tasks.find((x) => x.id === a.dataset.toggle);
    if (t) {
      t.done = a.checked;
      save();
      if (t.done) {
        toast("Tarea completada", {
          label: "Deshacer",
          run: () => {
            t.done = false;
            save();
            toast("Tarea recuperada");
          },
        });
      } else toast("Tarea recuperada");
    }
  }
  if (d) {
    tasks = tasks.filter((t) => t.id !== d.dataset.delete);
    save();
  }
  if (e.target.closest("[data-open]")) open();
});
$("#taskForm").onsubmit = () => {
  tasks.unshift(createTask(Object.fromEntries(new FormData($("#taskForm")))));
  save();
  $("#taskDialog").close();
  toast("Tarea guardada");
};
$("#voiceProcess").onclick = processVoiceText;
$("#voiceInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    processVoiceText();
  }
});
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isAppleMobile =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function openKeyboardDictation() {
  const input = $("#voiceInput");
  input.focus();
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  toast("Tocá el micrófono del teclado para dictar");
}
if (isAppleMobile || !SpeechRecognition) {
  $("#voiceButton").textContent = "🎙 Dictar";
  $("#voiceHelp").textContent =
    "Tocá Dictar, usá el micrófono del teclado y después pulsá la flecha.";
}
$("#voiceButton").onclick = () => {
  if (isAppleMobile || !SpeechRecognition) {
    openKeyboardDictation();
    return;
  }
  const recognition = new SpeechRecognition();
  const button = $("#voiceButton");
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    button.classList.add("listening");
    button.textContent = "Escuchando…";
  };
  recognition.onend = () => {
    button.classList.remove("listening");
    button.textContent = "🎙 Hablar";
  };
  recognition.onerror = () => toast("No pude escuchar. Probá con el dictado del teclado");
  recognition.onresult = (event) => {
    $("#voiceInput").value = event.results[0][0].transcript;
    processVoiceText();
  };
  recognition.start();
};
$("#closeDialog").onclick = () => $("#taskDialog").close();
$("#settingsButton").onclick = () => (location.hash = "settings");
window.onhashchange = navigate;
document.querySelectorAll("[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.filter;
      document
        .querySelectorAll("[data-filter]")
        .forEach((x) => x.classList.toggle("active", x === b));
      render();
    }),
);
function updateNotificationButton() {
  const button = $("#notificationButton");
  if (!("Notification" in window)) {
    button.textContent = "No disponible";
    button.disabled = true;
    return;
  }
  const state = Notification.permission;
  button.textContent =
    state === "granted"
      ? "Activadas"
      : state === "denied"
        ? "Bloqueadas"
        : "Activar";
  button.disabled = state !== "default";
}
$("#notificationButton").onclick = async () => {
  try {
    const result = await Notification.requestPermission();
    updateNotificationButton();
    toast(
      result === "granted"
        ? "Notificaciones activadas"
        : "No se activaron",
    );
  } catch {
    toast("Instala MIO en la pantalla de inicio para activar avisos");
  }
};
$("#copySiriUrl").onclick = async () => {
  await navigator.clipboard.writeText(
    `${location.origin}${location.pathname}?action=add&title=Texto%20dictado`,
  );
  toast("Enlace copiado");
};
$("#clearCompleted").onclick = () => {
  tasks = tasks.filter((t) => !t.done);
  save();
};
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("#installButton").hidden = false;
});
$("#installButton").onclick = async () => {
  await installPrompt?.prompt();
};
const now = new Date();
$("#fullDate").textContent = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(now);
$("#greeting").textContent =
  now.getHours() < 12
    ? "Buenos días"
    : now.getHours() < 20
      ? "Buenas tardes"
      : "Buenas noches";
if (/iPhone|iPad/.test(navigator.userAgent))
  $("#installHelp").textContent =
    "En Safari, toca Compartir y luego Añadir a pantalla de inicio.";
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
const shortcut = parseShortcut(new URLSearchParams(location.search));
if (shortcut) {
  history.replaceState({}, "", location.pathname);
  open(shortcut);
}
initImporter({
  getTasks: () => tasks,
  addTasks: (n) => {
    tasks = [...n, ...tasks];
    save();
  },
  toast,
});
updateNotificationButton();
navigate();
render();
reminders();

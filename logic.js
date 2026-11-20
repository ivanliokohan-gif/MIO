export function createTask(i, now = Date.now()) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${now}-${Math.random()}`,
    title: String(i.title || "").trim(),
    date: i.date || "",
    time: i.time || "",
    priority: ["low", "normal", "high"].includes(i.priority)
      ? i.priority
      : "normal",
    notes: String(i.notes || "").trim(),
    done: false,
    createdAt: now,
  };
}
export function selectTasks(ts, o = {}) {
  return ts
    .filter((t) => o.date === undefined || t.date === o.date)
    .filter((t) => o.done === undefined || t.done === o.done)
    .filter(
      (t) =>
        o.state === undefined ||
        o.state === "all" ||
        (o.state === "done" ? t.done : !t.done),
    )
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.date || "9999").localeCompare(b.date || "9999") ||
        (a.time || "99").localeCompare(b.time || "99"),
    );
}
export function taskProgress(ts) {
  return ts.length
    ? Math.round((ts.filter((t) => t.done).length / ts.length) * 100)
    : 0;
}
export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function formatTaskDate(date, time) {
  if (!date) return time || "";
  const today = localDateKey(),
    label =
      date === today
        ? "Hoy"
        : new Intl.DateTimeFormat("es-ES", {
            day: "numeric",
            month: "short",
          }).format(new Date(`${date}T12:00:00`));
  return [label, time].filter(Boolean).join(" · ");
}
export function parseShortcut(p) {
  if (p.get("action") !== "add") return null;
  return {
    title: p.get("title") || "",
    date: p.get("date") || "",
    time: p.get("time") || "",
    priority: p.get("priority") || "normal",
  };
}

/* ---------- Importador de pendientes (procesamiento 100 % local) ---------- */
export const IMPORT_LIMITS = {
  maxTasks: 500,
  maxBytes: 1048576,
  title: 120,
  notes: 400,
};
const PRIORITIES = {
  alta: "high",
  importante: "high",
  high: "high",
  normal: "normal",
  media: "normal",
  baja: "low",
  low: "low",
  "cuando pueda": "low",
};
export function isValidDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number),
    x = new Date(Date.UTC(y, m - 1, d));
  return (
    x.getUTCFullYear() === y &&
    x.getUTCMonth() === m - 1 &&
    x.getUTCDate() === d
  );
}
export function isValidTime(s) {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
export function normalizePriority(v) {
  if (v === undefined || v === null || String(v).trim() === "") return "normal";
  return PRIORITIES[String(v).trim().toLowerCase()] || null;
}
export function normalizeKey(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
export function taskKey(t) {
  return `${normalizeKey(t.title)}|${t.date || ""}|${t.time || ""}`;
}
/** Valida una entrada cruda; devuelve {task, errors}. task solo existe si no hay errores. */
export function validateImportEntry(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { task: null, errors: ["No es una tarea válida"] };
  const str = (v) =>
      v === undefined || v === null
        ? ""
        : typeof v === "string"
          ? v.trim()
          : typeof v === "number"
            ? String(v)
            : null,
    title = str(raw.title),
    date = str(raw.date),
    time = str(raw.time),
    notes = str(raw.notes),
    priority = normalizePriority(
      typeof raw.priority === "string" || raw.priority == null
        ? raw.priority
        : null,
    );
  if (title === null || !title) errors.push("Falta el título");
  else if (title.length > IMPORT_LIMITS.title)
    errors.push(`Título de más de ${IMPORT_LIMITS.title} caracteres`);
  if (date === null || (date && !isValidDate(date)))
    errors.push("Fecha inválida (usa AAAA-MM-DD)");
  if (time === null || (time && !isValidTime(time)))
    errors.push("Hora inválida (usa HH:MM)");
  if (priority === null)
    errors.push("Prioridad inválida (alta, normal o baja)");
  if (notes === null || (notes && notes.length > IMPORT_LIMITS.notes))
    errors.push(
      `Notas inválidas o de más de ${IMPORT_LIMITS.notes} caracteres`,
    );
  if (time && !date && !errors.length) errors.push("Hay hora pero no fecha");
  return errors.length
    ? { task: null, errors }
    : {
        task: {
          title,
          date: date || "",
          time: time || "",
          priority,
          notes: notes || "",
        },
        errors,
      };
}
/** Texto: una tarea por línea "Título | AAAA-MM-DD | prioridad | notas". Ignora líneas vacías y las que empiezan con #. */
export function parseTextImport(text) {
  const out = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((line, i) => {
      const s = line.trim();
      if (!s || s.startsWith("#")) return;
      const p = s.split("|").map((x) => x.trim());
      out.push({
        source: `Línea ${i + 1}`,
        raw: {
          title: p[0],
          date: p[1],
          priority: p[2],
          notes: p.slice(3).join(" | "),
        },
      });
    });
  return out;
}
/** JSON: {"version":1,"tasks":[...]} (también acepta un arreglo directo). Lanza Error con mensaje en español. */
export function parseJsonImport(text) {
  let data;
  try {
    data = JSON.parse(String(text || "").replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("El archivo no es un JSON válido");
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? data.tasks
      : undefined;
  if (!Array.isArray(list))
    throw new Error('El JSON debe tener una lista "tasks"');
  if (!Array.isArray(data) && data.version !== undefined && data.version !== 1)
    throw new Error(
      `Versión ${String(data.version)} no compatible (se espera 1)`,
    );
  return list.map((raw, i) => ({ source: `Tarea ${i + 1}`, raw }));
}
/** Detecta el formato: JSON si empieza con { o [. */
export function parseImport(text) {
  const t = String(text || "")
    .replace(/^\uFEFF/, "")
    .trim();
  const entries = /^[\[{]/.test(t) ? parseJsonImport(t) : parseTextImport(t);
  if (entries.length > IMPORT_LIMITS.maxTasks)
    throw new Error(
      `Demasiadas tareas (máximo ${IMPORT_LIMITS.maxTasks} por importación)`,
    );
  return entries;
}
/** Vista previa: cada elemento {source, task, errors, status:"ok"|"duplicate"|"invalid", selected}. Duplicado = mismo título (sin acentos/mayúsculas), fecha y hora que una tarea existente o una anterior del lote. */
export function buildImportPreview(entries, existing = []) {
  const seen = new Set(existing.map(taskKey));
  return entries.map(({ source, raw }) => {
    const { task, errors } = validateImportEntry(raw);
    if (!task)
      return { source, task: null, errors, status: "invalid", selected: false };
    const k = taskKey(task),
      dup = seen.has(k);
    seen.add(k);
    return {
      source,
      task,
      errors: [],
      status: dup ? "duplicate" : "ok",
      selected: !dup,
    };
  });
}

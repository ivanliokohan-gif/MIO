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

const SPOKEN_NUMBERS = {
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuna: 21,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
};
const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTHS = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
function spokenNormalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function addLocalDays(date, days) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}
/** Convierte una frase breve en un borrador editable; nunca guarda sin confirmación. */
export function parseSpokenTask(value, now = new Date()) {
  const original = String(value || "").trim();
  let working = spokenNormalize(original).replace(/\s+/g, " ").trim();
  let date = "", time = "", priority = "normal";

  const remove = (match) => { working = working.replace(match, " ").replace(/\s+/g, " ").trim(); };
  if (/\b(urgente|importante|prioridad alta)\b/.test(working)) {
    priority = "high";
    remove(/\b(urgente|importante|prioridad alta)\b/g);
  } else if (/\b(prioridad baja|cuando pueda)\b/.test(working)) {
    priority = "low";
    remove(/\b(prioridad baja|cuando pueda)\b/g);
  }

  if (/\bpasado manana\b/.test(working)) {
    date = localDateKey(addLocalDays(now, 2));
    remove(/\bpasado manana\b/g);
  } else if (/\bmanana\b/.test(working)) {
    date = localDateKey(addLocalDays(now, 1));
    remove(/\bmanana\b/g);
  } else if (/\bhoy\b/.test(working)) {
    date = localDateKey(now);
    remove(/\bhoy\b/g);
  } else {
    const numericDate = working.match(/\b(?:el\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    const namedDate = working.match(/\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/);
    const weekday = working.match(/\b(?:el\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
    if (numericDate) {
      let year = numericDate[3] ? Number(numericDate[3]) : now.getFullYear();
      if (year < 100) year += 2000;
      const candidate = new Date(year, Number(numericDate[2]) - 1, Number(numericDate[1]));
      if (candidate.getDate() === Number(numericDate[1]) && candidate.getMonth() === Number(numericDate[2]) - 1) date = localDateKey(candidate);
      remove(numericDate[0]);
    } else if (namedDate) {
      let candidate = new Date(now.getFullYear(), MONTHS[namedDate[2]], Number(namedDate[1]));
      if (candidate < addLocalDays(now, 0)) candidate = new Date(now.getFullYear() + 1, MONTHS[namedDate[2]], Number(namedDate[1]));
      date = localDateKey(candidate);
      remove(namedDate[0]);
    } else if (weekday) {
      let days = (WEEKDAYS[weekday[1]] - now.getDay() + 7) % 7;
      if (days === 0) days = 7;
      date = localDateKey(addLocalDays(now, days));
      remove(weekday[0]);
    }
  }

  const clock = working.match(/\b(?:a\s+la(?:s)?\s+)?(\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuna|veintiuno|veintidos|veintitres)(?::(\d{2})|\s+y\s+(media|cuarto))?(?:\s*(?:horas?|hs))?\b/);
  if (clock && (/\ba\s+la/.test(clock[0]) || clock[0].includes(":") || /horas?|hs/.test(clock[0]))) {
    const hour = /^\d+$/.test(clock[1]) ? Number(clock[1]) : SPOKEN_NUMBERS[clock[1]];
    const minute = clock[2] ? Number(clock[2]) : clock[3] === "media" ? 30 : clock[3] === "cuarto" ? 15 : 0;
    if (hour >= 0 && hour <= 23 && minute <= 59) time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    remove(clock[0]);
  }

  let title = original;
  title = title.replace(/\b(urgente|importante|prioridad alta|prioridad baja|cuando pueda)\b/gi, " ");
  if (date) {
    title = title
      .replace(/\b(pasado mañana|mañana|hoy)\b/gi, " ")
      .replace(/\b(?:el\s+)?\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/gi, " ")
      .replace(/\b(?:el\s+)?\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/gi, " ")
      .replace(/\b(?:el\s+)?(domingo|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado)\b/gi, " ");
  }
  if (time) {
    title = title
      .replace(/\b(?:a\s+las?|a\s+la)\s+(?:\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciséis|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuna|veintiuno|veintidós|veintidos|veintitrés|veintitres)(?::\d{2}|\s+y\s+(?:media|cuarto))?(?:\s*(?:horas?|hs))?\b/gi, " ")
      .replace(/\b\d{1,2}:\d{2}(?:\s*(?:horas?|hs))?\b/gi, " ");
  }
  title = title
    .replace(/^(recuérdame|recuerdame|recordame|agendar|agenda|anota|anotar|añade|anade|crear tarea|tengo que)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (title) title = title[0].toUpperCase() + title.slice(1);
  return { title, date, time, priority, transcript: original };
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

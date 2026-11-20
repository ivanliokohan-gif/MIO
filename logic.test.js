import test from "node:test";
import assert from "node:assert/strict";
import {
  createTask,
  parseShortcut,
  selectTasks,
  taskProgress,
  isValidDate,
  isValidTime,
  normalizePriority,
  validateImportEntry,
  parseTextImport,
  parseJsonImport,
  parseImport,
  buildImportPreview,
  IMPORT_LIMITS,
  parseSpokenTask,
} from "./logic.js";
test("crea tarea", () =>
  assert.equal(
    createTask({ title: "  Comprar pan " }, 1).title,
    "Comprar pan",
  ));
test("filtra pendientes", () =>
  assert.deepEqual(
    selectTasks(
      [
        { id: 1, date: "2", done: false },
        { id: 2, date: "1", done: true },
      ],
      { state: "pending" },
    ).map((t) => t.id),
    [1],
  ));
test("progreso", () =>
  assert.equal(taskProgress([{ done: true }, { done: false }]), 50));
test("atajo", () =>
  assert.equal(
    parseShortcut(new URLSearchParams("action=add&title=Llamar")).title,
    "Llamar",
  ));

test("valida fechas reales", () => {
  assert.ok(isValidDate("2026-02-28"));
  assert.ok(!isValidDate("2026-02-30"));
  assert.ok(!isValidDate("2026-13-01"));
  assert.ok(!isValidDate("25/11/2026"));
  assert.ok(isValidDate("2028-02-29"));
});
test("valida horas", () => {
  assert.ok(isValidTime("00:00"));
  assert.ok(isValidTime("23:59"));
  assert.ok(!isValidTime("24:00"));
  assert.ok(!isValidTime("9:30"));
});
test("normaliza prioridades", () => {
  assert.equal(normalizePriority("Alta"), "high");
  assert.equal(normalizePriority("baja"), "low");
  assert.equal(normalizePriority(""), "normal");
  assert.equal(normalizePriority(undefined), "normal");
  assert.equal(normalizePriority("urgente"), null);
});
test("texto: una tarea por línea con notas que contienen |", () => {
  const e = parseTextImport(
    "Llamar al dentista | 2026-11-25 | alta | Pedir cita | traer radiografía\n\n# comentario\r\nComprar pan",
  );
  assert.equal(e.length, 2);
  assert.deepEqual(e[0].raw, {
    title: "Llamar al dentista",
    date: "2026-11-25",
    priority: "alta",
    notes: "Pedir cita | traer radiografía",
  });
  assert.equal(e[0].source, "Línea 1");
  assert.equal(e[1].source, "Línea 4");
  assert.equal(e[1].raw.title, "Comprar pan");
});
test("JSON: formato versión 1", () => {
  const e = parseJsonImport(
    JSON.stringify({
      version: 1,
      tasks: [
        {
          title: "Ejemplo",
          date: "2026-11-25",
          time: "10:30",
          priority: "high",
          notes: "x",
        },
      ],
    }),
  );
  assert.equal(e.length, 1);
  assert.deepEqual(validateImportEntry(e[0].raw).task, {
    title: "Ejemplo",
    date: "2026-11-25",
    time: "10:30",
    priority: "high",
    notes: "x",
  });
});
test("JSON: errores claros", () => {
  assert.throws(() => parseJsonImport("{no"), /JSON válido/);
  assert.throws(() => parseJsonImport('{"version":1}'), /tasks/);
  assert.throws(() => parseJsonImport('{"version":2,"tasks":[]}'), /Versión/);
  assert.equal(parseJsonImport("\uFEFF" + '[{"title":"a"}]').length, 1);
});
test("detecta formato y limita cantidad", () => {
  assert.equal(parseImport('{"version":1,"tasks":[{"title":"a"}]}').length, 1);
  assert.equal(parseImport("a | 2026-01-01").length, 1);
  const many = Array.from(
    { length: IMPORT_LIMITS.maxTasks + 1 },
    (_, i) => `t${i}`,
  ).join("\n");
  assert.throws(() => parseImport(many), /Demasiadas/);
});
test("rechaza entradas inválidas", () => {
  const bad = [
    {},
    { title: "  " },
    { title: "a", date: "2026-02-30" },
    { title: "a", date: "2026-01-01", time: "25:00" },
    { title: "a", priority: "urgente" },
    { title: "a".repeat(121) },
    { title: "a", notes: "n".repeat(401) },
    { title: "a", time: "10:00" },
    { title: 123, date: 5 },
    null,
    "texto",
    [],
  ];
  bad.forEach((b) => {
    const r = validateImportEntry(b);
    assert.equal(r.task, null, JSON.stringify(b));
    assert.ok(r.errors.length);
  });
});
test("acepta título solo y aplica valores por defecto", () =>
  assert.deepEqual(validateImportEntry({ title: "  Solo título " }).task, {
    title: "Solo título",
    date: "",
    time: "",
    priority: "normal",
    notes: "",
  }));
test("vista previa: válidas, inválidas y duplicadas", () => {
  const existing = [
    { title: "Llamar al Dentista", date: "2026-11-25", time: "" },
  ];
  const p = buildImportPreview(
    parseTextImport(
      "llamar al dentista | 2026-11-25\nLlamar al dentista | 2026-11-26\nLlamar al dentista | 2026-11-26\nMala | 2026-99-99",
    ),
    existing,
  );
  assert.deepEqual(
    p.map((x) => x.status),
    ["duplicate", "ok", "duplicate", "invalid"],
  );
  assert.deepEqual(
    p.map((x) => x.selected),
    [false, true, false, false],
  );
  assert.ok(p[3].errors[0]);
});
test("duplicados ignoran acentos y espacios", () => {
  const p = buildImportPreview(
    [{ source: "a", raw: { title: "  Café   con Ana " } }],
    [{ title: "cafe con ana", date: "", time: "" }],
  );
  assert.equal(p[0].status, "duplicate");
});
test("importar no muta lo existente ni inventa campos", () => {
  const ex = [{ title: "x", date: "", time: "" }];
  const before = JSON.stringify(ex);
  buildImportPreview(parseTextImport("y"), ex);
  assert.equal(JSON.stringify(ex), before);
});
test("usa la fecha local del dispositivo", async () => {
  const { localDateKey } = await import("./logic.js");
  assert.equal(localDateKey(new Date(2026, 10, 20, 0, 5)), "2026-11-20");
});
test("interpreta una tarea hablada para mañana", () => {
  const draft = parseSpokenTask(
    "Recuérdame mañana a las diez y media llamar al médico urgente",
    new Date(2026, 10, 20, 9, 0),
  );
  assert.deepEqual(draft, {
    title: "Llamar al médico",
    date: "2026-11-21",
    time: "10:30",
    priority: "high",
    transcript: "Recuérdame mañana a las diez y media llamar al médico urgente",
  });
});
test("interpreta día de semana y conserva acentos", () => {
  const draft = parseSpokenTask(
    "Anota el lunes comprar café",
    new Date(2026, 10, 20, 9, 0),
  );
  assert.equal(draft.title, "Comprar café");
  assert.equal(draft.date, "2026-11-23");
});

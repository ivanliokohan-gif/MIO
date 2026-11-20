# MIO

Asistente personal instalable para organizar tareas, el día y recordatorios desde iPhone y Windows.

## Desarrollo

```bash
npm start
npm test
```

Abre `http://localhost:4173`. En iPhone se instala desde Safari con **Compartir → Añadir a pantalla de inicio**.

## Importar pendientes

En **Ajustes → Bandeja de entrada → Importar** puedes pegar texto (una tarea por línea) o elegir un archivo JSON local. Todo se procesa en el navegador; nada se envía a ningún servidor.

```
Título | AAAA-MM-DD | alta, normal o baja | notas
```

```json
{ "version": 1, "tasks": [ { "title": "Ejemplo", "date": "2026-11-25", "time": "10:30", "priority": "high", "notes": "Opcional" } ] }
```

No guardes archivos de tareas reales en este repositorio (es público).

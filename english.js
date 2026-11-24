const endpoint = "https://mio-ingles.kohanivan85.workers.dev";
export function initEnglish() {
  const form = document.querySelector("#englishForm");
  const input = document.querySelector("#englishInput");
  const access = document.querySelector("#englishAccess");
  const log = document.querySelector("#englishMessages");
  const status = document.querySelector("#englishStatus");
  const send = document.querySelector("#englishSend");
  let messages = [];
  function display(role, text) {
    const item = document.createElement("p");
    const label = document.createElement("strong");
    label.textContent = role === "user" ? "Vos: " : "MIO: ";
    item.append(label, document.createTextNode(text));
    if (role === "model" && "speechSynthesis" in window) {
      const listen = document.createElement("button");
      listen.type = "button";
      listen.textContent = "Escuchar";
      listen.addEventListener("click", () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
      });
      item.append(document.createTextNode(" "), listen);
    }
    log.append(item);
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !access.value.trim()) { status.textContent = "Ingresá tu clave de acceso y escribí un mensaje."; return; }
    const previous = messages.slice(-10);
    const outgoing = [...previous, { role: "user", text }];
    send.disabled = true;
    status.textContent = "MIO está pensando…";
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${access.value.trim()}` }, body: JSON.stringify({ messages: outgoing }) });
      if (!response.ok) throw new Error(response.status === 401 ? "La clave de acceso no coincide." : "No pude conectar. Revisá la configuración e intentá de nuevo.");
      const data = await response.json();
      if (!data.text) throw new Error("No llegó una respuesta. Intentá de nuevo.");
      messages = [...outgoing, { role: "model", text: data.text }];
      display("user", text);
      display("model", data.text);
      input.value = "";
      status.textContent = "";
    } catch (error) { status.textContent = error.message || "No pude conectar."; }
    finally { send.disabled = false; }
  });
  document.querySelector("#englishClear").addEventListener("click", () => { messages = []; log.replaceChildren(); status.textContent = "Conversación nueva"; });
}

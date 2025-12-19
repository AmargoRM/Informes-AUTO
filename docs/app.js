const WORKER_BASE_URL = "https://TU-WORKER.workers.dev";

const form = document.getElementById("report-form");
const statusMessage = document.getElementById("status-message");
const statusHelp = document.getElementById("status-help");
const statusPill = document.getElementById("status-pill");
const runLink = document.getElementById("run-link");
const downloadButton = document.getElementById("download-button");
const submitButton = document.getElementById("submit-button");

const fields = {
  exp: document.getElementById("exp"),
  gestor: document.getElementById("gestor"),
  lat: document.getElementById("lat"),
  lon: document.getElementById("lon"),
};

const STORAGE_KEY = "informes-auto:last-inputs";
let lastRunId = null;
let lastRunUrl = null;

const setStatus = (message, pillClass, helpText = "") => {
  statusMessage.textContent = message;
  statusPill.className = `pill ${pillClass}`;
  statusHelp.textContent = helpText;
};

const setRunLink = (url) => {
  if (url) {
    runLink.href = url;
    runLink.style.display = "inline-flex";
  } else {
    runLink.removeAttribute("href");
    runLink.style.display = "none";
  }
};

const saveInputs = () => {
  const payload = {
    exp: fields.exp.value.trim(),
    gestor: fields.gestor.value.trim(),
    lat: fields.lat.value.trim(),
    lon: fields.lon.value.trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const loadInputs = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const payload = JSON.parse(saved);
    Object.keys(fields).forEach((key) => {
      if (payload[key]) {
        fields[key].value = payload[key];
      }
    });
  } catch (error) {
    console.warn("No se pudieron cargar los datos guardados.", error);
  }
};

const callWorker = async (path, options = {}) => {
  const response = await fetch(`${WORKER_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const errorMessage = data.message || `Error ${response.status}`;
    throw new Error(errorMessage);
  }

  return response;
};

const handleDispatch = async (event) => {
  event.preventDefault();
  saveInputs();

  const lat = fields.lat.value.trim();
  const lon = fields.lon.value.trim();

  if (!lat || !lon) {
    setStatus("Latitud y longitud son obligatorias.", "waiting");
    return;
  }

  submitButton.disabled = true;
  downloadButton.disabled = true;
  setStatus("Solicitud enviada.", "sent", "Espera unos segundos y revisa la ejecución.");
  setRunLink(null);
  lastRunId = null;
  lastRunUrl = null;

  try {
    const body = {
      exp: fields.exp.value.trim(),
      gestor: fields.gestor.value.trim(),
      lat,
      lon,
    };

    const response = await callWorker("/dispatch", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();

    lastRunId = data.run_id || null;
    lastRunUrl = data.run_url || null;

    if (lastRunUrl) {
      setRunLink(lastRunUrl);
    }

    setStatus(
      data.message || "Workflow iniciado.",
      "sent",
      "Puedes revisar la ejecución o intentar descargar el Word cuando termine."
    );
    downloadButton.disabled = false;
  } catch (error) {
    setStatus(`No se pudo enviar la solicitud: ${error.message}`, "waiting");
  } finally {
    submitButton.disabled = false;
  }
};

const handleDownload = async () => {
  downloadButton.disabled = true;
  setStatus("Buscando el archivo generado...", "waiting");

  try {
    const query = lastRunId ? `?run_id=${encodeURIComponent(lastRunId)}` : "";
    const response = await fetch(`${WORKER_BASE_URL}/artifact${query}`);

    if (response.status === 404) {
      setStatus(
        "Aún procesando, reintentar.",
        "waiting",
        "El workflow sigue en ejecución. Intenta de nuevo en unos minutos."
      );
      if (lastRunUrl) {
        setRunLink(lastRunUrl);
      }
      downloadButton.disabled = false;
      return;
    }

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "informe.zip";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);

    setStatus("Informe listo para descargar.", "ready");
  } catch (error) {
    setStatus(`No se pudo descargar: ${error.message}`, "waiting");
  } finally {
    downloadButton.disabled = false;
  }
};

form.addEventListener("submit", handleDispatch);

Object.values(fields).forEach((field) => {
  field.addEventListener("change", saveInputs);
});

downloadButton.addEventListener("click", handleDownload);

loadInputs();
setRunLink(null);

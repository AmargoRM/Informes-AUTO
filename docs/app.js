const WORKER_STORAGE_KEY = "worker_base_url";
const FALLBACK_WORKER_URL = "";

const form = document.getElementById("report-form");
const statusMessage = document.getElementById("status-message");
const statusHelp = document.getElementById("status-help");
const statusPill = document.getElementById("status-pill");
const runLink = document.getElementById("run-link");
const downloadButton = document.getElementById("download-button");
const submitButton = document.getElementById("submit-button");
const workerUrlInput = document.getElementById("worker-url");
const workerUrlSave = document.getElementById("save-worker-url");
const workerUrlCurrent = document.getElementById("worker-url-current");
const workerHealthBadge = document.getElementById("worker-health-badge");
const workerHealthDetail = document.getElementById("worker-health-detail");
const workerWarning = document.getElementById("worker-warning");

const fields = {
  exp: document.getElementById("exp"),
  gestor: document.getElementById("gestor"),
  lat: document.getElementById("lat"),
  lon: document.getElementById("lon"),
};

const STORAGE_KEY = "informes-auto:last-inputs";
let lastRunId = null;
let lastRunUrl = null;
let workerBaseUrl = "";

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

const setWorkerHealth = ({ label, badgeClass, detail }) => {
  workerHealthBadge.textContent = label;
  workerHealthBadge.className = `pill ${badgeClass || ""}`.trim();
  workerHealthDetail.textContent = detail;
};

const setWorkerWarning = (message) => {
  if (!message) {
    workerWarning.textContent = "";
    workerWarning.classList.add("hidden");
    return;
  }
  workerWarning.textContent = message;
  workerWarning.classList.remove("hidden");
};

const normalizeWorkerUrl = (value) => {
  if (!value) return "";
  return value.trim().replace(/\/+$/, "");
};

const validateWorkerUrl = (value) => {
  if (!value) {
    return {
      ok: false,
      message: "Ingresa la URL del Worker antes de guardar.",
    };
  }
  if (!value.startsWith("https://")) {
    return {
      ok: false,
      message: "La URL del Worker debe iniciar con https://",
    };
  }
  if (value.endsWith("/")) {
    return {
      ok: false,
      message: "La URL del Worker no debe terminar en /",
    };
  }
  try {
    new URL(value);
  } catch (error) {
    return {
      ok: false,
      message: "La URL del Worker no es válida.",
    };
  }
  return { ok: true };
};

const getConfiguredWorkerUrl = () => {
  const stored = localStorage.getItem(WORKER_STORAGE_KEY);
  const configValue = window.__CONFIG__?.WORKER_BASE_URL;
  const source = stored ? "localStorage" : configValue ? "config" : "fallback";
  const rawValue = stored || configValue || FALLBACK_WORKER_URL;
  return {
    url: normalizeWorkerUrl(rawValue),
    source,
    hasConfig: Boolean(stored || configValue),
  };
};

const applyWorkerBaseUrl = ({ url, source, hasConfig }) => {
  workerBaseUrl = url;
  workerUrlInput.value = url;
  workerUrlCurrent.textContent = url || "No configurada";
  if (!hasConfig) {
    setWorkerWarning(
      "Configura la URL del Worker para habilitar la conexión."
    );
  } else if (!url) {
    setWorkerWarning("La URL configurada está vacía.");
  } else if (source === "config") {
    setWorkerWarning("Usando la URL del Worker definida en la página.");
  } else {
    setWorkerWarning("");
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
  if (!workerBaseUrl) {
    throw new Error(
      "Configura la URL del Worker en la sección correspondiente antes de continuar."
    );
  }

  let response;
  try {
    response = await fetch(`${workerBaseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "No se pudo conectar al Worker. Verifica: (1) URL correcta (2) Worker desplegado (3) CORS/ALLOWED_ORIGIN (4) conexión."
      );
    }
    throw error;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 403) {
      throw new Error(
        "Origen no permitido (CORS). Revisa ALLOWED_ORIGIN en el Worker."
      );
    }
    if (
      response.status === 500 &&
      data.message?.includes("Configura GITHUB_TOKEN")
    ) {
      throw new Error("Falta configurar GITHUB_TOKEN en el Worker.");
    }
    const errorMessage = data.message || `Error ${response.status}`;
    throw new Error(errorMessage);
  }

  return response;
};

const checkWorkerHealth = async () => {
  if (!workerBaseUrl) {
    setWorkerHealth({
      label: "Sin configurar",
      badgeClass: "idle",
      detail: "Ingresa la URL del Worker para validar la conexión.",
    });
    return;
  }
  try {
    const response = await callWorker("/health");
    const data = await response.json();
    if (data.ok) {
      if (data.originAllowed) {
        setWorkerHealth({
          label: "Conectado",
          badgeClass: "ready",
          detail: "El Worker respondió correctamente.",
        });
      } else {
        setWorkerHealth({
          label: "CORS",
          badgeClass: "waiting",
          detail:
            "El Worker está activo pero el origen no está permitido (ALLOWED_ORIGIN).",
        });
      }
      return;
    }
    throw new Error(data.message || "Respuesta inesperada del Worker.");
  } catch (error) {
    setWorkerHealth({
      label: "Sin conexión",
      badgeClass: "waiting",
      detail: "No se pudo conectar con el Worker.",
    });
    setStatus(
      `No se pudo verificar el Worker: ${error.message || "Revisa la URL y el despliegue."}`,
      "waiting"
    );
  }
};

const handleSaveWorkerUrl = () => {
  const candidate = workerUrlInput.value.trim();
  const validation = validateWorkerUrl(candidate);
  if (!validation.ok) {
    setStatus(validation.message, "waiting");
    return;
  }
  const normalized = normalizeWorkerUrl(candidate);
  localStorage.setItem(WORKER_STORAGE_KEY, normalized);
  applyWorkerBaseUrl({ url: normalized, source: "localStorage", hasConfig: true });
  setStatus("URL del Worker guardada correctamente.", "sent");
  checkWorkerHealth();
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
    if (!workerBaseUrl) {
      throw new Error(
        "Configura la URL del Worker en la sección correspondiente antes de descargar."
      );
    }
    const query = lastRunId ? `?run_id=${encodeURIComponent(lastRunId)}` : "";
    let response;
    try {
      response = await fetch(`${workerBaseUrl}/artifact${query}`);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          "No se pudo conectar al Worker. Verifica: (1) URL correcta (2) Worker desplegado (3) CORS/ALLOWED_ORIGIN (4) conexión."
        );
      }
      throw error;
    }

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
      if (response.status === 403) {
        throw new Error(
          "Origen no permitido (CORS). Revisa ALLOWED_ORIGIN en el Worker."
        );
      }
      const data = await response.json().catch(() => ({}));
      if (
        response.status === 500 &&
        data.message?.includes("Configura GITHUB_TOKEN")
      ) {
        throw new Error("Falta configurar GITHUB_TOKEN en el Worker.");
      }
      throw new Error(data.message || `Error ${response.status}`);
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

workerUrlSave.addEventListener("click", (event) => {
  event.preventDefault();
  handleSaveWorkerUrl();
});

loadInputs();
setRunLink(null);
applyWorkerBaseUrl(getConfiguredWorkerUrl());
checkWorkerHealth();

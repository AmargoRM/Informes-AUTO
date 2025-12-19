const WORKER_STORAGE_KEY = "worker_base_url";
const FALLBACK_WORKER_URL = "";

const elements = {
  modeRadios: document.querySelectorAll("input[name='coord-mode']"),
  wgsFields: document.getElementById("wgs84-fields"),
  lambertFields: document.getElementById("lambert-fields"),
  lat: document.getElementById("lat"),
  lon: document.getElementById("lon"),
  e5367: document.getElementById("e5367"),
  n5367: document.getElementById("n5367"),
  convert: document.getElementById("convert"),
  resultE: document.getElementById("result-e"),
  resultN: document.getElementById("result-n"),
  expediente: document.getElementById("expediente"),
  gestor: document.getElementById("gestor"),
  generate: document.getElementById("generate"),
  alert: document.getElementById("alert"),
  statusBadge: document.getElementById("status-badge"),
  statusSpinner: document.getElementById("status-spinner"),
  statusDetail: document.getElementById("status-detail"),
  runLink: document.getElementById("run-link"),
  downloadArtifact: document.getElementById("download-artifact"),
  workerUrlInput: document.getElementById("worker-url"),
  workerUrlSave: document.getElementById("save-worker-url"),
  workerUrlCurrent: document.getElementById("worker-url-current"),
  workerHealthBadge: document.getElementById("worker-health-badge"),
  workerHealthDetail: document.getElementById("worker-health-detail"),
  workerWarning: document.getElementById("worker-warning"),
};

let pollingId = null;
let lastRunId = null;
let workerBaseUrl = "";

proj4.defs(
  "EPSG:5367",
  "+proj=tmerc +lat_0=0 +lon_0=-84 +k=0.9996 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs"
);

const formatNumber = (value, decimals) => {
  if (Number.isNaN(value)) {
    return "";
  }
  return value.toFixed(decimals);
};

const setAlert = (message, type = "error") => {
  elements.alert.textContent = message;
  elements.alert.classList.remove("hidden", "success");
  if (type === "success") {
    elements.alert.classList.add("success");
  }
};

const clearAlert = () => {
  elements.alert.textContent = "";
  elements.alert.classList.add("hidden");
  elements.alert.classList.remove("success");
};

const setStatus = ({ label, badgeClass, detail, spinning }) => {
  elements.statusBadge.textContent = label;
  elements.statusBadge.className = `badge ${badgeClass || ""}`.trim();
  elements.statusDetail.textContent = detail;
  elements.statusSpinner.classList.toggle("hidden", !spinning);
};

const setWorkerHealth = ({ label, badgeClass, detail }) => {
  elements.workerHealthBadge.textContent = label;
  elements.workerHealthBadge.className = `badge ${badgeClass || ""}`.trim();
  elements.workerHealthDetail.textContent = detail;
};

const setWorkerWarning = (message) => {
  if (!message) {
    elements.workerWarning.textContent = "";
    elements.workerWarning.classList.add("hidden");
    return;
  }
  elements.workerWarning.textContent = message;
  elements.workerWarning.classList.remove("hidden");
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
  elements.workerUrlInput.value = url;
  elements.workerUrlCurrent.textContent = url || "No configurada";
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

const toggleMode = (mode) => {
  if (mode === "lambert") {
    elements.wgsFields.classList.add("hidden");
    elements.lambertFields.classList.remove("hidden");
    elements.convert.classList.add("hidden");
  } else {
    elements.wgsFields.classList.remove("hidden");
    elements.lambertFields.classList.add("hidden");
    elements.convert.classList.remove("hidden");
  }
  clearAlert();
};

const getSelectedMode = () =>
  Array.from(elements.modeRadios).find((radio) => radio.checked)?.value || "wgs84";

const validateWgs = () => {
  const lat = Number(elements.lat.value);
  const lon = Number(elements.lon.value);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return { ok: false, message: "Latitud y longitud deben ser números." };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, message: "La latitud debe estar entre -90 y 90." };
  }
  if (lon < -180 || lon > 180) {
    return { ok: false, message: "La longitud debe estar entre -180 y 180." };
  }
  return { ok: true, lat, lon };
};

const validateLambert = () => {
  const e = Number(elements.e5367.value);
  const n = Number(elements.n5367.value);
  if (Number.isNaN(e) || Number.isNaN(n)) {
    return { ok: false, message: "E y N deben ser números." };
  }
  if (e < 0 || n < 0) {
    return { ok: false, message: "E y N deben ser valores positivos." };
  }
  return { ok: true, e, n };
};

const convertTo5367 = () => {
  const validation = validateWgs();
  if (!validation.ok) {
    setAlert(validation.message);
    return null;
  }
  const { lat, lon } = validation;
  const [e, n] = proj4("EPSG:4326", "EPSG:5367", [lon, lat]);
  elements.resultE.textContent = formatNumber(e, 3);
  elements.resultN.textContent = formatNumber(n, 3);
  elements.e5367.value = formatNumber(e, 3);
  elements.n5367.value = formatNumber(n, 3);
  clearAlert();
  return { e, n, lat, lon };
};

const convertToWgs = () => {
  const validation = validateLambert();
  if (!validation.ok) {
    setAlert(validation.message);
    return null;
  }
  const { e, n } = validation;
  const [lon, lat] = proj4("EPSG:5367", "EPSG:4326", [e, n]);
  return { lat, lon, e, n };
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

const dispatchWorkflow = async (inputs) => {
  const response = await callWorker("/dispatch", {
    method: "POST",
    body: JSON.stringify(inputs),
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.message || "No se pudo disparar el workflow.");
  }
  return data;
};

const fetchLatestRun = async () => {
  const response = await callWorker("/latest-run");
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.message || "No se pudo consultar el estado.");
  }
  return data;
};

const downloadArtifact = async (runId) => {
  if (!workerBaseUrl) {
    throw new Error(
      "Configura la URL del Worker en la sección correspondiente antes de descargar."
    );
  }
  const query = runId ? `?run_id=${encodeURIComponent(runId)}` : "";
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
    throw new Error("Aún procesando el archivo.");
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
    throw new Error(data.message || "No se pudo descargar el artifact.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "informe.zip";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const startPolling = () => {
  stopPolling();
  pollingId = setInterval(async () => {
    try {
      await refreshStatus();
    } catch (error) {
      setAlert(`Error al actualizar estado: ${error.message}`);
      stopPolling();
    }
  }, 6000);
};

const stopPolling = () => {
  if (pollingId) {
    clearInterval(pollingId);
    pollingId = null;
  }
};

const updateStatusUi = (run) => {
  if (!run) {
    setStatus({
      label: "Sin iniciar",
      badgeClass: "",
      detail: "Aún no hay ejecución.",
      spinning: false,
    });
    elements.runLink.classList.add("hidden");
    elements.downloadArtifact.classList.add("hidden");
    return;
  }

  const status = run.status;
  const conclusion = run.conclusion;
  elements.runLink.href = run.html_url;
  elements.runLink.classList.toggle("hidden", !run.html_url);
  lastRunId = run.id;

  if (status === "queued" || status === "in_progress") {
    setStatus({
      label: status === "queued" ? "En cola" : "En ejecución",
      badgeClass: "running",
      detail: "El workflow está en progreso.",
      spinning: true,
    });
    elements.downloadArtifact.classList.add("hidden");
  } else {
    const isSuccess = conclusion === "success";
    setStatus({
      label: isSuccess ? "Completado" : "Fallido",
      badgeClass: isSuccess ? "completed" : "failed",
      detail: isSuccess
        ? "El workflow terminó correctamente."
        : `El workflow terminó con estado: ${conclusion || "desconocido"}.`,
      spinning: false,
    });
    if (isSuccess) {
      elements.downloadArtifact.classList.remove("hidden");
      elements.statusDetail.textContent =
        "Artifact listo. Usa el botón para descargar.";
    }
  }
};

const refreshStatus = async () => {
  const data = await fetchLatestRun();
  const run = data.status
    ? {
        status: data.status,
        conclusion: data.conclusion,
        html_url: data.run_url,
        id: data.run_id,
      }
    : null;
  updateStatusUi(run);
  if (!run) {
    stopPolling();
    return;
  }

  if (run.status === "completed") {
    stopPolling();
  }
};

const checkWorkerHealth = async () => {
  if (!workerBaseUrl) {
    setWorkerHealth({
      label: "Sin configurar",
      badgeClass: "",
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
          badgeClass: "completed",
          detail: "El Worker respondió correctamente.",
        });
      } else {
        setWorkerHealth({
          label: "CORS",
          badgeClass: "failed",
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
      badgeClass: "failed",
      detail: "No se pudo conectar con el Worker.",
    });
    setAlert(
      `No se pudo verificar el Worker: ${error.message || "Revisa la URL y el despliegue."}`
    );
  }
};

const handleSaveWorkerUrl = () => {
  const candidate = elements.workerUrlInput.value.trim();
  const validation = validateWorkerUrl(candidate);
  if (!validation.ok) {
    setAlert(validation.message);
    return;
  }
  const normalized = normalizeWorkerUrl(candidate);
  localStorage.setItem(WORKER_STORAGE_KEY, normalized);
  applyWorkerBaseUrl({ url: normalized, source: "localStorage", hasConfig: true });
  setAlert("URL del Worker guardada correctamente.", "success");
  checkWorkerHealth();
  refreshStatus().catch(() => {
    setStatus({
      label: "Sin iniciar",
      badgeClass: "",
      detail: "No se pudo consultar el estado del workflow.",
      spinning: false,
    });
  });
};

const handleGenerate = async () => {
  clearAlert();

  const mode = getSelectedMode();
  let coords;
  if (mode === "wgs84") {
    coords = convertTo5367();
  } else {
    coords = convertToWgs();
  }
  if (!coords) {
    return;
  }

  const lat = coords.lat;
  const lon = coords.lon;

  const inputs = {
    lat: formatNumber(lat, 6),
    lon: formatNumber(lon, 6),
    exp: elements.expediente.value.trim(),
    gestor: elements.gestor.value.trim(),
  };

  try {
    setStatus({
      label: "Enviando",
      badgeClass: "running",
      detail: "Enviando workflow_dispatch...",
      spinning: true,
    });
    elements.downloadArtifact.classList.add("hidden");
    const response = await dispatchWorkflow(inputs);
    setAlert(response.message || "Workflow enviado correctamente.", "success");
    if (response.run_url) {
      elements.runLink.href = response.run_url;
      elements.runLink.classList.remove("hidden");
    }
    lastRunId = response.run_id || null;
    await refreshStatus();
    startPolling();
  } catch (error) {
    setAlert(`No se pudo enviar el workflow: ${error.message}`);
    setStatus({
      label: "Error",
      badgeClass: "failed",
      detail: "Hubo un problema al enviar el workflow.",
      spinning: false,
    });
  }
};

const handleDownload = async () => {
  try {
    await downloadArtifact(lastRunId);
  } catch (error) {
    setAlert(error.message);
  }
};

const init = () => {
  applyWorkerBaseUrl(getConfiguredWorkerUrl());

  elements.modeRadios.forEach((radio) => {
    radio.addEventListener("change", (event) => {
      toggleMode(event.target.value);
    });
  });

  elements.convert.addEventListener("click", (event) => {
    event.preventDefault();
    convertTo5367();
  });

  elements.generate.addEventListener("click", (event) => {
    event.preventDefault();
    handleGenerate();
  });

  elements.downloadArtifact.addEventListener("click", (event) => {
    event.preventDefault();
    handleDownload();
  });

  elements.workerUrlSave.addEventListener("click", (event) => {
    event.preventDefault();
    handleSaveWorkerUrl();
  });

  checkWorkerHealth();

  if (workerBaseUrl) {
    refreshStatus().catch(() => {
      setStatus({
        label: "Sin iniciar",
        badgeClass: "",
        detail: "No se pudo consultar el estado del workflow.",
        spinning: false,
      });
    });
  } else {
    setStatus({
      label: "Sin iniciar",
      badgeClass: "",
      detail: "Configura la URL del Worker para consultar el estado.",
      spinning: false,
    });
  }
};

init();

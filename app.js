const OWNER = "AmargoRM";
const REPO = "Informes-AUTO";
const WORKFLOW_FILE = "generate_word.yml";
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;
const STORAGE_KEY = "informes_github_token";

const elements = {
  token: document.getElementById("token"),
  saveToken: document.getElementById("save-token"),
  clearToken: document.getElementById("clear-token"),
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
};

let pollingId = null;
let lastRunId = null;

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

const getToken = () => localStorage.getItem(STORAGE_KEY) || "";

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

const authHeaders = (token) => ({
  Authorization: `token ${token}`,
  Accept: "application/vnd.github+json",
});

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      detail = data.message ? ` (${data.message})` : "";
    } catch (error) {
      detail = "";
    }
    throw new Error(`Error ${response.status}${detail}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
};

const dispatchWorkflow = async ({ token, inputs }) => {
  const url = `${API_BASE}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  await fetchJson(url, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs }),
  });
};

const fetchLatestRun = async (token) => {
  const url = `${API_BASE}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=5`;
  const data = await fetchJson(url, { headers: authHeaders(token) });
  return data.workflow_runs?.[0] || null;
};

const fetchArtifacts = async (token, runId) => {
  const url = `${API_BASE}/actions/runs/${runId}/artifacts`;
  const data = await fetchJson(url, { headers: authHeaders(token) });
  return data.artifacts || [];
};

const downloadArtifact = async (token, artifact) => {
  const response = await fetch(artifact.archive_download_url, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error("No se pudo descargar el artifact.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${artifact.name}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const startPolling = (token) => {
  stopPolling();
  pollingId = setInterval(async () => {
    try {
      await refreshStatus(token);
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
  elements.runLink.classList.remove("hidden");
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
  }
};

const refreshStatus = async (token) => {
  const run = await fetchLatestRun(token);
  updateStatusUi(run);
  if (!run) {
    stopPolling();
    return;
  }

  if (run.status === "completed") {
    stopPolling();
    if (run.conclusion === "success") {
      const artifacts = await fetchArtifacts(token, run.id);
      const wordArtifact = artifacts.find((artifact) =>
        artifact.name.toLowerCase().includes("word") ||
        artifact.name.toLowerCase().includes("informe")
      );
      if (wordArtifact) {
        elements.downloadArtifact.classList.remove("hidden");
        elements.downloadArtifact.onclick = async () => {
          try {
            await downloadArtifact(token, wordArtifact);
          } catch (error) {
            setAlert(error.message);
          }
        };
        elements.statusDetail.textContent =
          "Artifact listo. Usa el botón para descargar.";
      } else {
        elements.statusDetail.textContent =
          "No se encontró el artifact del Word. Revisa el run en GitHub.";
      }
    }
  }
};

const handleGenerate = async () => {
  clearAlert();
  const token = getToken();
  if (!token) {
    setAlert("Debes ingresar un GitHub Token para ejecutar el workflow.");
    return;
  }

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
  const e = mode === "wgs84" ? coords.e : coords.e;
  const n = mode === "wgs84" ? coords.n : coords.n;

  const inputs = {
    lat_wgs84: formatNumber(lat, 6),
    lon_wgs84: formatNumber(lon, 6),
    e_5367: formatNumber(e, 3),
    n_5367: formatNumber(n, 3),
    expediente: elements.expediente.value.trim(),
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
    await dispatchWorkflow({ token, inputs });
    setAlert("Workflow enviado correctamente.", "success");
    await refreshStatus(token);
    startPolling(token);
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

const init = () => {
  const savedToken = getToken();
  if (savedToken) {
    elements.token.value = savedToken;
  }

  elements.saveToken.addEventListener("click", () => {
    if (!elements.token.value.trim()) {
      setAlert("El token no puede estar vacío.");
      return;
    }
    localStorage.setItem(STORAGE_KEY, elements.token.value.trim());
    clearAlert();
  });

  elements.clearToken.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    elements.token.value = "";
    clearAlert();
  });

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

  refreshStatus(getToken()).catch(() => {
    setStatus({
      label: "Sin iniciar",
      badgeClass: "",
      detail: "Ingresa un token para consultar el estado.",
      spinning: false,
    });
  });
};

init();

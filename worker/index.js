const OWNER = "AmargoRM";
const REPO = "Informes-AUTO";
const WORKFLOW_FILE = "generate_word.yml";
const DEFAULT_BRANCH = "main";

const jsonResponse = (data, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
};

const normalizeAllowedOrigin = (allowedOrigin) => {
  if (!allowedOrigin) return "";
  try {
    return new URL(allowedOrigin).origin;
  } catch (error) {
    return allowedOrigin;
  }
};

const isAllowedOrigin = (origin, allowedOrigin) => {
  const normalizedAllowed = normalizeAllowedOrigin(allowedOrigin);
  if (!origin) return true;
  if (origin === normalizedAllowed) return true;
  if (origin.startsWith("http://localhost")) return true;
  if (origin.startsWith("http://127.0.0.1")) return true;
  return false;
};

const withCors = (response, origin, allowedOrigin) => {
  const headers = new Headers(response.headers);
  const normalizedAllowed = normalizeAllowedOrigin(allowedOrigin);
  headers.set(
    "Access-Control-Allow-Origin",
    origin && isAllowedOrigin(origin, allowedOrigin) ? origin : normalizedAllowed
  );
  headers.set("Vary", "Origin");
  return new Response(response.body, { ...response, headers });
};

const buildCorsHeaders = (origin, allowedOrigin) => {
  const normalizedAllowed = normalizeAllowedOrigin(allowedOrigin);
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  headers["Access-Control-Allow-Origin"] =
    origin && isAllowedOrigin(origin, allowedOrigin) ? origin : normalizedAllowed;
  return headers;
};

const getWorkflow = async (token) => {
  const base = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };

  let response = await fetch(`${base}/actions/workflows/${WORKFLOW_FILE}`, {
    headers,
  });

  if (response.ok) {
    const data = await response.json();
    return data;
  }

  response = await fetch(`${base}/actions/workflows`, { headers });
  if (!response.ok) {
    throw new Error("No se pudo listar workflows.");
  }

  const data = await response.json();
  const match = data.workflows.find((workflow) => {
    if (workflow.path && workflow.path.endsWith(WORKFLOW_FILE)) return true;
    if (workflow.name && workflow.name.toLowerCase().includes("informe")) return true;
    return false;
  });

  if (!match) {
    throw new Error("No se encontró el workflow solicitado.");
  }

  return match;
};

const getLatestRun = async (token, workflowId) => {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflowId}/runs?per_page=5`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error("No se pudieron obtener ejecuciones recientes.");
  }

  const data = await response.json();
  return data.workflow_runs?.[0] || null;
};

const dispatchWorkflow = async (token, workflowId, inputs) => {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflowId}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: DEFAULT_BRANCH,
      inputs,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`No se pudo disparar el workflow. ${message}`);
  }
};

const buildInputs = ({ lat, lon, exp, gestor }) => {
  const inputs = {
    lat: String(lat),
    lon: String(lon),
  };
  if (exp) inputs.exp = String(exp);
  if (gestor) inputs.gestor = String(gestor);
  return inputs;
};

const pickArtifact = (artifacts) => {
  if (!artifacts?.length) return null;
  const priorityNames = [
    "word-report",
    "informe-word",
    "informe",
    "report",
    "output",
  ];
  for (const name of priorityNames) {
    const found = artifacts.find((artifact) => artifact.name === name);
    if (found) return found;
  }
  const wordMatch = artifacts.find((artifact) =>
    artifact.name.toLowerCase().includes("word")
  );
  return wordMatch || artifacts[0];
};

export default {
  async fetch(request, env) {
    const { pathname, searchParams } = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://amargorm.github.io";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(origin, allowedOrigin),
      });
    }

    if (pathname === "/health" && request.method === "GET") {
      return withCors(
        jsonResponse({
          ok: true,
          worker: "up",
          originAllowed: isAllowedOrigin(origin, allowedOrigin),
        }),
        origin,
        allowedOrigin
      );
    }

    if (!isAllowedOrigin(origin, allowedOrigin)) {
      return jsonResponse(
        { ok: false, message: "Origen no permitido." },
        {
          status: 403,
          headers: buildCorsHeaders(origin, allowedOrigin),
        }
      );
    }

    if (!env.GITHUB_TOKEN) {
      return withCors(
        jsonResponse(
          { ok: false, message: "Configura GITHUB_TOKEN en el Worker." },
          { status: 500 }
        ),
        origin,
        allowedOrigin
      );
    }

    if (pathname === "/dispatch" && request.method === "POST") {
      let payload = {};
      try {
        payload = await request.json();
      } catch (error) {
        return withCors(
          jsonResponse(
            { ok: false, message: "JSON inválido." },
            { status: 400 }
          ),
          origin,
          allowedOrigin
        );
      }

      if (!payload.lat || !payload.lon) {
        return withCors(
          jsonResponse(
            {
              ok: false,
              message: "lat y lon son obligatorios.",
            },
            { status: 400 }
          ),
          origin,
          allowedOrigin
        );
      }

      try {
        const workflow = await getWorkflow(env.GITHUB_TOKEN);
        const inputs = buildInputs(payload);
        await dispatchWorkflow(env.GITHUB_TOKEN, workflow.id, inputs);
        const run = await getLatestRun(env.GITHUB_TOKEN, workflow.id);

        return withCors(
          jsonResponse({
            ok: true,
            run_url: run?.html_url || null,
            run_id: run?.id || null,
            message: "Workflow iniciado correctamente.",
          }),
          origin,
          allowedOrigin
        );
      } catch (error) {
        return withCors(
          jsonResponse(
            { ok: false, message: error.message },
            { status: 500 }
          ),
          origin,
          allowedOrigin
        );
      }
    }

    if (pathname === "/latest-run" && request.method === "GET") {
      try {
        const workflow = await getWorkflow(env.GITHUB_TOKEN);
        const run = await getLatestRun(env.GITHUB_TOKEN, workflow.id);

        return withCors(
          jsonResponse({
            ok: true,
            run_url: run?.html_url || null,
            run_id: run?.id || null,
            status: run?.status || null,
            conclusion: run?.conclusion || null,
          }),
          origin,
          allowedOrigin
        );
      } catch (error) {
        return withCors(
          jsonResponse(
            { ok: false, message: error.message },
            { status: 500 }
          ),
          origin,
          allowedOrigin
        );
      }
    }

    if (pathname === "/artifact" && request.method === "GET") {
      try {
        const workflow = await getWorkflow(env.GITHUB_TOKEN);
        const runId = searchParams.get("run_id");
        const run = runId
          ? { id: runId }
          : await getLatestRun(env.GITHUB_TOKEN, workflow.id);

        if (!run?.id) {
          return withCors(
            jsonResponse(
              { ok: false, message: "No hay ejecuciones recientes." },
              { status: 404 }
            ),
            origin,
            allowedOrigin
          );
        }

        const artifactsResponse = await fetch(
          `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/artifacts`,
          {
            headers: {
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
              Accept: "application/vnd.github+json",
            },
          }
        );

        if (!artifactsResponse.ok) {
          throw new Error("No se pudieron obtener artifacts.");
        }

        const artifactsData = await artifactsResponse.json();
        const artifact = pickArtifact(artifactsData.artifacts);

        if (!artifact) {
          return withCors(
            jsonResponse(
              { ok: false, status: "processing" },
              { status: 404 }
            ),
            origin,
            allowedOrigin
          );
        }

        const zipResponse = await fetch(artifact.archive_download_url, {
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
        });

        if (!zipResponse.ok) {
          throw new Error("No se pudo descargar el artifact.");
        }

        const headers = new Headers(zipResponse.headers);
        headers.set("Content-Type", "application/zip");
        headers.set(
          "Content-Disposition",
          "attachment; filename=\"informe.zip\""
        );

        const response = new Response(zipResponse.body, {
          status: 200,
          headers,
        });

        return withCors(response, origin, allowedOrigin);
      } catch (error) {
        return withCors(
          jsonResponse(
            { ok: false, message: error.message },
            { status: 500 }
          ),
          origin,
          allowedOrigin
        );
      }
    }

    return withCors(
      jsonResponse(
        { ok: false, message: "Ruta no encontrada." },
        { status: 404 }
      ),
      origin,
      allowedOrigin
    );
  },
};

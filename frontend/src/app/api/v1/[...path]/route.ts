import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let lastWorkingBackendBase: string | null = null;

function getCandidateUrls(customHeaderUrl?: string | null): string[] {
  const list: string[] = [];

  // 1. Explicit override from client request header
  if (customHeaderUrl && customHeaderUrl.trim()) {
    const trimmed = customHeaderUrl.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      list.push(trimmed.replace(/\/+$/, ""));
    } else {
      list.push(`https://${trimmed}`.replace(/\/+$/, ""));
    }
  }

  // 2. Previously working URL if verified
  if (lastWorkingBackendBase && !list.includes(lastWorkingBackendBase)) {
    list.push(lastWorkingBackendBase);
  }

  // 3. Environment variables
  const rawEnv = (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  ).trim();

  if (rawEnv) {
    if (rawEnv.startsWith("http://") || rawEnv.startsWith("https://")) {
      const clean = rawEnv.replace(/\/+$/, "");
      if (!list.includes(clean)) list.push(clean);
    } else if (rawEnv.includes(".")) {
      const httpsUrl = `https://${rawEnv}`.replace(/\/+$/, "");
      if (!list.includes(httpsUrl)) list.push(httpsUrl);
    } else {
      // Short service name like "technewshub-api"
      const renderPublic = `https://${rawEnv}.onrender.com`;
      if (!list.includes(renderPublic)) list.push(renderPublic);

      const internalPort = `http://${rawEnv}:8000`;
      if (!list.includes(internalPort)) list.push(internalPort);
    }
  }

  // 4. Default public Render domains (new and legacy)
  const defaultRender = "https://acciofeed-api.onrender.com";
  if (!list.includes(defaultRender)) {
    list.push(defaultRender);
  }
  const legacyRender = "https://technewshub-api.onrender.com";
  if (!list.includes(legacyRender)) {
    list.push(legacyRender);
  }

  // 5. Localhost fallback
  const localhost = "http://localhost:8001";
  if (!list.includes(localhost)) {
    list.push(localhost);
  }

  return list;
}

async function proxy(request: NextRequest, path: string[]) {
  const customHeader = request.headers.get("x-backend-url");
  const candidates = getCandidateUrls(customHeader);
  const search = request.nextUrl.search;
  const subpath = path.join("/");

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!["host", "connection", "content-length", "x-backend-url"].includes(lowerKey)) {
      headers.set(key, value);
    }
  });

  const method = request.method;
  let body: ArrayBuffer | undefined = undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await request.arrayBuffer();
    } catch {
      // Body may be empty
    }
  }

  const errors: string[] = [];

  for (const backendBase of candidates) {
    const targetUrl = `${backendBase}/api/v1/${subpath}${search}`;

    try {
      const response = await fetch(targetUrl, {
        method,
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(45000), // 45s timeout for Render cold start
      });

      // If we got ANY response from the server, consider this backend responsive
      lastWorkingBackendBase = backendBase;

      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (!["content-encoding", "content-length", "transfer-encoding"].includes(lowerKey)) {
          responseHeaders.set(key, value);
        }
      });
      responseHeaders.set("x-backend-upstream", backendBase);

      const data = await response.arrayBuffer();
      return new NextResponse(data, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err: unknown) {
      const cause =
        err && typeof err === "object" && "cause" in err
          ? (err as { cause?: { code?: string; message?: string } }).cause
          : undefined;
      const causeCode = cause?.code || cause?.message || "";
      const msg = err instanceof Error ? err.message : "Unreachable";
      const full = causeCode ? `${msg} (${causeCode})` : msg;
      errors.push(`${backendBase} -> ${full}`);
      console.warn(`[API Proxy] Falha ao tentar ${targetUrl}: ${full}`);
    }
  }

  console.error(`[API Proxy] Todas as tentativas falharam:`, errors);
  return NextResponse.json(
    {
      detail: `Não foi possível conectar ao servidor backend da API. Tentamos: ${candidates.join(", ")}.`,
      candidates,
      errors,
      hint: "Verifique se a URL do backend está correta ou configure manualmente o endereço da API no painel.",
    },
    { status: 502 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

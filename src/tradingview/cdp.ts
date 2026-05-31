export interface CdpEndpoint {
  host: string;
  port: number;
}

export interface FetchCdpJsonOptions extends CdpEndpoint {
  timeoutMs: number;
}

export class CdpHttpError extends Error {
  constructor(
    message: string,
    options?: {
      cause?: unknown;
    }
  ) {
    super(message, options);
    this.name = "CdpHttpError";
  }
}

export function formatCdpEndpoint(endpoint: CdpEndpoint): string {
  return `http://${endpoint.host}:${endpoint.port}`;
}

export function buildCdpUrl(pathname: string, endpoint: CdpEndpoint): URL {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, `${formatCdpEndpoint(endpoint)}/`);
}

export async function fetchCdpJson(
  pathname: string,
  options: FetchCdpJsonOptions
): Promise<unknown> {
  const url = buildCdpUrl(pathname, options);
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      signal: abort.signal
    });

    if (!response.ok) {
      throw new CdpHttpError(
        `CDP endpoint ${url.href} returned HTTP ${response.status}.`
      );
    }

    return await response.json();
  } catch (error: unknown) {
    if (error instanceof CdpHttpError) {
      throw error;
    }

    throw new CdpHttpError(`CDP endpoint ${url.href} is unreachable.`, {
      cause: error
    });
  } finally {
    clearTimeout(timeout);
  }
}

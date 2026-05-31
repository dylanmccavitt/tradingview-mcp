import WebSocket, { type RawData } from "ws";

export interface CdpClient {
  send<T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T>;
  close(): Promise<void>;
}

export interface ConnectCdpClientOptions {
  timeoutMs: number;
}

interface CdpResponseError {
  code?: number;
  message: string;
  data?: unknown;
}

interface PendingCommand {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class CdpProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CdpProtocolError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function responseId(value: Record<string, unknown>): number | null {
  const id = value.id;
  return typeof id === "number" ? id : null;
}

function responseError(value: Record<string, unknown>): CdpResponseError | null {
  const error = value.error;

  if (!isRecord(error)) {
    return null;
  }

  const message = error.message;

  if (typeof message !== "string") {
    return null;
  }

  const normalized: CdpResponseError = {
    message
  };

  if (typeof error.code === "number") {
    normalized.code = error.code;
  }

  if ("data" in error) {
    normalized.data = error.data;
  }

  return normalized;
}

function rawDataToString(data: RawData): string {
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  return Buffer.from(data).toString("utf8");
}

export class WebSocketCdpClient implements CdpClient {
  readonly #socket: WebSocket;
  readonly #timeoutMs: number;
  readonly #pending = new Map<number, PendingCommand>();
  #nextId = 1;

  constructor(socket: WebSocket, timeoutMs: number) {
    this.#socket = socket;
    this.#timeoutMs = timeoutMs;

    this.#socket.on("message", (data) => {
      this.#handleMessage(data);
    });

    this.#socket.on("close", () => {
      this.#rejectPending("CDP WebSocket closed before a command completed.");
    });

    this.#socket.on("error", (error) => {
      this.#rejectPending(`CDP WebSocket error: ${error.message}`);
    });
  }

  send<T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const id = this.#nextId;
    this.#nextId += 1;

    const payload: Record<string, unknown> = {
      id,
      method
    };

    if (params) {
      payload.params = params;
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(
          new CdpProtocolError(
            `CDP command ${method} timed out after ${this.#timeoutMs}ms.`
          )
        );
      }, this.#timeoutMs);

      this.#pending.set(id, {
        resolve: (value) => {
          resolve(value as T);
        },
        reject,
        timeout
      });

      this.#socket.send(JSON.stringify(payload), (error) => {
        if (!error) {
          return;
        }

        const pending = this.#pending.get(id);
        if (!pending) {
          return;
        }

        clearTimeout(pending.timeout);
        this.#pending.delete(id);
        pending.reject(
          new CdpProtocolError(
            `CDP command ${method} could not be sent: ${error.message}`
          )
        );
      });
    });
  }

  close(): Promise<void> {
    if (
      this.#socket.readyState === WebSocket.OPEN ||
      this.#socket.readyState === WebSocket.CONNECTING
    ) {
      this.#socket.close();
    }

    return Promise.resolve();
  }

  #handleMessage(data: RawData): void {
    let message: unknown;

    try {
      message = JSON.parse(rawDataToString(data));
    } catch {
      return;
    }

    if (!isRecord(message)) {
      return;
    }

    const id = responseId(message);
    if (id === null) {
      return;
    }

    const pending = this.#pending.get(id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.#pending.delete(id);

    const error = responseError(message);
    if (error) {
      const code = typeof error.code === "number" ? ` ${error.code}` : "";
      pending.reject(
        new CdpProtocolError(`CDP command failed${code}: ${error.message}`)
      );
      return;
    }

    pending.resolve(message.result ?? {});
  }

  #rejectPending(message: string): void {
    for (const [id, pending] of this.#pending.entries()) {
      clearTimeout(pending.timeout);
      this.#pending.delete(id);
      pending.reject(new CdpProtocolError(message));
    }
  }
}

export async function connectCdpClient(
  webSocketDebuggerUrl: string,
  options: ConnectCdpClientOptions
): Promise<CdpClient> {
  const socket = new WebSocket(webSocketDebuggerUrl);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.close();
      reject(
        new CdpProtocolError(
          `CDP WebSocket connection timed out after ${options.timeoutMs}ms.`
        )
      );
    }, options.timeoutMs);

    socket.once("open", () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(new CdpProtocolError(`CDP WebSocket error: ${error.message}`));
    });

    socket.once("close", () => {
      clearTimeout(timeout);
      reject(new CdpProtocolError("CDP WebSocket closed before opening."));
    });
  });

  return new WebSocketCdpClient(socket, options.timeoutMs);
}

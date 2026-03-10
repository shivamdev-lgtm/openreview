import type { OutputMessage } from "@alibaba-group/opensandbox";
import { ConnectionConfig, Sandbox } from "@alibaba-group/opensandbox";

import { env } from "@/lib/env";

const WORKSPACE_DIR = "/workspace";

export { WORKSPACE_DIR };

/** Concatenate OutputMessage[] into a single string. */
export function collectOutput(messages: OutputMessage[]): string {
  return messages.map((m) => m.text).join("");
}

export function getSandboxConfig(): ConnectionConfig {
  return new ConnectionConfig({
    domain: env.OPENSANDBOX_DOMAIN ?? "localhost:8080",
    apiKey: env.OPENSANDBOX_API_KEY ?? "api-key",
  });
}

export async function connectToSandbox(sandboxId: string): Promise<Sandbox> {
  const config = getSandboxConfig();
  return Sandbox.connect({
    sandboxId,
    connectionConfig: config,
  });
}

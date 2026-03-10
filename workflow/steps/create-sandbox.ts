import { Sandbox } from "@alibaba-group/opensandbox";

import { parseError } from "@/lib/error";
import { getSandboxConfig } from "@/lib/sandbox";
import { runCommandInSandbox } from "./configure-git";
import { installDependencies } from "./install-dependencies";

const TEN_MINUTES_S = 10 * 60;

export const createSandbox = async (
  repoFullName: string,
  token: string,
  branch: string
): Promise<string> => {
  try {
    const config = getSandboxConfig();
    const sandbox = await Sandbox.create({
      connectionConfig: config,
      image: "debian:trixie-slim",
      timeoutSeconds: TEN_MINUTES_S,
      env: {
        REPO_URL: `https://x-access-token:${token}@github.com/${repoFullName}.git`,
        REPO_BRANCH: branch,
      },
    });

    await installDependencies(sandbox.id);
    
    // Clone the repository inside the sandbox
    await runCommandInSandbox(sandbox, `git clone --depth 1 --branch "${branch}" "$REPO_URL" /workspace`);

    return sandbox.id;
  } catch (error) {
    throw new Error(`Failed to create sandbox: ${parseError(error)}`, {
      cause: error,
    });
  }
};

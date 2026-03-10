import type { Sandbox } from "@alibaba-group/opensandbox";

import { parseError } from "@/lib/error";
import { collectOutput, connectToSandbox } from "@/lib/sandbox";

export const installDependencies = async (sandboxId: string): Promise<void> => {
  let sandbox: Sandbox | null = null;

  try {
    sandbox = await connectToSandbox(sandboxId);
  } catch (error) {
    throw new Error(
      `[installDependencies] Failed to get sandbox: ${parseError(error)}`,
      { cause: error }
    );
  }

  try {
    // Install GitHub CLI
    const ghInstall = await sandbox.commands.run(
      "command -v gh >/dev/null 2>&1 || (" +
        " apt update && apt install -y curl git gh)"
    );

    if (ghInstall.error) {
      console.error("GitHub CLI install error:", ghInstall.error.name, ghInstall.error.value, ghInstall.error.traceback);
      throw new Error(
        `Failed to install GitHub CLI: ${ghInstall.error.name}: ${ghInstall.error.value}`,
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to install project dependencies: ${parseError(error)}`,
      { cause: error }
    );
  } finally {
    sandbox?.close();
  }
};

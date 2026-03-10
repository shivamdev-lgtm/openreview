import { parseError } from "@/lib/error";
import { collectOutput, connectToSandbox } from "@/lib/sandbox";
import { runCommandInSandbox } from "./configure-git";
import type { RunCommandOpts } from "@alibaba-group/opensandbox";

export const commitAndPush = async (
  sandboxId: string,
  message: string,
  branchName?: string
): Promise<void> => {
  const sandbox = await connectToSandbox(sandboxId).catch((error: unknown) => {
    throw new Error(
      `[commitAndPush] Failed to get sandbox: ${parseError(error)}`,
      { cause: error }
    );
  });

  try {
    const opts: RunCommandOpts = {
      workingDirectory: "/workspace",
    }
    await runCommandInSandbox(sandbox, "git add -A", opts);

    const commitResult = await sandbox.commands.run(
      `git commit --no-verify -m "${message.replace(/"/g, '\\"')}"`, opts
    );

    const commitStderr = collectOutput(commitResult.logs.stderr);

    if (commitStderr.includes("nothing to commit")) {
      return;
    }

    const pushArgs = branchName ? `push origin ${branchName}` : "push";
    await runCommandInSandbox(sandbox, `git ${pushArgs}`, opts);
  } catch (error) {
    throw new Error(`Failed to commit and push: ${parseError(error)}`, {
      cause: error,
    });
  } finally {
    sandbox.close();
  }
};

import { parseError } from "@/lib/error";
import { collectOutput, connectToSandbox } from "@/lib/sandbox";

export const hasUncommittedChanges = async (
  sandboxId: string
): Promise<boolean> => {
  const sandbox = await connectToSandbox(sandboxId).catch((error: unknown) => {
    throw new Error(
      `[hasUncommittedChanges] Failed to get sandbox: ${parseError(error)}`,
      { cause: error }
    );
  });

  try {
    const diffResult = await sandbox.commands.run("git diff --name-only", {
      workingDirectory: "/workspace",
    });
    return Boolean(collectOutput(diffResult.logs.stdout).trim());
  } catch (error) {
    throw new Error(
      `[hasUncommittedChanges] Failed to check git diff: ${parseError(error)}`
    );
  } finally {
    sandbox.close();
  }
};

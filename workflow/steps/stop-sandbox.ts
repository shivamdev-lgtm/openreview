import { parseError } from "@/lib/error";
import { connectToSandbox } from "@/lib/sandbox";

export const stopSandbox = async (sandboxId: string): Promise<void> => {
  const sandbox = await connectToSandbox(sandboxId).catch((error: unknown) => {
    throw new Error(
      `[stopSandbox] Failed to get sandbox: ${parseError(error)}`,
      { cause: error }
    );
  });

  try {
    await sandbox.kill();
  } catch (error) {
    throw new Error(`Failed to stop sandbox: ${parseError(error)}`, {
      cause: error,
    });
  }
};

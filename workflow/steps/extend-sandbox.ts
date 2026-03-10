import { parseError } from "@/lib/error";
import { connectToSandbox } from "@/lib/sandbox";

const THREE_MINUTES_S = 3 * 60;

export const extendSandbox = async (sandboxId: string): Promise<void> => {
  const sandbox = await connectToSandbox(sandboxId).catch((error: unknown) => {
    throw new Error(
      `[extendSandbox] Failed to get sandbox: ${parseError(error)}`,
      { cause: error }
    );
  });

  try {
    await sandbox.renew(THREE_MINUTES_S);
  } catch (error) {
    throw new Error(`Failed to extend sandbox timeout: ${parseError(error)}`, {
      cause: error,
    });
  } finally {
    sandbox.close();
  }
};

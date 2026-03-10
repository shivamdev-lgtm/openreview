import type { RunCommandOpts, Sandbox } from "@alibaba-group/opensandbox";

import { parseError } from "@/lib/error";
import { connectToSandbox } from "@/lib/sandbox";

export const runCommandInSandbox = async (
  sandbox: Sandbox,
  command: string,
  options: RunCommandOpts | undefined = undefined 
): Promise<void> => {
  const cmd = await sandbox.commands.run(command, options);

  if (cmd.error) {
    console.error(`Error running command "${command}":`, cmd.logs.stdout.map((line) => line.text).join('\n'), cmd.logs.stderr.map((line) => line.text).join('\n'));
    throw new Error(
      `Command failed: ${command}. ${cmd.error.name}: ${cmd.error.value} ${cmd.error.traceback}`
    );
  }
};

const configureRemoteAndIdentity = async (
  sandbox: Sandbox,
  authenticatedUrl: string,
  token: string
): Promise<void> => {
  await runCommandInSandbox(
    sandbox,
    `git remote set-url origin "${authenticatedUrl}"`, { workingDirectory: "/workspace" }
  );

  await runCommandInSandbox(sandbox, "git config --local core.hooksPath /dev/null", { workingDirectory: "/workspace" });

  await runCommandInSandbox(sandbox, 'git config user.name "claryreviewer[bot]"', { workingDirectory: "/workspace" });

  await runCommandInSandbox(sandbox, 'git config user.email "claryreviewer[bot]@users.noreply.github.com"', { workingDirectory: "/workspace" });

  await runCommandInSandbox(
    sandbox,
    `export PATH="$HOME/.local/bin:$PATH" && echo "${token}" | gh auth login --with-token`, { workingDirectory: "/workspace" }
  );
};

export const configureGit = async (
  sandboxId: string,
  repoFullName: string,
  token: string
): Promise<void> => {
  const sandbox = await connectToSandbox(sandboxId).catch((error: unknown) => {
    throw new Error(
      `[configureGit] Failed to get sandbox: ${parseError(error)}`,
      { cause: error }
    );
  });

  const authenticatedUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;

  try {
    await configureRemoteAndIdentity(sandbox, authenticatedUrl, token);
  } catch (error) {
    console.error(`[configureGit] Error configuring git: ${parseError(error)}`);
    throw new Error(`Failed to configure git: ${parseError(error)}`, {
      cause: error,
    });
  } finally {
    sandbox.close();
  }
};

import { Sandbox } from "@alibaba-group/opensandbox";
import { addPRComment } from "./steps/add-pr-comment";
import { checkPushAccess } from "./steps/check-push-access";
import { commitAndPush } from "./steps/commit-and-push";
import { configureGit } from "./steps/configure-git";
import { createSandbox } from "./steps/create-sandbox";
import { extendSandbox } from "./steps/extend-sandbox";
import { getGitHubToken } from "./steps/get-github-token";
import { hasUncommittedChanges } from "./steps/has-uncommitted-changes";
import { installDependencies } from "./steps/install-dependencies";
import { runAgentStep } from "./steps/run-agent";
import { stopSandbox } from "./steps/stop-sandbox";
import { connectToSandbox } from "@/lib/sandbox";

export interface ThreadMessage {
  content: string;
  role: "assistant" | "user";
}

export interface WorkflowParams {
  baseBranch: string;
  messages: ThreadMessage[];
  prBranch: string;
  prNumber: number;
  repoFullName: string;
  threadId: string;
}

const detectInstallCommand = async (
  sandbox: Sandbox
): Promise<{ args: string; cmd: string }> => {
  const checks = [
    {
      args: "install --frozen-lockfile",
      cmd: "bun",
      lockfile: "bun.lock",
    },
    {
      args: "install --frozen-lockfile",
      cmd: "pnpm",
      lockfile: "pnpm-lock.yaml",
    },
    {
      args: "install --frozen-lockfile",
      cmd: "yarn",
      lockfile: "yarn.lock",
    },
  ];

  for (const { args, cmd, lockfile } of checks) {
    const result = await sandbox.commands.run(`test -f ${lockfile}`, {
      workingDirectory: "/workspace",
    });
    // `test -f` succeeds silently (no error) when the file exists
    if (!result.error) {
      return { args, cmd };
    }
  }

  return { args: "install", cmd: "npm" };
};

export const botWorkflow = async (params: WorkflowParams): Promise<void> => {
  const {
    baseBranch: _baseBranch,
    messages,
    prBranch,
    prNumber,
    repoFullName,
    threadId,
  } = params;

  const pushAccess = await checkPushAccess(repoFullName, prBranch);

  if (!pushAccess.canPush) {
    await addPRComment(
      threadId,
      `## Skipped

Unable to access this branch: ${pushAccess.reason}

Please ensure the OpenReview app has access to this repository and branch.`
    );

    throw new Error(pushAccess.reason ?? "Push access denied");
  }

  const token = await getGitHubToken();
  const sandboxId = await createSandbox(repoFullName, token, prBranch);

  try {
    await configureGit(sandboxId, repoFullName, token);
    await extendSandbox(sandboxId);

    const sandbox = await connectToSandbox(sandboxId);
    
    // Install project dependencies
    const { cmd, args } = await detectInstallCommand(sandbox);

    if (cmd !== "npm") {
      await sandbox.commands.run(`npm install -g ${cmd}`, {
        workingDirectory: "/workspace",
      });
    }

    await sandbox.commands.run(`${cmd} ${args}`, {
      workingDirectory: "/workspace",
    });

    const agentResult = await runAgentStep(
      sandboxId,
      messages,
      threadId,
      prNumber,
      repoFullName
    );

    if (!agentResult.success) {
      throw new Error(agentResult.errorMessage ?? "Agent failed to run");
    }

    const changed = await hasUncommittedChanges(sandboxId);

    if (changed) {
      await commitAndPush(sandboxId, "openreview: apply changes", prBranch);
    }
  } catch (error) {
    try {
      await addPRComment(
        threadId,
        `## Error

An error occurred while processing your request. Please try again later.
`
      );
    } catch {
      // Ignore comment failure
    }

    throw error;
  } finally {
    await stopSandbox(sandboxId);
  }
};

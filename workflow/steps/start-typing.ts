import { getBot } from "@/lib/bot";

export const startTyping = async (
  threadId: string,
  text: string
): Promise<void> => {
  const bot = await getBot();
  const adapter = bot.getAdapter("github");
  await adapter.startTyping(threadId, text);
};

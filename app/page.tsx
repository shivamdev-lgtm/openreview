import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Readme } from "./components/readme";

const Page = async () => {
  const content = await readFile(join(process.cwd(), "README.md"), "utf8");

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
      <main className="w-full max-w-2xl px-6 py-24">
        <Readme content={content} />
      </main>
    </div>
  );
};

export default Page;

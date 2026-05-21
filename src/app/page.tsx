import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bodyHtml = readFileSync(resolve(process.cwd(), "src/app/_body.html"), "utf8");

export default function Home() {
  return <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}

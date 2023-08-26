import * as Si from "npm:simple-icons";
import { pascalCase } from "npm:change-case";

// const buildDir = await Deno.makeTempDir();
const buildDir = "build";
try {
  await Deno.mkdir(buildDir);
} catch (_) {
  // Already exists...
}
console.info("Cloning heroicons...");
await new Deno.Command("git", {
  cwd: buildDir,
  args: ["clone", "git@github.com:tailwindlabs/heroicons.git"],
}).output();

let index = "";

const generateComponent = async (opts: { name: string; rawSvg: string }) => {
  const svg = opts.rawSvg
    .replaceAll(/-[a-z]/g, (x) => x.slice(1).toUpperCase())
    .replaceAll("ariaHidden", "aria-hidden")
    .replaceAll(/xmlns="[^"]+"/g, "class={props.class} title={props.title}");
  const component = `
  export const ${opts.name} = (props: { class?: string, title?: string }) => (
      ${svg}
  );
  `.trim();
  index += `export * from "./icons/${opts.name}.tsx";\n`;
  try {
    await Deno.mkdir("icons");
  } catch (_) {
    // Already exists...
  }
  await Deno.writeTextFile(`icons/${opts.name}.tsx`, component);
};

const processFolder = async (path: string) => {
  const dir = Deno.readDir(path);
  for await (const item of dir) {
    if (item.isDirectory) {
      await processFolder(`${path}/${item.name}`);
    } else {
      const kind = path.split("/").slice(-2).join("/");
      const suffix = {
        "20/solid": "Mini",
        "24/solid": "Solid",
        "24/outline": "Outline",
      }[kind];

      const svg = await Deno.readTextFile(`${path}/${item.name}`);
      const name =
        "Hi" +
        item.name
          .split("-")
          .map((s) => s.slice(0, 1).toUpperCase() + s.slice(1))
          .join("")
          .split(".")[0] +
        suffix;

      await generateComponent({ name, rawSvg: svg });
    }
  }
};

await Deno.remove("./icons/", { recursive: true });

await processFolder(`${buildDir}/heroicons/optimized`);

for (const item of Object.values(Si)) {
  if (!("slug" in item)) continue;

  const name = "Si" + pascalCase(item.title).replaceAll("_", "");
  if (name.match(/^[0-9]/)) {
    console.warn("skipping", item.title);
    continue;
  }

  await generateComponent({ name, rawSvg: item.svg });
}

await Deno.writeTextFile("lib/index.ts", index);

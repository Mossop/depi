const path = require("path");
const { promises: fs } = require("fs");

async function readFileLines(file) {
  let contents = await fs.readFile(file, {
    encoding: "utf8",
  });
  return contents.split("\n");
}

async function processFile(file) {
  console.log(`Processing "${file}"...`);
}

async function main() {
  if (process.argv.length != 3) {
    throw new Error(
      "Please pass the path to the source tree as an argument to this script."
    );
  }

  let root = path.resolve(process.argv[2]);

  try {
    let stat = await fs.stat(root);
    if (!stat.isDirectory()) {
      throw new Error(`"${root}" is not a directory.`);
    }
  } catch (e) {
    throw new Error(`Failed to access ${root}`);
  }

  let filelist = await readFileLines(path.join(__dirname, "filelist.txt"));

  for (let file of filelist) {
    if (file) {
      await processFile(path.join(root, file));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

const path = require("path");
const { promises: fs } = require("fs");
const sax = require("sax");

// const LINK_RE = /^(\s+)<(\w+:)?link\s.*rel="localization"/;
const HTML_URI = "http://www.w3.org/1999/xhtml";
const XUL_URI = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

async function readFileLines(file) {
  let contents = await fs.readFile(file, {
    encoding: "utf8",
  });
  return contents.split("\n");
}

async function processFile(file) {
  console.log(`Processing "${file}"...`);
  let lines = await readFileLines(file);

  let parser = sax.parser(true, {
    boolean: true,
    xmlns: true,
    position: true,
  });

  let xulPrefix = null;
  let htmlPrefix = null;
  let startTagLine = null;

  parser.onopentag = ({ name, attributes, ns }) => {
    for (let [prefix, uri] of Object.entries(ns)) {
      if (uri == HTML_URI) {
        htmlPrefix = prefix;
      } else if (uri == XUL_URI) {
        xulPrefix = prefix;
      }
    }

    startTagLine = parser.line;

    // We only care about the first tag.
    throw new Error("Bail out");
  };

  let parseable = lines.map((l) => (l.startsWith("#") ? "" : l)).join("\n");

  try {
    parser.write(parseable).close();
  } catch (e) {
    // Ignore
  }

  if (htmlPrefix === null) {
    throw new Error("No HTML namespace defined");
  }
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

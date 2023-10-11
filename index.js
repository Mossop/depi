const path = require("path");
const { promises: fs } = require("fs");
const sax = require("sax");

const STYLESHEET_RE = /^<\?xml-stylesheet\s.*href="([^"]+)"/;

// const LINK_RE = /^(\s+)<(\w+:)?link\s.*rel="localization"/;

const HTML_URI = "http://www.w3.org/1999/xhtml";
const XUL_URI = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

async function readFileLines(file) {
  let contents = await fs.readFile(file, {
    encoding: "utf8",
  });
  return contents.split("\n");
}

function prettyLink(indent, prefix, url) {
  let link = `${indent}<${prefix}link rel="stylesheet" href="${url}" />`;

  if (link.length > 80) {
    return `${indent}<${prefix}link
${indent}  rel="stylesheet"
${indent}  href="${url}"
${indent}/>`;
  }

  return link;
}

function insertStylesheets(lines, stylesheets) {
  // We need to use a parser to figure out the XML namespaces
  let parser = sax.parser(true, {
    boolean: true,
    xmlns: true,
    position: true,
  });

  let xulPrefixes = [];
  let htmlPrefixes = [];
  let afterStartTag = null;

  parser.onopentag = ({ name, attributes, ns }) => {
    for (let [prefix, uri] of Object.entries(ns)) {
      if (prefix) {
        prefix += ":";
      }

      if (uri == HTML_URI) {
        htmlPrefixes.push(prefix);
      } else if (uri == XUL_URI) {
        xulPrefixes.push(prefix);
      }
    }

    // The parser is currently looking at the `>` of the start tag. Use the next
    // line as a potential insertion point.
    afterStartTag = parser.line + 1;

    // We only care about the first tag.
    throw new Error("Bail out");
  };

  // Strip preprocessor instructions before attempting to parse.
  let parseable = lines.map((l) => (l.startsWith("#") ? "" : l)).join("\n");

  try {
    parser.write(parseable).close();
  } catch (e) {
    // Ignore
  }

  if (!htmlPrefixes.length) {
    throw new Error("No HTML namespace defined");
  }

  // Use the shortest prefix by default.
  htmlPrefixes.sort();
  let linkPrefix = htmlPrefixes[0];

  // First pass, attempt to find a <linkset> to insert into.
  for (let xulPrefix of xulPrefixes) {
    let linksetRe = new RegExp(`(\\s*)<${xulPrefix}linkset>`);
    for (let i = 0; i < lines.length; i++) {
      let matches = lines[i].match(linksetRe);
      if (matches !== null) {
        let indent = matches[1] + "  ";
        stylesheets = stylesheets.map((s) => prettyLink(indent, linkPrefix, s));

        // Add a linebreak between the stylesheets and the localization links.
        stylesheets.push("");

        lines.splice(i + 1, 0, ...stylesheets);

        return;
      }
    }
  }

  // Second pass, attempt to find another link element to use as a reference.
  for (let htmlPrefix of htmlPrefixes) {
    let linkRe = new RegExp(`(\\s*)<${htmlPrefix}link\\s`);
    for (let i = 0; i < lines.length; i++) {
      let matches = lines[i].match(linkRe);
      if (matches !== null) {
        let indent = matches[1];
        stylesheets = stylesheets.map((s) => prettyLink(indent, htmlPrefix, s));

        // Add a linebreak between the stylesheets and the localization links.
        stylesheets.push("");

        lines.splice(i, 0, ...stylesheets);

        return;
      }
    }
  }

  // Third pass, insert just after the start tag.
  console.warn("WARN: Inserting stylesheets inside document element");
  stylesheets = stylesheets.map((s) => prettyLink("  ", linkPrefix, s));

  // If the first line isn't already whitespace add an empty line after the
  // stylesheets.
  if (lines[afterStartTag]) {
    stylesheets.push("");
  }

  lines.splice(afterStartTag, 0, ...stylesheets);
}

async function processFile(file) {
  console.log(`Processing "${file}"...`);
  let lines = await readFileLines(file);

  let stylesheets = [];

  // First list all the stylesheets.
  for (let line of lines) {
    let matches = line.match(STYLESHEET_RE);
    if (matches !== null) {
      stylesheets.push(matches[1]);
    }
  }

  if (!stylesheets.length) {
    // Nothing to do here
    return;
  }

  insertStylesheets(lines, stylesheets);

  // Finally strip the processing instructions.
  let i = 0;
  while (i < lines.length) {
    while (lines[i].match(STYLESHEET_RE) !== null) {
      lines.splice(i, 1);

      // If the line before the PI was empty then strip any empty lines after the PI.
      while (i > 0 && i < lines.length - 1 && !lines[i - 1] && !lines[i]) {
        lines.splice(i, 1);
      }
    }

    i++;
  }
  lines = lines.filter((l) => l.match(STYLESHEET_RE) === null);

  // Write out the result.
  await fs.writeFile(file, lines.join("\n"));
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

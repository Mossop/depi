const path = require("path");
const fs = require("fs");

function processFile(file) {
  console.log(`Processing "${file}"...`);
}

if (process.argv.length != 3) {
  console.error(
    "Please pass the path to the source tree as an argument to this script."
  );
  process.exit(1);
}

let root = path.resolve(process.argv[2]);
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`"${process.argv[2]}" is not a directory.`);
}

let filelist = path.join(__dirname, "filelist.txt");
let files = fs.readFileSync(filelist, { encoding: "utf8" }).split("\n");

for (let file of files) {
  if (file) {
    processFile(path.join(root, file));
  }
}

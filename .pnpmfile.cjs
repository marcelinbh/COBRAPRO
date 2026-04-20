// This file is required to allow pnpm to run build scripts for native modules
// during the Digital Ocean build process
function readPackage(pkg, context) {
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};

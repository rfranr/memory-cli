module.exports = {
  forbidden: [
    { name: "no-circular", severity: "warn", from: {}, to: { circular: true } },
    { name: "no-unresolved", severity: "error", from: {}, to: { couldNotResolve: true } },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(node_modules|dist|coverage|\\.pi|\\.agentic-adoption)/" },
  },
};

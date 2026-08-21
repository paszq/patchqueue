/**
 * Reguly dla analizy grafu zaleznosci PatchQueue.
 *
 * Poza standardowymi (cykle, sieroty, brak modulu) pilnuja jednej rzeczy specyficznej
 * dla tego projektu: modul domenowy ma pozostac czysty. Regula priorytetu nie moze
 * siegac do bazy, HTTP ani warstwy widoku - inaczej przestanie byc testowalna w
 * izolacji i zacznie istniec w wielu miejscach naraz.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Cykl zaleznosci utrudnia zmiane: nie da sie przeczytac jednej strony bez drugiej.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment: "Modul, do ktorego nikt nie siega - kandydat do usuniecia albo martwy kod.",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "(^|/)(vitest|playwright|astro|eslint)\\.config\\."] },
      to: {},
    },
    {
      name: "domain-stays-pure",
      severity: "error",
      comment: "Modul domenowy nie siega do bazy, HTTP ani widoku.",
      from: { path: "^src/lib/domain" },
      to: { path: "^(src/pages|src/components|src/lib/services|src/lib/supabase|src/middleware)" },
    },
    {
      name: "domain-no-external-io",
      severity: "error",
      comment: "Modul domenowy nie zalezy od bibliotek dostepu do danych ani frameworka.",
      from: { path: "^src/lib/domain" },
      to: { dependencyTypes: ["npm"], pathNot: "^(zod)$" },
    },
    {
      name: "no-deprecated-core",
      severity: "warn",
      from: {},
      to: { dependencyTypes: ["core"], path: "^(punycode|domain|constants|sys)$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "node_modules|\\.astro/" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] },
    reporterOptions: { dot: { collapsePattern: "node_modules/(@[^/]+/[^/]+|[^/]+)" } },
  },
};

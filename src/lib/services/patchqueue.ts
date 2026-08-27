/**
 * Punkt wejścia warstwy danych.
 *
 * Warstwa była wcześniej jednym plikiem na 335 linii, skupiającym mapowanie wierszy,
 * operacje na trzech pojęciach domenowych i budowanie kolejki. Została rozdzielona
 * wzdłuż tych pojęć, a ten plik pozostał jako punkt wejścia — dzięki temu podział nie
 * wymusił zmiany w żadnym z dziewięciu modułów, które z niej korzystają.
 *
 * Nowy kod może importować wprost z modułów szczegółowych; ten plik istnieje po to,
 * żeby refaktor był odwracalny i nie rozlał się na resztę repozytorium za jednym razem.
 */
export { DataAccessError } from "./rows";
export type { AssetInput } from "./assets";
export { createAsset, deleteAsset, getAsset, listAssets, listAssetsWithOpenItems, updateAsset } from "./assets";
export type { VulnerabilityInput } from "./vulnerabilities";
export {
  createVulnerability,
  deleteVulnerability,
  listVulnerabilitiesForAsset,
  updateVulnerability,
} from "./vulnerabilities";
export type { DecisionInput } from "./decisions";
export { listDecisions, recordDecision } from "./decisions";
export { buildEntry, getVulnerabilityWithAsset, loadMonitoredAsset, loadQueue } from "./queue";

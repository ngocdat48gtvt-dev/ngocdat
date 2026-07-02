import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DH = path.resolve(__dirname, "../../dieu-hanh-web/src");
const OUT = path.resolve(__dirname, "../src/lib");

const MAP = {
  "lib/incidentFilters.ts": "incidentFilters.js",
  "lib/incidentStats.ts": "incidentStats.js",
  "lib/excelReportBuilder.ts": "excelReportBuilder.js",
  "lib/wordReportBuilder.ts": "wordReportBuilder.js",
  "services/incidentExportService.ts": "../services/incidentExportService.js"
};

function stripTs(src) {
  let s = src;
  s = s.replace(/^import type .+$/gm, "");
  s = s.replace(/^export interface .+$/gm, "");
  s = s.replace(/^type \w+ = \{[\s\S]*?\n\}/gm, "");
  s = s.replace(/: IncidentRecord\[\]/g, "");
  s = s.replace(/: IncidentRecord/g, "");
  s = s.replace(/: DispatchFilters/g, "");
  s = s.replace(/: WordExportOptions/g, "");
  s = s.replace(/: WordBuildResult/g, "");
  s = s.replace(/: VolumeByUnit/g, "");
  s = s.replace(/: DispatchSummary/g, "");
  s = s.replace(/: RoadSummary/g, "");
  s = s.replace(/: PreparedImage/g, "");
  s = s.replace(/: SectionState/g, "");
  s = s.replace(/: SheetStyles/g, "");
  s = s.replace(/<T extends \{ km\?: string; road\?: string \}>/g, "");
  s = s.replace(/: T\[\]/g, "");
  s = s.replace(/: T/g, "");
  s = s.replace(/: number/g, "");
  s = s.replace(/: string/g, "");
  s = s.replace(/: boolean/g, "");
  s = s.replace(/: Date \| null/g, "");
  s = s.replace(/: Date/g, "");
  s = s.replace(/Promise<ExcelJS\.Workbook>/g, "Promise");
  s = s.replace(/Promise<WordBuildResult>/g, "Promise");
  s = s.replace(/Partial<ExcelJS\.[^>]+>/g, "");
  s = s.replace(/ExcelJS\.(Cell|Row|Worksheet|Workbook|Style|Borders|Font)/g, "Object");
  s = s.replace(/ as const/g, "");
  s = s.replace(/@\/lib\//g, "./");
  s = s.replace(/@\/types\/incident/g, "");
  s = s.replace(/from '\.\/'\n/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

fs.mkdirSync(OUT, { recursive: true });

for (const [rel, outRel] of Object.entries(MAP)) {
  const srcPath = path.join(DH, rel);
  const outPath = path.resolve(__dirname, "../src", outRel.replace(/^\.\.\//, ""));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const raw = fs.readFileSync(srcPath, "utf8");
  fs.writeFileSync(outPath, stripTs(raw), "utf8");
  console.log("Wrote", outPath);
}

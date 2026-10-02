import { DEFAULT_PEN_PRESETS } from "./src/utils/presetData";
import { strokePointsToOutline, contoursToSvgPath } from "./src/utils/pathUtils";

const preset = DEFAULT_PEN_PRESETS[0];

// Let us test an S-curve stroke
const pts: any[] = [];
const numPoints = 80;
const startX = 40;
const endX = 440;

for (let i = 0; i <= numPoints; i++) {
  const t = i / numPoints;
  const x = startX + t * (endX - startX);
  const y = 50 - Math.sin(t * Math.PI * 2) * 20;
  const pres = Math.sin(t * Math.PI) * 0.7 + 0.3;
  pts.push({ x, y, pressure: pres, time: t * 1000 });
}

console.log("Ready to test with pathUtils modifications");

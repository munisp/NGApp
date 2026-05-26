/**
 * lasParser.ts — Server-side LAS 2.0 file parser
 * Uses Python lasio library via subprocess for robust LAS parsing.
 * Exposes POST /api/las/parse endpoint (multipart/form-data, field: "file").
 *
 * Returns: { header, curves, data, memSuggestions }
 */
import express from "express";
import multer from "multer";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);
export const lasParserRouter = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `las_${Date.now()}_${file.originalname}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".las", ".LAS", ".txt"];
    const ext = path.extname(file.originalname);
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only .las files are accepted"));
  },
});

const PARSE_SCRIPT = `
import sys, json, lasio, numpy as np

def safe(v):
    if v is None: return None
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)): return None
    return v

las_path = sys.argv[1]
las = lasio.read(las_path)

header = {
    "well": {k: str(v.value) for k, v in las.well.items()},
    "params": {k: str(v.value) for k, v in las.params.items()},
    "version": {k: str(v.value) for k, v in las.version.items()},
}

curves = []
for c in las.curves:
    curves.append({
        "mnemonic": c.mnemonic,
        "unit": c.unit,
        "description": c.descr,
        "data": [safe(float(v)) for v in c.data[:500]],  # first 500 samples
    })

# MEM auto-population suggestions based on standard curve mnemonics
mem_map = {
    "RHOB": {"field": "bulkDensityGcc", "label": "Bulk Density (g/cc)"},
    "DT":   {"field": "sonicTransitTimeUsft", "label": "Sonic Transit Time (us/ft)"},
    "DTS":  {"field": "shearTransitTimeUsft", "label": "Shear Transit Time (us/ft)"},
    "GR":   {"field": "gammaRayApi", "label": "Gamma Ray (API)"},
    "NPHI": {"field": "neutronPorosityFrac", "label": "Neutron Porosity (fraction)"},
    "CALI": {"field": "caliperIn", "label": "Caliper (in)"},
    "PRES": {"field": "formationPressurePsi", "label": "Formation Pressure (psi)"},
    "PP":   {"field": "porePressurePsi", "label": "Pore Pressure (psi)"},
    "OBG":  {"field": "overburdenGradientPsiPerFt", "label": "Overburden Gradient (psi/ft)"},
    "DEPT": {"field": "depthFt", "label": "Depth (ft)"},
    "DEPTH":{"field": "depthFt", "label": "Depth (ft)"},
    "MD":   {"field": "depthFt", "label": "Measured Depth (ft)"},
}
mem_suggestions = []
for c in las.curves:
    mn = c.mnemonic.upper().strip()
    if mn in mem_map:
        mem_suggestions.append({
            "curveMnemonic": c.mnemonic,
            "curveUnit": c.unit,
            "memField": mem_map[mn]["field"],
            "memLabel": mem_map[mn]["label"],
        })

depth_curve = None
for c in las.curves:
    if c.mnemonic.upper() in ("DEPT","DEPTH","MD"):
        depth_curve = [safe(float(v)) for v in c.data[:500]]
        break

print(json.dumps({
    "header": header,
    "curves": curves,
    "depthCurve": depth_curve,
    "memSuggestions": mem_suggestions,
    "totalSamples": len(las.curves[0].data) if las.curves else 0,
    "curveCount": len(las.curves),
}))
`;

lasParserRouter.post("/parse", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No LAS file uploaded" });
    return;
  }
  const scriptPath = path.join(os.tmpdir(), `las_parse_${Date.now()}.py`);
  try {
    fs.writeFileSync(scriptPath, PARSE_SCRIPT);
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${req.file.path}"`,
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );
    if (stderr && !stdout) {
      res.status(500).json({ error: "LAS parse error", detail: stderr.slice(0, 500) });
      return;
    }
    const result = JSON.parse(stdout);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to parse LAS file", detail: err.message?.slice(0, 300) });
  } finally {
    try { fs.unlinkSync(req.file!.path); } catch {}
    try { fs.unlinkSync(scriptPath); } catch {}
  }
});

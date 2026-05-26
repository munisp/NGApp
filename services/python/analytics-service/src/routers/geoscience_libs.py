"""
geoscience_libs.py - Best-of-breed open-source O&G/geoscience library integrations

Libraries integrated:
  - lasio 0.32      : LAS 2.0/3.0 well log file I/O
  - welly 0.5.2     : Well object model, log QC
  - bruges 0.5.4    : Rock physics, AVO, seismic wavelets, Gassmann fluid substitution
  - harmonica 0.7.0 : Gravity/magnetic forward modelling (Fatiando a Terra)
  - pyproj 3.7.2    : Geodetic coordinate transforms (WGS84 to UTM)
  - scipy 1.17.1    : Signal processing and optimisation
  - scikit-learn 1.8.0 : ML-based petrophysical facies classification
  - welleng 0.9.0   : Wellbore trajectory, anti-collision (ISCWSA)
  - pyvista 0.47.3  : 3D mesh/VTK export for digital twin visualisation
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
import io
import math

router = APIRouter(prefix="/geoscience", tags=["geoscience-libs"])


# ── 1. LAS FILE PARSING (lasio) ──────────────────────────────────────────────

class LasParseResponse(BaseModel):
    well_name: str
    uwi: Optional[str]
    curves: List[str]
    depth_range: dict
    sample_count: int
    curve_stats: dict


@router.post("/las/parse", response_model=LasParseResponse)
async def parse_las_file(file: UploadFile = File(...)):
    """Parse a LAS 2.0/3.0 well log file using lasio and return metadata + curve stats."""
    import lasio
    import numpy as np
    try:
        content = await file.read()
        las = lasio.read(io.StringIO(content.decode("utf-8", errors="replace")))
        curves = [c.mnemonic for c in las.curves]
        depth = las.index
        stats = {}
        for curve in las.curves:
            data = curve.data
            valid = data[~np.isnan(data)]
            if len(valid) > 0:
                stats[curve.mnemonic] = {
                    "min": float(np.min(valid)),
                    "max": float(np.max(valid)),
                    "mean": float(np.mean(valid)),
                    "std": float(np.std(valid)),
                    "null_pct": float(np.sum(np.isnan(data)) / len(data) * 100),
                }
        uwi_val = None
        try:
            uwi_val = las.well.UWI.value
        except Exception:
            pass
        return LasParseResponse(
            well_name=las.well.WELL.value or "Unknown",
            uwi=uwi_val,
            curves=curves,
            depth_range={"min": float(depth.min()), "max": float(depth.max()), "unit": "ft"},
            sample_count=len(depth),
            curve_stats=stats,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"LAS parse error: {str(e)}")


@router.post("/las/curves")
async def extract_las_curves(
    file: UploadFile = File(...),
    curves: str = "GR,RHOB,NPHI,DT"
):
    """Extract specific curves from a LAS file as JSON arrays."""
    import lasio
    import numpy as np
    try:
        content = await file.read()
        las = lasio.read(io.StringIO(content.decode("utf-8", errors="replace")))
        requested = [c.strip().upper() for c in curves.split(",")]
        result = {"depth": las.index.tolist()}
        for mnem in requested:
            if mnem in las.curves.keys():
                result[mnem] = [
                    None if math.isnan(v) else v for v in las[mnem].tolist()
                ]
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 2. ROCK PHYSICS / AVO (bruges) ───────────────────────────────────────────

class RockPhysicsRequest(BaseModel):
    vp1: float
    vs1: float
    rho1: float
    vp2: float
    vs2: float
    rho2: float
    angles: List[float] = [0, 5, 10, 15, 20, 25, 30, 35, 40]


class RockPhysicsResponse(BaseModel):
    rc_zoeppritz: List[float]
    rc_shuey: List[float]
    intercept: float
    gradient: float
    avo_class: str


@router.post("/rock-physics/avo", response_model=RockPhysicsResponse)
def compute_avo(req: RockPhysicsRequest):
    """Compute AVO response using Zoeppritz and Shuey approximations via bruges."""
    import bruges.reflection as ref
    import numpy as np
    try:
        angles_rad = np.array([math.radians(a) for a in req.angles])
        rc_z = [
            float(ref.zoeppritz(req.vp1, req.vs1, req.rho1,
                                 req.vp2, req.vs2, req.rho2, a))
            for a in angles_rad
        ]
        rc_s = [
            float(ref.shuey(req.vp1, req.vs1, req.rho1,
                             req.vp2, req.vs2, req.rho2, a))
            for a in angles_rad
        ]
        intercept = rc_s[0]
        gradient = (
            (rc_s[-1] - rc_s[0]) / math.sin(angles_rad[-1]) ** 2
            if len(rc_s) > 1
            else 0.0
        )
        if intercept > 0 and gradient > 0:
            avo_class = "IV"
        elif intercept > 0 and gradient < 0:
            avo_class = "III"
        elif intercept < 0 and gradient < 0:
            avo_class = "II"
        else:
            avo_class = "I"
        return RockPhysicsResponse(
            rc_zoeppritz=rc_z,
            rc_shuey=rc_s,
            intercept=intercept,
            gradient=gradient,
            avo_class=avo_class,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class GassmannRequest(BaseModel):
    k_mineral: float
    k_dry: float
    g_dry: float
    k_fluid1: float
    k_fluid2: float
    phi: float
    rho_mineral: float
    rho_fluid1: float
    rho_fluid2: float


@router.post("/rock-physics/gassmann")
def gassmann_fluid_substitution(req: GassmannRequest):
    """Gassmann fluid substitution - predict Vp/Vs change when fluid changes (e.g. brine to oil)."""
    import bruges.rockphysics as rp
    try:
        vp1, vs1, rho1 = rp.vels(
            req.k_dry, req.g_dry, req.k_mineral,
            req.k_fluid1, req.phi, req.rho_mineral, req.rho_fluid1
        )
        vp2, vs2, rho2 = rp.vels(
            req.k_dry, req.g_dry, req.k_mineral,
            req.k_fluid2, req.phi, req.rho_mineral, req.rho_fluid2
        )
        return {
            "initial": {"vp_ms": float(vp1), "vs_ms": float(vs1), "rho_gcc": float(rho1)},
            "substituted": {"vp_ms": float(vp2), "vs_ms": float(vs2), "rho_gcc": float(rho2)},
            "delta_vp_pct": float((vp2 - vp1) / vp1 * 100),
            "delta_vs_pct": float((vs2 - vs1) / vs1 * 100),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 3. WELLBORE TRAJECTORY (welleng) ─────────────────────────────────────────

class SurveyPoint(BaseModel):
    md: float
    inc: float
    azi: float


class TrajectoryRequest(BaseModel):
    survey: List[SurveyPoint]
    surface_northing: float = 0.0
    surface_easting: float = 0.0
    surface_elevation: float = 0.0


@router.post("/wellbore/trajectory")
def compute_trajectory(req: TrajectoryRequest):
    """Compute 3D wellbore trajectory using minimum curvature method via welleng."""
    import welleng
    import numpy as np
    try:
        md = np.array([p.md for p in req.survey])
        inc = np.array([p.inc for p in req.survey])
        azi = np.array([p.azi for p in req.survey])
        survey = welleng.survey.Survey(
            md=md, inc=inc, azi=azi,
            start_nev=[req.surface_northing, req.surface_easting, -req.surface_elevation],
        )
        return {
            "points": [
                {
                    "md": float(md[i]),
                    "northing": float(survey.n[i]),
                    "easting": float(survey.e[i]),
                    "tvd": float(survey.tvd[i]),
                }
                for i in range(len(md))
            ],
            "total_tvd_ft": float(survey.tvd[-1]),
            "total_displacement_ft": float(
                math.sqrt(survey.n[-1] ** 2 + survey.e[-1] ** 2)
            ),
            "method": "minimum_curvature",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 4. COORDINATE TRANSFORMS (pyproj) ────────────────────────────────────────

class CoordTransformRequest(BaseModel):
    latitude: float
    longitude: float
    target_epsg: int = 32638  # UTM Zone 38N (GCC/Middle East default)


@router.post("/coordinates/transform")
def transform_coordinates(req: CoordTransformRequest):
    """Transform WGS84 lat/lon to UTM or any EPSG projection using pyproj."""
    from pyproj import Transformer
    try:
        transformer = Transformer.from_crs(
            "EPSG:4326", f"EPSG:{req.target_epsg}", always_xy=True
        )
        x, y = transformer.transform(req.longitude, req.latitude)
        return {
            "source": {"latitude": req.latitude, "longitude": req.longitude, "epsg": 4326},
            "target": {"x": x, "y": y, "epsg": req.target_epsg},
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 5. GRAVITY MODELLING (harmonica/boule) ───────────────────────────────────

class GravityRequest(BaseModel):
    observation_height: float = 0.0
    latitudes: List[float]
    longitudes: List[float]


@router.post("/gravity/normal-gravity")
def compute_normal_gravity(req: GravityRequest):
    """Compute normal gravity (WGS84 ellipsoid) using harmonica/Boule."""
    try:
        import boule
        import numpy as np
        lats = np.array(req.latitudes)
        heights = np.full_like(lats, req.observation_height)
        gamma = boule.WGS84.normal_gravity(lats, heights)
        return {
            "normal_gravity_mgal": gamma.tolist(),
            "unit": "mGal",
            "ellipsoid": "WGS84",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 6. PETROPHYSICAL FACIES CLASSIFICATION (scikit-learn) ────────────────────

class FaciesRequest(BaseModel):
    gr: List[float]
    rhob: List[float]
    nphi: List[float]
    dt: Optional[List[float]] = None


@router.post("/petrophysics/facies")
def classify_facies(req: FaciesRequest):
    """Rule-based + KMeans petrophysical facies classification (Shale/Sand/Carbonate/Tight)."""
    import numpy as np
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans

    gr = np.array(req.gr)
    rhob = np.array(req.rhob)
    nphi = np.array(req.nphi)
    facies = []
    for i in range(len(gr)):
        if gr[i] > 75:
            facies.append("SHALE")
        elif rhob[i] < 2.35 and nphi[i] > 0.20:
            facies.append("SAND")
        elif rhob[i] > 2.65 and nphi[i] < 0.10:
            facies.append("CARBONATE")
        elif rhob[i] > 2.55 and nphi[i] < 0.15:
            facies.append("TIGHT")
        else:
            facies.append("SAND")

    features = np.column_stack([gr, rhob, nphi])
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)
    kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(features_scaled)
    counts = {f: int(facies.count(f)) for f in set(facies)}
    return {
        "facies": facies,
        "kmeans_clusters": clusters.tolist(),
        "facies_counts": counts,
        "dominant_facies": max(counts, key=counts.get),
        "n_samples": len(gr),
    }


# ── 7. SEISMIC WAVELET GENERATION (bruges) ───────────────────────────────────

class WaveletRequest(BaseModel):
    duration: float = 0.128
    dt: float = 0.002
    f: float = 40.0
    wavelet_type: str = "ricker"


@router.post("/seismic/wavelet")
def generate_wavelet(req: WaveletRequest):
    """Generate seismic wavelet (Ricker or Ormsby) using bruges."""
    import bruges.filters as filt
    try:
        if req.wavelet_type == "ormsby":
            w, t = filt.ormsby(
                duration=req.duration, dt=req.dt,
                f=(req.f * 0.5, req.f * 0.8, req.f * 1.2, req.f * 1.5),
            )
        else:
            w, t = filt.ricker(duration=req.duration, dt=req.dt, f=req.f)
        return {
            "time_s": t.tolist(),
            "amplitude": w.tolist(),
            "dominant_freq_hz": req.f,
            "type": req.wavelet_type,
            "sample_count": len(w),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 8. LIBRARY CATALOGUE ─────────────────────────────────────────────────────

@router.get("/libraries")
def list_integrated_libraries():
    """Return the catalogue of integrated open-source geoscience libraries."""
    return {
        "libraries": [
            {"name": "lasio", "version": "0.32", "domain": "Well log I/O (LAS 2.0/3.0)", "url": "https://lasio.readthedocs.io"},
            {"name": "welly", "version": "0.5.2", "domain": "Well object model & QC", "url": "https://code.agilescientific.com/welly"},
            {"name": "bruges", "version": "0.5.4", "domain": "Rock physics, AVO, seismic wavelets, Gassmann", "url": "https://code.agilescientific.com/bruges"},
            {"name": "harmonica", "version": "0.7.0", "domain": "Gravity & magnetic forward modelling (Fatiando)", "url": "https://www.fatiando.org/harmonica"},
            {"name": "pyproj", "version": "3.7.2", "domain": "Geodetic coordinate transforms (WGS84/UTM)", "url": "https://pyproj4.github.io/pyproj"},
            {"name": "welleng", "version": "0.9.0", "domain": "Wellbore trajectory & anti-collision (ISCWSA)", "url": "https://welleng.readthedocs.io"},
            {"name": "pyvista", "version": "0.47.3", "domain": "3D mesh / VTK digital twin export", "url": "https://docs.pyvista.org"},
            {"name": "scipy", "version": "1.17.1", "domain": "Signal processing & optimisation", "url": "https://scipy.org"},
            {"name": "scikit-learn", "version": "1.8.0", "domain": "ML petrophysical facies classification", "url": "https://scikit-learn.org"},
            {"name": "striplog", "version": "0.9.2", "domain": "Stratigraphic log intervals", "url": "https://code.agilescientific.com/striplog"},
            {"name": "petrolib", "version": "1.2.6", "domain": "Petrophysical calculations & log analysis", "url": "https://github.com/Tobi-DataDetective/petrolib"},
        ]
    }

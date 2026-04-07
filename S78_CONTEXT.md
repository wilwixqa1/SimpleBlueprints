# Session 78 Context File

## S78 Status: Google Solar API Integration + Architecture Simplification

### Summary

S78 integrated the Google Solar API as the primary building data source, replacing Overpass for building dimensions and positioning. Overpass is now only used for road detection (name + bearing for lot rotation) and secondary structures. Multiple iterations refined the architecture from hybrid merge to Solar-only building data after discovering Overpass polygon data was unreliable (wrong building matches, bad aspect ratios).

Key outcome: building dimensions are now more accurate and the codebase is simpler. The bbox inflation correction handles rotated buildings. Next session should consider removing lot rotation entirely (label street on correct edge instead of rotating to bottom) to eliminate the largest remaining source of complexity and bugs.

---

### What Was Built (7 commits, 2 files changed)

**backend/app/main.py:**

1. **Google Solar API integration** (commit 25e10a8):
   - Added `GOOGLE_SOLAR_API_KEY` env var
   - Added `_google_solar_lookup(lat, lng
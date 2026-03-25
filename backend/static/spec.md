# SimpleBlueprints Parameter Specification

## Purpose
This file is the canonical reference for how the parametric deck planning system works.
It serves as: (1) Developer documentation, (2) AI context for extraction/chat/automation,
(3) Validation rules for user input.

When building AI prompts, include the relevant sections of this spec so the AI understands
the data contract, coordinate system, and solver behavior.

## Coordinate System
- Origin: SW corner of lot = (0, 0), bottom-left at street
- X-axis: Increases left to right (east)
- Y-axis: Increases from street toward rear (north)
- Street edge is placed along y = 0 (bottom of viewport)
- All measurements in feet

## Lot System

### lotWidth (number, default: 80, range: 30-300)
Lot width in feet (east-west along street). Only used when lotEdges is null (rectangular lot).

### lotDepth (number, default: 120, range: 50-400)
Lot depth in feet (north-south, street to rear). Only used when lotEdges is null.

### lotEdges (array | null, default: null)
Clockwise boundary segments starting from the street-facing edge.
When set, the polygon solver computes lotVertices and the viewport scales to the polygon bounding box.
When null, the system uses a rectangular lot from lotWidth/lotDepth.

Edge object schema:
- length: number (feet, required)
- type: "street" | "property" (required)
- setbackType: "front" | "rear" | "side" | "none" (required, default "side")
- label: string (street name for street edges, empty for property edges)
- neighborLabel: string (adjacent lot number for property edges, empty for street edges)
- bearing: string | null (survey bearing, e.g. "N 45 30' E")
- angle: number | null (interior angle in degrees at vertex where this edge meets the next)

CRITICAL: Edge 0 MUST be the street-facing edge. The solver places edge 0 along y=0.
If the street runs along a short side, edge 0 is that short side. Getting this wrong
produces a rotated/distorted site plan.

Side effects:
- Setting lotEdges triggers computePolygonVerts() to compute lotVertices
- Clearing lotEdges (or changing lotWidth/lotDepth) resets lotVertices to null
- Only use NEIGHBORING lot numbers in labels, never the subject property lot number

### lotVertices (array | null, default: null)
Computed polygon vertices [[x,y], ...] in lot coordinates. Never set directly by users.
Always computed via computePolygonVerts(lotEdges).

## Solver: computePolygonVerts(edges)

Four solver paths in priority order:

### Path 1: Bearing-based (exact)
Trigger: All edges have a non-null, parseable bearing field.
Method: Parse each bearing (e.g. "N 45 E") to a math heading, walk edge lengths from origin.
Accuracy: Exact, limited only by survey measurement precision.
Bearing format: "N/S [degrees] [minutes'] [seconds"] E/W"

### Path 2: Angle-based (good)
Trigger: All edges have a non-null angle > 0 (but no bearings).
Method: Start heading east (0 rad). At each vertex, turn by exterior angle = 180 - interior_angle.
Closure error distributed proportionally across all vertices.
Accuracy: Good for most lots. The AI estimates angles from the survey drawing.
Note: angle on edge[i] = interior angle at the vertex where edge i meets edge i+1.

### Path 3: 4-edge trapezoid (good for quads)
Trigger: Exactly 4 edges, no bearings or angles.
Method: Closed-form. Edge 0 = south base at y=0. Solves vertex positions from side lengths.
Accuracy: Exact for trapezoids. May distort for very irregular quadrilaterals.

### Path 4: Equal-angle fallback (approximate)
Trigger: 5+ edges, no bearings or angles.
Method: Equal exterior angle distribution (2*PI/n per turn).
Accuracy: POOR for lots that are not regular polygons. Last resort only.

### Area Validation
After computing vertices, compare shoelace area to the survey-stated lot area.
If divergence exceeds 10%, the solver result is likely inaccurate. Warn the user.
Shoelace formula: area = 0.5 * |sum(x[i]*y[i+1] - x[i+1]*y[i])|

## House Positioning

### houseWidth (number, default: 40, range: 20-80)
House width in feet (east-west dimension).

### houseDepth (number, default: 30, range: 20-60)
House depth in feet (north-south dimension).

### houseOffsetSide (number, default: 20, range: 5 to lotWidth-houseWidth-5)
Distance from left (west) property line to house left wall.

### houseDistFromStreet (number | null, default: null)
Distance from street to house front wall. Must be >= setbackFront. If null, uses setbackFront.

## Setbacks

### setbackFront (number, default: 25, range: 0-50)
Front setback requirement from zoning code.

### setbackRear (number, default: 20, range: 0-50)
Rear setback requirement.

### setbackSide (number, default: 5, range: 0-30)
Side setback requirement (applies to both sides uniformly).

## Deck Positioning

### width (number, default: 20, range: 8-50)
Deck width in feet (along house wall).

### depth (number, default: 12, range: 6-24)
Deck depth in feet (perpendicular from house wall).

### height (number, default: 4, range: 1-14)
Deck surface height above grade in feet.

### deckOffset (number, default: 0, range: -houseWidth/2 to +houseWidth/2)
Horizontal offset of deck center relative to house center.
Positive = shift right (east), Negative = shift left (west).

### attachment (string, default: "ledger")
"ledger" = attached to house via ledger board. "freestanding" = independent structure.

## Street and Orientation

### streetName (string, default: "")
Name of the street the property faces. Rendered below the site plan.

### northAngle (number, default: 0, range: 0-359)
Compass direction of north in degrees clockwise from screen-up.
0 = north is up, 90 = north is right, 180 = north is down.

## AI Extraction Contract

When extracting from a property survey or plat map, the AI should:

1. Identify the street-facing edge first (street names, road, sidewalk, curb)
2. Enumerate edges clockwise from the street edge
3. For each edge: extract length, type, setback type, labels, bearing if shown
4. Estimate the interior angle at each vertex from the visual
5. Extract stated lot area from area tabulations
6. Do NOT use the subject property lot number as a neighbor label
7. Edge 0 = street-facing edge (this determines viewport orientation)
8. For curved edges, use arc length (L value) as the length

## Structural System (stub - expand in future sessions)

Deck structure is computed by calcStructure() in engine.js / calc_engine.py.
Posts sit at the beam line (y = deckY + depth - 1.5').
Stairs frame into the rim joist (y = deckY + depth).
Posts and stairs are in different planes and do not collide.

## Zone System (stub - expand in future sessions)

Multi-zone deck support via p.zones array. Each zone has type ("add" or "cutout"),
dimensions, attachEdge, and attachOffset. Zone 0 is always the main deck.

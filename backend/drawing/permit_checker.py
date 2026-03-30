"""
permit_checker.py - Permit Plan Completeness Checker

Registry-based validation system that checks structural code compliance,
drawing completeness, and capability gaps before/during PDF generation.

Architecture:
  - Checks are pure functions decorated with metadata (product type,
    conditions, severity, sheet, code reference).
  - The registry dispatches checks based on product_type and active
    conditions derived from the configuration.
  - Adding a new product type (porch, pergola, shed, garage) is purely
    additive: create new check functions, tag them, register them.
    Existing deck checks are never modified.
  - Shared checks (footings, setbacks) are tagged with multiple product
    types and tested via the configuration matrix.

Layers:
  1. Structural/Code Compliance - does the math comply with IRC?
  2. Drawing Completeness - are required elements present per sheet?
  3. Capability Gaps - can our engine produce correct output for this config?

Future extension points:
  - Jurisdiction profiles: add conditions like "jurisdiction:colorado_springs"
  - Material types: add conditions like "material:steel"
  - Professional review: PermitReport includes all data a reviewer needs
  - Versioning: report is serializable and storable with generation record
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, List, Callable
import math


# ============================================================
# DATA MODEL
# ============================================================

@dataclass
class CheckResult:
    id: str                          # e.g. "IRC_JOIST_SPAN"
    category: str                    # "structural", "drawing", "capability"
    sheet: str                       # "A-1", "A-3", "all", "engine"
    severity: str                    # "error", "warning", "info"
    status: str                      # "pass", "fail", "unsupported", "skip"
    message: str                     # Human-readable description
    detail: str = ""                 # Specific values
    fix: Optional[str] = None        # Actionable fix instruction
    code_ref: Optional[str] = None   # IRC reference
    fix_step: Optional[int] = None   # Wizard step to navigate to for fix


@dataclass
class PermitReport:
    product_type: str = ""                 # "deck", "porch", "pergola", etc.
    overall_status: str = ""               # "ready", "warnings", "not_ready", "unsupported"
    checks: List[CheckResult] = field(default_factory=list)
    config_tags: List[str] = field(default_factory=list)
    capability_gaps: List[CheckResult] = field(default_factory=list)
    passed: int = 0
    failed: int = 0
    warnings: int = 0
    total_applicable: int = 0
    readiness_pct: float = 0.0
    summary: str = ""
    # Future: jurisdiction, version_id, reviewer_notes


def report_to_dict(report):
    """Serialize PermitReport for JSON API response and storage."""
    return {
        "product_type": report.product_type,
        "overall_status": report.overall_status,
        "config_tags": report.config_tags,
        "passed": report.passed,
        "failed": report.failed,
        "warnings": report.warnings,
        "total_applicable": report.total_applicable,
        "readiness_pct": report.readiness_pct,
        "summary": report.summary,
        "checks": [asdict(c) for c in report.checks],
        "capability_gaps": [asdict(c) for c in report.capability_gaps],
    }


# ============================================================
# CHECK REGISTRY
# ============================================================

_CHECK_REGISTRY = []


def check(
    id: str,
    products: list,
    category: str,
    sheet: str = "engine",
    severity: str = "error",
    code_ref: str = None,
    conditions: list = None,
):
    """
    Decorator to register a permit check function.

    The decorated function receives (params, calc, spec) and returns
    a CheckResult. If conditions is None or ["always"], the check
    runs for all configurations of the tagged product types.

    Condition strings match against config_tags derived from the
    actual configuration. Examples:
      "ledger"           - attachment == ledger
      "freestanding"     - attachment == freestanding
      "has_stairs"       - stairs configured
      "has_zones"        - L-shape / wraparound zones
      "dropped_beam"     - beam below joists
      "flush_beam"       - beam inline with joists
      "snow_any"         - any snow load > 0
      "height_over_30in" - deck > 30" above grade
      "height_over_8ft"  - deck > 8' above grade

    Future conditions (not yet active):
      "jurisdiction:colorado_springs"
      "material:steel"
    """
    if conditions is None:
        conditions = ["always"]

    def decorator(fn: Callable):
        _CHECK_REGISTRY.append({
            "id": id,
            "fn": fn,
            "products": products,
            "category": category,
            "sheet": sheet,
            "severity": severity,
            "code_ref": code_ref,
            "conditions": conditions,
        })
        return fn
    return decorator


def get_config_tags(params, calc):
    """
    Derive condition tags from a configuration.
    These determine which checks are applicable.
    """
    tags = ["always"]

    attachment = calc.get("attachment", "ledger")
    tags.append(attachment)  # "ledger" or "freestanding"

    beam_type = calc.get("beam_type", "dropped")
    tags.append(f"{beam_type}_beam")  # "dropped_beam" or "flush_beam"

    if params.get("hasStairs") and calc.get("stairs"):
        tags.append("has_stairs")

    if len(params.get("zones", [])) > 0:
        tags.append("has_zones")

    height_in = calc.get("height", 4) * 12
    if height_in > 30:
        tags.append("height_over_30in")
    if calc.get("height", 4) > 8:
        tags.append("height_over_8ft")

    snow = params.get("snowLoad", "none")
    if snow != "none":
        tags.append("snow_any")
        tags.append(f"snow_{snow}")

    decking = params.get("deckingType", "composite")
    tags.append(f"decking_{decking}")

    beam_size = calc.get("beam_size", "")
    if "LVL" in beam_size.upper():
        tags.append("lvl_beam")

    # Future: jurisdiction tags, material tags
    # jurisdiction = params.get("jurisdiction")
    # if jurisdiction:
    #     tags.append(f"jurisdiction:{jurisdiction}")

    return tags


def _check_applies(entry, product_type, config_tags):
    """Determine if a registered check applies to this configuration."""
    if product_type not in entry["products"]:
        return False
    conditions = entry["conditions"]
    if "always" in conditions:
        return True
    return all(c in config_tags for c in conditions)


def run_checks(product_type, params, calc, spec):
    """
    Run all applicable checks for the given product type and configuration.
    Returns a PermitReport.
    """
    config_tags = get_config_tags(params, calc)
    results = []

    for entry in _CHECK_REGISTRY:
        if not _check_applies(entry, product_type, config_tags):
            continue

        try:
            result = entry["fn"](params, calc, spec)
        except Exception as e:
            result = CheckResult(
                id=entry["id"],
                category=entry["category"],
                sheet=entry["sheet"],
                severity="warning",
                status="fail",
                message=f"Check failed with error: {str(e)}",
                detail=str(e),
            )

        if result.code_ref is None and entry["code_ref"]:
            result.code_ref = entry["code_ref"]

        results.append(result)

    return _build_report(product_type, config_tags, results)


def _build_report(product_type, config_tags, results):
    """Assemble individual check results into a PermitReport."""
    report = PermitReport(product_type=product_type)
    report.config_tags = config_tags
    report.checks = results
    report.capability_gaps = [r for r in results if r.status == "unsupported"]

    applicable = [r for r in results if r.status != "skip"]
    report.total_applicable = len(applicable)
    report.passed = sum(1 for r in applicable if r.status == "pass")
    report.failed = sum(1 for r in applicable if r.status == "fail")
    report.warnings = sum(
        1 for r in applicable
        if r.status == "fail" and r.severity == "warning"
    )

    errors = sum(
        1 for r in applicable
        if r.status == "fail" and r.severity == "error"
    )
    unsupported = len(report.capability_gaps)

    if report.total_applicable > 0:
        report.readiness_pct = round(report.passed / report.total_applicable, 2)
    else:
        report.readiness_pct = 1.0

    if errors > 0:
        report.overall_status = "not_ready"
        report.summary = (
            f"{report.passed} of {report.total_applicable} checks passed. "
            f"{errors} error(s) must be resolved."
        )
    elif unsupported > 0:
        report.overall_status = "unsupported"
        report.summary = (
            f"{report.passed} of {report.total_applicable} checks passed. "
            f"{unsupported} feature(s) not fully supported yet."
        )
    elif report.warnings > 0:
        report.overall_status = "warnings"
        report.summary = (
            f"{report.passed} of {report.total_applicable} checks passed. "
            f"{report.warnings} item(s) to review."
        )
    else:
        report.overall_status = "ready"
        report.summary = (
            f"All {report.total_applicable} checks passed. "
            f"Plans are ready for permit submission."
        )

    return report


# ============================================================
# LAYER 1: STRUCTURAL / CODE COMPLIANCE CHECKS
# ============================================================
# These validate calc_engine output against IRC code tables.
# Shared checks tagged with multiple product types for reuse.


@check(
    id="IRC_JOIST_SPAN",
    products=["deck", "porch"],
    category="structural",
    sheet="A-1",
    severity="error",
    code_ref="IRC R507.5, Table R507.5",
)
def check_joist_span(params, calc, spec):
    joist_span = calc.get("joist_span", 0)
    joist_size = calc.get("joist_size", "2x10")
    joist_spacing = calc.get("joist_spacing", 16)
    LL = calc.get("LL", 40)
    species = calc.get("species", "dfl_hf_spf")

    from .calc_engine import get_joist_spans_for_load
    spans = get_joist_spans_for_load(LL, species)
    max_span = spans.get(joist_size, {}).get(joist_spacing, 0)

    if max_span == 0:
        return CheckResult(
            id="IRC_JOIST_SPAN",
            category="structural", sheet="A-1", severity="error",
            status="fail",
            message="Joist size/spacing combination not in IRC tables.",
            detail=f"{joist_size} @ {joist_spacing}\" O.C. at {LL} PSF design load ({species})",
            fix="Change joist spacing to 12\", 16\", or 24\" in Step 2.",
            fix_step=2,
        )

    if joist_span > max_span:
        return CheckResult(
            id="IRC_JOIST_SPAN",
            category="structural", sheet="A-1", severity="error",
            status="fail",
            message=f"Joist span exceeds IRC maximum for {joist_size}.",
            detail=(
                f"{joist_size} @ {joist_spacing}\" O.C. spans {joist_span:.1f}' "
                f"(max {max_span:.1f}' at {LL} PSF design load)"
            ),
            fix="Reduce deck depth or upgrade to larger joists in Step 2.",
            fix_step=2,
        )

    return CheckResult(
        id="IRC_JOIST_SPAN",
        category="structural", sheet="A-1", severity="error",
        status="pass",
        message="Joist span within IRC limits.",
        detail=(
            f"{joist_size} @ {joist_spacing}\" O.C. spans {joist_span:.1f}' "
            f"(max {max_span:.1f}' at {LL} PSF design load)"
        ),
    )


@check(
    id="IRC_BEAM_SPAN",
    products=["deck", "porch"],
    category="structural",
    sheet="A-1",
    severity="error",
    code_ref="IRC R507.5, Tables R507.5(1)-R507.5(4)",
)
def check_beam_span(params, calc, spec):
    beam_size = calc.get("beam_size", "3-ply 2x10")
    beam_span = calc.get("beam_span", 0)
    joist_span = calc.get("joist_span", 10)
    LL = calc.get("LL", 40)
    species = calc.get("species", "dfl_hf_spf")

    from .calc_engine import get_beam_max_span, BEAM_SIZE_ORDER

    # LVL beams are outside the prescriptive tables
    if "LVL" in beam_size.upper():
        return CheckResult(
            id="IRC_BEAM_SPAN",
            category="structural", sheet="A-1", severity="warning",
            status="fail",
            message=f"Beam size '{beam_size}' not in standard IRC tables.",
            detail="LVL beams require engineering documentation.",
            fix="Consider standard lumber sizes or provide engineering stamp.",
            fix_step=2,
        )

    # Check if beam size is in our tables
    if beam_size not in BEAM_SIZE_ORDER:
        return CheckResult(
            id="IRC_BEAM_SPAN",
            category="structural", sheet="A-1", severity="warning",
            status="fail",
            message=f"Beam size '{beam_size}' not in standard IRC tables.",
            detail="May require engineering documentation.",
            fix="Consider standard lumber sizes or provide engineering stamp.",
            fix_step=2,
        )

    max_span = get_beam_max_span(beam_size, joist_span, LL, species)

    if beam_span > max_span:
        return CheckResult(
            id="IRC_BEAM_SPAN",
            category="structural", sheet="A-1", severity="error",
            status="fail",
            message=f"Beam {beam_size} exceeds IRC capacity.",
            detail=(
                f"{beam_size}: span {beam_span:.1f}' exceeds max {max_span:.1f}' "
                f"at {joist_span:.0f}' joist span, {LL} PSF design load."
            ),
            fix="Add more posts to reduce beam span, or upgrade beam size.",
            fix_step=2,
        )

    return CheckResult(
        id="IRC_BEAM_SPAN",
        category="structural", sheet="A-1", severity="error",
        status="pass",
        message="Beam span within IRC R507.5 limits.",
        detail=(
            f"{beam_size}: span {beam_span:.1f}' "
            f"(max {max_span:.1f}' at {joist_span:.0f}' joist span, {LL} PSF)"
        ),
    )


@check(
    id="IRC_FOOTING_FROST",
    products=["deck", "porch", "pergola", "shed", "garage"],
    category="structural",
    sheet="A-4",
    severity="error",
    code_ref="IRC R403.1.4, Table R301.2",
)
def check_footing_frost(params, calc, spec):
    footing_depth = calc.get("footing_depth", 36)
    from .calc_engine import FROST_DEPTHS
    frost_zone = params.get("frostZone", "cold")
    required = FROST_DEPTHS.get(frost_zone, 36)

    if footing_depth < required:
        return CheckResult(
            id="IRC_FOOTING_FROST",
            category="structural", sheet="A-4", severity="error",
            status="fail",
            message="Footing depth is above frost line.",
            detail=f"{footing_depth}\" deep, frost line at {required}\" ({frost_zone} zone)",
            fix=f"Increase footing depth to at least {required}\" in Step 2.",
            fix_step=2,
        )

    return CheckResult(
        id="IRC_FOOTING_FROST",
        category="structural", sheet="A-4", severity="error",
        status="pass",
        message="Footing depth below frost line.",
        detail=f"{footing_depth}\" deep, frost line at {required}\" ({frost_zone} zone)",
    )


@check(
    id="IRC_FOOTING_BEARING",
    products=["deck", "porch", "pergola"],
    category="structural",
    sheet="A-4",
    severity="warning",
    code_ref="IRC R507.3.1",
)
def check_footing_bearing(params, calc, spec):
    footing_diam = calc.get("footing_diam", 24)
    width = calc.get("width", 20)
    depth = calc.get("depth", 12)
    num_posts = calc.get("num_posts", 3)
    TL = calc.get("TL", 55)

    trib_area = (width / max(num_posts - 1, 1)) * depth
    footing_load = trib_area * TL
    required_area = footing_load / 1500  # sq ft at 1500 PSF soil bearing
    actual_area = math.pi * (footing_diam / 24) ** 2  # diam in -> ft radius -> area

    if actual_area < required_area * 0.9:
        return CheckResult(
            id="IRC_FOOTING_BEARING",
            category="structural", sheet="A-4", severity="warning",
            status="fail",
            message="Footing may be undersized for soil bearing capacity.",
            detail=(
                f"{footing_diam}\" dia. = {actual_area:.2f} SF, "
                f"load requires {required_area:.2f} SF at 1500 PSF"
            ),
            fix="Increase footing diameter in Step 2.",
            fix_step=2,
        )

    return CheckResult(
        id="IRC_FOOTING_BEARING",
        category="structural", sheet="A-4", severity="warning",
        status="pass",
        message="Footing area sufficient for soil bearing.",
        detail=f"{footing_diam}\" dia. = {actual_area:.2f} SF (need {required_area:.2f} SF)",
    )


@check(
    id="IRC_GUARD_HEIGHT",
    products=["deck", "porch"],
    category="structural",
    sheet="A-2",
    severity="warning",
    code_ref="IRC R312.1.1, R312.1.3",
    conditions=["height_over_30in"],
)
def check_guard_height(params, calc, spec):
    height = calc.get("height", 4)
    rail_height = calc.get("rail_height", 36)
    required = 36
    if height > 8:
        required = 42

    if rail_height < required:
        return CheckResult(
            id="IRC_GUARD_HEIGHT",
            category="structural", sheet="A-2", severity="warning",
            status="fail",
            message=f"Guard rail height may need to be {required}\" for this deck height.",
            detail=(
                f"Deck is {height}' above grade, rail is {rail_height}\". "
                f"Some jurisdictions require {required}\" for decks over "
                + ("8'." if required == 42 else "30\".")
            ),
            fix="Check with your local building department for guard height requirements.",
            fix_step=3,
        )

    return CheckResult(
        id="IRC_GUARD_HEIGHT",
        category="structural", sheet="A-2", severity="warning",
        status="pass",
        message="Guard rail height meets minimum requirements.",
        detail=f"{rail_height}\" rail on {height}' deck (min {required}\")",
    )


@check(
    id="IRC_STAIR_RISE",
    products=["deck", "porch"],
    category="structural",
    sheet="A-4",
    severity="error",
    code_ref="IRC R311.7.5.1",
    conditions=["has_stairs"],
)
def check_stair_rise(params, calc, spec):
    stairs = calc.get("stairs")
    if not stairs:
        return CheckResult(
            id="IRC_STAIR_RISE",
            category="structural", sheet="A-4", severity="error",
            status="skip", message="No stairs configured.",
        )

    actual_rise = stairs.get("actual_rise", 7.5)
    max_rise = 7.75  # IRC R311.7.5.1

    if actual_rise > max_rise:
        return CheckResult(
            id="IRC_STAIR_RISE",
            category="structural", sheet="A-4", severity="error",
            status="fail",
            message=f"Stair rise {actual_rise:.2f}\" exceeds IRC maximum of {max_rise}\".",
            detail=f"Actual rise: {actual_rise:.2f}\", max allowed: {max_rise}\"",
            fix="Adjust deck height to produce a compliant rise.",
            fix_step=1,
        )

    return CheckResult(
        id="IRC_STAIR_RISE",
        category="structural", sheet="A-4", severity="error",
        status="pass",
        message="Stair rise within IRC limits.",
        detail=f"{actual_rise:.2f}\" rise (max {max_rise}\")",
    )


@check(
    id="IRC_STAIR_TREAD",
    products=["deck", "porch"],
    category="structural",
    sheet="A-4",
    severity="error",
    code_ref="IRC R311.7.5.2",
    conditions=["has_stairs"],
)
def check_stair_tread(params, calc, spec):
    stairs = calc.get("stairs")
    if not stairs:
        return CheckResult(
            id="IRC_STAIR_TREAD",
            category="structural", sheet="A-4", severity="error",
            status="skip", message="No stairs configured.",
        )

    tread_depth = stairs.get("tread_depth", 10.5)
    min_tread = 10.0  # IRC R311.7.5.2

    if tread_depth < min_tread:
        return CheckResult(
            id="IRC_STAIR_TREAD",
            category="structural", sheet="A-4", severity="error",
            status="fail",
            message=f"Stair tread {tread_depth}\" is below IRC minimum of {min_tread}\".",
            detail=f"Tread depth: {tread_depth}\", min allowed: {min_tread}\"",
            fix="Tread depth is calculated from deck height. Adjust height in Step 1.",
            fix_step=1,
        )

    return CheckResult(
        id="IRC_STAIR_TREAD",
        category="structural", sheet="A-4", severity="error",
        status="pass",
        message="Stair tread depth meets IRC minimum.",
        detail=f"{tread_depth}\" tread (min {min_tread}\")",
    )


@check(
    id="IRC_LATERAL_LOAD",
    products=["deck"],
    category="structural",
    sheet="A-1",
    severity="error",
    code_ref="IRC R507.2.3",
    conditions=["ledger"],
)
def check_lateral_load(params, calc, spec):
    hw = spec.get("hardware", {}) if spec else {}
    lateral = hw.get("lateral_load", {})
    model = lateral.get("model", "")
    min_count = lateral.get("min_count", 0)

    if not model or min_count < 2:
        return CheckResult(
            id="IRC_LATERAL_LOAD",
            category="structural", sheet="A-1", severity="error",
            status="fail",
            message="Lateral load connectors not specified.",
            detail="IRC requires minimum 2 hold-down devices for ledger-attached decks.",
            fix="This should be auto-populated. Contact support if missing.",
        )

    return CheckResult(
        id="IRC_LATERAL_LOAD",
        category="structural", sheet="A-1", severity="error",
        status="pass",
        message="Lateral load connectors specified.",
        detail=f"Simpson {model}, {min_count} minimum",
    )


@check(
    id="IRC_LEDGER_FASTENER",
    products=["deck", "porch"],
    category="structural",
    sheet="A-4",
    severity="error",
    code_ref="IRC R507.2.1, Table R507.2",
    conditions=["ledger"],
)
def check_ledger_fastener(params, calc, spec):
    ledger = spec.get("ledger", {}) if spec else {}
    fastener = ledger.get("fastener", "")
    spacing = ledger.get("fastener_spacing", 0)

    if not fastener or spacing <= 0:
        return CheckResult(
            id="IRC_LEDGER_FASTENER",
            category="structural", sheet="A-4", severity="error",
            status="fail",
            message="Ledger fastener specification missing.",
            detail="IRC requires specified fastener type and spacing.",
        )

    return CheckResult(
        id="IRC_LEDGER_FASTENER",
        category="structural", sheet="A-4", severity="error",
        status="pass",
        message="Ledger fastener specified.",
        detail=f"{fastener} {ledger.get('fastener_size', '')} @ {spacing}\" O.C.",
    )


@check(
    id="IRC_POST_HEIGHT",
    products=["deck", "porch"],
    category="structural",
    sheet="A-2",
    severity="warning",
    code_ref="IRC R507.8",
)
def check_post_height(params, calc, spec):
    height = calc.get("height", 4)
    if height > 14:
        return CheckResult(
            id="IRC_POST_HEIGHT",
            category="structural", sheet="A-2", severity="warning",
            status="fail",
            message="Post height exceeds typical IRC prescriptive limits.",
            detail=f"Height: {height}'. Posts over 14' may require engineering.",
            fix="Consider reducing deck height or consulting an engineer.",
            fix_step=1,
        )

    return CheckResult(
        id="IRC_POST_HEIGHT",
        category="structural", sheet="A-2", severity="warning",
        status="pass",
        message="Post height within typical limits.",
        detail=f"{height}' posts",
    )


@check(
    id="CALC_LOADS_CONSISTENCY",
    products=["deck", "porch"],
    category="structural",
    sheet="A-3",
    severity="error",
    code_ref="IRC Table R301.5",
)
def check_loads_consistency(params, calc, spec):
    """Verify load values are consistent across calc engine, spec, and labels."""
    if not spec:
        return CheckResult(
            id="CALC_LOADS_CONSISTENCY",
            category="structural", sheet="A-3", severity="error",
            status="fail",
            message="No permit spec available for cross-check.",
        )

    loads = spec.get("loads", {})
    labels = spec.get("labels", {})

    calc_ll = calc.get("LL", 0)
    calc_dl = calc.get("DL", 0)
    calc_tl = calc.get("TL", 0)
    spec_ll = loads.get("LL", 0)
    spec_dl = loads.get("DL", 0)
    spec_tl = loads.get("TL", 0)

    issues = []

    # Engine to spec consistency
    if calc_ll != spec_ll:
        issues.append(f"LL mismatch: calc={calc_ll}, spec={spec_ll}")
    if calc_dl != spec_dl:
        issues.append(f"DL mismatch: calc={calc_dl}, spec={spec_dl}")
    if calc_tl != spec_tl:
        issues.append(f"TL mismatch: calc={calc_tl}, spec={spec_tl}")

    # Math consistency: TL should equal DL + LL
    expected_tl = spec_dl + spec_ll
    if spec_tl != expected_tl:
        issues.append(f"TL={spec_tl} but DL+LL={expected_tl}")

    # Snow load label present when snow > 0
    ground_snow = loads.get("ground_snow", 0)
    if ground_snow > 0 and not labels.get("loads_snow"):
        issues.append("Ground snow > 0 but no snow label in loads box")

    # TL label contains correct value
    tl_label = labels.get("loads_TL", "")
    if str(spec_tl) not in tl_label:
        issues.append(f"TL label '{tl_label}' missing value {spec_tl}")

    if issues:
        return CheckResult(
            id="CALC_LOADS_CONSISTENCY",
            category="structural", sheet="A-3", severity="error",
            status="fail",
            message="Load values inconsistent: " + "; ".join(issues),
            detail=f"Calc: LL={calc_ll}, DL={calc_dl}, TL={calc_tl}. Snow={ground_snow} PSF.",
        )

    snow_note = f", ground snow={ground_snow} PSF" if ground_snow > 0 else ""
    return CheckResult(
        id="CALC_LOADS_CONSISTENCY",
        category="structural", sheet="A-3", severity="error",
        status="pass",
        message="Design loads consistent across all sheets.",
        detail=f"LL={spec_ll} PSF, DL={spec_dl} PSF, TL={spec_tl} PSF{snow_note}",
    )


# ============================================================
# LAYER 2: DRAWING COMPLETENESS CHECKS
# ============================================================
# These verify that the spec contains all required data for each
# sheet to render correctly.


@check(
    id="DWG_SPEC_LABELS",
    products=["deck", "porch"],
    category="drawing",
    sheet="all",
    severity="error",
)
def check_spec_labels(params, calc, spec):
    """Verify all required label strings are populated in the spec."""
    if not spec:
        return CheckResult(
            id="DWG_SPEC_LABELS",
            category="drawing", sheet="all", severity="error",
            status="fail", message="No permit spec available.",
        )

    required = [
        "ledger", "joist", "beam", "posts_and_hardware",
        "footings", "joist_hanger", "hurricane_tie", "decking",
        "guardrail", "loads_LL", "loads_DL", "loads_TL",
    ]
    labels = spec.get("labels", {})
    missing = [lbl for lbl in required if not labels.get(lbl)]

    if missing:
        return CheckResult(
            id="DWG_SPEC_LABELS",
            category="drawing", sheet="all", severity="error",
            status="fail",
            message=f"Missing label(s): {', '.join(missing)}",
            detail="These labels are needed for plan sheet rendering.",
        )

    return CheckResult(
        id="DWG_SPEC_LABELS",
        category="drawing", sheet="all", severity="error",
        status="pass",
        message=f"All {len(required)} required labels populated.",
    )


@check(
    id="DWG_HARDWARE_MODELS",
    products=["deck", "porch"],
    category="drawing",
    sheet="all",
    severity="error",
)
def check_hardware_models(params, calc, spec):
    """Verify all hardware models are resolved."""
    if not spec:
        return CheckResult(
            id="DWG_HARDWARE_MODELS",
            category="drawing", sheet="all", severity="error",
            status="fail", message="No permit spec available.",
        )

    hw = spec.get("hardware", {})
    required_hw = {
        "post_base": hw.get("post_base", {}).get("model"),
        "post_cap": hw.get("post_cap", {}).get("model"),
        "joist_hanger": hw.get("joist_hanger", {}).get("model"),
        "hurricane_tie": hw.get("hurricane_tie", {}).get("model"),
        "lateral_load": hw.get("lateral_load", {}).get("model"),
    }

    missing = [k for k, v in required_hw.items() if not v]

    if missing:
        return CheckResult(
            id="DWG_HARDWARE_MODELS",
            category="drawing", sheet="all", severity="error",
            status="fail",
            message=f"Unresolved hardware: {', '.join(missing)}",
        )

    return CheckResult(
        id="DWG_HARDWARE_MODELS",
        category="drawing", sheet="all", severity="error",
        status="pass",
        message="All hardware models resolved.",
        detail=", ".join(f"{k}={v}" for k, v in required_hw.items()),
    )


@check(
    id="DWG_SPEC_VALIDATION",
    products=["deck", "porch"],
    category="drawing",
    sheet="all",
    severity="error",
)
def check_spec_validation(params, calc, spec):
    """Check permit_spec internal validation."""
    if not spec:
        return CheckResult(
            id="DWG_SPEC_VALIDATION",
            category="drawing", sheet="all", severity="error",
            status="fail", message="No permit spec available.",
        )

    errors = spec.get("validation_errors", [])
    if errors:
        return CheckResult(
            id="DWG_SPEC_VALIDATION",
            category="drawing", sheet="all", severity="error",
            status="fail",
            message=f"Spec validation failed: {'; '.join(errors)}",
        )

    return CheckResult(
        id="DWG_SPEC_VALIDATION",
        category="drawing", sheet="all", severity="error",
        status="pass",
        message="Permit spec internal validation passed.",
    )


@check(
    id="DWG_PLAN_LEDGER_LABEL",
    products=["deck", "porch"],
    category="drawing",
    sheet="A-1",
    severity="warning",
    conditions=["ledger"],
)
def check_plan_ledger_label(params, calc, spec):
    labels = spec.get("labels", {}) if spec else {}
    lbl = labels.get("ledger", "")
    if not lbl or "LEDGER" not in lbl.upper():
        return CheckResult(
            id="DWG_PLAN_LEDGER_LABEL",
            category="drawing", sheet="A-1", severity="warning",
            status="fail",
            message="Ledger label missing or incomplete on framing plan.",
        )

    return CheckResult(
        id="DWG_PLAN_LEDGER_LABEL",
        category="drawing", sheet="A-1", severity="warning",
        status="pass",
        message="Ledger label present.",
        detail=lbl,
    )


@check(
    id="DWG_STAIR_LABELS",
    products=["deck", "porch"],
    category="drawing",
    sheet="A-1",
    severity="warning",
    conditions=["has_stairs"],
)
def check_stair_labels(params, calc, spec):
    labels = spec.get("labels", {}) if spec else {}
    stringer_lbl = labels.get("stair_stringers", "")
    rise_run_lbl = labels.get("stair_rise_run", "")

    missing = []
    if not stringer_lbl:
        missing.append("stair_stringers")
    if not rise_run_lbl:
        missing.append("stair_rise_run")

    if missing:
        return CheckResult(
            id="DWG_STAIR_LABELS",
            category="drawing", sheet="A-1", severity="warning",
            status="fail",
            message=f"Missing stair label(s): {', '.join(missing)}",
        )

    return CheckResult(
        id="DWG_STAIR_LABELS",
        category="drawing", sheet="A-1", severity="warning",
        status="pass",
        message="Stair labels present.",
        detail=f"{stringer_lbl}; {rise_run_lbl}",
    )


@check(
    id="DWG_LOADS_LEDGER_LABEL",
    products=["deck", "porch"],
    category="drawing",
    sheet="A-1",
    severity="info",
    conditions=["ledger"],
)
def check_loads_ledger_label(params, calc, spec):
    labels = spec.get("labels", {}) if spec else {}
    lbl = labels.get("loads_ledger")
    if not lbl:
        return CheckResult(
            id="DWG_LOADS_LEDGER_LABEL",
            category="drawing", sheet="A-1", severity="info",
            status="fail",
            message="Ledger capacity not shown in loads box.",
        )

    return CheckResult(
        id="DWG_LOADS_LEDGER_LABEL",
        category="drawing", sheet="A-1", severity="info",
        status="pass",
        message="Ledger capacity shown in loads box.",
        detail=lbl,
    )


# ============================================================
# LAYER 2b: SITE / CONFIGURATION VALIDATION CHECKS
# ============================================================
# These check user inputs against each other for logical
# consistency. They catch real mistakes, not engine tautologies.


@check(
    id="SITE_SETBACK_COMPLIANCE",
    products=["deck", "porch", "pergola", "shed", "garage"],
    category="structural",
    sheet="A-5",
    severity="error",
    code_ref="Local zoning ordinance",
)
def check_setback_compliance(params, calc, spec):
    """Check if deck (including zones and stairs) fits within setback lines."""
    lot_w = params.get("lotWidth", 80)
    lot_d = params.get("lotDepth", 120)
    sb_side = params.get("setbackSide", 5)
    sb_rear = params.get("setbackRear", 20)
    sb_front = params.get("setbackFront", 25)

    house_w = params.get("houseWidth", 40)
    house_x = params.get("houseOffsetSide", 20)
    house_y = params.get("houseDistFromStreet") or sb_front
    house_d = params.get("houseDepth", 30)
    deck_w = calc.get("width", 20)
    deck_d = calc.get("depth", 12)
    deck_offset = params.get("deckOffset", 0)

    # Deck zone 0 position (matches draw_site_plan.py)
    z0_x = house_x + (house_w - deck_w) / 2 + deck_offset
    z0_y = house_y + house_d

    # Get bounding box including all zones
    try:
        from .zone_utils import get_bounding_box
        bb = get_bounding_box(params)
    except Exception:
        bb = {"x": 0, "y": 0, "w": deck_w, "d": deck_d}

    deck_left = z0_x + bb["x"]
    deck_right = z0_x + bb["x"] + bb["w"]
    deck_rear = z0_y + bb["y"] + bb["d"]

    # Add stair projection
    stair_proj = 0
    if params.get("hasStairs") and calc.get("stairs"):
        stair_proj = calc["stairs"].get("total_run_ft", 0)
        stair_loc = params.get("stairLocation", "front")
        if stair_loc == "front":
            deck_rear += stair_proj
        elif stair_loc == "left":
            deck_left -= stair_proj
        elif stair_loc == "right":
            deck_right += stair_proj

    violations = []
    if deck_left < sb_side:
        violations.append(
            f"Left edge {deck_left:.1f}' from property line "
            f"(setback requires {sb_side}')"
        )
    if deck_right > lot_w - sb_side:
        violations.append(
            f"Right edge {lot_w - deck_right:.1f}' from property line "
            f"(setback requires {sb_side}')"
        )
    if deck_rear > lot_d - sb_rear:
        violations.append(
            f"Rear edge {lot_d - deck_rear:.1f}' from rear property line "
            f"(setback requires {sb_rear}')"
        )

    if violations:
        return CheckResult(
            id="SITE_SETBACK_COMPLIANCE",
            category="structural", sheet="A-5", severity="error",
            status="fail",
            message="Deck extends into setback zone.",
            detail="; ".join(violations),
            fix="Reduce deck size, adjust deck offset, or verify setbacks with your building department.",
            fix_step=0,
        )

    return CheckResult(
        id="SITE_SETBACK_COMPLIANCE",
        category="structural", sheet="A-5", severity="error",
        status="pass",
        message="Deck within setback boundaries.",
        detail=(
            f"Side clearance: L={deck_left:.1f}' R={lot_w - deck_right:.1f}' "
            f"(req {sb_side}'). Rear clearance: {lot_d - deck_rear:.1f}' (req {sb_rear}')."
        ),
    )


@check(
    id="IRC_POST_SIZE_HEIGHT",
    products=["deck", "porch"],
    category="structural",
    sheet="A-2",
    severity="error",
    code_ref="IRC R507.8",
)
def check_post_size_height(params, calc, spec):
    """IRC R507.8: 4x4 posts max 8', 6x6 posts max 14'."""
    post_size = calc.get("post_size", "6x6")
    height = calc.get("height", 4)
    post_heights = calc.get("post_heights", [height])
    max_post_h = max(post_heights) if post_heights else height

    if post_size == "4x4" and max_post_h > 8:
        return CheckResult(
            id="IRC_POST_SIZE_HEIGHT",
            category="structural", sheet="A-2", severity="error",
            status="fail",
            message=f"4x4 posts limited to 8' height. Tallest post is {max_post_h:.1f}'.",
            detail="IRC R507.8: 4x4 or 4x6 posts max 8'. 6x6 posts max 14'.",
            fix="Switch to 6x6 posts in Step 2, or reduce deck height.",
            fix_step=2,
        )

    if post_size == "4x6" and max_post_h > 8:
        return CheckResult(
            id="IRC_POST_SIZE_HEIGHT",
            category="structural", sheet="A-2", severity="error",
            status="fail",
            message=f"4x6 posts limited to 8' height. Tallest post is {max_post_h:.1f}'.",
            detail="IRC R507.8: 4x4 or 4x6 posts max 8'. 6x6 posts max 14'.",
            fix="Switch to 6x6 posts in Step 2, or reduce deck height.",
            fix_step=2,
        )

    if post_size == "6x6" and max_post_h > 14:
        return CheckResult(
            id="IRC_POST_SIZE_HEIGHT",
            category="structural", sheet="A-2", severity="error",
            status="fail",
            message=f"6x6 posts limited to 14'. Tallest post is {max_post_h:.1f}'.",
            detail="IRC R507.8: 6x6 posts max 14'. Taller requires engineering.",
            fix="Reduce deck height or consult an engineer.",
            fix_step=1,
        )

    return CheckResult(
        id="IRC_POST_SIZE_HEIGHT",
        category="structural", sheet="A-2", severity="error",
        status="pass",
        message=f"{post_size} posts within IRC height limits.",
        detail=f"Tallest post: {max_post_h:.1f}' (max {'8' if '4x' in post_size else '14'}')",
    )


@check(
    id="SITE_IMPERVIOUS_COVERAGE",
    products=["deck", "porch", "pergola", "shed", "garage"],
    category="structural",
    sheet="A-5",
    severity="warning",
    code_ref="Local zoning ordinance",
)
def check_impervious_coverage(params, calc, spec):
    """Flag high impervious lot coverage. Many jurisdictions cap at 40-50%."""
    lot_w = params.get("lotWidth", 80)
    lot_d = params.get("lotDepth", 120)
    house_w = params.get("houseWidth", 40)
    house_d = params.get("houseDepth", 30)
    deck_w = calc.get("width", 20)
    deck_d = calc.get("depth", 12)

    # Use lot_area from calc if available (polygon-based)
    lot_area = calc.get("lot_area", lot_w * lot_d)

    house_area = house_w * house_d
    deck_area = calc.get("area", deck_w * deck_d)

    # Add zone areas
    try:
        from .zone_utils import get_additive_rects, get_cutout_rects
        add_rects = get_additive_rects(params)
        cut_rects = get_cutout_rects(params)
        deck_area = sum(r["rect"]["w"] * r["rect"]["d"] for r in add_rects)
        deck_area -= sum(r["rect"]["w"] * r["rect"]["d"] for r in cut_rects)
    except Exception:
        pass

    # Add site elements
    el_area = 0
    impervious_types = {"driveway", "garage", "shed", "patio"}
    for el in params.get("siteElements", []):
        if el.get("type", "") in impervious_types:
            el_area += el.get("w", 0) * el.get("d", 0)

    total_impervious = house_area + deck_area + el_area
    coverage_pct = (total_impervious / lot_area * 100) if lot_area > 0 else 0

    if coverage_pct > 50:
        return CheckResult(
            id="SITE_IMPERVIOUS_COVERAGE",
            category="structural", sheet="A-5", severity="warning",
            status="fail",
            message=f"Impervious lot coverage is {coverage_pct:.1f}%.",
            detail=(
                f"House {house_area:.0f} SF + Deck {deck_area:.0f} SF"
                + (f" + Other {el_area:.0f} SF" if el_area > 0 else "")
                + f" = {total_impervious:.0f} SF on {lot_area:.0f} SF lot. "
                "Many jurisdictions cap at 40-50%."
            ),
            fix="Check your local zoning code for maximum lot coverage percentage.",
            fix_step=0,
        )

    return CheckResult(
        id="SITE_IMPERVIOUS_COVERAGE",
        category="structural", sheet="A-5", severity="warning",
        status="pass",
        message=f"Impervious lot coverage: {coverage_pct:.1f}%.",
        detail=(
            f"House {house_area:.0f} SF + Deck {deck_area:.0f} SF"
            + (f" + Other {el_area:.0f} SF" if el_area > 0 else "")
            + f" = {total_impervious:.0f} SF on {lot_area:.0f} SF lot"
        ),
    )


# ============================================================
# LAYER 3: CAPABILITY GAPS
# ============================================================
# Status is "unsupported" - product limitation, not user error.


@check(
    id="CAP_FREESTANDING_BRACING",
    products=["deck"],
    category="capability",
    sheet="A-1",
    severity="warning",
    conditions=["freestanding"],
)
def check_freestanding_bracing(params, calc, spec):
    return CheckResult(
        id="CAP_FREESTANDING_BRACING",
        category="capability", sheet="A-1", severity="warning",
        status="unsupported",
        message="Freestanding deck lateral bracing is not yet drawn on plans.",
        detail=(
            "Your plan set includes bracing requirements in the General Notes, "
            "but diagonal bracing is not shown on the framing or elevation drawings. "
            "A plan examiner may request a bracing detail supplement."
        ),
        fix="This feature is on our roadmap. Plans can still be submitted with a bracing note.",
    )


@check(
    id="CAP_ZONE_CALCS",
    products=["deck"],
    category="capability",
    sheet="A-1",
    severity="warning",
    conditions=["has_zones"],
)
def check_zone_calcs(params, calc, spec):
    return CheckResult(
        id="CAP_ZONE_CALCS",
        category="capability", sheet="A-1", severity="warning",
        status="pass",
        message="Zone extensions have independent structural sizing.",
        detail=(
            "S60: Zone joist, beam, and footing sizes are computed independently "
            "based on each zone's dimensions and the design load. "
            "Plan view labels on A-1 still show main deck member sizes."
        ),
    )


# CAP_GUARD_HEIGHT_TALL: RESOLVED in S58 Push 3.
# Engine now auto-adjusts guard height (42" for decks >8').
# The IRC_GUARD_HEIGHT structural check validates the actual value.


@check(
    id="CAP_LVL_ENGINEERING",
    products=["deck", "porch"],
    category="capability",
    sheet="A-1",
    severity="warning",
    conditions=["lvl_beam"],
)
def check_lvl_engineering(params, calc, spec):
    beam_size = calc.get("beam_size", "")
    return CheckResult(
        id="CAP_LVL_ENGINEERING",
        category="capability", sheet="A-1", severity="warning",
        status="unsupported",
        message="LVL beam selected but no engineering stamp provided.",
        detail=(
            f"Beam: {beam_size}. LVL (laminated veneer lumber) beams typically "
            "require engineering documentation. Our plans reference the LVL "
            "but do not include a stamped engineering calculation."
        ),
        fix="Consider adding more posts to allow standard lumber, or obtain engineering separately.",
        fix_step=2,
    )


# ============================================================
# COMPLIANCE SUMMARY (for cover sheet)
# ============================================================

def get_compliance_summary(report):
    """
    Generate a compact compliance summary for the PDF cover sheet.
    Returns a dict with display-ready values.
    """
    structural_checks = [c for c in report.checks
                         if c.category == "structural" and c.status != "skip"]
    drawing_checks = [c for c in report.checks
                      if c.category == "drawing" and c.status != "skip"]

    structural_pass = sum(1 for c in structural_checks if c.status == "pass")
    drawing_pass = sum(1 for c in drawing_checks if c.status == "pass")

    return {
        "overall_status": report.overall_status,
        "total_checks": report.total_applicable,
        "total_passed": report.passed,
        "structural_checked": len(structural_checks),
        "structural_passed": structural_pass,
        "drawing_checked": len(drawing_checks),
        "drawing_passed": drawing_pass,
        "capability_gaps": len(report.capability_gaps),
        "summary_line": report.summary,
        # Compact line for cover sheet
        "stamp_line": (
            f"Automated pre-check: {report.passed}/{report.total_applicable} "
            f"structural and drawing checks passed."
            + (f" {len(report.capability_gaps)} advisory notice(s)."
               if report.capability_gaps else "")
        ),
    }


# ============================================================
# CONFIGURATION TEST MATRIX
# ============================================================

TEST_MATRIX = [
    {
        "name": "01 Default attached (20x12, 4ft)",
        "tests_for": "Baseline: standard labels, framing, all 4 elevations, stairs front",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "02 Tall attached (20x12, 9ft)",
        "tests_for": "42in auto-guard, long stair run, tall post labels, 6x6 posts",
        "params": {
            "width": 20, "depth": 12, "height": 9,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "03 Wide attached (36x12, 4ft)",
        "tests_for": "Many posts (5+), long beam label, wide framing layout, no stairs",
        "params": {
            "width": 36, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 100, "lotDepth": 120,
            "houseWidth": 60, "houseDepth": 30,
        },
    },
    {
        "name": "04 Freestanding (20x12, 4ft)",
        "tests_for": "Dual beams, no ledger labels, freestanding framing plan",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "freestanding", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "05 L-shape zone right (20x12, 4ft)",
        "tests_for": "Zone framing on A-1, zone outline on plan view, zone perimeter",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": False,
            "slopePercent": 0,
            "zones": [{"type": "additive", "attachEdge": "right", "w": 8, "d": 6}],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "06 Heavy snow severe frost (20x12, 4ft)",
        "tests_for": "Loads box with G.S.L. GOVERNS line, deep 48in footings, A-3 snow notes",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "heavy", "frostZone": "severe",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "07 Low deck wood (16x10, 2ft)",
        "tests_for": "No guards needed, no stairs, wood DL=12 labels, smaller member sizes",
        "params": {
            "width": 16, "depth": 10, "height": 2,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "moderate",
            "deckingType": "wood", "railType": "wood",
            "hasStairs": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 60, "lotDepth": 100,
            "houseWidth": 35, "houseDepth": 25,
        },
    },
    {
        "name": "08 Max stress (50x24, 14ft, snow, zone)",
        "tests_for": "Expected structural failures, label overflow, max member sizes, slope+zone",
        "params": {
            "width": 50, "depth": 24, "height": 14,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "heavy", "frostZone": "severe",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 5,
            "zones": [{"type": "additive", "attachEdge": "left", "w": 10, "d": 8}],
            "lotWidth": 150, "lotDepth": 200,
            "houseWidth": 70, "houseDepth": 40,
        },
    },
    {
        "name": "09 Slope 8pct front-to-back (20x12, 4ft)",
        "tests_for": "Grade lines on all 4 elevations, per-post height variation",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 8, "slopeDirection": "front-to-back",
            "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "10 Flush beam (20x12, 4ft)",
        "tests_for": "Flush beam framing detail, hanger callouts at both ends, A-4 detail",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "flush",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "11 Left stair (20x12, 4ft)",
        "tests_for": "Stair position left on plan view and elevations",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "left",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "12 Right stair (20x12, 4ft)",
        "tests_for": "Stair position right on plan view and elevations",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "right",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "13 Freestanding tall (20x12, 9ft)",
        "tests_for": "Dual beam + 42in guard + tall 6x6 posts combined, no ledger",
        "params": {
            "width": 20, "depth": 12, "height": 9,
            "attachment": "freestanding", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "14 L-shape zone left (24x12, 4ft)",
        "tests_for": "Zone on left side (opposite of 05), wider deck with zone",
        "params": {
            "width": 24, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0,
            "zones": [{"type": "additive", "attachEdge": "left", "w": 8, "d": 6}],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "15 Moderate snow + slope (20x12, 6ft)",
        "tests_for": "Combined snow loads box + grade lines, mid-height deck",
        "params": {
            "width": 20, "depth": 12, "height": 6,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "moderate", "frostZone": "cold",
            "deckingType": "composite", "railType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 5, "slopeDirection": "left-to-right",
            "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
]


def run_test_matrix(verbose=False):
    """
    Run the checker against all test configurations.
    Returns list of (name, report) tuples.

    Usage from repo root:
        python -m drawing.permit_checker
    """
    from .calc_engine import calculate_structure
    from .permit_spec import build_permit_spec

    results = []
    for config in TEST_MATRIX:
        name = config["name"]
        params = config["params"]

        calc = calculate_structure(params)
        spec = build_permit_spec(params, calc)
        report = run_checks("deck", params, calc, spec)
        results.append((name, report))

        if verbose:
            _print_report(name, report)

    return results


def _print_report(name, report):
    """Pretty-print a single test matrix result."""
    status_icon = {
        "ready": "OK",
        "warnings": "WARN",
        "not_ready": "FAIL",
        "unsupported": "NOTE",
    }
    icon = status_icon.get(report.overall_status, "??")
    print(f"\n{'='*70}")
    print(f"[{icon}] {name}")
    print(f"    {report.summary}")
    print(f"    Tags: {', '.join(report.config_tags)}")

    for c in report.checks:
        if c.status == "skip":
            continue
        if c.status == "pass":
            mark = "  PASS"
        elif c.status == "unsupported":
            mark = "  NOTE"
        else:
            mark = "**FAIL"
        line = f"    {mark} [{c.id}] {c.message}"
        if c.detail:
            line += f" | {c.detail}"
        print(line)


# ============================================================
# CLI ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import sys
    sys.path.insert(0, ".")
    results = run_test_matrix(verbose=True)

    print(f"\n{'='*70}")
    print("MATRIX SUMMARY")
    print(f"{'='*70}")
    for name, report in results:
        icon = {"ready": "OK", "warnings": "WARN",
                "not_ready": "FAIL", "unsupported": "NOTE"}.get(
                    report.overall_status, "??")
        print(f"  [{icon}] {name}: {report.readiness_pct:.0%} "
              f"({report.passed}/{report.total_applicable})")

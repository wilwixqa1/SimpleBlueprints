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
    TL = calc.get("TL", 55)

    from .calc_engine import get_joist_spans_for_load
    spans = get_joist_spans_for_load(TL)
    max_span = spans.get(joist_size, {}).get(joist_spacing, 0)

    if max_span == 0:
        return CheckResult(
            id="IRC_JOIST_SPAN",
            category="structural", sheet="A-1", severity="error",
            status="fail",
            message="Joist size/spacing combination not in IRC tables.",
            detail=f"{joist_size} @ {joist_spacing}\" O.C. at {TL} PSF total load",
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
                f"(max {max_span:.1f}' at {TL} PSF)"
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
            f"(max {max_span:.1f}' at {TL} PSF)"
        ),
    )


@check(
    id="IRC_BEAM_SPAN",
    products=["deck", "porch"],
    category="structural",
    sheet="A-1",
    severity="error",
    code_ref="IRC R507.6, Table R507.6",
)
def check_beam_span(params, calc, spec):
    beam_size = calc.get("beam_size", "3-ply 2x10")
    beam_span = calc.get("beam_span", 0)
    depth = calc.get("depth", 12)

    from .calc_engine import IRC_BEAM_CAPACITY
    caps = IRC_BEAM_CAPACITY.get(beam_size)

    if caps is None:
        return CheckResult(
            id="IRC_BEAM_SPAN",
            category="structural", sheet="A-1", severity="warning",
            status="fail",
            message=f"Beam size '{beam_size}' not in standard IRC tables.",
            detail="May require engineering documentation.",
            fix="Consider standard lumber sizes or provide engineering stamp.",
            fix_step=2,
        )

    issues = []
    if beam_span > caps["max_span"]:
        issues.append(
            f"span {beam_span:.1f}' exceeds max {caps['max_span']}'"
        )
    if depth > caps["max_trib"]:
        issues.append(
            f"tributary depth {depth}' exceeds max {caps['max_trib']}'"
        )

    if issues:
        return CheckResult(
            id="IRC_BEAM_SPAN",
            category="structural", sheet="A-1", severity="error",
            status="fail",
            message=f"Beam {beam_size} exceeds IRC capacity.",
            detail=f"{beam_size}: {'; '.join(issues)}.",
            fix="Add more posts to reduce beam span, or engine will auto-upgrade beam.",
            fix_step=2,
        )

    return CheckResult(
        id="IRC_BEAM_SPAN",
        category="structural", sheet="A-1", severity="error",
        status="pass",
        message="Beam span and tributary within IRC limits.",
        detail=(
            f"{beam_size}: span {beam_span:.1f}' "
            f"(max {caps['max_span']}'), "
            f"trib {depth}' (max {caps['max_trib']}')"
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
    """Verify spec loads match calc engine and labels contain correct values."""
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
    spec_ll = loads.get("LL", 0)
    spec_dl = loads.get("DL", 0)

    if calc_ll != spec_ll or calc_dl != spec_dl:
        return CheckResult(
            id="CALC_LOADS_CONSISTENCY",
            category="structural", sheet="A-3", severity="error",
            status="fail",
            message="Load values inconsistent between calc engine and spec.",
            detail=(
                f"Calc: LL={calc_ll}, DL={calc_dl}. "
                f"Spec: LL={spec_ll}, DL={spec_dl}."
            ),
        )

    ll_label = labels.get("loads_LL", "")
    if str(spec_ll) not in ll_label:
        return CheckResult(
            id="CALC_LOADS_CONSISTENCY",
            category="structural", sheet="A-3", severity="error",
            status="fail",
            message="Load label does not match calculated value.",
            detail=f"Label: '{ll_label}', expected LL={spec_ll} PSF",
        )

    return CheckResult(
        id="CALC_LOADS_CONSISTENCY",
        category="structural", sheet="A-3", severity="error",
        status="pass",
        message="Design loads consistent across all sheets.",
        detail=f"LL={spec_ll} PSF, DL={spec_dl} PSF, TL={loads.get('TL', 0)} PSF",
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
        status="unsupported",
        message="Zone extensions use main deck structural sizing.",
        detail=(
            "L-shape and wraparound extensions currently use the same "
            "beam, joist, and footing calculations as the main deck. "
            "Smaller extensions may be over-built, which is safe but not optimized."
        ),
        fix="This is conservative (safe). Independent zone calcs are on our roadmap.",
    )


@check(
    id="CAP_GUARD_HEIGHT_TALL",
    products=["deck", "porch"],
    category="capability",
    sheet="A-2",
    severity="warning",
    conditions=["height_over_8ft"],
)
def check_guard_height_tall(params, calc, spec):
    rail_height = calc.get("rail_height", 36)
    return CheckResult(
        id="CAP_GUARD_HEIGHT_TALL",
        category="capability", sheet="A-2", severity="warning",
        status="unsupported",
        message="Guard height for tall decks not yet auto-adjusted.",
        detail=(
            f"Deck is over 8' above grade. Guard is {rail_height}\". "
            "Some jurisdictions require 42\" guards for elevated decks. "
            "Our engine does not yet auto-adjust guard height based on deck height."
        ),
        fix="Check your local building code for guard height requirements.",
        fix_step=3,
    )


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
            f"Checked against {report.total_applicable} IRC requirements. "
            f"{report.passed} passed."
            + (f" {len(report.capability_gaps)} advisory notice(s)."
               if report.capability_gaps else "")
        ),
    }


# ============================================================
# CONFIGURATION TEST MATRIX
# ============================================================

TEST_MATRIX = [
    {
        "name": "Default (20x12, 4ft, ledger, no snow, stairs)",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railingType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "Tall deck (20x12, 9ft, ledger)",
        "params": {
            "width": 20, "depth": 12, "height": 9,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railingType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "Wide deck (36x12, 4ft, ledger)",
        "params": {
            "width": 36, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railingType": "fortress",
            "hasStairs": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 100, "lotDepth": 120,
            "houseWidth": 60, "houseDepth": 30,
        },
    },
    {
        "name": "Freestanding (20x12, 4ft)",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "freestanding", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railingType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "L-shape with zone (20x12, ledger, right zone)",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "cold",
            "deckingType": "composite", "railingType": "fortress",
            "hasStairs": False,
            "slopePercent": 0,
            "zones": [{"type": "additive", "attachEdge": "right", "w": 8, "d": 6}],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "Heavy snow (20x12, 4ft, ledger, heavy snow, severe frost)",
        "params": {
            "width": 20, "depth": 12, "height": 4,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "heavy", "frostZone": "severe",
            "deckingType": "composite", "railingType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 80, "lotDepth": 120,
            "houseWidth": 40, "houseDepth": 30,
        },
    },
    {
        "name": "Low deck (16x10, 2ft, ledger, no stairs, moderate frost)",
        "params": {
            "width": 16, "depth": 10, "height": 2,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "none", "frostZone": "moderate",
            "deckingType": "wood", "railingType": "wood",
            "hasStairs": False,
            "slopePercent": 0, "zones": [],
            "lotWidth": 60, "lotDepth": 100,
            "houseWidth": 35, "houseDepth": 25,
        },
    },
    {
        "name": "Max size (50x24, 14ft, ledger, heavy snow, zones)",
        "params": {
            "width": 50, "depth": 24, "height": 14,
            "attachment": "ledger", "beamType": "dropped",
            "joistSpacing": 16, "snowLoad": "heavy", "frostZone": "severe",
            "deckingType": "composite", "railingType": "fortress",
            "hasStairs": True, "stairWidth": 4, "stairLocation": "front",
            "numStringers": 3, "hasLanding": False,
            "slopePercent": 5,
            "zones": [{"type": "additive", "attachEdge": "left", "w": 10, "d": 8}],
            "lotWidth": 150, "lotDepth": 200,
            "houseWidth": 70, "houseDepth": 40,
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

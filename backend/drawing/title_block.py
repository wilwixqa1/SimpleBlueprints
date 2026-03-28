"""
SimpleBlueprints - Shared Title Block
Renders a professional title block with project info on each sheet.
S44: Added sheet count (X of Y) to bottom bar.
"""
from datetime import date
BRAND = {
    "dark": "#1a1f16", "green": "#3d5a2e", "cream": "#faf8f3",
    "mute": "#7a8068", "border": "#ddd8cc", "red": "#c62828",
}
def format_feet_inches(feet):
    ft = int(feet)
    inches = (feet - ft) * 12
    if inches < 0.5:
        return f"{ft}'-0\""
    else:
        return f"{ft}'-{inches:.0f}\""
def draw_title_block(fig, sheet_num, sheet_title, calc, project_info=None, total_sheets=7):
    """Draw a professional title block at the bottom of each sheet.
    
    Args:
        fig: matplotlib figure
        sheet_num: e.g. "A-1"
        sheet_title: e.g. "DECK PLAN & FRAMING"
        calc: calculation results dict
        project_info: dict with owner, address, city, state, zip, lot, contractor
        total_sheets: total number of sheets in the set (default 7: A-0 through A-6)
    """
    pi = project_info or {}
    W = calc["width"]
    D = calc["depth"]
    today = date.today().strftime("%m/%d/%Y")

    # Extract page number from sheet_num (e.g. "A-1" -> 2, "A-6" -> 7)
    try:
        _page = int(sheet_num.split("-")[1]) + 1
    except (IndexError, ValueError):
        _page = 0

    # Bottom bar with sheet info
    _page_label = f"  |  {_page} OF {total_sheets}" if _page > 0 else ""
    fig.text(0.5, 0.02,
             f'SHEET {sheet_num}  |  {sheet_title}  |  {format_feet_inches(W)} \u00D7 {format_feet_inches(D)}{_page_label}  |  simpleblueprints.xyz',
             ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"])
    # Right side title block
    owner = pi.get("owner", "")
    address = pi.get("address", "")
    city = pi.get("city", "")
    state = pi.get("state", "")
    zip_code = pi.get("zip", "")
    lot = pi.get("lot", "")
    contractor = pi.get("contractor", "") or "Owner-Builder"
    
    city_state_zip = ", ".join(filter(None, [city, state])) 
    if zip_code:
        city_state_zip += f" {zip_code}" if city_state_zip else zip_code
    # Only draw the info block if we have at least an owner or address
    if owner or address:
        block_x = 0.78
        block_y = 0.06
        line_h = 0.012
        fig.text(block_x, block_y + line_h * 5, "SIMPLEBLUEPRINTS",
                 fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["green"])
        
        fig.text(block_x, block_y + line_h * 4, f"OWNER: {owner.upper()}",
                 fontsize=5, fontfamily='monospace', color=BRAND["dark"])
        
        if address:
            fig.text(block_x, block_y + line_h * 3, f"ADDR: {address.upper()}",
                     fontsize=5, fontfamily='monospace', color=BRAND["dark"])
        
        if city_state_zip:
            fig.text(block_x, block_y + line_h * 2, f"      {city_state_zip.upper()}",
                     fontsize=5, fontfamily='monospace', color=BRAND["dark"])
        
        if lot:
            fig.text(block_x, block_y + line_h * 1, f"LOT: {lot.upper()}",
                     fontsize=5, fontfamily='monospace', color=BRAND["dark"])
        fig.text(block_x, block_y, f"DATE: {today}  |  BY: {contractor.upper()}",
                 fontsize=5, fontfamily='monospace', color=BRAND["mute"])
    else:
        # Fallback: just show date
        fig.text(0.78, 0.06, f"DATE: {today}",
                 fontsize=5, fontfamily='monospace', color=BRAND["mute"])
        fig.text(0.78, 0.073, "SIMPLEBLUEPRINTS",
                 fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["green"])

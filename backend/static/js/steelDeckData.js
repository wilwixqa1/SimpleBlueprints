// =============================================================================
// STEEL DECK DATA - Fortress Evolution System
// Source: Intertek CCRR-0313 (Issue Date: 07-15-2020)
// Source: Fortress Evolution Installation Guide (Rev6-10/10/19)
// Source: Welborn Decks reference plan (Rick Rutstein, 02-28-2026)
//
// AUTHORITATIVE SOURCE: All span data comes from CCRR-0313, the Intertek
// Code Compliance Research Report that permit reviewers reference.
// Do NOT substitute values from the installation guide TER tables.
//
// This file is the complete data foundation for steel deck framing support
// in SimpleBlueprints. It parallels the existing IRC R507 wood tables.
// =============================================================================

// -----------------------------------------------------------------------------
// TABLE 2: ALLOWABLE JOIST SPANS - 2x6 JOIST
// From CCRR-0313 Page 5
// Analyzed per AISI S100-2016
// Format: span = [feet, inches], cantilever = [feet, inches]
// Reactions in lbs: { ledger: lbs, post: lbs }
//
// Load case definitions (CCRR-0313 Table 2 footnote 2):
//   50 psf:  DL=10, LL=40, SL=0   (standard residential, no snow)
//   75 psf:  DL=10, LL=40, SL=25  (snow region, e.g. Colorado)
//   100 psf: DL=10, LL=40, SL=50  (heavy snow)
//   125 psf: DL=10, LL=40, SL=75
//   150 psf: DL=10, LL=40, SL=100
//   200 psf: DL=10, LL=40, SL=150
//
// NOTE: Original CCRR-0313 uses 12" and 16" OC only (no 10" OC).
// The revised 01-16-2026 version adds 10" OC and 70psf load case.
// We use the original tables as the baseline.
// -----------------------------------------------------------------------------
const STEEL_JOIST_SPANS = {
  "50": {
    "16ga": {
      "12": { span: [16, 4], cantilever: [4, 8],  reactions: { ledger: 375, post: 675 } },
      "16": { span: [14, 10], cantilever: [4, 3], reactions: { ledger: 454, post: 818 } },
    },
    "18ga": {
      "12": { span: [15, 4], cantilever: [4, 4],  reactions: { ledger: 353, post: 631 } },
      "16": { span: [13, 11], cantilever: [3, 11], reactions: { ledger: 427, post: 762 } },
    },
  },
  "75": {
    "16ga": {
      "12": { span: [16, 4], cantilever: [4, 8],  reactions: { ledger: 441, post: 793 } },
      "16": { span: [14, 10], cantilever: [4, 3], reactions: { ledger: 533, post: 962 } },
    },
    "18ga": {
      "12": { span: [15, 4], cantilever: [4, 4],  reactions: { ledger: 414, post: 741 } },
      "16": { span: [13, 11], cantilever: [3, 11], reactions: { ledger: 502, post: 895 } },
    },
  },
  "100": {
    "16ga": {
      "12": { span: [15, 0], cantilever: [4, 3],  reactions: { ledger: 535, post: 957 } },
      "16": { span: [13, 6], cantilever: [3, 10], reactions: { ledger: 641, post: 1150 } },
    },
    "18ga": {
      "12": { span: [14, 1], cantilever: [4, 0],  reactions: { ledger: 502, post: 900 } },
      "16": { span: [12, 2], cantilever: [3, 5],  reactions: { ledger: 579, post: 1031 } },
    },
  },
  "125": {
    "16ga": {
      "12": { span: [14, 0], cantilever: [4, 0],  reactions: { ledger: 619, post: 1114 } },
      "16": { span: [12, 1], cantilever: [3, 5],  reactions: { ledger: 713, post: 1276 } },
    },
    "18ga": {
      "12": { span: [12, 8], cantilever: [3, 7],  reactions: { ledger: 561, post: 1003 } },
      "16": { span: [10, 11], cantilever: [3, 1], reactions: { ledger: 645, post: 1152 } },
    },
  },
  "150": {
    "16ga": {
      "12": { span: [12, 9], cantilever: [3, 7],  reactions: { ledger: 675, post: 1203 } },
      "16": { span: [11, 1], cantilever: [3, 2],  reactions: { ledger: 780, post: 1405 } },
    },
    "18ga": {
      "12": { span: [11, 7], cantilever: [3, 3],  reactions: { ledger: 614, post: 1092 } },
      "16": { span: [10, 0], cantilever: [2, 10], reactions: { ledger: 705, post: 1263 } },
    },
  },
  "200": {
    "16ga": {
      "12": { span: [10, 10], cantilever: [3, 1], reactions: { ledger: 796, post: 1430 } },
      "16": { span: [9, 4], cantilever: [2, 8],   reactions: { ledger: 914, post: 1646 } },
    },
    "18ga": {
      "12": { span: [9, 9], cantilever: [2, 9],   reactions: { ledger: 718, post: 1282 } },
      "16": { span: [8, 5], cantilever: [2, 5],   reactions: { ledger: 824, post: 1487 } },
    },
  },
};

// -----------------------------------------------------------------------------
// TABLES 3-8: ALLOWABLE SINGLE BEAM SPANS
// From CCRR-0313 Pages 6-11
// Beam = 2x11 single beam (two 16ga J-channels, factory welded)
// Key: loadCase -> joistCantilever -> joistSpanFt -> [maxBeamSpanFt, maxBeamSpanIn]
// null entries (joist cantilever > L/4 of joist span) shown as "-" in report
// -----------------------------------------------------------------------------
const STEEL_SINGLE_BEAM_SPANS = {
  // TABLE 3: 50 PSF
  "50": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[19,1], 9:[17,11], 10:[17,0], 11:[16,3], 12:[15,6], 13:[14,11], 14:[14,4], 15:[13,10], 16:[13,5] },
    "0-6":  { 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[19,0], 8:[17,11], 9:[17,0], 10:[16,2], 11:[15,6], 12:[14,11], 13:[14,4], 14:[13,10], 15:[13,5], 16:[13,0] },
    "1-0":  { 4:[20,0], 5:[20,0], 6:[18,10], 7:[17,10], 8:[16,11], 9:[16,2], 10:[15,5], 11:[14,10], 12:[14,4], 13:[13,10], 14:[13,5], 15:[13,0], 16:[12,7] },
    "1-6":  { 6:[17,7], 7:[16,9], 8:[16,0], 9:[15,4], 10:[14,9], 11:[14,3], 12:[13,9], 13:[13,4], 14:[12,11], 15:[12,7], 16:[12,3] },
    "2-0":  { 8:[15,2], 9:[14,8], 10:[14,2], 11:[13,8], 12:[13,3], 13:[12,11], 14:[12,6], 15:[12,2], 16:[11,11] },
    "2-6":  { 10:[13,7], 11:[13,2], 12:[12,10], 13:[12,6], 14:[12,2], 15:[11,10], 16:[11,7] },
    "3-0":  { 12:[12,4], 13:[12,1], 14:[11,9], 15:[11,6], 16:[11,3] },
    "3-6":  { 14:[11,5], 15:[11,2], 16:[11,0] },
    "4-0":  { 16:[10,8] },
  },
  // TABLE 4: 75 PSF
  "75": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[18,9], 8:[17,7], 9:[16,7], 10:[15,8], 11:[14,11], 12:[14,4], 13:[13,9], 14:[13,3], 15:[12,9], 16:[12,4] },
    "0-6":  { 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[18,9], 7:[17,6], 8:[16,6], 9:[15,8], 10:[14,11], 11:[14,3], 12:[13,9], 13:[13,3], 14:[12,9], 15:[12,4], 16:[12,0] },
    "1-0":  { 4:[19,11], 5:[18,6], 6:[17,5], 7:[16,5], 8:[15,7], 9:[14,10], 10:[14,3], 11:[13,8], 12:[13,2], 13:[12,9], 14:[12,4], 15:[11,11], 16:[11,7] },
    "1-6":  { 6:[16,3], 7:[15,5], 8:[14,9], 9:[14,2], 10:[13,7], 11:[13,2], 12:[12,8], 13:[12,3], 14:[11,11], 15:[11,7], 16:[11,3] },
    "2-0":  { 8:[14,0], 9:[13,6], 10:[13,0], 11:[12,7], 12:[12,3], 13:[11,10], 14:[11,7], 15:[11,3], 16:[10,11] },
    "2-6":  { 10:[12,6], 11:[12,2], 12:[11,10], 13:[11,6], 14:[11,2], 15:[10,11], 16:[10,8] },
    "3-0":  { 12:[11,5], 13:[11,1], 14:[10,10], 15:[10,7], 16:[10,4] },
    "3-6":  { 14:[10,6], 15:[10,4], 16:[10,1] },
    "4-0":  { 16:[9,10] },
  },
  // TABLE 5: 100 PSF
  "100": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[20,0], 5:[19,4], 6:[17,8], 7:[16,4], 8:[15,3], 9:[14,5], 10:[13,8], 11:[13,0], 12:[12,5], 13:[11,11], 14:[11,6], 15:[11,1], 16:[10,9] },
    "0-6":  { 2:[20,0], 3:[20,0], 4:[19,3], 5:[17,7], 6:[16,3], 7:[15,3], 8:[14,4], 9:[13,7], 10:[13,0], 11:[12,5], 12:[11,11], 13:[11,6], 14:[11,1], 15:[10,9], 16:[10,5] },
    "1-0":  { 4:[17,4], 5:[16,1], 6:[15,1], 7:[14,3], 8:[13,7], 9:[12,11], 10:[12,4], 11:[11,11], 12:[11,5], 13:[11,1], 14:[10,8], 15:[10,5], 16:[10,1] },
    "1-6":  { 6:[14,1], 7:[13,5], 8:[12,10], 9:[12,4], 10:[11,10], 11:[11,5], 12:[11,0], 13:[10,8], 14:[10,4], 15:[10,1], 16:[9,9] },
    "2-0":  { 8:[12,2], 9:[11,9], 10:[11,4], 11:[10,11], 12:[10,7], 13:[10,4], 14:[10,0], 15:[9,9], 16:[9,6] },
    "2-6":  { 10:[10,10], 11:[10,6], 12:[10,3], 13:[10,0], 14:[9,8], 15:[9,6], 16:[9,3] },
    "3-0":  { 12:[9,11], 13:[9,8], 14:[9,5], 15:[9,2], 16:[9,0] },
    "3-6":  { 14:[9,2], 15:[8,11], 16:[8,9] },
    "4-0":  { 16:[8,6] },
  },
  // TABLE 6: 125 PSF
  "125": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[19,5], 5:[17,4], 6:[15,10], 7:[14,8], 8:[13,8], 9:[12,11], 10:[12,3], 11:[11,8], 12:[11,1], 13:[10,8], 14:[10,3], 15:[9,11], 16:[9,7] },
    "0-6":  { 2:[20,0], 3:[19,3], 4:[17,3], 5:[15,9], 6:[14,7], 7:[13,8], 8:[12,10], 9:[12,2], 10:[11,7], 11:[11,1], 12:[10,8], 13:[10,3], 14:[9,11], 15:[9,7], 16:[9,4] },
    "1-0":  { 4:[15,6], 5:[14,5], 6:[13,6], 7:[12,9], 8:[12,2], 9:[11,7], 10:[11,1], 11:[10,8], 12:[10,3], 13:[9,11], 14:[9,7], 15:[9,3], 16:[9,0] },
    "1-6":  { 6:[12,7], 7:[12,0], 8:[11,6], 9:[11,0], 10:[10,7], 11:[10,2], 12:[9,10], 13:[9,7], 14:[9,3], 15:[9,0], 16:[8,9] },
    "2-0":  { 8:[10,11], 9:[10,6], 10:[10,2], 11:[9,10], 12:[9,6], 13:[9,3], 14:[8,11], 15:[8,9], 16:[8,6] },
    "2-6":  { 10:[9,9], 11:[9,5], 12:[9,2], 13:[8,11], 14:[8,8], 15:[8,6], 16:[8,3] },
    "3-0":  { 12:[8,10], 13:[8,7], 14:[8,5], 15:[8,3], 16:[8,0] },
    "3-6":  { 14:[8,2], 15:[8,0], 16:[7,10] },
    "4-0":  { 16:[7,7] },
  },
  // TABLE 7: 150 PSF
  "150": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[17,9], 5:[15,10], 6:[14,6], 7:[13,4], 8:[12,6], 9:[11,9], 10:[11,2], 11:[10,7], 12:[10,2], 13:[9,9], 14:[9,5], 15:[9,1], 16:[8,9] },
    "0-6":  { 2:[20,0], 3:[17,7], 4:[15,9], 5:[14,5], 6:[13,4], 7:[12,6], 8:[11,9], 9:[11,2], 10:[10,7], 11:[10,2], 12:[9,9], 13:[9,4], 14:[9,1], 15:[8,9], 16:[8,6] },
    "1-0":  { 4:[14,2], 5:[13,2], 6:[12,4], 7:[11,8], 8:[11,1], 9:[10,7], 10:[10,1], 11:[9,9], 12:[9,4], 13:[9,0], 14:[8,9], 15:[8,6], 16:[8,3] },
    "1-6":  { 6:[11,6], 7:[11,0], 8:[10,6], 9:[10,1], 10:[9,8], 11:[9,4], 12:[9,0], 13:[8,8], 14:[8,5], 15:[8,2], 16:[8,0] },
    "2-0":  { 8:[9,11], 9:[9,7], 10:[9,3], 11:[8,11], 12:[8,8], 13:[8,5], 14:[8,2], 15:[7,11], 16:[7,9] },
    "2-6":  { 10:[8,10], 11:[8,7], 12:[8,4], 13:[8,1], 14:[7,11], 15:[7,9], 16:[7,6] },
    "3-0":  { 12:[8,1], 13:[7,10], 14:[7,8], 15:[7,6], 16:[7,4] },
    "3-6":  { 14:[7,5], 15:[7,3], 16:[7,1] },
    "4-0":  { 16:[6,11] },
  },
  // TABLE 8: 200 PSF
  "200": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[17,5], 4:[15,0], 5:[13,5], 6:[12,3], 7:[11,4], 8:[10,7], 9:[9,11], 10:[9,5], 11:[8,11], 12:[8,7], 13:[8,3], 14:[7,11], 15:[7,7], 16:[7,4] },
    "0-6":  { 2:[17,0], 3:[14,10], 4:[13,4], 5:[12,2], 6:[11,3], 7:[10,6], 8:[9,11], 9:[9,5], 10:[8,11], 11:[8,7], 12:[8,2], 13:[7,11], 14:[7,7], 15:[7,4], 16:[7,2] },
    "1-0":  { 4:[12,0], 5:[11,2], 6:[10,5], 7:[9,10], 8:[9,4], 9:[8,11], 10:[8,6], 11:[8,2], 12:[7,11], 13:[7,7], 14:[7,4], 15:[7,2], 16:[6,11] },
    "1-6":  { 6:[9,9], 7:[9,3], 8:[8,10], 9:[8,6], 10:[8,2], 11:[7,10], 12:[7,7], 13:[7,4], 14:[7,1], 15:[6,11], 16:[6,8] },
    "2-0":  { 8:[8,5], 9:[8,1], 10:[7,9], 11:[7,6], 12:[7,3], 13:[7,1], 14:[6,10], 15:[6,8], 16:[6,6] },
    "2-6":  { 10:[7,6], 11:[7,3], 12:[7,0], 13:[6,10], 14:[6,8], 15:[6,6], 16:[6,4] },
    "3-0":  { 12:[6,9], 13:[6,7], 14:[6,5], 15:[6,3], 16:[6,2] },
    "3-6":  { 14:[6,3], 15:[6,1], 16:[6,0] },
    "4-0":  { 16:[5,10] },
  },
};

// -----------------------------------------------------------------------------
// TABLES 9-14: ALLOWABLE DOUBLE BEAM SPANS
// From CCRR-0313 Pages 12-17
// Double beam = two single beams + double beam tracks top/bottom
// Same key structure as single beam tables
// -----------------------------------------------------------------------------
const STEEL_DOUBLE_BEAM_SPANS = {
  // TABLE 9: 50 PSF
  "50": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[20,0], 16:[20,0] },
    "0-6":  { 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[20,0], 16:[20,0] },
    "1-0":  { 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[20,0], 16:[20,0] },
    "1-6":  { 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[20,0], 16:[20,0] },
    "2-0":  { 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[20,0], 16:[20,0] },
    "2-6":  { 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[20,0], 16:[19,8] },
    "3-0":  { 12:[20,0], 13:[20,0], 14:[20,0], 15:[19,7], 16:[19,2] },
    "3-6":  { 14:[19,6], 15:[19,1], 16:[18,8] },
    "4-0":  { 16:[18,2] },
  },
  // TABLE 10: 75 PSF
  "75": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[20,0], 16:[20,0] },
    "0-6":  { 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[20,0], 16:[20,0] },
    "1-0":  { 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[20,0], 16:[19,9] },
    "1-6":  { 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[20,0], 15:[19,9], 16:[19,2] },
    "2-0":  { 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[19,8], 15:[19,2], 16:[18,8] },
    "2-6":  { 10:[20,0], 11:[20,0], 12:[20,0], 13:[19,7], 14:[19,1], 15:[18,7], 16:[18,2] },
    "3-0":  { 12:[19,5], 13:[18,11], 14:[18,6], 15:[18,1], 16:[17,8] },
    "3-6":  { 14:[17,11], 15:[17,7], 16:[17,3] },
    "4-0":  { 16:[16,9] },
  },
  // TABLE 11: 100 PSF
  "100": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[20,0], 14:[19,7], 15:[18,11], 16:[18,3] },
    "0-6":  { 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[20,0], 13:[19,6], 14:[18,10], 15:[18,3], 16:[17,9] },
    "1-0":  { 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[20,0], 12:[19,6], 13:[18,10], 14:[18,3], 15:[17,8], 16:[17,2] },
    "1-6":  { 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[19,5], 12:[18,9], 13:[18,2], 14:[17,8], 15:[17,2], 16:[16,8] },
    "2-0":  { 8:[20,0], 9:[20,0], 10:[19,3], 11:[18,8], 12:[18,1], 13:[17,7], 14:[17,1], 15:[16,8], 16:[16,3] },
    "2-6":  { 10:[18,6], 11:[17,11], 12:[17,5], 13:[17,0], 14:[16,7], 15:[16,2], 16:[15,9] },
    "3-0":  { 12:[16,10], 13:[16,5], 14:[16,1], 15:[15,8], 16:[15,4] },
    "3-6":  { 14:[15,7], 15:[15,3], 16:[14,11] },
    "4-0":  { 16:[14,7] },
  },
  // TABLE 12: 125 PSF
  "125": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[20,0], 11:[19,10], 12:[18,11], 13:[18,2], 14:[17,6], 15:[16,11], 16:[16,5] },
    "0-6":  { 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[19,9], 11:[18,11], 12:[18,2], 13:[17,6], 14:[16,11], 15:[16,4], 16:[15,11] },
    "1-0":  { 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[19,8], 10:[18,10], 11:[18,2], 12:[17,6], 13:[16,11], 14:[16,4], 15:[15,10], 16:[15,5] },
    "1-6":  { 6:[20,0], 7:[20,0], 8:[19,7], 9:[18,9], 10:[18,0], 11:[17,5], 12:[16,10], 13:[16,3], 14:[15,10], 15:[15,4], 16:[14,11] },
    "2-0":  { 8:[18,7], 9:[17,11], 10:[17,3], 11:[16,9], 12:[16,3], 13:[15,9], 14:[15,4], 15:[14,11], 16:[14,6] },
    "2-6":  { 10:[16,7], 11:[16,1], 12:[15,8], 13:[15,3], 14:[14,10], 15:[14,6], 16:[14,2] },
    "3-0":  { 12:[15,1], 13:[14,9], 14:[14,5], 15:[14,1], 16:[13,9] },
    "3-6":  { 14:[14,0], 15:[13,8], 16:[13,5] },
    "4-0":  { 16:[13,1] },
  },
  // TABLE 13: 150 PSF
  "150": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[20,0], 10:[19,0], 11:[18,1], 12:[17,4], 13:[16,8], 14:[16,0], 15:[15,6], 16:[15,0] },
    "0-6":  { 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[20,0], 8:[20,0], 9:[19,0], 10:[18,1], 11:[17,4], 12:[16,7], 13:[16,0], 14:[15,5], 15:[14,11], 16:[14,6] },
    "1-0":  { 4:[20,0], 5:[20,0], 6:[20,0], 7:[19,10], 8:[18,10], 9:[18,0], 10:[17,3], 11:[16,7], 12:[16,0], 13:[15,5], 14:[14,11], 15:[14,6], 16:[14,1] },
    "1-6":  { 6:[19,7], 7:[18,8], 8:[17,10], 9:[17,2], 10:[16,6], 11:[15,11], 12:[15,4], 13:[14,11], 14:[14,5], 15:[14,0], 16:[13,8] },
    "2-0":  { 8:[17,0], 9:[16,4], 10:[15,9], 11:[15,3], 12:[14,10], 13:[14,5], 14:[14,0], 15:[13,7], 16:[13,3] },
    "2-6":  { 10:[15,2], 11:[14,8], 12:[14,3], 13:[13,11], 14:[13,7], 15:[13,3], 16:[12,11] },
    "3-0":  { 12:[13,10], 13:[13,6], 14:[13,2], 15:[12,10], 16:[12,7] },
    "3-6":  { 14:[12,9], 15:[12,6], 16:[12,3] },
    "4-0":  { 16:[11,11] },
  },
  // TABLE 14: 200 PSF
  "200": {
    "0-0":  { 1:[20,0], 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[20,0], 7:[19,3], 8:[18,0], 9:[16,11], 10:[16,1], 11:[15,4], 12:[14,8], 13:[14,1], 14:[13,6], 15:[13,1], 16:[12,8] },
    "0-6":  { 2:[20,0], 3:[20,0], 4:[20,0], 5:[20,0], 6:[19,2], 7:[17,11], 8:[16,11], 9:[16,1], 10:[15,3], 11:[14,8], 12:[14,1], 13:[13,6], 14:[13,1], 15:[12,8], 16:[12,3] },
    "1-0":  { 4:[20,0], 5:[19,0], 6:[17,10], 7:[16,10], 8:[16,0], 9:[15,3], 10:[14,7], 11:[14,0], 12:[13,6], 13:[13,0], 14:[12,7], 15:[12,3], 16:[11,11] },
    "1-6":  { 6:[16,7], 7:[15,10], 8:[15,1], 9:[14,6], 10:[13,11], 11:[13,5], 12:[13,0], 13:[12,7], 14:[12,2], 15:[11,10], 16:[11,6] },
    "2-0":  { 8:[14,4], 9:[13,10], 10:[13,4], 11:[12,11], 12:[12,6], 13:[12,2], 14:[11,10], 15:[11,6], 16:[11,2] },
    "2-6":  { 10:[12,10], 11:[12,5], 12:[12,1], 13:[11,9], 14:[11,5], 15:[11,2], 16:[10,11] },
    "3-0":  { 12:[11,8], 13:[11,4], 14:[11,1], 15:[10,10], 16:[10,7] },
    "3-6":  { 14:[10,9], 15:[10,6], 16:[10,4] },
    "4-0":  { 16:[10,1] },
  },
};

// -----------------------------------------------------------------------------
// TABLE 15: ALLOWABLE POST HEIGHTS
// From CCRR-0313 Page 18
// 3.5" x 3.5" post, 11-gauge structural steel galvanized ASTM A653 G60
// WARNING: Steel posts must NOT be buried. Mount on top of pier brackets.
// -----------------------------------------------------------------------------
const STEEL_POST_HEIGHTS = {
  "3.5": {
    gauge: 11,
    entries: [
      { dl: 10, ll: 40, sl: 0,   maxTribArea: 200, maxHeight: 120.0 },  // 10'-0"
      { dl: 10, ll: 40, sl: 50,  maxTribArea: 200, maxHeight: 120.0 },  // 10'-0"
      { dl: 10, ll: 40, sl: 75,  maxTribArea: 200, maxHeight: 120.0 },  // 10'-0"
      { dl: 10, ll: 40, sl: 100, maxTribArea: 150, maxHeight: 120.0 },  // 10'-0"
      { dl: 10, ll: 40, sl: 100, maxTribArea: 200, maxHeight: 109.3 },  // 9'-1"
      { dl: 10, ll: 40, sl: 150, maxTribArea: 100, maxHeight: 120.0 },  // 10'-0"
      { dl: 10, ll: 40, sl: 150, maxTribArea: 150, maxHeight: 101.5 },  // 8'-5"
    ],
    // NOTE: 5.5" x 5.5" post (12-gauge) added in revised CCRR-0313 (01-16-2026)
    // Not in original report. For elevated decks needing > 10' posts,
    // flag for engineer review.
  },
};

// -----------------------------------------------------------------------------
// FORTRESS EVOLUTION PARTS CATALOG
// Source: Installation guide pages 54-58 + Welborn reference plans
// Item numbers and UPCs from Rev6-10/10/19 product overview
// Part names match Rick Rutstein's callout convention
// -----------------------------------------------------------------------------
const FORTRESS_PARTS = {
  // STRUCTURAL MEMBERS
  joist16ga: {
    sizes: [
      { item: "181112161", desc: "FF-EVOLUTION-2X6 JOIST-12'-16GA-PC", upc: "811397030170", length: 12 },
      { item: "181114161", desc: "FF-EVOLUTION-2X6 JOIST-14'-16GA-PC", upc: "811397030163", length: 14 },
      { item: "181116161", desc: "FF-EVOLUTION-2X6 JOIST-16'-16GA-PC", upc: "811397030156", length: 16 },
      { item: "181118161", desc: "FF-EVOLUTION-2X6 JOIST-18'-16GA-PC", upc: "811397030149", length: 18 },
      { item: "181120161", desc: "FF-EVOLUTION-2X6 JOIST-20'-16GA-PC", upc: "811397030132", length: 20 },
    ],
  },
  joist18ga: {
    sizes: [
      { item: "181112180", desc: "FF-EVOLUTION-2X6 JOIST-12'-18GA", upc: "811397030224", length: 12 },
      { item: "181114180", desc: "FF-EVOLUTION-2X6 JOIST-14'-18GA", upc: "811397030217", length: 14 },
      { item: "181116180", desc: "FF-EVOLUTION-2X6 JOIST-16'-18GA", upc: "811397030200", length: 16 },
      { item: "181118180", desc: "FF-EVOLUTION-2X6 JOIST-18'-18GA", upc: "811397030194", length: 18 },
      { item: "181120180", desc: "FF-EVOLUTION-2X6 JOIST-20'-18GA", upc: "811397030187", length: 20 },
    ],
  },
  sLedger: {
    sizes: [
      { item: "182012141", desc: "FF-EVOLUTION-S-LEDGER-12'", upc: "811397030293", length: 12 },
      { item: "182020141", desc: "FF-EVOLUTION-S-LEDGER-20'", upc: "811397030309", length: 20 },
      { item: "182112141", desc: "FF-EVOLUTION-12OC-S-LEDGER-12'", upc: "811397030316", length: 12 },
      { item: "182120141", desc: "FF-EVOLUTION-12OC-S-LEDGER-20'", upc: "811397030354", length: 20 },
      { item: "182212141", desc: "FF-EVOLUTION-16OC-S-LEDGER-12'", upc: "811397030330", length: 12 },
      { item: "182220141", desc: "FF-EVOLUTION-16OC-S-LEDGER-20'", upc: "811397030347", length: 20 },
    ],
  },
  beam: {
    sizes: [
      { item: "184108161", desc: "FF-EVOLUTION-BEAM 2X11-8'", upc: "811397030361", length: 8 },
      { item: "184112161", desc: "FF-EVOLUTION-BEAM 2X11-12'", upc: "811397030378", length: 12 },
      { item: "184116161", desc: "FF-EVOLUTION-BEAM 2X11-16'", upc: "811397030385", length: 16 },
      { item: "184120161", desc: "FF-EVOLUTION-BEAM 2X11-20'", upc: "811397030392", length: 20 },
    ],
  },
  doubleBeamTrack: { item: "184204161", desc: "FF-EVOLUTION-DBL BEAM TRACK-4' (2 PACK)", upc: "811397030408" },
  caps: {
    joist: { item: "183062001", desc: "FF-EVOLUTION-JOIST CAP", upc: "811397030262" },
    beam:  { item: "183112001", desc: "FF-EVOLUTION-BEAM CAP", upc: "811397030279" },
  },
  rimJoist: {
    prePunched12: { item: "185108141", desc: "FF-EVOLUTION-12OC U-RIM JOIST-2X6-8'", upc: "811397030422" },
    prePunched16: { item: "185208141", desc: "FF-EVOLUTION-16OC U-RIM JOIST-2X6-8'", upc: "811397030439" },
    blank:        { item: "185008141", desc: "FF-EVOLUTION-U-RIM JOIST-2X6-8'", upc: "811397030415" },
    curved:       { item: "185308161", desc: "FF-EVOLUTION-CURVE-RIM JOIST-2X6-8'", upc: "811397030446" },
  },
  post: { item: "186110111", desc: "FF-EVOLUTION-POST 3.5X3.5-10'", upc: "811397030248" },
  // BRACKETS AND CONNECTORS
  postToPierBracket:      { item: "183351601", desc: "FF-EVOLUTION-3.5\" POST/PIER BRACKET", upc: "811397030286" },
  singleBeamPostBracket:  { item: "183161601", desc: "FF-EVOLUTION-SNGL BEAM/POST BRACKET", upc: "811397030057" },
  doubleBeamPostBracket:  { item: "183261601", desc: "FF-EVOLUTION-DBL BEAM/POST BRACKET", upc: "811397030040" },
  ledgerBracket:          { item: "183011401", desc: "FF-EVOLUTION-LEDGER BRACKET", upc: "811397030125" },
  f10Bracket:             { item: "183041601", desc: "FF-EVOLUTION-F10 BRACKET (BOX 10)", upc: "811397030453" },
  f50Bracket:             { item: "183021601", desc: "FF-EVOLUTION-F50 BRACKET", upc: "811397030118" },
  singleHangerBracket:    { item: "183102001", desc: "FF-EVOLUTION-SNGL HANGER BRACKET", upc: "811397030071" },
  doubleHangerBracket:    { item: "183202001", desc: "FF-EVOLUTION-DBL HANGER BRACKET", upc: "811397030064" },
  deg45Bracket:           { item: "183451401", desc: "FF-EVOLUTION-45 DEG BRACKET", upc: "811397030101" },
  rimJoistBracket:        { item: "183031801", desc: "FF-EVOLUTION-RIM JOIST BRACKET", upc: "811397030095" },
  // BLOCKING AND STRAPPING
  blocking12:  { item: "188122001", desc: "FF-EVOLUTION-12OC BLOCKING", upc: "811397030033" },
  blocking16:  { item: "188162001", desc: "FF-EVOLUTION-16OC BLOCKING", upc: "811397030026" },
  strap12:     { item: "187104201", desc: "FF-EVOLUTION-12OC STRAP", upc: "811397030002" },
  strap16:     { item: "187204201", desc: "FF-EVOLUTION-16OC STRAP", upc: "811397030019" },
  // FASTENERS AND FINISHING
  selfDrillingScrew: { item: "183990341", desc: "FF-EVOLUTION 3/4\" BLACK SELF-DRILLING SCREW (BAG 250)", upc: "811397030255" },
  touchUpPaint:      { item: "183280601", desc: "FF-BLACK SAND (BKSND) AEROSOL TOUCH UP PAINT", upc: "811397030736" },
};

// -----------------------------------------------------------------------------
// FASTENING SCHEDULE (from CCRR-0313 Table 1 + Installation Guide page 53)
// Used for materials list screw count estimation
// All connections use Evolution #12-14, 3/4" self-tapping screws
// Edge distance and c-c spacing: min 1/2"
// Must extend through steel min 3 exposed threads
// -----------------------------------------------------------------------------
const STEEL_FASTENING_SCHEDULE = {
  f50ToLedger:                    { screws: 3, note: "fill all holes in bracket" },
  ledgerBracketToBackOfLedger:    { screws: 0, note: "no fasteners, press-fit (typical)" },
  ledgerBracketToFrontOfLedger:   { screws: 6, note: "fill all holes in bracket" },
  f50BracketToJoist:              { screws: 3, note: "fill all holes in bracket" },
  ledgerBracketToJoist:           { screws: 2, note: "one per side" },
  joistToBeamFlushHanger:         { screws: 8, note: "6 to beam + 2 to joist" },
  joistToBeamDropBlocking:        { screws: 5, note: "3 to beam + 2 to joist (12/16 OC)" },
  joistToBeamDropF10:             { screws: 4, note: "2 to beam + 2 to joist (non-standard)" },
  joistToStrapTopside:            { screws: 0, note: "no fasteners required (ground level)" },
  joistToStrapUnderside:          { screws: 1, note: "1 screw per joist, fill all holes" },
  joistToBlockingNonStandard:     { screws: 12, note: "2 F50 brackets + joist cut to length" },
  rimBracketToJoist:              { screws: 2, note: "2 screws" },
  curvedRimToRimBracket:          { screws: 1, note: "1 screw" },
  rimJoist12or16OC:               { screws: 2, note: "2 per joist, fill all holes" },
  postToBeamBracket:              { screws: 28, note: "fill all holes" },
  postToPierBracket:              { screws: 8, note: "fill all holes" },
  // Beam connections
  singleBeamToPost:               { screws: 28, note: "1 Single Beam/Post Bracket, fill all holes" },
  singleBeamToNotchedColumn:      { bolts: 2, note: "1/2\" diam. carriage bolts (410 stainless steel)" },
  doubleBeamToPost:               { screws: 28, note: "1 Double Beam/Post Bracket, fill all holes" },
  beamSplice:                     { bolts: 4, note: "3/8\" diameter stainless steel thru bolts" },
};

// -----------------------------------------------------------------------------
// LOAD CASE MAPPING
// Maps common residential load scenarios to CCRR-0313 load cases
// -----------------------------------------------------------------------------
const STEEL_LOAD_CASES = {
  standard:  { loadCase: "50",  dl: 10, ll: 40, sl: 0,   description: "Standard residential: no snow" },
  colorado:  { loadCase: "75",  dl: 10, ll: 40, sl: 25,  description: "Snow region (e.g. Colorado Springs)" },
  heavySnow: { loadCase: "100", dl: 10, ll: 40, sl: 50,  description: "Heavy snow" },
  extreme:   { loadCase: "125", dl: 10, ll: 40, sl: 75,  description: "Extreme snow" },
  vHeavy:    { loadCase: "150", dl: 10, ll: 40, sl: 100, description: "Very heavy snow" },
  max:       { loadCase: "200", dl: 10, ll: 40, sl: 150, description: "Maximum rated load" },
};

// -----------------------------------------------------------------------------
// PDF LABEL CONVENTIONS
// Matches Rick Rutstein's Welborn Decks callout style (02-28-2026)
// These are the proven permit-passing label formats
// -----------------------------------------------------------------------------
const STEEL_PDF_LABELS = {
  joistLabel: (gauge, spacing) =>
    `FF-EVOLUTION - 2X6-${gauge} GA - PC DECK JOISTS @ ${spacing}" O.C.`,
  ledgerLabel: (spacing) =>
    `FF-EVOLUTION - ${spacing}OC - S LEDGER`,
  rimJoistLabel: (spacing) =>
    `FF-EVOLUTION - ${spacing}OC U RIM JOIST - 2X6 @ ${spacing}" O.C.`,
  beamLabel: (type) =>
    `FF-EVOLUTION 2X11 ${type.toUpperCase()} BEAM`,
  postLabel: (size) =>
    `FORTRESS STEEL ${size}" X ${size}" POST`,
  hangerLabel: () =>
    `FF-EVOLUTION - SNGL HANGER BRACKET EA. JOIST`,
  screwNote: () =>
    `USE 3/4" SELF-TAPPING SCREWS PER MANUFACTURER'S SPECIFICATIONS - FILL ALL HOLES`,
  systemNote: () =>
    `STEEL FRAMING PER FORTRESS EVOLUTION SYSTEM - INTERTEK CCRR-0313`,
  stairLabel: () =>
    `'FORTRESS' STEEL STAIR FRAMING SYSTEM`,
};

// -----------------------------------------------------------------------------
// KEY CONSTRAINTS FROM CCRR-0313
// These must be enforced in the engine (app.js)
// -----------------------------------------------------------------------------
const STEEL_CONSTRAINTS = {
  maxBeamCantilever: 24,          // inches
  joistCantileverRatio: 0.25,     // max L/4 of supported span
  midSpanBlockingRequired: 96,    // inches (8'), blocking required when joist span exceeds this
  beamSpliceOverlap: 24,          // inches minimum overlap at splice
  beamSpliceBolts: 4,             // 3/8" SS thru bolts per splice
  maxBeamSpan: 240,               // inches (20'), absolute max from tables
  saltWaterExclusion: 1,          // miles, cannot install within this distance
  postBuryProhibited: true,       // steel posts must NOT be buried underground
  // Deflection limits (same as wood IRC)
  liveLoadDeflection: 360,        // L/360
  totalLoadDeflection: 240,       // L/240
};

// -----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// -----------------------------------------------------------------------------

/** Convert [feet, inches] to total inches */
function spanToInches(span) {
  if (!span) return 0;
  return span[0] * 12 + span[1];
}

/** Convert total inches to [feet, inches] */
function inchesToSpan(totalInches) {
  return [Math.floor(totalInches / 12), totalInches % 12];
}

/** Look up max joist span for given parameters */
function steelJoistMaxSpan(loadCase, gauge, spacingOC) {
  const lc = STEEL_JOIST_SPANS[loadCase];
  if (!lc) return null;
  const g = lc[gauge + "ga"];
  if (!g) return null;
  return g[spacingOC] || null;
}

/** Look up max single beam span */
function steelSingleBeamMaxSpan(loadCase, joistSpanFt, joistCantileverKey) {
  const table = STEEL_SINGLE_BEAM_SPANS[loadCase];
  if (!table) return null;
  const cantRow = table[joistCantileverKey || "0-0"];
  if (!cantRow) return null;
  return cantRow[joistSpanFt] || null;
}

/** Look up max double beam span */
function steelDoubleBeamMaxSpan(loadCase, joistSpanFt, joistCantileverKey) {
  const table = STEEL_DOUBLE_BEAM_SPANS[loadCase];
  if (!table) return null;
  const cantRow = table[joistCantileverKey || "0-0"];
  if (!cantRow) return null;
  return cantRow[joistSpanFt] || null;
}

/** Look up max post height for given load and tributary area */
function steelMaxPostHeight(snowLoad, tributaryArea) {
  const entries = STEEL_POST_HEIGHTS["3.5"].entries;
  // Find matching entry (match snow load, find largest trib area that fits)
  const matching = entries
    .filter(e => e.sl === snowLoad && e.maxTribArea >= tributaryArea)
    .sort((a, b) => a.maxTribArea - b.maxTribArea);
  return matching.length > 0 ? matching[0].maxHeight : null;
}

/** Determine if single beam works, or if double beam is needed */
function steelBeamType(loadCase, joistSpanFt, joistCantileverKey, requiredBeamSpanInches) {
  const singleMax = steelSingleBeamMaxSpan(loadCase, joistSpanFt, joistCantileverKey);
  if (singleMax && spanToInches(singleMax) >= requiredBeamSpanInches) {
    return { type: "single", maxSpan: singleMax };
  }
  const doubleMax = steelDoubleBeamMaxSpan(loadCase, joistSpanFt, joistCantileverKey);
  if (doubleMax && spanToInches(doubleMax) >= requiredBeamSpanInches) {
    return { type: "double", maxSpan: doubleMax };
  }
  return { type: "exceeds", maxSpan: null };
}

/**
 * DS4 Validator + Coverage Report
 * Validates the new grouped DS4 structure and reports category-level coverage.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ds4Path   = path.join(__dirname, '../datasets/DS4_faq.json');
const topicPath = path.join(__dirname, '../scripts/ds4_topic_candidates.json');

// ─── Load ─────────────────────────────────────────────────────────────────────
if (!fs.existsSync(ds4Path)) { console.error('DS4_faq.json not found!'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(ds4Path, 'utf8'));

const topicCandidates = fs.existsSync(topicPath)
  ? JSON.parse(fs.readFileSync(topicPath, 'utf8'))
  : [];

// ─── Counters ─────────────────────────────────────────────────────────────────
let totalRecords        = data.length;
let totalVariants       = 0;

let mapDS1 = 0, mapDS2 = 0, mapDS3 = 0, mapDS7 = 0;

const idSet             = new Set();
let duplicateIds        = 0;

const globalQSet        = new Set();
let duplicateQuestions  = 0;

let invalidRefs         = 0;
let legacyRefs          = 0;
let emptyQArrays        = 0;
let emptyQuestions      = 0;
let tanglishQuestions   = 0;
let missingRequiredFields = 0;

// Coverage tracking
const foundKurals       = new Set();
const foundAdhigarams   = new Set();
let bioCount            = 0;
let factCount           = 0;

// Category variant counts
let kuralLookup         = 0;
let kuralRequest        = 0;
let kuralMeaning        = 0;
let kuralExplanation    = 0;
let adhigaramLookup     = 0;
let adhigaramExplan     = 0;
let biographyQ          = 0;
let generalFactQ        = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalize(q) {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasLatin(q) {
  return /[a-zA-Z]/.test(q);
}

// Category detection heuristics (Tamil-only)
function detectCategory(q, ref) {
  if (/^K\d{4}$/.test(ref)) {
    const normalized = q;
    if (/விளக்க|விளக்கம்|எளிமையாக/.test(normalized))  return 'KURAL_EXPLANATION';
    if (/பொருள்|கருத்து|அர்த்தம்|என்ன சொல்லுது/.test(normalized)) return 'KURAL_MEANING';
    if (/சொல்லுங்கள்|சொல்லுங்க|சொல்லு|கேட்கணும்|கூறுங்கள்/.test(normalized)) return 'KURAL_REQUEST';
    return 'KURAL_LOOKUP';
  }
  if (/^A\d{3}$/.test(ref)) {
    if (/விளக்க|கருத்து|என்ன சொல்கிறது|எதைப் பற்றியது/.test(q)) return 'ADHIGARAM_EXPLANATION';
    return 'ADHIGARAM_LOOKUP';
  }
  if (/^BIO\d{3}$/.test(ref)) return 'BIOGRAPHY';
  if (/^F\d{3}$/.test(ref))   return 'GENERAL_FACT';
  return 'UNKNOWN';
}

// ─── Main validation loop ─────────────────────────────────────────────────────
for (const record of data) {
  // Required fields
  if (!record.id || !Array.isArray(record.questions) || !record.answer_reference) {
    missingRequiredFields++;
    continue;
  }

  // Unique ID
  if (idSet.has(record.id)) duplicateIds++;
  idSet.add(record.id);

  // Empty question array
  if (record.questions.length === 0) emptyQArrays++;

  // Answer reference validation
  const ref = record.answer_reference;
  let isValid = false;

  if (/^K\d{4}$/.test(ref)) {
    const n = parseInt(ref.substring(1), 10);
    if (n >= 1 && n <= 1330) { isValid = true; mapDS1++; foundKurals.add(ref); }
  } else if (/^A\d{3}$/.test(ref)) {
    const n = parseInt(ref.substring(1), 10);
    if (n >= 1 && n <= 133)  { isValid = true; mapDS2++; foundAdhigarams.add(ref); }
  } else if (/^BIO\d{3}$/.test(ref)) {
    const n = parseInt(ref.substring(3), 10);
    if (n >= 1 && n <= 50)   { isValid = true; mapDS3++; bioCount++; }
  } else if (/^F\d{3}$/.test(ref)) {
    const n = parseInt(ref.substring(1), 10);
    if (n >= 1 && n <= 4)    { isValid = true; mapDS7++; factCount++; }
  } else {
    legacyRefs++;
  }
  if (!isValid) invalidRefs++;

  // ID ↔ reference consistency for K and A records
  if ((/^K\d{4}$/.test(record.id) || /^A\d{3}$/.test(record.id)) && record.id !== record.answer_reference) {
    invalidRefs++;
  }

  // Per-question checks
  for (const q of record.questions) {
    totalVariants++;
    if (typeof q !== 'string' || q.trim() === '') { emptyQuestions++; continue; }

    const key = normalize(q);
    if (globalQSet.has(key)) duplicateQuestions++;
    globalQSet.add(key);

    if (hasLatin(q)) tanglishQuestions++;

    // Category counts
    const cat = detectCategory(q, ref);
    if (cat === 'KURAL_LOOKUP')          kuralLookup++;
    else if (cat === 'KURAL_REQUEST')    kuralRequest++;
    else if (cat === 'KURAL_MEANING')    kuralMeaning++;
    else if (cat === 'KURAL_EXPLANATION') kuralExplanation++;
    else if (cat === 'ADHIGARAM_LOOKUP') adhigaramLookup++;
    else if (cat === 'ADHIGARAM_EXPLANATION') adhigaramExplan++;
    else if (cat === 'BIOGRAPHY')        biographyQ++;
    else if (cat === 'GENERAL_FACT')     generalFactQ++;
  }
}

// ─── Missing coverage ─────────────────────────────────────────────────────────
const missingKurals     = [];
for (let i = 1; i <= 1330; i++) {
  const id = 'K' + String(i).padStart(4, '0');
  if (!foundKurals.has(id)) missingKurals.push(id);
}

const missingAdhigarams = [];
for (let i = 1; i <= 133; i++) {
  const id = 'A' + String(i).padStart(3, '0');
  if (!foundAdhigarams.has(id)) missingAdhigarams.push(id);
}

// ─── Per-record stats ─────────────────────────────────────────────────────────
const kuralRecords = data.filter(r => /^K\d{4}$/.test(r.answer_reference));
const adhigaramRecords = data.filter(r => /^A\d{3}$/.test(r.answer_reference));

function minMaxAvg(records) {
  if (!records.length) return { min: 0, max: 0, avg: 0 };
  let min = Infinity, max = -Infinity, sum = 0;
  for (const r of records) {
    const l = r.questions.length;
    if (l < min) min = l;
    if (l > max) max = l;
    sum += l;
  }
  return { min, max, avg: (sum / records.length).toFixed(2) };
}

const kuralStats = minMaxAvg(kuralRecords);
const adhiStats  = minMaxAvg(adhigaramRecords);

// ─── Report ───────────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════');
console.log('          DS4 VALIDATION REPORT        ');
console.log('═══════════════════════════════════════');
console.log('');
console.log(`Total records          : ${totalRecords}`);
console.log(`Total question variants: ${totalVariants}`);
console.log('');
console.log(`Kural records          : ${mapDS1} / 1330`);
console.log(`Adhigaram records      : ${mapDS2} / 133`);
console.log(`Biography records      : ${bioCount}`);
console.log(`Fixed fact records     : ${mapDS7} / 4`);
console.log('');
console.log(`Missing Kurals         : ${missingKurals.length}${missingKurals.length ? '  → ' + missingKurals.join(', ') : ''}`);
console.log(`Missing Adhigarams     : ${missingAdhigarams.length}${missingAdhigarams.length ? '  → ' + missingAdhigarams.join(', ') : ''}`);
console.log('');
console.log(`Duplicate IDs          : ${duplicateIds}`);
console.log(`Duplicate questions    : ${duplicateQuestions}`);
console.log(`Invalid references     : ${invalidRefs}`);
console.log(`Legacy references      : ${legacyRefs}`);
console.log(`Empty question arrays  : ${emptyQArrays}`);
console.log(`Empty questions        : ${emptyQuestions}`);
console.log(`Tanglish questions     : ${tanglishQuestions}`);
console.log(`Missing required fields: ${missingRequiredFields}`);
console.log('');
console.log('───────────────────────────────────────');
console.log('       QUESTION COVERAGE BY INTENT     ');
console.log('───────────────────────────────────────');
console.log(`Kural lookup           : ${kuralLookup}`);
console.log(`Kural request          : ${kuralRequest}`);
console.log(`Kural meaning          : ${kuralMeaning}`);
console.log(`Kural explanation      : ${kuralExplanation}`);
console.log(`Adhigaram lookup       : ${adhigaramLookup}`);
console.log(`Adhigaram explanation  : ${adhigaramExplan}`);
console.log(`Biography              : ${biographyQ}`);
console.log(`General facts          : ${generalFactQ}`);
console.log(`Deferred topic q's     : ${topicCandidates.length}`);
console.log(`TOTAL                  : ${totalVariants}`);
console.log('');
console.log('───────────────────────────────────────');
console.log('          PER-RECORD STATISTICS        ');
console.log('───────────────────────────────────────');
console.log(`Avg questions / Kural  : ${kuralStats.avg}`);
console.log(`Min questions / Kural  : ${kuralStats.min}`);
console.log(`Max questions / Kural  : ${kuralStats.max}`);
console.log(`Avg questions / Adhig  : ${adhiStats.avg}`);
console.log(`Min questions / Adhig  : ${adhiStats.min}`);
console.log(`Max questions / Adhig  : ${adhiStats.max}`);
console.log('');

const ok = (duplicateIds + duplicateQuestions + invalidRefs + legacyRefs +
            emptyQArrays + emptyQuestions + tanglishQuestions +
            missingKurals.length + missingAdhigarams.length +
            missingRequiredFields) === 0;
console.log(`JSON Structure Valid   : true`);
console.log(`Overall               : ${ok ? '✓ PASS' : '✗ FAIL — fix issues above'}`);
console.log('');

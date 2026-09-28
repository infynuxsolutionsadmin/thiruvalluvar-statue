/**
 * DS4 Expansion Script
 *
 * Reads existing DS4_faq.json and expands each record with additional
 * natural Tamil question variants covering:
 *   - KURAL_LOOKUP       (existing)
 *   - KURAL_REQUEST      (new)
 *   - KURAL_MEANING      (new, explicit number-based only)
 *   - KURAL_EXPLANATION  (new, explicit number-based only)
 *   - ADHIGARAM_LOOKUP   (existing)
 *   - ADHIGARAM_EXPLANATION (new)
 *
 * Rules:
 *  - Tamil Unicode only. No Tanglish / English.
 *  - No ambiguous deictic ("இந்த குறள்") globally mapped.
 *  - No topic questions (deferred to ds4_topic_candidates.json).
 *  - No invented content from DS1/DS2.
 *  - Deduplicate within each record and across all records.
 */

const fs = require('fs');
const path = require('path');

const ds4Path   = path.join(__dirname, '../datasets/DS4_faq.json');
const topicPath = path.join(__dirname, '../scripts/ds4_topic_candidates.json');

// ─── Load existing DS4 ────────────────────────────────────────────────────────
const ds4 = JSON.parse(fs.readFileSync(ds4Path, 'utf8'));

// Track all question strings globally for cross-record dedup
const globalQSet = new Set();

// Pre-populate with all existing questions (normalized key → original kept as-is)
for (const rec of ds4) {
  for (const q of rec.questions) {
    globalQSet.add(normalize(q));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalize(q) {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Add a candidate question to a record if it isn't already present globally */
function tryAdd(rec, q) {
  const key = normalize(q);
  if (!globalQSet.has(key) && q.trim().length > 0) {
    rec.questions.push(q);
    globalQSet.add(key);
    return true;
  }
  return false;
}

// ─── Tamil ordinal word map (1–133 for adhigarams, 1–20 special for kurals) ──
// Only grammatically correct forms used here.
const tamilOrdinals = {
  1:   'முதல்',
  2:   'இரண்டாவது',
  3:   'மூன்றாவது',
  4:   'நான்காவது',
  5:   'ஐந்தாவது',
  6:   'ஆறாவது',
  7:   'ஏழாவது',
  8:   'எட்டாவது',
  9:   'ஒன்பதாவது',
  10:  'பத்தாவது',
  11:  'பதினொன்றாவது',
  12:  'பன்னிரண்டாவது',
  13:  'பதின்மூன்றாவது',
  14:  'பதிநான்காவது',
  15:  'பதினைந்தாவது',
  16:  'பதினாறாவது',
  17:  'பதினேழாவது',
  18:  'பதினெட்டாவது',
  19:  'பத்தொன்பதாவது',
  20:  'இருபதாவது',
  50:  'ஐம்பதாவது',
  100: 'நூறாவது',
  133: 'நூற்று முப்பத்து மூன்றாவது',
  1330:'ஆயிரத்து முந்நூற்று முப்பதாவது',
};

function tamilOrd(n) {
  return tamilOrdinals[n] || null;
}

// ─── Deferred topic questions (not inserted into DS4) ─────────────────────────
const topicCandidates = [
  { question: "அன்பைப் பற்றி ஒரு குறள் சொல்லுங்க",         reason: "Multiple Kurals cover love/compassion; requires topic retrieval", status: "DEFERRED" },
  { question: "நட்பு பற்றி திருக்குறள் என்ன சொல்கிறது?",   reason: "Adhigaram A079 covers friendship but multiple Kurals exist; topic retrieval needed", status: "DEFERRED" },
  { question: "கல்வி பற்றி ஒரு குறள் சொல்லுங்க",           reason: "Multiple Kurals in Adhigaram A040; topic retrieval needed", status: "DEFERRED" },
  { question: "ஒழுக்கம் பற்றி ஒரு குறள் சொல்லுங்க",       reason: "Multiple Kurals across adhigarams; topic retrieval needed", status: "DEFERRED" },
  { question: "பொருளைப் பற்றி திருவள்ளுவர் என்ன சொல்கிறார்?", reason: "Entire Porutpal section; requires topic retrieval", status: "DEFERRED" },
  { question: "ஒரு நல்ல மனைவியின் பண்புகள் என்ன?",         reason: "Known false-positive case; no deterministic Kural mapping", status: "DEFERRED" },
  { question: "வாழ்க்கையில் வெற்றி பெற என்ன செய்யணும்?",   reason: "Broad life-advice question; no deterministic single mapping", status: "DEFERRED" },
  { question: "தர்மம் பற்றி திருக்குறள் என்ன சொல்கிறது?",  reason: "Topic spans multiple adhigarams; requires topic retrieval", status: "DEFERRED" },
];

fs.writeFileSync(topicPath, JSON.stringify(topicCandidates, null, 2), 'utf8');

// ─── Expand each record ───────────────────────────────────────────────────────
for (const rec of ds4) {
  const ref = rec.answer_reference;

  // ── Kural records ─────────────────────────────────────────────────────────
  if (/^K\d{4}$/.test(ref)) {
    const n = parseInt(ref.substring(1), 10);
    const ord = tamilOrd(n);

    // KURAL_REQUEST variants
    tryAdd(rec, `${n}வது குறளை சொல்லுங்கள்`);
    tryAdd(rec, `${n}ம் குறளை சொல்லுங்கள்`);
    tryAdd(rec, `${n}வது குறளை கேட்கணும்`);
    if (ord) {
      tryAdd(rec, `${ord} குறளை சொல்லுங்க`);
      tryAdd(rec, `${ord} திருக்குறள் சொல்லுங்கள்`);
    }
    if (n === 1) {
      tryAdd(rec, 'முதல் குறளை சொல்லுங்கள்');
      tryAdd(rec, 'முதலாவது திருக்குறள் சொல்லுங்க');
    }
    if (n === 1330) {
      tryAdd(rec, 'கடைசி குறளை சொல்லுங்கள்');
      tryAdd(rec, 'கடைசி திருக்குறள் என்ன?');
    }

    // KURAL_MEANING variants (explicit number — deterministic)
    tryAdd(rec, `${n}வது குறளின் பொருள் என்ன?`);
    tryAdd(rec, `${n}ம் குறள் என்ன சொல்லுது?`);
    tryAdd(rec, `${n}வது குறளின் கருத்து என்ன?`);
    if (ord) {
      tryAdd(rec, `${ord} குறளின் பொருள் என்ன?`);
      tryAdd(rec, `${ord} குறளின் கருத்து என்ன?`);
    }

    // KURAL_EXPLANATION variants (explicit number — deterministic)
    tryAdd(rec, `${n}வது குறளை விளக்குங்க`);
    tryAdd(rec, `${n}வது குறளின் விளக்கம் என்ன?`);
    tryAdd(rec, `${n}ம் குறளை எளிமையாக விளக்குங்க`);
    if (ord) {
      tryAdd(rec, `${ord} குறளை விளக்குங்க`);
    }
    if (n === 1) {
      tryAdd(rec, 'முதல் குறளின் பொருள் என்ன?');
      tryAdd(rec, 'முதல் குறளை விளக்குங்க');
    }
    if (n === 1330) {
      tryAdd(rec, 'கடைசி குறளின் பொருள் என்ன?');
    }
  }

  // ── Adhigaram records ──────────────────────────────────────────────────────
  else if (/^A\d{3}$/.test(ref)) {
    const n = parseInt(ref.substring(1), 10);
    const ord = tamilOrd(n);

    // ADHIGARAM_LOOKUP additional variants
    tryAdd(rec, `${n}வது அதிகாரம் எது?`);
    tryAdd(rec, `${n}ம் அதிகாரம் சொல்லுங்கள்`);
    if (ord) {
      tryAdd(rec, `${ord} அதிகாரம் என்ன?`);
      tryAdd(rec, `${ord} அதிகாரம் சொல்லுங்க`);
    }
    if (n === 1) {
      tryAdd(rec, 'முதல் அதிகாரம் எது?');
      tryAdd(rec, 'முதல் அதிகாரம் சொல்லுங்கள்');
    }
    if (n === 133) {
      tryAdd(rec, 'கடைசி அதிகாரம் என்ன?');
      tryAdd(rec, 'கடைசி அதிகாரம் சொல்லுங்க');
    }

    // ADHIGARAM_EXPLANATION variants
    tryAdd(rec, `${n}வது அதிகாரம் எதைப் பற்றியது?`);
    tryAdd(rec, `${n}வது அதிகாரத்தின் கருத்து என்ன?`);
    tryAdd(rec, `${n}வது அதிகாரம் பற்றி விளக்குங்க`);
    tryAdd(rec, `${n}ம் அதிகாரம் என்ன சொல்கிறது?`);
    if (ord) {
      tryAdd(rec, `${ord} அதிகாரம் எதைப் பற்றியது?`);
      tryAdd(rec, `${ord} அதிகாரத்தை விளக்குங்க`);
    }
    if (n === 1) {
      tryAdd(rec, 'முதல் அதிகாரம் எதைப் பற்றியது?');
      tryAdd(rec, 'முதல் அதிகாரத்தின் கருத்து என்ன?');
    }
  }

  // ── BIO records ────────────────────────────────────────────────────────────
  else if (/^BIO\d{3}$/.test(ref)) {
    if (ref === 'BIO001') {
      tryAdd(rec, 'திருவள்ளுவரைப் பற்றி கொஞ்சம் சொல்லுங்கள்');
      tryAdd(rec, 'வள்ளுவர் பற்றி சொல்லுங்க');
      tryAdd(rec, 'திருவள்ளுவர் வரலாறு சொல்லுங்கள்');
      tryAdd(rec, 'வள்ளுவரைப் பற்றி சொல்ல முடியுமா?');
    }
  }

  // ── DS7 fact records ───────────────────────────────────────────────────────
  else if (/^F\d{3}$/.test(ref)) {
    if (ref === 'F001') {
      tryAdd(rec, 'திருக்குறளில் எத்தனை குறள்?');
      tryAdd(rec, 'எத்தனை குறள்கள் உள்ளன?');
    } else if (ref === 'F002') {
      tryAdd(rec, 'திருக்குறளில் எத்தனை அதிகாரம் உள்ளது?');
      tryAdd(rec, 'எத்தனை அதிகாரங்கள் உள்ளன?');
    } else if (ref === 'F003') {
      tryAdd(rec, 'திருக்குறளில் எத்தனை பிரிவுகள் உள்ளன?');
      tryAdd(rec, 'திருக்குறள் எத்தனை பாகங்களாக பிரிக்கப்பட்டுள்ளது?');
    } else if (ref === 'F004') {
      tryAdd(rec, 'திருக்குறளை இயற்றியவர் யார்?');
      tryAdd(rec, 'திருக்குறளுக்கு ஆசிரியர் யார்?');
    }
  }
}

// ─── Write expanded DS4 atomically ───────────────────────────────────────────
const tmpPath = ds4Path + '.tmp';
fs.writeFileSync(tmpPath, JSON.stringify(ds4, null, 2), 'utf8');
fs.renameSync(tmpPath, ds4Path);

// ─── Summary ──────────────────────────────────────────────────────────────────
const totalQ = ds4.reduce((sum, r) => sum + r.questions.length, 0);
console.log(`DS4 EXPANSION COMPLETE`);
console.log(`Records          : ${ds4.length}`);
console.log(`Question variants: ${totalQ}`);
console.log(`Topic candidates : ${topicCandidates.length} (deferred — see scripts/ds4_topic_candidates.json)`);

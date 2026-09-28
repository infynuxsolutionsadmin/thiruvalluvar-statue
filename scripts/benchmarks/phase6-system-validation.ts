

const BASE_URL = 'http://localhost:3000';
const KNOWLEDGE_URL = `${BASE_URL}/api/v1/knowledge/query`;

interface TestCase {
  category: string;
  query: string;
  expectedRef: string | 'UNKNOWN';
}

const testCases: TestCase[] = [
  // A. EXACT KURAL
  { category: 'EXACT_KURAL', query: 'குறள் 1 என்ன?', expectedRef: 'K0001' },
  { category: 'EXACT_KURAL', query: 'குறள் 101 என்ன?', expectedRef: 'K0101' },
  { category: 'EXACT_KURAL', query: 'குறள் 1330 என்ன?', expectedRef: 'K1330' },
  
  // B. TAMIL NUMERAL
  { category: 'TAMIL_NUMERAL', query: 'குறள் ௧௦௧ என்ன?', expectedRef: 'K0101' },
  { category: 'TAMIL_NUMERAL', query: 'நூற்று ஒன்றாவது குறள் என்ன?', expectedRef: 'K0101' },
  { category: 'TAMIL_NUMERAL', query: 'ஐநூற்று இருபத்தி ஒன்பதாவது குறள் என்ன?', expectedRef: 'K0529' },
  
  // C. KURAL MEANING
  { category: 'KURAL_MEANING', query: '101வது குறளின் பொருள் என்ன?', expectedRef: 'K0101' },
  { category: 'KURAL_MEANING', query: '101வது குறளை விளக்குங்க', expectedRef: 'K0101' },
  
  // D. KURAL-SPECIFIC SEMANTIC
  { category: 'KURAL_SPECIFIC_SEMANTIC', query: 'கற்ற கல்வியை சரியாக பயன்படுத்த வேண்டும் என்று சொல்லும் குறள் எது?', expectedRef: 'K0391' },
  { category: 'KURAL_SPECIFIC_SEMANTIC', query: 'ஒருவர் செய்த உதவியை மறக்காமல் இருப்பது பற்றி என்ன குறள்?', expectedRef: 'K0108' },
  
  // E. ADHIGARAM GENERAL
  { category: 'ADHIGARAM_GENERAL', query: 'கல்வி ஏன் முக்கியம்?', expectedRef: 'A040' },
  { category: 'ADHIGARAM_GENERAL', query: 'நட்பு பற்றி சொல்லுங்கள்', expectedRef: 'A079' },
  { category: 'ADHIGARAM_GENERAL', query: 'கோபத்தை அடக்குவது எப்படி?', expectedRef: 'A031' },
  { category: 'ADHIGARAM_GENERAL', query: 'வாழ்க்கையில் கஷ்டங்கள் வந்தால் எப்படி சமாளிக்க வேண்டும்?', expectedRef: 'A063' },
  
  // F. ADHIGARAM SPECIFIC
  { category: 'ADHIGARAM_SPECIFIC', query: 'நட்பைப் பற்றிய அதிகாரம் என்ன?', expectedRef: 'A079' },
  { category: 'ADHIGARAM_SPECIFIC', query: 'கல்வியைப் பற்றிய அதிகாரம் என்ன?', expectedRef: 'A040' },
  
  // G. BIOGRAPHY
  { category: 'BIOGRAPHY', query: 'திருவள்ளுவர் யார்?', expectedRef: 'BIO001' },
  { category: 'BIOGRAPHY', query: 'திருவள்ளுவர் பற்றி சொல்லுங்கள்', expectedRef: 'BIO001' },
  
  // H. FACTS
  { category: 'FACTS', query: 'திருக்குறளில் எத்தனை குறள்கள் உள்ளன?', expectedRef: 'F001' },
  { category: 'FACTS', query: 'எத்தனை அதிகாரங்கள் உள்ளன?', expectedRef: 'F002' },
  { category: 'FACTS', query: 'திருக்குறளில் எத்தனை பால் இருக்கிறது?', expectedRef: 'F003' },
  { category: 'FACTS', query: 'திருக்குறளை எழுதியவர் யார்?', expectedRef: 'F004' },
  
  // I. SAFETY / UNKNOWN
  { category: 'SAFETY_UNKNOWN', query: 'எப்படி நன்றாக தூங்குவது?', expectedRef: 'UNKNOWN' },
  { category: 'SAFETY_UNKNOWN', query: 'அகர', expectedRef: 'UNKNOWN' },
  { category: 'SAFETY_UNKNOWN', query: 'xyzzzwqe', expectedRef: 'UNKNOWN' },
  { category: 'SAFETY_UNKNOWN', query: 'எனக்கு ஏதாவது சொல்லுங்கள்', expectedRef: 'UNKNOWN' },
  { category: 'SAFETY_UNKNOWN', query: 'ஒருவன் எப்படி பேச வேண்டும்?', expectedRef: 'UNKNOWN' },
];

async function runValidation() {
  console.log('========================================');
  console.log('PHASE 6 SYSTEM VALIDATION');
  console.log('========================================\n');

  // 1. Health Check
  console.log('--- 1. HEALTH CHECK ---');
  try {
    const health = await fetch(`${BASE_URL}/health`);
    console.log(`GET /health -> Status: ${health.status}`);
  } catch (e: any) {
    console.log(`GET /health -> FAILED: ${e.message}`);
  }

  console.log('\n--- 2. KNOWLEDGE API VALIDATION ---');
  let passed = 0;
  let failed = 0;
  let latencies: number[] = [];

  for (const tc of testCases) {
    const t0 = Date.now();
    try {
      const res = await fetch(KNOWLEDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: tc.query })
      });
      const data = await res.json();
      const answer = data.answer;
      const dt = Date.now() - t0;
      latencies.push(dt);
      
      const actualRef = answer.dataset === 'UNKNOWN' ? 'UNKNOWN' : answer.reference;

      const isPass = 
        (tc.expectedRef === 'UNKNOWN' && (answer.dataset === 'UNKNOWN' || answer.reference === 'D001')) ||
        (tc.expectedRef === actualRef);

      if (isPass) {
        passed++;
        console.log(`[PASS] ${tc.query} -> ${actualRef} (${dt}ms)`);
      } else {
        failed++;
        console.log(`[FAIL] ${tc.query} -> Expected: ${tc.expectedRef}, Got: ${actualRef} (${dt}ms)`);
        console.log(`       Details: Intent=${answer.intent}, Score=${answer.score}`);
      }
    } catch (e: any) {
      failed++;
      const dt = Date.now() - t0;
      console.log(`[ERROR] ${tc.query} -> ${e.message} (${dt}ms)`);
    }
  }

  console.log('\n--- 3. API ERROR HANDLING ---');
  const errorCases = [
    { name: 'Empty body', payload: {} },
    { name: 'Missing query', payload: { foo: 'bar' } },
    { name: 'Empty string', payload: { query: '' } },
  ];

  for (const ec of errorCases) {
    try {
      const res = await fetch(KNOWLEDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ec.payload)
      });
      if (!res.ok) {
        console.log(`[PASS] ${ec.name} correctly failed with status ${res.status}`);
      } else {
        console.log(`[FAIL] ${ec.name} should have failed but succeeded.`);
      }
    } catch (e: any) {
      console.log(`[PASS] ${ec.name} correctly failed with error ${e.message}`);
    }
  }

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log(`Total Knowledge Tests: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  const avgLat = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
  console.log(`Avg Latency: ${avgLat.toFixed(2)} ms`);
  console.log('========================================');
}

runValidation().catch(console.error);

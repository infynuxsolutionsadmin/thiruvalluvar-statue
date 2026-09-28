// Quick diagnostics to understand what the regex engine sees
const q1 = '101வது குறளை சொல்லுங்க';
const q2 = '101வது குறளின் பொருள் என்ன?';

// Test 1: does the broad unicode range match?
const p1 = /(\d+)[\u0B80-\u0BFF]*\s*(?:\u0BA4\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BC1\u0BB1\u0BB3\u0BCD|\u0B95\u0BC1\u0BB1\u0BB3)/;
console.log('Pattern 1 on q1:', p1.test(q1), q1.match(p1));

// Test 2: does a simple digit+space+kural match?
const p2 = /(\d+)\s/;
console.log('Pattern 2 on q1:', q1.match(p2));

// Test 3: Check the actual char codes of the word "குறள்"
const word = 'குறள்';
console.log('குறள் charCodes:', [...word].map(c => c.codePointAt(0)?.toString(16)));
console.log('குறளை charCodes:', [...'குறளை'].map(c => c.codePointAt(0)?.toString(16)));

// Test 4: Split on digit
const m = q1.match(/(\d+)/);
console.log('digit match:', m);

// Test 5: does "குறள" (without virama) appear in the strings?
console.log('q1 includes குறள:', q1.includes('குறள'));
console.log('q2 includes குறள:', q2.includes('குறள'));

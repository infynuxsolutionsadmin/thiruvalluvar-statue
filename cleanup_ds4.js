const fs = require('fs');

const ds4 = JSON.parse(fs.readFileSync('datasets/DS4_faq.json', 'utf8'));

function getTamilNumberForms(n) {
  if (n === 1) return ["முதல்", "முதலாவது"];
  
  const ones = ["", "ஒன்றாவது", "இரண்டாவது", "மூன்றாவது", "நான்காவது", "ஐந்தாவது", "ஆறாவது", "ஏழாவது", "எட்டாவது", "ஒன்பதாவது"];
  const teens = ["பத்தாவது", "பதினொன்றாவது", "பன்னிரண்டாவது", "பதிமூன்றாவது", "பதினான்காவது", "பதினைந்தாவது", "பதினாறாவது", "பதினேழாவது", "பதினெட்டாவது", "பத்தொன்பதாவது"];
  
  const tensVariants = {
    2: ["இருபத்து", "இருபத்தி"],
    3: ["முப்பத்து", "முப்பத்தி"],
    4: ["நாற்பத்து", "நாற்பத்தி"],
    5: ["ஐம்பத்து", "ஐம்பத்தி"],
    6: ["அறுபத்து", "அறுபத்தி"],
    7: ["எழுபத்து", "எழுபத்தி"],
    8: ["எண்பத்து", "எண்பத்தி"],
    9: ["தொண்ணூற்று", "தொண்ணூத்தி"]
  };
  
  const hundredsVariants = {
    1: ["நூற்று", "நூற்றி"],
    2: ["இருநூற்று", "இருநூத்தி"],
    3: ["முன்னூற்று", "முன்னூத்தி"],
    4: ["நானூற்று", "நானூத்தி"],
    5: ["ஐநூற்று", "ஐநூத்தி"],
    6: ["அறுநூற்று", "அறுநூத்தி"],
    7: ["எழுநூற்று", "எழுநூத்தி"],
    8: ["எண்ணூற்று", "எட்நூற்று"],
    9: ["தொள்ளாயிரத்து", "தொள்ளாயிரத்தி"]
  };

  const thousandVariants = ["ஆயிரத்து", "ஆயிரத்தி"];
  
  let forms = ["", ""];
  let remaining = n;
  
  if (remaining >= 1000) {
    if (remaining === 1000) {
      return ["ஆயிரமாவது", "ஆயிரமாவது"];
    } else {
      forms[0] += thousandVariants[0] + " ";
      forms[1] += thousandVariants[1] + " ";
    }
    remaining %= 1000;
  }
  
  if (remaining >= 100) {
    let h = Math.floor(remaining / 100);
    if (remaining % 100 === 0) {
      const exactHundreds = {
        1: "நூறாவது", 2: "இருநூறாவது", 3: "முந்நூறாவது", 4: "நானூறாவது",
        5: "ஐந்நூறாவது", 6: "அறுநூறாவது", 7: "எழுநூறாவது", 8: "எண்ணூறாவது", 9: "தொள்ளாயிரமாவது"
      };
      forms[0] += exactHundreds[h];
      forms[1] += exactHundreds[h];
      return forms.map(f => f.trim());
    } else {
      forms[0] += hundredsVariants[h][0] + " ";
      forms[1] += hundredsVariants[h][1] + " ";
    }
    remaining %= 100;
  }
  
  if (remaining > 0) {
    if (remaining < 10) {
      forms[0] += ones[remaining];
      forms[1] += ones[remaining];
    } else if (remaining < 20) {
      forms[0] += teens[remaining - 10];
      forms[1] += teens[remaining - 10];
    } else {
      let t = Math.floor(remaining / 10);
      let u = remaining % 10;
      if (u === 0) {
        const exactTens = {
          2: "இருபதாவது", 3: "முப்பதாவது", 4: "நாற்பதாவது", 5: "ஐம்பதாவது", 
          6: "அறுபதாவது", 7: "எழுபதாவது", 8: "எண்பதாவது", 9: "தொண்ணூறாவது"
        };
        forms[0] += exactTens[t];
        forms[1] += t === 5 ? "அம்பதாவது" : exactTens[t];
      } else {
        forms[0] += tensVariants[t][0] + " " + ones[u];
        forms[1] += tensVariants[t][1] + " " + ones[u];
      }
    }
  }
  
  return forms.map(f => f.trim());
}

const numberWords = new Set([
  'ஆயிரத்து', 'ஆயிரத்தி', 'ஆயிரம்', 'ஆயிரமாவது',
  'தொள்ளாயிரத்து', 'தொள்ளாயிரத்தி', 'தொள்ளாயிரம்', 'தொள்ளாயிரமாவது',
  'எண்ணூற்று', 'எண்ணூத்தி', 'எண்ணூற்றி', 'எட்நூற்று', 'எட்நூத்தி', 'எண்ணூறு', 'எண்ணூறாவது',
  'எழுநூற்று', 'எழுநூத்தி', 'எழுநூற்றி', 'எழுநூறு', 'எழுநூறாவது',
  'அறுநூற்று', 'அறுநூத்தி', 'அறுநூற்றி', 'அறுநூறு', 'அறுநூறாவது',
  'ஐந்நூற்று', 'ஐந்நூத்தி', 'ஐந்நூற்றி', 'ஐநூற்று', 'ஐநூத்தி', 'ஐநூற்றி', 'ஐந்நூறு', 'ஐந்நூறாவது', 'ஐநூறு', 'ஐநூறாவது',
  'நானூற்று', 'நானூத்தி', 'நானூற்றி', 'நானூறு', 'நானூறாவது',
  'முந்நூற்று', 'முந்நூத்தி', 'முந்நூற்றி', 'முன்னூற்று', 'முன்னூத்தி', 'முன்னூற்றி', 'முந்நூறு', 'முந்நூறாவது', 'முன்னூறு', 'முன்னூறாவது',
  'இருநூற்று', 'இருநூத்தி', 'இருநூற்றி', 'இருநூறு', 'இருநூறாவது', 'இரநூற்று', 'இரநூத்தி', 'இரநூற்றி', 'இரநூறு', 'இரநூறாவது',
  'நூற்று', 'நூத்தி', 'நூற்றி', 'நூறு', 'நூறாவது',
  'தொண்ணூற்று', 'தொண்ணூத்தி', 'தொண்ணூற்றி', 'தொண்ணூறு', 'தொண்ணூறாவது',
  'எண்பத்து', 'எண்பத்தி', 'எண்பது', 'எண்பதாவது', 'எம்பத்து', 'எம்பத்தி', 'எம்பது', 'எம்பதாவது',
  'எழுபத்து', 'எழுபத்தி', 'எழுபது', 'எழுபதாவது',
  'அறுபத்து', 'அறுபத்தி', 'அறுபது', 'அறுபதாவது',
  'ஐம்பத்து', 'ஐம்பத்தி', 'ஐம்பது', 'ஐம்பதாவது', 'அம்பத்து', 'அம்பத்தி', 'அம்பது', 'அம்பதாவது',
  'நாற்பத்து', 'நாற்பத்தி', 'நாற்பது', 'நாற்பதாவது', 'நாப்பத்து', 'நாப்பத்தி', 'நாப்பது', 'நாப்பதாவது',
  'முப்பத்து', 'முப்பத்தி', 'முப்பது', 'முப்பதாவது',
  'இருபத்து', 'இருபத்தி', 'இருபது', 'இருபதாவது',
  'பத்தொன்பது', 'பத்தொன்பதாவது',
  'பதினெட்டு', 'பதினெட்டாவது',
  'பதினேழு', 'பதினேழாவது',
  'பதினாறு', 'பதினாறாவது',
  'பதினைந்து', 'பதினைந்தாவது',
  'பதினான்கு', 'பதினான்காவது',
  'பதிமூன்று', 'பதிமூன்றாவது', 'பதின்மூன்று', 'பதின்மூன்றாவது',
  'பன்னிரண்டு', 'பன்னிரண்டாவது', 'பனிரண்டு', 'பனிரண்டாவது',
  'பதினொன்று', 'பதினொன்றாவது', 'பதினோரு', 'பதினோராவது',
  'பத்து', 'பத்தி', 'பத்தாவது',
  'ஒன்பது', 'ஒன்பதாவது',
  'எட்டு', 'எட்டாவது',
  'ஏழு', 'ஏழாவது',
  'ஆறு', 'ஆறாவது',
  'ஐந்து', 'ஐந்தாவது', 'அஞ்சு', 'அஞ்சாவது',
  'நான்கு', 'நான்காவது', 'நாலு', 'நாலாவது',
  'மூன்று', 'மூன்றாவது', 'மூனு', 'மூனாவது',
  'இரண்டு', 'இரண்டாவது', 'ரெண்டு', 'ரெண்டாவது',
  'ஒன்று', 'ஒன்றாவது', 'முதல்', 'முதலாவது', 'முதலாம்', 'ஒன்னு', 'ஒன்னாவது'
]);

function isPureNumberedRequest(q) {
  // Remove valid non-number related intent words
  if (q.includes('பொருள்') || q.includes('கருத்து') || q.includes('விளக்கு') || q.includes('விளக்கம்') || q.includes('பற்றி')) {
    return false;
  }
  
  // Clean up the query string
  let cleaned = q.replace(/\?/g, '').trim().replace(/\s+/g, ' ');
  let tokens = cleaned.split(' ');
  
  // Check if every token is either a number word, digit with suffix, or boilerplate request word
  let boilerplate = new Set(['குறள்', 'குறளை', 'திருக்குறள்', 'திருக்குறளை', 'அதிகாரம்', 'அதிகாரத்தை', 'என்ன', 'எது', 'சொல்லு', 'சொல்லுங்க', 'சொல்லுங்கள்', 'சொல்லிக்', 'கொடுங்க']);
  
  for (let t of tokens) {
    if (numberWords.has(t)) continue;
    if (boilerplate.has(t)) continue;
    if (/^\d+(வது|ம்|ஆம்|ஆவது)?$/.test(t)) continue;
    
    // If it's a word we don't recognize as pure number/boilerplate, it's not a pure number request
    return false;
  }
  
  return true;
}

let kuralQuestionsRemoved = 0;
let adhigaramQuestionsRemoved = 0;

for (let entry of ds4) {
  const ref = entry.answer_reference;
  let isKural = ref.startsWith('K');
  let isAdhigaram = ref.startsWith('A');
  
  if (!isKural && !isAdhigaram) continue;
  
  const num = parseInt(ref.replace(/[KA]/, ''), 10);
  
  let newQs = [];
  let originalLen = entry.questions.length;
  
  for (let q of entry.questions) {
    if (!isPureNumberedRequest(q)) {
      newQs.push(q);
    }
  }
  
  // Add the 2 representative queries
  const typeStr = isKural ? 'குறள்' : 'அதிகாரம்';
  
  const rep1 = `${num}வது ${typeStr} என்ன?`;
  
  // For the Tamil form, let's use the first form (the formal variant, which matches user's exact examples)
  // Or if it's 1, 'முதல்'. 
  const forms = getTamilNumberForms(num);
  let rep2;
  if (num === 1) {
    rep2 = `முதல் ${typeStr} என்ன?`;
  } else {
    rep2 = `${forms[0]} ${typeStr} என்ன?`;
  }
  
  if (!newQs.includes(rep1)) newQs.unshift(rep1);
  if (!newQs.includes(rep2)) newQs.unshift(rep2);
  
  // Deduplicate
  entry.questions = [...new Set(newQs)];
  
  let removed = originalLen - entry.questions.length;
  if (removed > 0) {
    if (isKural) kuralQuestionsRemoved += removed;
    if (isAdhigaram) adhigaramQuestionsRemoved += removed;
  }
}

let totalQuestionsBefore = 18904; // from logs
let totalQuestionsAfter = ds4.reduce((acc, entry) => acc + entry.questions.length, 0);

console.log(`Kural questions removed: ${kuralQuestionsRemoved}`);
console.log(`Adhigaram questions removed: ${adhigaramQuestionsRemoved}`);
console.log(`Total questions before: ${totalQuestionsBefore}`);
console.log(`Total questions after: ${totalQuestionsAfter}`);

fs.writeFileSync('datasets/DS4_faq.json', JSON.stringify(ds4, null, 2));

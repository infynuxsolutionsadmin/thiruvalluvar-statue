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
      return ["ஆயிரமாவது"];
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
      return [...new Set([forms[0].trim(), forms[1].trim()])];
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
  
  return [...new Set([forms[0].trim(), forms[1].trim()])];
}

let kuralModified = 0;
let kuralAdded = 0;
let adhigaramModified = 0;
let adhigaramAdded = 0;
let duplicates = 0;
let invalidMappings = 0;

const allQuestions = new Set();
const questionMap = new Map();

for (let entry of ds4) {
  const ref = entry.answer_reference;
  let isKural = ref.startsWith('K');
  let isAdhigaram = ref.startsWith('A');
  
  if (!isKural && !isAdhigaram) {
    entry.questions.forEach(q => {
      allQuestions.add(q);
      questionMap.set(q, ref);
    });
    continue;
  }
  
  const num = parseInt(ref.replace(/[KA]/, ''), 10);
  
  let newQs = [];
  let numericFormsKept = 0;
  
  for (let q of entry.questions) {
    if (/\d/.test(q)) {
      if (numericFormsKept < 2) {
        newQs.push(q);
        numericFormsKept++;
      }
    } else {
      if (!q.includes("குறள் என்ன") && !q.includes("அதிகாரம் என்ன") && !q.includes("குறளை சொல்லுங்க") && !q.includes("அதிகாரத்தை சொல்லுங்க") && !q.includes("அதிகாரம் எது")) {
        newQs.push(q);
      } else if (!q.match(/(வது|ம்|ஆம்|ஆவது)\s*(குறள்|அதிகாரம்)/) && q !== "முதல் குறள் என்ன?" && q !== "முதல் அதிகாரம் என்ன?" && q !== "முதலாவது அதிகாரம் என்ன?" && q !== "முதலாம் அதிகாரம் என்ன?") {
        newQs.push(q);
      }
    }
  }
  
  const tamilForms = getTamilNumberForms(num);
  let addedForThis = 0;
  
  const subjects = isKural ? ["குறள் என்ன?"] : ["அதிகாரம் என்ன?"];
  if (num === 1 && isAdhigaram) {
    // specific for 1st adhigaram
    tamilForms.push("முதலாவது");
    tamilForms.push("முதலாம்");
  }
  
  let variantsToAdd = [];
  [...new Set(tamilForms)].forEach(tf => {
    variantsToAdd.push(`${tf} ${subjects[0]}`);
  });
  
  if (numericFormsKept === 0) {
    newQs.push(`${num}வது ${isKural ? 'குறள்' : 'அதிகாரம்'} என்ன?`);
    newQs.push(`${num}ம் ${isKural ? 'குறள்' : 'அதிகாரம்'} சொல்லுங்க`);
  }
  
  for (let v of variantsToAdd) {
    if (!newQs.includes(v)) {
      newQs.push(v);
      addedForThis++;
    }
  }
  
  newQs = [...new Set(newQs)];
  
  if (addedForThis > 0 || newQs.length !== entry.questions.length) {
    if (isKural) {
      kuralModified++;
      kuralAdded += addedForThis;
    } else {
      adhigaramModified++;
      adhigaramAdded += addedForThis;
    }
    entry.questions = newQs;
  }
  
  entry.questions.forEach(q => {
    if (questionMap.has(q) && questionMap.get(q) !== ref) {
      invalidMappings++;
      console.log(`DUPLICATE CONFLICT: "${q}" maps to both ${questionMap.get(q)} and ${ref}`);
    } else if (allQuestions.has(q)) {
      duplicates++;
    }
    allQuestions.add(q);
    questionMap.set(q, ref);
  });
}

let kCount = 0;
let aCount = 0;
for (let entry of ds4) {
  if (entry.id.startsWith('K')) kCount++;
  if (entry.id.startsWith('A')) aCount++;
}

console.log(`Kural entries modified: ${kuralModified}`);
console.log(`Kural questions added/replaced: ${kuralAdded}`);
console.log(`Adhigaram entries modified: ${adhigaramModified}`);
console.log(`Adhigaram questions added/replaced: ${adhigaramAdded}`);
console.log(`Duplicates found: ${duplicates}`);
console.log(`Invalid mappings found: ${invalidMappings}`);
console.log(`Total Kural references verified: ${kCount} (Expected: 1330)`);
console.log(`Total Adhigaram references verified: ${aCount} (Expected: 133)`);

fs.writeFileSync('datasets/DS4_faq.json', JSON.stringify(ds4, null, 2));

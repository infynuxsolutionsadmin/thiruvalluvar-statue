const fs = require('fs');
const path = require('path');

const ds4Path = path.join(__dirname, '../datasets/DS4_faq.json');

const ds4 = [];

// Kurals
for (let i = 1; i <= 1330; i++) {
  const kId = "K" + String(i).padStart(4, '0');
  const questions = [
    `${i}வது குறள் என்ன?`,
    `${i}வது குறளை சொல்லுங்க`,
    `${i}ம் குறள் சொல்லு`,
    `${i}வது திருக்குறள் எது?`
  ];
  if (i === 1) {
    questions.push("முதல் குறள் என்ன?", "முதல் குறளை சொல்லுங்க");
  } else if (i === 1330) {
    questions.push("கடைசி குறள் என்ன?", "கடைசி குறளை சொல்லுங்க");
  }
  
  ds4.push({
    id: kId,
    questions,
    answer_reference: kId
  });
}

// Adhigarams
for (let i = 1; i <= 133; i++) {
  const aId = "A" + String(i).padStart(3, '0');
  const questions = [
    `${i}வது அதிகாரம் என்ன?`,
    `${i}வது அதிகாரம் பற்றி சொல்லுங்க`,
    `${i}ம் அதிகாரத்தை சொல்லுங்கள்`,
    `${i}வது திருக்குறள் அதிகாரம் எது?`
  ];
  if (i === 1) {
    questions.push("முதல் அதிகாரம் என்ன?", "முதல் அதிகாரம் பற்றி சொல்லுங்க");
  }
  ds4.push({
    id: aId,
    questions,
    answer_reference: aId
  });
}

// BIO
ds4.push({
  id: "BIO001",
  questions: [
    "திருவள்ளுவர் யார்?",
    "வள்ளுவர் யாரு?",
    "திருவள்ளுவரைப் பற்றி சொல்லுங்க",
    "வள்ளுவரைப் பற்றி கொஞ்சம் சொல்லுங்கள்"
  ],
  answer_reference: "BIO001"
});

// F001
ds4.push({
  id: "F001",
  questions: [
    "திருக்குறளில் எத்தனை குறள்கள் இருக்கிறது?",
    "மொத்தம் எத்தனை குறள் இருக்கு?",
    "திருக்குறளில் மொத்தம் எத்தனை குறள்?"
  ],
  answer_reference: "F001"
});

// F002
ds4.push({
  id: "F002",
  questions: [
    "திருக்குறளில் எத்தனை அதிகாரங்கள்?",
    "மொத்தம் எத்தனை அதிகாரம்?",
    "திருக்குறளில் மொத்தம் எத்தனை அதிகாரங்கள்?"
  ],
  answer_reference: "F002"
});

// F003
ds4.push({
  id: "F003",
  questions: [
    "திருக்குறளில் எத்தனை பால்?",
    "திருக்குறளில் மொத்தம் எத்தனை பாகங்கள்?",
    "மொத்தம் எத்தனை பால் இருக்கிறது?"
  ],
  answer_reference: "F003"
});

// F004
ds4.push({
  id: "F004",
  questions: [
    "திருக்குறளை எழுதியவர் யார்?",
    "திருக்குறளின் ஆசிரியர் யார்?",
    "திருக்குறள் யார் எழுதியது?"
  ],
  answer_reference: "F004"
});

fs.writeFileSync(ds4Path, JSON.stringify(ds4, null, 2), 'utf8');
console.log(`Successfully generated DS4 dataset at ${ds4Path} with ${ds4.length} records.`);

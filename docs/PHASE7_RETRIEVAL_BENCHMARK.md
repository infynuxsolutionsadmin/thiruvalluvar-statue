# PHASE 7 COMPLETE

Benchmark source:
ACTUAL NESTJS KNOWLEDGE ENGINE

Python retrieval simulation:
NOT USED

## Step 11 — Important Safety Check

**Question:** முதல் குறள்
**DS4 expected reference:** UNKNOWN
**Actual production reference:** A001
**Actual intent:** TOPIC_GENERAL
**Resolver:** UNKNOWN

**Question:** நட்பு பற்றி சொல்லுங்கள்
**DS4 expected reference:** UNKNOWN
**Actual production reference:** A079
**Actual intent:** TOPIC_GENERAL
**Resolver:** UNKNOWN

**Question:** நட்பு பற்றி எந்த அதிகாரம் பேசுகிறது?
**DS4 expected reference:** A079
**Actual production reference:** A079
**Actual intent:** ADHIGARAM
**Resolver:** DS2

**Question:** நட்பு பற்றி சில குறள்கள் சொல்லுங்கள்
**DS4 expected reference:** UNKNOWN
**Actual production reference:** K0781
**Actual intent:** TOPIC_KURALS
**Resolver:** UNKNOWN

**Question:** திருவள்ளுவர் யார்?
**DS4 expected reference:** UNKNOWN
**Actual production reference:** BIO001
**Actual intent:** BIOGRAPHY
**Resolver:** DS3

**Question:** திருக்குறளில் மொத்தம் எத்தனை குறள்கள்?
**DS4 expected reference:** UNKNOWN
**Actual production reference:** F001
**Actual intent:** TOTAL_KURALS
**Resolver:** DS7

**Question:** xyzzzwqe
**DS4 expected reference:** UNKNOWN
**Actual production reference:** D001
**Actual intent:** UNKNOWN
**Resolver:** UNKNOWN

**Question:** கம்ப்யூட்டர் பற்றி வள்ளுவர் என்ன சொல்கிறார்?
**DS4 expected reference:** UNKNOWN
**Actual production reference:** BIO001
**Actual intent:** BIOGRAPHY
**Resolver:** DS3

**Question:** அண்டவெளியில் பச்சை யானைகள் பற்றி குறள் என்ன சொல்கிறது?
**DS4 expected reference:** UNKNOWN
**Actual production reference:** D001
**Actual intent:** UNKNOWN
**Resolver:** UNKNOWN

**Question:** ஒரு நல்ல மனைவியின் பண்புகள் என்ன?
**DS4 expected reference:** UNKNOWN
**Actual production reference:** D001
**Actual intent:** UNKNOWN
**Resolver:** UNKNOWN

## Full Benchmark

DS4 questions evaluated: 5416

Correct: 1418
Wrong topic: 709
Wrong intent: 1416
False positives: 5
Ambiguous: 0
Correct unknown: 5
Missing aliases: 1863
Parser failures: 0
Incorrect DS4 references: 0

Overall answerable-query accuracy: 26.2%

False-positive rate: 50.0%

Production behavior changed: NO
Tests: PASS
Build: PASS

## False Positive Audit
- Q: கம்ப்யூட்டர் பற்றி வள்ளுவர் என்ன சொல்கிறார்? | Expected: UNKNOWN | Actual: BIO001 | Resolver: DS3
- Q: இன்றைய AI பற்றி வள்ளுவர் என்ன சொல்லியிருக்கிறார்? | Expected: UNKNOWN | Actual: BIO001 | Resolver: DS3
- Q: பிரியாணி எப்படி சமைப்பது என்று குறள் சொல்கிறதா? | Expected: UNKNOWN | Actual: A065 | Resolver: UNKNOWN
- Q: தமிழ் சினிமா பற்றி வள்ளுவர் என்ன சொல்கிறார்? | Expected: UNKNOWN | Actual: BIO001 | Resolver: DS3
- Q: விண்வெளி பயணம் பற்றி திருவள்ளுவர் என்ன சொல்றாரு? | Expected: UNKNOWN | Actual: BIO001 | Resolver: DS3

## Missing Alias Examples
- Q: நண்பர்கள் பற்றி சொல்லுங்க | Expected: A079 | Actual: D001
- Q: நண்பர்கள் பத்தி கொஞ்சம் சொல்லு | Expected: A079 | Actual: D001
- Q: நண்பர்கள் என்றால் என்ன? | Expected: A079 | Actual: D001
- Q: நண்பர்கள் பற்றி விளக்குங்க | Expected: A079 | Actual: D001
- Q: திருக்குறள்ல நண்பர்கள் பத்தி என்ன இருக்கு? | Expected: A079 | Actual: D001
- Q: நண்பர்கள் பற்றி சில குறள் சொல்லுங்க | Expected: K0781 | Actual: D001
- Q: நண்பர்கள் பத்தி ஒரு குறள் சொல்லு | Expected: K0781 | Actual: D001
- Q: நண்பர்கள் சம்பந்தமான குறள் இருக்கா? | Expected: K0781 | Actual: D001
- Q: நண்பர்கள்க்கு ஒரு திருக்குறள் சொல்லுங்க | Expected: K0781 | Actual: D001
- Q: நண்பர்கள் எந்த அதிகாரத்தில் வருகிறது? | Expected: A079 | Actual: UNKNOWN
- Q: நண்பர்கள் பற்றி எந்த அதிகாரம் பேசுகிறது? | Expected: A079 | Actual: UNKNOWN
- Q: நண்பர்கள்க்கான அதிகாரம் எது? | Expected: A079 | Actual: UNKNOWN
- Q: எந்த அதிகாரத்துல நண்பர்கள் பத்தி வருது? | Expected: A079 | Actual: UNKNOWN
- Q: நண்பர்கள் பற்றி எளிமையாக விளக்குங்க | Expected: A079 | Actual: D001
- Q: நண்பர்கள் பத்தி புரியுற மாதிரி சொல்லுங்க | Expected: A079 | Actual: D001
- Q: நண்பர்கள்ன் முக்கியத்துவம் என்ன? | Expected: A079 | Actual: D001
- Q: நண்பர்கள் பத்தி சொல்லுங்க | Expected: A079 | Actual: D001
- Q: நண்பர்கள் பத்தி கொஞ்சம் விளக்குங்க | Expected: A079 | Actual: D001
- Q: நண்பர்கள் பத்தி குறள்ல என்ன இருக்கு? | Expected: A079 | Actual: D001
- Q: நண்பர்கள்க்கு சம்பந்தமான குறள் எது? | Expected: A079 | Actual: D001

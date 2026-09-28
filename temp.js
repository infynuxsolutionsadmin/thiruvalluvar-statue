const q = "முன்னூத்தி முப்பத்தி ஒன்பதாவது குரல் என்ன";

let thousands = 0;
let hundreds = 0;
let tens = 0;
let units = 0;

let matched = false;

// THOUSANDS (1000)
if (/(?:ஆயிரத்து|ஆயிரத்தி|ஆயிரம்|ஆயிரமாவது)/.test(q)) { thousands = 1000; matched = true; }

// HUNDREDS (100 - 900)
if (/(?:தொள்ளாயிரத்து|தொள்ளாயிரத்தி|தொள்ளாயிரம்|தொள்ளாயிரமாவது)/.test(q)) { hundreds = 900; matched = true; }
else if (/(?:எண்ணூற்று|எண்ணூத்தி|எண்ணூற்றி|எட்நூற்று|எட்நூத்தி|எண்ணூறு|எண்ணூறாவது)/.test(q)) { hundreds = 800; matched = true; }
else if (/(?:எழுநூற்று|எழுநூத்தி|எழுநூற்றி|எழுநூறு|எழுநூறாவது)/.test(q)) { hundreds = 700; matched = true; }
else if (/(?:அறுநூற்று|அறுநூத்தி|அறுநூற்றி|அறுநூறு|அறுநூறாவது)/.test(q)) { hundreds = 600; matched = true; }
else if (/(?:ஐந்நூற்று|ஐந்நூத்தி|ஐந்நூற்றி|ஐநூற்று|ஐநூத்தி|ஐநூற்றி|ஐந்நூறு|ஐந்நூறாவது|ஐநூறு|ஐநூறாவது)/.test(q)) { hundreds = 500; matched = true; }
else if (/(?:நானூற்று|நானூத்தி|நானூற்றி|நானூறு|நானூறாவது)/.test(q)) { hundreds = 400; matched = true; }
else if (/(?:முந்நூற்று|முந்நூத்தி|முந்நூற்றி|முன்னூற்று|முன்னூத்தி|முன்னூற்றி|முந்நூறு|முந்நூறாவது|முன்னூறு|முன்னூறாவது)/.test(q)) { hundreds = 300; matched = true; }
else if (/(?:இருநூற்று|இருநூத்தி|இருநூற்றி|இருநூறு|இருநூறாவது|இரநூற்று|இரநூத்தி|இரநூற்றி|இரநூறு|இரநூறாவது)/.test(q)) { hundreds = 200; matched = true; }
else if (/(?:நூற்று|நூத்தி|நூற்றி|நூறு|நூறாவது)/.test(q)) { hundreds = 100; matched = true; }

// TENS (10 - 90)
if (/(?:தொண்ணூற்று|தொண்ணூத்தி|தொண்ணூற்றி|தொண்ணூறு|தொண்ணூறாவது)/.test(q)) { tens = 90; matched = true; }
else if (/(?:எண்பத்து|எண்பத்தி|எண்பது|எண்பதாவது|எம்பத்து|எம்பத்தி|எம்பது|எம்பதாவது)/.test(q)) { tens = 80; matched = true; }
else if (/(?:எழுபத்து|எழுபத்தி|எழுபது|எழுபதாவது)/.test(q)) { tens = 70; matched = true; }
else if (/(?:அறுபத்து|அறுபத்தி|அறுபது|அறுபதாவது)/.test(q)) { tens = 60; matched = true; }
else if (/(?:ஐம்பத்து|ஐம்பத்தி|ஐம்பது|ஐம்பதாவது|அம்பத்து|அம்பத்தி|அம்பது|அம்பதாவது)/.test(q)) { tens = 50; matched = true; }
else if (/(?:நாற்பத்து|நாற்பத்தி|நாற்பது|நாற்பதாவது|நாப்பத்து|நாப்பத்தி|நாப்பது|நாப்பதாவது)/.test(q)) { tens = 40; matched = true; }
else if (/(?:முப்பத்து|முப்பத்தி|முப்பது|முப்பதாவது)/.test(q)) { tens = 30; matched = true; }
else if (/(?:இருபத்து|இருபத்தி|இருபது|இருபதாவது)/.test(q)) { tens = 20; matched = true; }
else if (/(?:பத்தொன்பது|பத்தொன்பதாவது)/.test(q)) { tens = 19; matched = true; }
else if (/(?:பதினெட்டு|பதினெட்டாவது)/.test(q)) { tens = 18; matched = true; }
else if (/(?:பதினேழு|பதினேழாவது)/.test(q)) { tens = 17; matched = true; }
else if (/(?:பதினாறு|பதினாறாவது)/.test(q)) { tens = 16; matched = true; }
else if (/(?:பதினைந்து|பதினைந்தாவது)/.test(q)) { tens = 15; matched = true; }
else if (/(?:பதினான்கு|பதினான்காவது)/.test(q)) { tens = 14; matched = true; }
else if (/(?:பதிமூன்று|பதிமூன்றாவது|பதின்மூன்று|பதின்மூன்றாவது)/.test(q)) { tens = 13; matched = true; }
else if (/(?:பன்னிரண்டு|பன்னிரண்டாவது|பனிரண்டு|பனிரண்டாவது|பன்னிரெண்டு|பன்னிரெண்டாவது|பனிரெண்டு|பனிரெண்டாவது)/.test(q)) { tens = 12; matched = true; }
else if (/(?:பதினொன்று|பதினொன்றாவது|பதினோரு|பதினோராவது)/.test(q)) { tens = 11; matched = true; }
else if (/(?:பத்து|பத்தி|பத்தாவது)/.test(q)) { tens = 10; matched = true; }

// UNITS (1 - 9)
if (tens < 11 || tens > 19) {
  if (/(?:ஒன்பது|ஒன்பதாவது)/.test(q)) { units = 9; matched = true; }
  else if (/(?:எட்டு|எட்டாவது)/.test(q)) { units = 8; matched = true; }
  else if (/(?:ஏழு|ஏழாவது)/.test(q)) { units = 7; matched = true; }
  else if (/(?:ஆறு|ஆறாவது)/.test(q)) { units = 6; matched = true; }
  else if (/(?:ஐந்து|ஐந்தாவது|அஞ்சு|அஞ்சாவது)/.test(q)) { units = 5; matched = true; }
  else if (/(?:நான்கு|நான்காவது|நாலு|நாலாவது)/.test(q)) { units = 4; matched = true; }
  else if (/(?:மூன்று|மூன்றாவது|மூனு|மூனாவது)/.test(q)) { units = 3; matched = true; }
  else if (/(?:இரண்டு|இரண்டாவது|ரெண்டு|ரெண்டாவது)/.test(q)) { units = 2; matched = true; }
  else if (/(?:ஒன்று|ஒன்றாவது|முதல்|ஒன்னு|ஒன்னாவது)/.test(q)) { units = 1; matched = true; }
}

const total = thousands + hundreds + tens + units;
console.log({ thousands, hundreds, tens, units, total });

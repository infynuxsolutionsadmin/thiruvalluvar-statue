const fs = require('fs');

const file = 'datasets/DS4_faq.json';
const ds4 = JSON.parse(fs.readFileSync(file, 'utf8'));

const addMap = {
  'A008': 'அன்பைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்',
  'A079': 'நட்பை பற்றி திருவள்ளுவர் என்ன கூறுகிறார்',
  'A031': 'சினத்தைப் பற்றி இத் திருக்குறள் என்ன சொல்கிறது',
  'A030': 'உண்மையைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்',
  'A014': 'ஒழுக்கத்தைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்'
};

for (const entry of ds4) {
  if (addMap[entry.id]) {
    if (!entry.questions.includes(addMap[entry.id])) {
      entry.questions.push(addMap[entry.id]);
    }
  }
}

fs.writeFileSync(file, JSON.stringify(ds4, null, 2));

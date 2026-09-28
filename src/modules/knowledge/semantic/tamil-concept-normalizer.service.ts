import { Injectable } from '@nestjs/common';

export enum QueryIntent {
  KURAL_SPECIFIC = 'KURAL_SPECIFIC',
  KURAL_GENERAL = 'KURAL_GENERAL',
  ADHIGARAM_SPECIFIC = 'ADHIGARAM_SPECIFIC',
  ADHIGARAM_GENERAL = 'ADHIGARAM_GENERAL',
  BIOGRAPHY = 'BIOGRAPHY',
  FACT = 'FACT',
  UNKNOWN = 'UNKNOWN'
}

export interface TamilQueryNormalization {
  originalQuery: string;
  normalizedQuery?: string;
  concepts: string[];
  intent: QueryIntent;
  broadTerms: string[];
  stopConcepts?: string[];
  confidence: number;
}

@Injectable()
export class TamilConceptNormalizerService {
  
  // Words that are too broad and should be explicitly tracked so they don't dominate.
  private readonly BROAD_WORDS = new Set([
    'வாழ்க்கை', 'வாழ்க்கையில்', 'வாழும்', 'வாழ', 
    'மனிதன்', 'மனிதனுக்கு', 'ஒருவர்', 'மக்கள்', 'யார்', 
    'நல்ல', 'கெட்ட', 
    'முக்கியம்', 'அவசியம்', 
    'எப்படி', 'என்ன', 'ஏன்', 'எதை',
    'செய்ய', 'செய்யலாம்', 'வேண்டும்', 
    'விஷயம்', 'பற்றி', 'சொல்லுங்கள்', 'கூறுகிறது', 'சொல்லுது',
    'வந்தால்', 'இருக்கும்', 'போது', 'என்றால்',
    'என்று', 'எது', 'யாரை', 'வேலை', 'சமைப்பது', 'பற்றிய', 'பற்றியும்'
  ]);

  // Concept dictionary mapping conversational phrases to classical concepts
  private readonly CONCEPT_MAP = [
    {
      keywords: ['மனசு கஷ்டம்', 'மனசு கஷ்டமாக', 'கஷ்டம்', 'கஷ்டங்கள்', 'துன்பம்', 'சோகம்', 'வேதனை', 'கவலை', 'அழுகை'],
      concepts: ['துன்பம்', 'இடுக்கண்', 'மனத் துன்பம்', 'அல்லல்', 'மன உறுதி', 'துன்பத்தை எதிர்கொள்வது', 'சமாளித்தல்']
    },
    {
      keywords: ['தோல்வி', 'தோற்று', 'சறுக்கல்'],
      concepts: ['இடுக்கண்', 'துன்பம்', 'முயற்சி', 'தளராமை', 'விடாமுயற்சி', 'ஊக்கம்']
    },
    {
      keywords: ['கோபம்', 'கோபத்தை', 'கோபத்தில்', 'ஆத்திரம்'],
      concepts: ['சினம்', 'வெகுளி', 'வெகுளாமை', 'சினத்தை கட்டுப்படுத்துதல்']
    },
    {
      keywords: ['நல்ல மனிதன்', 'நல்ல மனிதனாக', 'நல்லவன்', 'மனித நேயம்'],
      concepts: ['நல்ல பண்பு', 'நற்பண்பு', 'அறம்', 'ஒழுக்கம்', 'குணநலம்', 'சான்றாண்மை']
    },
    {
      keywords: ['பேச வேண்டும்', 'பேசுவது', 'பேச்சு', 'வார்த்தை'],
      concepts: ['பேச்சு', 'சொல்', 'இன்சொல்', 'இனிய சொல்', 'சொல்வன்மை', 'கடுஞ்சொல் தவிர்த்தல்', 'பயனுள்ள சொல்']
    },
    {
      keywords: ['உதவியை மறக்காமல்', 'நன்றி', 'உதவி செய்த'],
      concepts: ['செய்ந்நன்றி அறிதல்', 'நன்றி மறவாமை', 'உதவி', 'நன்றியுணர்வு']
    },
    {
      keywords: ['உதவுவது', 'உதவி', 'உதவ', 'ஈகை'],
      concepts: ['உதவி', 'பிறருக்கு நன்மை', 'ஈகை', 'கொடை', 'இரக்கம்', 'ஒப்புரவு']
    },
    {
      keywords: ['நண்பன்', 'நண்பனை', 'நட்பு', 'நண்பர்கள்', 'நட்பை', 'நட்பைப்'],
      concepts: ['நண்பன்', 'நட்பு', 'நட்பின் பண்பு', 'உண்மையான நட்பு', 'நட்பை தேர்வு செய்தல்', 'கூடா நட்பு']
    },
    {
      keywords: ['நம்புவது', 'நம்புவதற்கு', 'நம்பிக்கை', 'நம்ப', 'யாரை நம்ப'],
      concepts: ['நம்பிக்கை', 'ஒருவரின் குணம்', 'ஆராய்ந்து அறிதல்', 'தேர்வு', 'நம்பத்தகுந்தவர்', 'தெரிந்து தெளிதல்']
    },
    {
      keywords: ['கல்வி', 'படிப்பது', 'படிக்க', 'கற்றல்', 'கற்றதை', 'கற்ற'],
      concepts: ['கற்ற கல்வி', 'கற்றதை பயன்படுத்துதல்', 'கற்ற அறிவை நடைமுறையில் பயன்படுத்துதல்', 'கல்வியின் பயன்', 'கற்றபின் செயல்படுதல்']
    },
    {
      keywords: ['முன்னேற', 'முன்னேற்றம்', 'வெற்றி', 'சாதிக்க'],
      concepts: ['முயற்சி', 'உழைப்பு', 'விடாமுயற்சி', 'முன்னேற்றம்', 'செயல்', 'வினைத்திட்பம்']
    },
    {
      keywords: ['பணம்', 'பணத்தை', 'செல்வம்', 'காசு'],
      concepts: ['பொருள்', 'செல்வம்', 'பொருட்செல்வம்', 'பொருட்பால்', 'ஈட்டல்']
    },
    {
      keywords: ['தலைவர்', 'தலைவருக்கு', 'ஆட்சி', 'அரசன்', 'அரசு'],
      concepts: ['இறைமாட்சி', 'மன்னன்', 'அரசன்', 'செங்கோன்மை', 'ஆட்சி', 'தலைமை']
    },
    {
      keywords: ['தவறு', 'தவறுகள்', 'குற்றம்', 'பிழை', 'திருத்திக்'],
      concepts: ['குற்றம்', 'குற்றங்கடிதல்', 'தவறு', 'பிழை', 'குற்றம் பார்க்காமை']
    },
    {
      keywords: ['தீங்கு', 'தீமை', 'கெடுதல்', 'பாதிப்பு'],
      concepts: ['இன்னா செய்தல்', 'தீவினை', 'தீமை', 'பிறருக்கு தீங்கு']
    },
    {
      keywords: ['சரியான பாதை', 'வழி', 'தர்மம்'],
      concepts: ['அறம்', 'அறவழி', 'நல்வழி', 'ஒழுக்கம்', 'செம்மை']
    },
    {
      keywords: ['அன்பு', 'அன்பாக', 'பாசம்'],
      concepts: ['அன்பு', 'அன்புடைமை', 'அன்பின் சிறப்பு']
    }
  ];

  normalize(query: string): TamilQueryNormalization {
    const tokens = query.replace(/[.,?]/g, '').split(/\s+/);
    const broadTerms: string[] = [];
    const concepts = new Set<string>();
    
    // Identify broad terms
    for (const t of tokens) {
      if (this.BROAD_WORDS.has(t)) {
        broadTerms.push(t);
      }
    }

    // Identify concepts by substring match on keywords
    for (const mapping of this.CONCEPT_MAP) {
      for (const kw of mapping.keywords) {
        if (query.includes(kw)) {
          mapping.concepts.forEach(c => {
             // Only add if not trivially in the query already
             if (!query.includes(c)) {
                 concepts.add(c);
             }
          });
          break; // Found one keyword for this concept group, move to next group
        }
      }
    }

    // Intent resolution
    let intent = QueryIntent.UNKNOWN;
    
    if (query.includes('எத்தனை குறள்') || query.includes('எத்தனை அதிகாரம்') || query.includes('எத்தனை பால்') || query.includes('எத்தனை')) {
      intent = QueryIntent.FACT;
    } else if (query.includes('திருவள்ளுவர் யார்') || query.includes('வள்ளுவர் யார்') || query.includes('எழுதியவர் யார்')) {
      intent = QueryIntent.BIOGRAPHY;
    } else if (query.includes('அதிகாரம் என்ன') || query.includes('எந்த அதிகாரம்') || query.includes('அதிகாரம் கூறு') || query.includes('அதிகாரம்')) {
      intent = QueryIntent.ADHIGARAM_SPECIFIC;
    } else {
      const kuralSpecificSignals = [
        'எந்த குறள்', 'என்ன குறள்', 'சொல்லும் குறள்', 'கூறும் குறள்', 
        'குறள் எது', 'குறள் என்ன', 'எந்த குரல்', 'என்ன குரல்', 
        'குறளை சொல்லுங்கள்', 'குறளின் பொருள்', 'குறளை விளக்குங்கள்', 
        'இந்த கருத்துக்கு குறள்'
      ];
      const hasSpecificPhrase = kuralSpecificSignals.some(s => query.includes(s));
      const hasNumber = /\d+/.test(query) && (query.includes('குறள்') || query.includes('குரல்'));
      const hasTamilNumber = /[௧-௯]/.test(query) && query.includes('குறள்');
      const hasWordNumber = query.includes('வது குறள்') || query.includes('ஆவது குறள்');

      if (hasSpecificPhrase || hasNumber || hasTamilNumber || hasWordNumber) {
        intent = QueryIntent.KURAL_SPECIFIC;
      } else if (query.includes('குறள்') || query.includes('குரல்')) {
         intent = QueryIntent.KURAL_GENERAL;
      }
    }

    if (intent === QueryIntent.UNKNOWN && concepts.size > 0) {
      intent = QueryIntent.ADHIGARAM_GENERAL;
    }

    // Limit concepts to avoid over-expansion based on intent
    let limit = 8;
    if (intent === QueryIntent.KURAL_SPECIFIC) {
      limit = 4; // Max 3-5 concepts for KURAL_SPECIFIC
    }
    const limitedConcepts = Array.from(concepts).slice(0, limit);

    return {
      originalQuery: query,
      concepts: limitedConcepts,
      broadTerms,
      intent,
      confidence: limitedConcepts.length > 0 ? 1.0 : 0.0
    };
  }

  buildRetrievalQuery(normalization: TamilQueryNormalization): string {
    if (normalization.concepts.length === 0) {
      return normalization.originalQuery;
    }

    const conceptsString = normalization.concepts.join(' ');
    
    return `${normalization.originalQuery} ${conceptsString}`;
  }
}

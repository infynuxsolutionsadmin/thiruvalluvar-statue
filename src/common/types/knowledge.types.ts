// ─── DS1 Kural record ────────────────────────────────────────────────────────
export interface KuralRecord {
  id: string;           // K0001–K1330
  kural_number: number;
  paal: string;
  adhigaram_number: number;
  adhigaram_name: string;
  kural: string;
  simple_explanation: string;
  keywords: string[];
}

// ─── DS2 Adhigaram record ────────────────────────────────────────────────────
export interface AdhigaramRecord {
  id: string;           // A001–A133
  adhigaram_number: number;
  adhigaram_name: string;
  paal: string;
  short_description: string;
  summary: string;
  keywords: string[];
}

// ─── DS3 Biography record ────────────────────────────────────────────────────
export interface BiographyRecord {
  id: string;           // BIO001–BIO050
  category: string;
  title: string;
  content: string;
  summary: string;
  keywords: string[];
}

// ─── DS7 Fact record ─────────────────────────────────────────────────────────
export interface FactRecord {
  id: string;           // F001–F004
  category: string;
  title: string;
  question_intent: string;
  answer: string;
  audio_id: string;
  source_dataset: string;
  source_id: string;
  source_text: string;
  keywords: string[];
}

// ─── Query parsing types ─────────────────────────────────────────────────────
export type KnowledgeDataset = 'DS1' | 'DS2' | 'DS3' | 'DS7' | 'UNKNOWN';

export type QueryIntent =
  | 'KURAL_TEXT'
  | 'MEANING'
  | 'EXPLANATION'
  | 'KURAL_AND_EXPLANATION'
  | 'ADHIGARAM'
  | 'BIOGRAPHY'
  | 'TOTAL_KURALS'
  | 'TOTAL_ADHIGARAMS'
  | 'TOTAL_PAALS'
  | 'AUTHOR'
  | 'TOPIC_GENERAL'
  | 'TOPIC_ADHIGARAM'
  | 'TOPIC_KURALS'
  | 'TOPIC_KURAL_SINGLE'
  | 'GREETING'
  | 'SYSTEM_USAGE'
  | 'STATUE'
  | 'UNKNOWN';

// ─── Topic match result (used by TopicResolverService) ───────────────────────
export interface TopicMatch {
  reference: string;         // e.g. "A079" or "K0781"
  dataset: KnowledgeDataset;
  score: number;             // 0–100 deterministic score
  matchedBy:
    | 'ADHIGARAM_NAME'        // topic == adhigaram_name
    | 'DS2_KEYWORD'           // topic found in DS2 keywords[]
    | 'DS1_KEYWORD'           // topic found in DS1 keywords[]
    | 'TOKEN_MATCH';          // normalized token overlap
  adhigaramNumber?: number;  // filled when dataset === 'DS2'
}

export interface ParsedQuery {
  dataset: KnowledgeDataset;
  reference: string | null;
  intent: QueryIntent;
  confidence: number;   // 0–1
  normalizedQuery: string;
}

// ─── Resolved knowledge answer ───────────────────────────────────────────────
export interface KnowledgeAnswer {
  found: boolean;
  dataset: KnowledgeDataset;
  reference: string | null;
  references?: string[];     // populated for TOPIC_KURALS multi-results
  intent: QueryIntent;
  answer: string | null;
  record?: KuralRecord | AdhigaramRecord | BiographyRecord | FactRecord;
  topicMatches?: TopicMatch[]; // ranked matches for topic queries
}

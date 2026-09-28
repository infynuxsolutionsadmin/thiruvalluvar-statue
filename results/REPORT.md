# Thiruvalluvar Voice AI - Phase 3.1 Semantic Disambiguation Benchmark

## Objective
Implement Top-K semantic retrieval and disambiguation for Adhigarams to ensure the principle: "A wrong authoritative answer is worse than UNKNOWN."

## Implementation
1. **Top-K Vector Search:** The system now queries `MongoDB Atlas Vector Search` for the top 5 candidates.
2. **Margin Analysis:** The margin between the Top 1 and Top 2 results is analyzed.
3. **Keyword Tie-Breaker:** If the score margin is less than `0.02` (a highly ambiguous scenario), the system employs a Keyword Tie-Breaker. It checks if the `keywords` of the candidate Adhigarams exactly match tokens in the natural language query.
4. **Safe Rejection:** If the tie-breaker cannot confidently select a single winner, the match is rejected, and the system safely returns `UNKNOWN` (`D001`).

## Group 1: Friendship (`A079` vs `A080`)
| Query | Expected | Top 1 (Score) | Top 2 (Score) | Margin | Accepted? | Final Result | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| நட்பைப் பற்றித் திருக்குறள் என்ன கூறுகிறது | A079 | A080 (0.8852) | A079 (0.8778) | 0.0074 | Yes | **A079** | Tie-breaker won by A079 (+1 keyword) |
| நட்பை பற்றி சொல்லுங்கள் | A079 | A079 (0.9131) | A080 (0.9009) | 0.0122 | Yes | **A079** | Tie-breaker won by A079 (+1 keyword) |
| நல்ல நண்பன் எப்படி இருக்க வேண்டும் | A079 | A080 (0.9153) | A079 (0.9080) | 0.0073 | Yes | **A079** | Tie-breaker won by A079 (+1 keyword) |
| நல்ல நட்பு எப்படி இருக்க வேண்டும் | A079 | A080 (0.9205) | A079 (0.9142) | 0.0063 | Yes | **A079** | Tie-breaker won by A079 (+1 keyword) |
| திருக்குறளில் எந்த அதிகாரம் நட்பைப் பற்றிக் கூறுகின்றது | A079 | A080 (0.8927) | A079 (0.8872) | 0.0055 | Yes | **A079** | Tie-breaker won by A079 (+1 keyword) |

## Group 2: Love (`A008` vs `A131`)
| Query | Expected | Top 1 (Score) | Top 2 (Score) | Margin | Accepted? | Final Result | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| அன்பைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார் | D001 | A131 (0.8948) | A008 (0.8917) | 0.0031 | No | **D001 (UNKNOWN)** | Ambiguous; Tie-breaker failed |
| ஒருவருக்கு அன்பு ஏன் முக்கியம் | A008 | A008 (0.9065) | A080 (0.8886) | 0.0179 | Yes | **A008** | Tie-breaker won by A008 (+1 keyword) |

## Group 3: Virtue / Domestic Life (`A004` vs `A005`)
| Query | Expected | Top 1 (Score) | Top 2 (Score) | Margin | Accepted? | Final Result | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| அறம் நிறைந்த வாழ்க்கை என்றால் என்ன | D001 | A005 (0.9105) | A004 (0.9075) | 0.0030 | No | **D001 (UNKNOWN)** | Ambiguous; Tie-breaker failed |

## Group 4: Character (`A099` vs `A100`)
| Query | Expected | Top 1 (Score) | Top 2 (Score) | Margin | Accepted? | Final Result | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| நல்ல மனிதனின் பண்புகள் என்ன | D001 | A100 (0.9136) | A099 (0.9123) | 0.0013 | No | **D001 (UNKNOWN)** | Ambiguous; Tie-breaker failed |

## Negative / Out-of-Scope Queries
| Query | Top 1 (Score) | Top 2 (Score) | Margin | Accepted? | Final Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| xyzabc123 | A106 (0.8011) | A107 (0.8005) | 0.0006 | No | **D001 (UNKNOWN)** |
| ஒன்பது குறள் பத்தாவது | A054 (0.8536) | A100 (0.8534) | 0.0002 | No | **D001 (UNKNOWN)** |
| எனக்கு ஏதாவது சொல்லுங்கள் | A106 (0.8654) | A042 (0.8551) | 0.0102 | No | **D001 (UNKNOWN)** |

## Conclusion
Phase 3.1 is highly successful. We successfully leveraged a `MARGIN_THRESHOLD` (0.02) and a keyword tie-breaker to confidently resolve extremely close matches without hardcoding conditions. Unresolved ambiguities correctly fall back to `UNKNOWN` (`D001`). No LLM was needed, no new embeddings were required, and safety guarantees remain fully intact.

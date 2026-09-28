import json
import time
import psutil
import gc
import os
import torch
from sentence_transformers import SentenceTransformer
import numpy as np

# Path definitions
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))
DS1_PATH = os.path.join(PROJECT_ROOT, "datasets", "allthirukural.json")
DS2_PATH = os.path.join(PROJECT_ROOT, "datasets", "DS2", "Adhigarams.json")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
BENCHMARK_JSON_PATH = os.path.join(RESULTS_DIR, "benchmark.json")
REPORT_MD_PATH = os.path.join(RESULTS_DIR, "REPORT.md")

MODELS = [
    "Tamil-ai/tamil-embed-base",
    "l3cube-pune/tamil-sentence-similarity-sbert",
    "BAAI/bge-m3"
]

TEST_QUESTIONS = [
    {"query": "நல்ல நட்பு எப்படி இருக்க வேண்டும்?", "expected": ["A079"]},
    {"query": "நல்ல நண்பனுடைய பண்புகள் என்ன?", "expected": ["A079"]},
    {"query": "நட்பு பற்றி திருவள்ளுவர் என்ன கூறுகிறார்?", "expected": ["A079"]},
    {"query": "அன்பைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்?", "expected": ["A008"]},
    {"query": "கல்வியைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்?", "expected": ["A040"]},
    {"query": "நல்ல வாழ்க்கையைப் பற்றி திருக்குறள் என்ன சொல்கிறது?", "expected": ["EXPECTED_REFERENCE_UNCERTAIN"]},
    {"query": "மனிதன் எப்படி வாழ வேண்டும்?", "expected": ["EXPECTED_REFERENCE_UNCERTAIN"]},
    {"query": "நல்ல மனிதனின் பண்புகள் என்ன?", "expected": ["A099"]},
    {"query": "ஒருவருக்கு அன்பு ஏன் முக்கியம்?", "expected": ["A008"]},
    {"query": "நண்பர்களை எப்படி தேர்வு செய்ய வேண்டும்?", "expected": ["A080"]},
    {"query": "கல்வியின் முக்கியத்துவம் என்ன?", "expected": ["A040"]},
    {"query": "அறம் நிறைந்த வாழ்க்கை என்றால் என்ன?", "expected": ["A004"]},
]

def load_datasets():
    with open(DS1_PATH, "r", encoding="utf-8") as f:
        ds1 = json.load(f)
    with open(DS2_PATH, "r", encoding="utf-8") as f:
        ds2 = json.load(f)
    return ds1, ds2

def prepare_documents(ds1, ds2):
    documents = []
    # DS1 Documents
    for kural in ds1:
        text = f"{kural['kural']} {kural['simple_explanation']}"
        documents.append({
            "id": kural['id'],
            "dataset": "DS1",
            "text": text
        })
    # DS2 Documents
    for adhigaram in ds2:
        text = f"{adhigaram['adhigaram_name']} {adhigaram['short_description']} {adhigaram.get('summary', '')}"
        documents.append({
            "id": adhigaram['id'],
            "dataset": "DS2",
            "text": text
        })
    return documents

def cosine_similarity(vec1, vec2):
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def run_benchmark():
    os.makedirs(RESULTS_DIR, exist_ok=True)
    ds1, ds2 = load_datasets()
    documents = prepare_documents(ds1, ds2)
    doc_texts = [doc["text"] for doc in documents]
    doc_ids = [doc["id"] for doc in documents]
    
    scored_questions = [q for q in TEST_QUESTIONS if "EXPECTED_REFERENCE_UNCERTAIN" not in q["expected"]]
    
    results = {}
    report_content = "# Embedding Models Benchmark Report\n\n"
    report_content += f"**Number of benchmark questions:** {len(TEST_QUESTIONS)}\n"
    report_content += f"**Number of strictly scored questions:** {len(scored_questions)}\n\n"
    
    for model_name in MODELS:
        print(f"\n--- Benchmarking {model_name} ---")
        model_result = {
            "model": model_name,
            "status": "SUCCESS"
        }
        
        try:
            # Monitor RAM before load
            mem_before = psutil.virtual_memory().used
            
            t0 = time.time()
            model = SentenceTransformer(model_name, device="cpu")
            t_load = time.time() - t0
            
            model_result["load_time"] = t_load
            model_result["dimensions"] = model.get_sentence_embedding_dimension()
            
            t0 = time.time()
            doc_embeddings = model.encode(doc_texts, show_progress_bar=True, convert_to_numpy=True)
            t_embed = time.time() - t0
            model_result["doc_embedding_time"] = t_embed
            
            queries = [q["query"] for q in TEST_QUESTIONS]
            t0 = time.time()
            query_embeddings = model.encode(queries, show_progress_bar=False, convert_to_numpy=True)
            t_query = time.time() - t0
            model_result["query_embedding_time"] = t_query
            
            top1_correct = 0
            top3_correct = 0
            top5_correct = 0
            mrr_sum = 0
            
            examples = []
            
            for idx, q in enumerate(TEST_QUESTIONS):
                query_emb = query_embeddings[idx]
                sims = [cosine_similarity(query_emb, d_emb) for d_emb in doc_embeddings]
                
                # Get top 5 indices
                top_indices = np.argsort(sims)[::-1][:5]
                top_ids = [doc_ids[i] for i in top_indices]
                top_sims = [sims[i] for i in top_indices]
                
                examples.append({
                    "question": q["query"],
                    "expected": q["expected"],
                    "top_5": [{"id": top_ids[i], "sim": float(top_sims[i])} for i in range(5)]
                })
                
                if "EXPECTED_REFERENCE_UNCERTAIN" in q["expected"]:
                    continue
                
                # Evaluation
                expected = q["expected"][0]
                if expected in top_ids[:1]:
                    top1_correct += 1
                if expected in top_ids[:3]:
                    top3_correct += 1
                if expected in top_ids[:5]:
                    top5_correct += 1
                
                if expected in top_ids:
                    rank = top_ids.index(expected) + 1
                    mrr_sum += 1.0 / rank
            
            n = len(scored_questions)
            model_result["top1_accuracy"] = top1_correct / n
            model_result["top3_accuracy"] = top3_correct / n
            model_result["top5_accuracy"] = top5_correct / n
            model_result["mrr"] = mrr_sum / n
            model_result["examples"] = examples
            
            del model
            del doc_embeddings
            del query_embeddings
            gc.collect()
            
        except Exception as e:
            print(f"Error benchmarking {model_name}: {str(e)}")
            model_result["status"] = "MODEL_RESOURCE_FAILURE"
            model_result["error"] = str(e)
            
        results[model_name] = model_result
        
        report_content += f"## {model_name}\n"
        if model_result["status"] == "SUCCESS":
            report_content += f"- **Dimensions**: {model_result['dimensions']}\n"
            report_content += f"- **Load Time**: {model_result['load_time']:.2f} s\n"
            report_content += f"- **Doc Embedding Time**: {model_result['doc_embedding_time']:.2f} s\n"
            report_content += f"- **Query Embedding Time**: {model_result['query_embedding_time']:.2f} s\n"
            report_content += f"- **Top-1 Accuracy**: {model_result['top1_accuracy']:.2%}\n"
            report_content += f"- **Top-3 Accuracy**: {model_result['top3_accuracy']:.2%}\n"
            report_content += f"- **Top-5 Accuracy**: {model_result['top5_accuracy']:.2%}\n"
            report_content += f"- **MRR**: {model_result['mrr']:.4f}\n\n"
            
            report_content += "### Representative Examples\n"
            for ex in model_result["examples"][:3]: # Show first 3
                report_content += f"**Question:** {ex['question']}\n"
                report_content += f"**Expected:** {ex['expected'][0]}\n"
                report_content += "**Top 5:**\n"
                for i, t in enumerate(ex['top_5']):
                    report_content += f"{i+1}. {t['id']} (sim: {t['sim']:.4f})\n"
                report_content += "\n"
        else:
            report_content += f"**Status:** {model_result['status']}\n"
            report_content += f"**Error:** {model_result.get('error', 'Unknown')}\n"
        report_content += "\n---\n"
        
    with open(BENCHMARK_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        
    with open(REPORT_MD_PATH, "w", encoding="utf-8") as f:
        f.write(report_content)
        
    print("Benchmark complete!")

if __name__ == "__main__":
    run_benchmark()

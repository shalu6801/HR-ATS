import re
import io
import os
import json
import pdfplumber

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from supabase import create_client
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://nfkypjunrwaoezrukusp.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_hQDMDFTnzRB9cbYyVVsNcA_IhVs0K5i")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Groq (OpenAI-compatible) ──────────────────────────────────────────────────
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def clean_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()
    return json.loads(raw)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "TalentAI backend running"}


@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        text = ""

        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": """You are a resume parser. Return ONLY a valid JSON object with:
- name (string)
- email (string)
- phone (string)
- skills (array of strings)
- experience (string: brief summary)
- education (string: brief summary)
No markdown, no extra text. Only raw JSON."""
                },
                {
                    "role": "user",
                    "content": f"Parse this resume:\n\n{text[:3000]}"
                }
            ]
        )

        result = clean_json(response.choices[0].message.content)
        result["raw_text"] = text[:3000]
        return result

    except Exception as e:
        print(f"PARSE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai-analysis")
async def ai_analysis(data: dict):
    try:
        resume_text      = data.get("resume", "")
        job_desc         = data.get("job", "")
        candidate_name   = data.get("candidate_name", "Candidate")
        candidate_skills = data.get("candidate_skills", [])

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert AI recruiter. Analyze the resume against the job description.
Return ONLY a valid JSON object with these exact fields:
- matchScore (integer 0-100)
- skillMatch (array of objects, each with: skill string, required boolean, matched boolean, proficiency integer 0-100)
- skillGaps (array of strings)
- experienceScore (integer 0-100)
- educationScore (integer 0-100)
- overallFit (string: exactly one of "Excellent", "Good", "Fair", "Poor")
- strengths (array of 3-5 strings)
- weaknesses (array of 2-4 strings)
- flags (array of strings, can be empty)
- aiExplanation (object with: summary string, confidence integer 0-100, recommendation string exactly one of "Shortlist"/"Review"/"Reject")
No markdown, no extra text. Only raw JSON."""
                },
                {
                    "role": "user",
                    "content": f"Job Description:\n{job_desc}\n\nCandidate: {candidate_name}\nSkills: {', '.join(candidate_skills)}\n\nResume:\n{resume_text[:3000]}"
                }
            ]
        )

        return clean_json(response.choices[0].message.content)

    except Exception as e:
        print(f"ANALYSIS ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/parse-resume-text")
async def parse_resume_text(data: dict):
    try:
        text = data.get("resume_text", "")

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": "Parse resume, return ONLY JSON with: name, email, phone, skills (array), experience, education. No markdown, only raw JSON."
                },
                {
                    "role": "user",
                    "content": f"Parse:\n\n{text[:3000]}"
                }
            ]
        )

        return clean_json(response.choices[0].message.content)

    except Exception as e:
        print(f"PARSE TEXT ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "taskready.sqlite3"
FRONTEND = ROOT

WEIGHTS = {
    "context": 20,
    "data": 20,
    "expected": 15,
    "success": 15,
    "constraints": 10,
    "users": 10,
    "business": 10,
}

FIELD_LABELS = {
    "context": "Контекст и потребность",
    "data": "Данные и материалы",
    "expected": "Ожидаемый результат",
    "success": "Критерии успеха",
    "constraints": "Ограничения",
    "users": "Пользователи",
    "business": "Связь с бизнесом",
}

app = FastAPI(title="TaskReady AI API", version="0.2.0", description="Readiness OS backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StatePayload(BaseModel):
    view: str = "dashboard"
    role: str = "business"
    draftStep: int = 1
    draft: dict[str, Any] = Field(default_factory=dict)
    tasks: list[dict[str, Any]] = Field(default_factory=list)
    teams: list[dict[str, Any]] = Field(default_factory=list)
    offers: list[dict[str, Any]] = Field(default_factory=list)


class AnalyzePayload(BaseModel):
    raw: str = Field(min_length=15)
    industry: str = "Другое"
    contact: str = ""


def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute(
        "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)"
    )
    connection.commit()
    return connection


def completeness(value: Any) -> float:
    text = str(value or "").strip()
    if len(text) < 8:
        return 0
    if len(text) < 42:
        return 0.5
    return 1


def score_task(item: dict[str, Any]) -> int:
    score = sum(round(WEIGHTS[key] * completeness(item.get(key))) for key in WEIGHTS)
    return min(100, round(score))


def level_for(score: int) -> str:
    if score >= 90:
        return "Приоритетная"
    if score >= 70:
        return "Готовая"
    if score >= 40:
        return "Рабочая"
    return "Черновик"


def breakdown(item: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "key": key,
            "label": FIELD_LABELS[key],
            "points": round(WEIGHTS[key] * completeness(item.get(key))),
            "weight": WEIGHTS[key],
        }
        for key in WEIGHTS
    ]


def fallback_questions(raw: str) -> list[dict[str, str]]:
    text = raw.lower()
    probes = [
        ("users", "Кто сейчас сталкивается с этой проблемой и для кого создаётся решение?", ["клиент", "пользовател", "родител", "студент", "менеджер", "оператор"]),
        ("data", "Какие данные, примеры или материалы будут доступны команде?", ["данн", "таблиц", "csv", "пример", "источн", "выгруз", "истори"]),
        ("expected", "Какой конкретный результат команда должна передать бизнесу?", ["прототип", "сервис", "система", "результат", "решен", "дашборд"]),
        ("success", "По какому измеримому признаку вы примете решение, что задача решена?", ["процент", "час", "минут", "количеств", "сократ", "увелич", "точност"]),
        ("constraints", "Какие сроки, технологии, доступы или ограничения нужно учитывать?", ["срок", "недел", "месяц", "огранич", "доступ", "нельзя"]),
        ("business", "Кто будет давать обратную связь и как часто можно сверяться?", ["контакт", "созвон", "обратн", "встреч", "куратор", "руковод"]),
    ]
    questions = [{"field": field, "question": question} for field, question, keys in probes if not any(key in text for key in keys)]
    fallback = [
        ("success", "По какому измеримому признаку вы примете решение, что задача решена?"),
        ("data", "Какие данные, примеры или материалы будут доступны команде?"),
        ("constraints", "Какие сроки, технологии, доступы или ограничения нужно учитывать?"),
    ]
    for field, question in fallback:
        if len(questions) >= 3:
            break
        if not any(q["field"] == field for q in questions):
            questions.append({"field": field, "question": question})
    return questions[:5]


def title_from_raw(raw: str) -> str:
    title = raw.strip().split(".")[0].split("!")[0].split("?")[0].strip()
    return (title[:61] + "…") if len(title) > 64 else title or "Новая бизнес-задача"


def default_state() -> dict[str, Any]:
    return {"view": "dashboard", "role": "business", "draftStep": 1, "draft": {}, "tasks": [], "teams": [], "offers": []}


def load_state() -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT payload FROM app_state WHERE id=1").fetchone()
        if not row:
            payload = default_state()
            connection.execute(
                "INSERT INTO app_state(id, payload, updated_at) VALUES (1, ?, ?)",
                (json.dumps(payload, ensure_ascii=False), datetime.now(timezone.utc).isoformat()),
            )
            connection.commit()
            return payload
        return json.loads(row["payload"])


def persist_state(payload: dict[str, Any]) -> dict[str, Any]:
    with db() as connection:
        connection.execute(
            "INSERT INTO app_state(id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at",
            (json.dumps(payload, ensure_ascii=False), datetime.now(timezone.utc).isoformat()),
        )
        connection.commit()
    return payload


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "taskready-ai", "version": app.version}


@app.get("/api/state")
def get_state() -> dict[str, Any]:
    return load_state()


@app.put("/api/state")
def put_state(payload: StatePayload) -> dict[str, Any]:
    return persist_state(payload.model_dump())


@app.post("/api/tasks/analyze")
def analyze(payload: AnalyzePayload) -> dict[str, Any]:
    raw = payload.raw.strip()
    questions = fallback_questions(raw)
    draft = {
        "raw": raw,
        "title": title_from_raw(raw),
        "context": raw,
        "industry": payload.industry,
        "contact": payload.contact,
        "questions": questions,
        "analyzed": True,
        "confirmed": False,
    }
    return {"draft": draft, "questions": questions, "mode": "local-fallback", "message": "AI fallback готов: используйте внешний LLM без изменения контракта ответа."}


@app.post("/api/tasks/score")
def score(payload: dict[str, Any]) -> dict[str, Any]:
    value = score_task(payload)
    return {"score": value, "level": level_for(value), "breakdown": breakdown(payload)}


@app.get("/api/tasks")
def list_tasks() -> list[dict[str, Any]]:
    return [task for task in load_state().get("tasks", []) if task.get("status") == "published"]


@app.post("/api/tasks")
def create_task(task: dict[str, Any]) -> dict[str, Any]:
    current = load_state()
    score_value = score_task(task)
    task = {**task, "score": score_value, "level": level_for(score_value), "status": "published"}
    current.setdefault("tasks", []).insert(0, task)
    persist_state(current)
    return task


@app.get("/api/offers")
def list_offers() -> list[dict[str, Any]]:
    return load_state().get("offers", [])


@app.post("/api/offers")
def create_offer(offer: dict[str, Any]) -> dict[str, Any]:
    current = load_state()
    current.setdefault("offers", []).append(offer)
    persist_state(current)
    return offer


@app.post("/api/offers/{offer_id}/decision")
def decide_offer(offer_id: str, decision: dict[str, str]) -> dict[str, Any]:
    current = load_state()
    offer = next((item for item in current.get("offers", []) if item.get("id") == offer_id), None)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    action = decision.get("decision")
    if action not in {"accepted", "rejected"}:
        raise HTTPException(status_code=400, detail="decision must be accepted or rejected")
    offer["status"] = action
    persist_state(current)
    return offer


# API routes must be registered before the static frontend mount.
app.mount("/", StaticFiles(directory=str(FRONTEND), html=True), name="frontend")

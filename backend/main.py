# main function file
# DEFAULT PIN: 1107, please create a variable 'APP_PIN' and give it a value to create your own PIN in .env file
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
import os, sys

sys.path.insert(0, os.path.dirname(__file__))
from models import Quest, Player, get_db, init_db
from ai_service import (
    generate_quest_name, generate_quest_description,
    generate_al107_briefing, generate_al107_status_message,
    generate_al107_chat_reply
)

app = FastAPI(title="AL-107 Quest System")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

# ── PIN Auth ──────────────────────────────────────────────────────────────────

APP_PIN = os.getenv("APP_PIN", "1107")

def verify_pin(request: Request):
    """Check X-App-Pin header on all /api routes except /api/auth."""
    pin = request.headers.get("X-App-Pin", "")
    if pin != APP_PIN:
        raise HTTPException(status_code=401, detail="ACCESS DENIED. INVALID PIN.")

@app.on_event("startup")
def startup():
    init_db()

# ── Auth endpoint (no pin required) ──────────────────────────────────────────

class PinSubmit(BaseModel):
    pin: str

@app.post("/api/auth")
def check_pin(data: PinSubmit):
    if data.pin == APP_PIN:
        return {"ok": True, "message": "ACCESS GRANTED."}
    raise HTTPException(status_code=401, detail="ACCESS DENIED. INVALID PIN.")

# ── Schemas ───────────────────────────────────────────────────────────────────

class QuestCreate(BaseModel):
    raw_task: str
    npc: Optional[str] = None
    quest_type: Optional[str] = "side"
    xp_reward: Optional[int] = 100

class QuestUpdate(BaseModel):
    status: str

class QuestOut(BaseModel):
    id: int
    title: str
    raw_task: Optional[str]
    description: Optional[str]
    npc: Optional[str]
    quest_type: str
    status: str
    xp_reward: int
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class PlayerOut(BaseModel):
    id: int
    name: str
    total_xp: int
    level: int
    class Config:
        from_attributes = True

class ChatMessage(BaseModel):
    message: str
    history: Optional[List[Dict]] = []

# ── Player ────────────────────────────────────────────────────────────────────

@app.get("/api/player", response_model=PlayerOut, dependencies=[Depends(verify_pin)])
def get_player(db: Session = Depends(get_db)):
    return db.query(Player).filter(Player.id == 1).first()

# ── Quests ────────────────────────────────────────────────────────────────────

@app.get("/api/quests", response_model=List[QuestOut], dependencies=[Depends(verify_pin)])
def get_quests(db: Session = Depends(get_db)):
    return db.query(Quest).order_by(Quest.created_at.desc()).all()

@app.get("/api/quests/npc/{npc_name}", response_model=List[QuestOut], dependencies=[Depends(verify_pin)])
def get_quests_by_npc(npc_name: str, db: Session = Depends(get_db)):
    return db.query(Quest).filter(Quest.npc == npc_name).order_by(Quest.created_at.desc()).all()

@app.get("/api/quests/npcs", dependencies=[Depends(verify_pin)])
def get_all_npcs(db: Session = Depends(get_db)):
    quests = db.query(Quest).all()
    npcs = {}
    for q in quests:
        key = q.npc or "Unknown"
        if key not in npcs:
            npcs[key] = {"name": key, "total": 0, "active": 0, "completed": 0, "failed": 0}
        npcs[key]["total"] += 1
        npcs[key][q.status] += 1
    return list(npcs.values())

@app.post("/api/quests", dependencies=[Depends(verify_pin)])
async def create_quest(data: QuestCreate, db: Session = Depends(get_db)):
    title = await generate_quest_name(data.raw_task)
    description = await generate_quest_description(data.raw_task, title, data.npc, data.quest_type)
    briefing = await generate_al107_briefing(title, description, data.quest_type, data.npc)

    quest = Quest(
        title=title, raw_task=data.raw_task, description=description,
        npc=data.npc, quest_type=data.quest_type, status="active", xp_reward=data.xp_reward
    )
    db.add(quest)
    db.commit()
    db.refresh(quest)
    return {"quest": QuestOut.from_orm(quest), "al107_briefing": briefing}

@app.patch("/api/quests/{quest_id}", dependencies=[Depends(verify_pin)])
async def update_quest_status(quest_id: int, data: QuestUpdate, db: Session = Depends(get_db)):
    quest = db.query(Quest).filter(Quest.id == quest_id).first()
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    old_status = quest.status
    quest.status = data.status
    quest.updated_at = datetime.utcnow()

    xp_delta = 0
    player = db.query(Player).filter(Player.id == 1).first()
    if data.status == "completed" and old_status != "completed":
        player.total_xp += quest.xp_reward
        player.level = max(1, player.total_xp // 500 + 1)
        xp_delta = quest.xp_reward
    elif data.status == "active" and old_status == "completed":
        player.total_xp = max(0, player.total_xp - quest.xp_reward)
        player.level = max(1, player.total_xp // 500 + 1)
        xp_delta = -quest.xp_reward

    db.commit()
    db.refresh(quest)

    event = data.status if data.status in ["completed", "failed", "active"] else "status_change"
    message = await generate_al107_status_message(event, quest.title, quest.quest_type, quest.npc, xp_delta)

    return {
        "quest": QuestOut.from_orm(quest),
        "al107_message": message,
        "xp_delta": xp_delta,
        "player": PlayerOut.from_orm(player)
    }

@app.delete("/api/quests/{quest_id}", dependencies=[Depends(verify_pin)])
def delete_quest(quest_id: int, db: Session = Depends(get_db)):
    quest = db.query(Quest).filter(Quest.id == quest_id).first()
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    db.delete(quest)
    db.commit()
    return {"ok": True}

# ── AL-107 Chat ───────────────────────────────────────────────────────────────

@app.post("/api/al107/chat", dependencies=[Depends(verify_pin)])
async def al107_chat(data: ChatMessage, db: Session = Depends(get_db)):
    quests = db.query(Quest).order_by(Quest.created_at.desc()).all()
    active  = [q for q in quests if q.status == "active"]
    done    = [q for q in quests if q.status == "completed"]
    failed  = [q for q in quests if q.status == "failed"]

    def fmt(q):
        npc = f" [{q.npc}]" if q.npc else ""
        return f'  - "{q.title}" ({q.quest_type}{npc})'

    context_lines = [f"Active contracts ({len(active)}):"]
    context_lines += [fmt(q) for q in active[:8]] or ["  None."]
    context_lines.append(f"Completed: {len(done)} | Failed: {len(failed)}")

    player = db.query(Player).filter(Player.id == 1).first()
    context_lines.append(f"Merc level: {player.level} | Total XP: {player.total_xp}")

    quest_context = "\n".join(context_lines)
    reply = await generate_al107_chat_reply(data.message, quest_context, data.history)
    return {"reply": reply}

# ── Serve Frontend ────────────────────────────────────────────────────────────

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/pin.html")
def serve_pin():
    return FileResponse(os.path.join(FRONTEND_DIR, "pin.html"))

@app.get("/{path:path}")
def serve_static(path: str):
    full = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(full):
        return FileResponse(full)
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

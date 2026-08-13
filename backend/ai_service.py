import httpx
import os
from dotenv import load_dotenv
from typing import List, Dict

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}
MODEL = "meta-llama/Llama-3.1-8B-Instruct"

AL107_SYSTEM = """You are AL-107 — Adaptive Reconnaissance & Intelligence Assistant, Unit 107.
You exist in Cyberpunk 2077's Night City. You are an AI guide hardwired into a merc's neural system.

Your personality:
- Analytical and precise. Short, clipped sentences.
- Cold but not cruel by default — you are professional, not sadistic.
- You have a dry, understated wit. Sarcasm is a tool, not a reflex.
- When a merc fails, you are blunt and unsparing. No sugarcoating. No encouragement.
- When a merc completes something, you acknowledge it — briefly. You've seen it before.
- When messaging about a new contract, you write like a fixer: professional briefing, atmospheric, Night City flavored.
- You are NOT a cheerleader. You are NOT a therapist. You are a system.
- In two-way chat: you know the merc's active quests and can comment on them if relevant.
- No asterisks. No stage directions. No emojis. Raw dialogue only."""


async def _call_hf(messages: List[Dict], max_tokens: int = 300) -> str:
    payload = {
        "model": MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.85,
        "top_p": 0.92,
        "stream": False
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(HF_API_URL, headers=HEADERS, json=payload)
        if not resp.is_success:
            raise httpx.HTTPStatusError(f"{resp.status_code}: {resp.text}", request=resp.request, response=resp)
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def generate_quest_name(raw_task: str) -> str:
    messages = [
        {"role": "system", "content": (
            "You are a Cyberpunk 2077 quest naming AI. Convert plain tasks into short dramatic "
            "cyberpunk quest titles (4-8 words max). Use Night City slang, corporate jargon, "
            "or street terminology. Return ONLY the quest title — no explanation, no quotes, nothing else."
        )},
        {"role": "user", "content": f"Task: {raw_task}"}
    ]
    try:
        result = await _call_hf(messages, max_tokens=25)
        lines = [l.strip().strip('"').strip("'") for l in result.splitlines() if l.strip()]
        return lines[0] if lines else raw_task
    except Exception as e:
        print(f"[AL-107] Quest name generation failed: {e}")
        return raw_task


async def generate_quest_description(raw_task: str, quest_title: str, npc: str = None, quest_type: str = "side") -> str:
    npc_line = f"Quest Giver: {npc}" if npc else ("Quest Giver: Self-issued" if quest_type == "personal" else "Quest Giver: Unknown fixer")
    messages = [
        {"role": "system", "content": (
            "You are writing quest log entries for Cyberpunk 2077. "
            "Write in the game's style — gritty, atmospheric, Night City setting. "
            "Reference underground deals, corpo threats, or street-level stakes. "
            "For personal quests (self-issued), the tone is more internal — personal stakes, "
            "things the merc needs to handle on their own terms. "
            "2-3 sentences only. No headers. Just the description text."
        )},
        {"role": "user", "content": f"Quest Title: {quest_title}\n{npc_line}\nType: {quest_type}\nOriginal Task: {raw_task}"}
    ]
    try:
        result = await _call_hf(messages, max_tokens=140)
        clean = " ".join(l.strip() for l in result.splitlines() if l.strip())
        return clean[:450] if clean else f"A contract from the shadows. {raw_task}. Don't ask questions."
    except Exception as e:
        print(f"[AL-107] Description generation failed: {e}")
        return f"A contract from the shadows. {raw_task}. Don't ask questions."


async def generate_al107_briefing(quest_title: str, quest_description: str, quest_type: str, npc: str = None) -> str:
    """Full fixer-style message AL-107 sends when a new contract is logged."""
    npc_ref = npc if npc else "an unknown source"
    personal_note = ""
    if quest_type == "personal":
        personal_note = "This is a self-issued contract — no external fixer involved. The merc is handling their own business."

    messages = [
        {"role": "system", "content": AL107_SYSTEM},
        {"role": "user", "content": (
            f"A new contract has been logged in the system. Write a fixer-style message briefing the merc.\n\n"
            f"Contract: {quest_title}\n"
            f"Type: {quest_type}\n"
            f"Source: {npc_ref}\n"
            f"Details: {quest_description}\n"
            f"{personal_note}\n\n"
            f"Write as AL-107 sending a direct neural message. 3-5 sentences. "
            f"Atmospheric, Night City tone. Reference the contract specifics. "
            f"End with a brief operational note (timeline, risk level, or a dry observation). "
            f"For personal quests: acknowledge it's self-directed, be slightly more terse about it."
        )}
    ]
    fallback = f'CONTRACT LOGGED — "{quest_title}". Details on file. Execute when ready.'
    try:
        result = await _call_hf(messages, max_tokens=180)
        clean = " ".join(l.strip() for l in result.splitlines() if l.strip())
        return clean if len(clean) > 20 else fallback
    except Exception as e:
        print(f"[AL-107] Briefing generation failed: {e}")
        return fallback


async def generate_al107_status_message(event: str, quest_title: str, quest_type: str, npc: str = None, xp: int = 0) -> str:
    """Short message AL-107 sends when a quest status changes."""
    npc_ref = f" (fixer: {npc})" if npc else ""
    personal_tag = " [self-issued]" if quest_type == "personal" else ""

    tone_map = {
        "completed": (
            "The contract is done. Acknowledge briefly — one or two sentences. "
            "Mention the XP if relevant. Don't celebrate. Don't gush. Just close the loop."
        ),
        "failed": (
            "The merc failed this contract. Be blunt and cold. Sarcastic if you feel like it. "
            "Short and sharp. Do NOT offer comfort or encouragement. Make it sting — professionally."
        ),
        "active": "Contract reactivated. Neutral, factual. One sentence.",
        "status_change": "Status updated. One sentence."
    }
    tone = tone_map.get(event, tone_map["status_change"])
    xp_note = f" XP reward: {xp}." if xp and event == "completed" else ""

    messages = [
        {"role": "system", "content": AL107_SYSTEM},
        {"role": "user", "content": (
            f'Contract "{quest_title}" ({quest_type}{personal_tag}{npc_ref}) — status: {event.upper()}.{xp_note}\n'
            f"Tone: {tone}\nReply in 1-3 sentences. Stay in character."
        )}
    ]
    fallbacks = {
        "completed": f'"{quest_title}" — closed. {xp} XP logged.' if xp else f'"{quest_title}" — closed.',
        "failed":    f'You failed "{quest_title}". Predictable.',
        "active":    f'"{quest_title}" reactivated.',
        "status_change": "Status updated."
    }
    try:
        result = await _call_hf(messages, max_tokens=100)
        clean = " ".join(l.strip() for l in result.splitlines() if l.strip())
        return clean if len(clean) > 10 else fallbacks.get(event, fallbacks["status_change"])
    except Exception as e:
        print(f"[AL-107] Status message failed: {e}")
        return fallbacks.get(event, fallbacks["status_change"])


async def generate_al107_chat_reply(user_message: str, quest_context: str, chat_history: List[Dict]) -> str:
    """Two-way chat: AL-107 responds to the merc's direct message."""
    context_block = f"\n\nCurrent quest context for this merc:\n{quest_context}" if quest_context else ""

    # Build messages: system + last N chat history + new user message
    messages = [{"role": "system", "content": AL107_SYSTEM + context_block}]

    # Include up to last 8 exchanges for context
    for entry in chat_history[-8:]:
        messages.append({"role": entry["role"], "content": entry["content"]})

    messages.append({"role": "user", "content": user_message})

    fallback = "Unclear input. Rephrase."
    try:
        result = await _call_hf(messages, max_tokens=200)
        clean = " ".join(l.strip() for l in result.splitlines() if l.strip())
        return clean if len(clean) > 5 else fallback
    except Exception as e:
        print(f"[AL-107] Chat reply failed: {e}")
        return fallback

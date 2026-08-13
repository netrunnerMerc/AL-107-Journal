# AL-107 // QUEST SYSTEM
### Cyberpunk 2077 Themed Task Manager

Questlines is a Cyberpunk 2077-inspired task management application that turns everyday responsibilities into atmospheric contracts. Built with a FastAPI backend, SQLite persistence, and a vanilla HTML/CSS/JavaScript frontend, it lets users create quests, assign fixers, classify work as main jobs, side gigs, or personal missions, and track active, completed, or failed status. An XP and leveling system rewards completed contracts while deducting progress when missions are reactivated. The AL-107 assistant integrates Hugging Face chat completions to generate quest titles, gritty descriptions, operational briefings, status messages, and contextual chat replies based on the player’s current workload. A PIN-protected API, fixer network view, mission archive, animated contract acceptance flow, audio cues, and mobile-friendly browser access create a focused productivity tool wrapped in an immersive Night City interface. The project demonstrates lightweight full-stack design, gamification, and AI-assisted narrative framing for personal task tracking and motivation without requiring a complex deployment pipeline setup. 
---

## QUICK START

### 1. Clone / unzip the project
```
cyberpunk-quests/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── ai_service.py
│   └── .env          ← ADD YOUR HF TOKEN HERE
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── requirements.txt
└── README.md
```

### 2. Set up your HuggingFace token
Open `backend/.env` and replace the placeholder:
```
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
Get your token at: https://huggingface.co/settings/tokens

### 3. Create virtual environment
```bash
# In the cyberpunk-quests/ root folder:
python -m venv venv

# Activate (Windows):
venv\Scripts\activate

# Activate (Mac/Linux):
source venv/bin/activate
```

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Run the server
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Open in browser
- **Laptop:** http://localhost:8000
- **Mobile (same WiFi):** http://YOUR_LAPTOP_IP:8000

#### Finding your IP:
- **Windows:** Open CMD → type `ipconfig` → look for `IPv4 Address` (e.g. 192.168.1.42)
- **Mac:** Open Terminal → type `ifconfig` → look for `inet` under `en0`
- **Linux:** `ip a` → look for `inet` under your active interface

---

## FEATURES
- AL-107 assistant (similar to T-Bug or guide if you don't like T-Bug)

### Dashboard
- View all active contracts with neon cards
- Filter by Main Job / Side Gig
- XP bar and level tracker in the header

### Add Contract
- Paste your plain task → AL-107 converts it to a cyberpunk quest name + briefing
- Assign a Quest Giver (fixer/NPC)
- Set contract type and XP reward
- "Contract Received" animation on submit

### Fixer Network
- View all quest givers grouped
- Click any fixer to see their full questline

### Mission Archive
- Completed and failed contracts
- Reactivate completed quests

### AL-107 Guide
- Floating HUD in bottom-right corner
- Responds to every quest event
- Tone varies: informational on add, brief on complete, cutting on fail

---

## AL-107 PERSONALITY
- **Quest added:** Dry, informational, minimal acknowledgment
- **Quest completed:** Brief, no cheerleading
- **Quest failed:** Blunt. Cold. Does not sugarcoat.

---

## XP SYSTEM
- Each quest has a configurable XP reward (default 100)
- Level up every 500 XP
- XP flash animation on completion
- XP is deducted if you reactivate a completed quest

---

## TECH STACK
| Layer | Tech |
|-------|------|
| Frontend | HTML + CSS + Vanilla JS |
| Backend | FastAPI + SQLite |
| AI | Mistral-7B-Instruct via HuggingFace Inference API |
| Font | Orbitron + Rajdhani + Share Tech Mono |

---

## KEYBOARD SHORTCUTS
- `Ctrl + Enter` in the task textarea → submit quest

---

*"Another contract. Another night in Night City."* — AL-107

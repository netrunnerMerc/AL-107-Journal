# Remote Access Setup // Tailscale + PIN

## How it works

Tailscale creates a private encrypted tunnel between your devices.
Your server laptop gets a stable private IP (like `100.x.x.x`).
Your phone and other laptops connect to it directly — over WiFi, mobile data, anywhere.
Nothing is exposed to the public internet.

---

## Step 1 — Install Tailscale everywhere

**On your server laptop (the one running the app):**
- Windows: https://tailscale.com/download/windows
- Linux: `curl -fsSL https://tailscale.com/install.sh | sh`
- Mac: https://tailscale.com/download/mac

**On your phone:**
- iOS: App Store → search "Tailscale"
- Android: Play Store → search "Tailscale"

**On other laptops:** same as above for their OS.

Sign into the same Tailscale account on all devices.

---

## Step 2 — Find your server's Tailscale IP

After installing on the server laptop, open a terminal:

```bash
# Windows
tailscale ip -4

# Mac / Linux
tailscale ip -4
```

You'll get something like: `100.84.21.7`

That's your permanent private IP. It never changes.

---

## Step 3 — Run the server

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

No `--reload` in everyday use (that's just for development).

---

## Step 4 — Access from anywhere

On any device with Tailscale installed and signed in:

```
http://100.84.21.7:8000
```

Replace `100.84.21.7` with your actual Tailscale IP.

**Bookmark it on your phone.** Works on WiFi, 4G, 5G — anywhere.

---

## PIN Authentication

Your app is protected by a PIN code.

**Default PIN: `1107`**

To change it, open `backend/.env`:
```
APP_PIN=your_new_pin_here
```

Then restart the server. The PIN can be any length — 4, 6, 8 digits.

**How it works:**
- Every device that opens the app sees the PIN screen first
- Enter the correct PIN → session is stored, you're in
- Wrong PIN → AL-107 denies access
- Closing the browser tab clears the session (you'll PIN again next time)
- The PIN is never stored in plain text on the frontend — only in sessionStorage for the current tab

---

## Optional: Auto-start the server on boot

**Windows (Task Scheduler):**
1. Open Task Scheduler → Create Basic Task
2. Trigger: "When the computer starts"
3. Action: Start a program
4. Program: `C:\path\to\venv\Scripts\uvicorn.exe`
5. Arguments: `main:app --host 0.0.0.0 --port 8000`
6. Start in: `C:\path\to\questlines\backend`

**Linux (systemd):**
```ini
# /etc/systemd/system/al107.service
[Unit]
Description=AL-107 Quest System
After=network.target

[Service]
WorkingDirectory=/path/to/questlines/backend
ExecStart=/path/to/questlines/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable al107
sudo systemctl start al107
```

**Mac (launchd):** Simplest option is to add the uvicorn command to your Login Items in System Settings.

---

*"Neural link established. Don't lose the code."* — AL-107

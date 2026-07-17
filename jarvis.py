import os
import sys
import time
import subprocess
import json
import requests
import pyautogui
import webbrowser
import speech_recognition as sr
import pyttsx3
import tkinter as tk
import threading

# =====================================================================
# J.A.R.V.I.S. NATIVE SYSTEM ASSISTANT (POPUP HUD & ALL-APP LAUNCHER)
# =====================================================================
# Features:
# 1. Start Menu App Scanner: Recursively scans Windows Start Menu shortcuts
#    on startup to launch ANY installed desktop app (Spotify, Chrome, VS Code,
#    Steam, WhatsApp, Discord, etc.) natively by matching names.
# 2. Dynamic Folder Search: Automatically searches your user directories
#    to locate and open system/custom folders natively.
# 3. Borderless Popup HUD Card: Replaces the dot with a borderless, rounded,
#    always-on-top status card (200x50 px) with state labels:
#    - Blue Dot & "STANDBY" (waiting for "Hey Jarvis")
#    - Green Dot & "LISTENING..." (active command recording)
#    - Orange Dot & "THINKING..." (Ollama reasoning/TTS speaking)
#    - Red Dot & "OFFLINE" (shutting down)
# =====================================================================

class JarvisAssistant:
    def __init__(self):
        print("[SYSTEM] Initializing J.A.R.V.I.S. advanced cores...")
        
        # 1. State tracking for Tkinter HUD Thread
        self.gui_state = "standby"  # standby | listening | speaking | offline
        
        # 2. Initialize Memory File
        self.memory_path = "memory.json"
        self.memory = self.load_memory()
        
        # 3. Initialize Text-to-Speech Engine
        self.tts_engine = pyttsx3.init()
        self.setup_tts_voice()
        
        # 4. Initialize Speech Recognition Engine
        self.recognizer = sr.Recognizer()
        self.recognizer.dynamic_energy_threshold = True
        
        # 5. Configurations
        self.ollama_url = "http://localhost:11434/api/chat"
        self.model_name = "llama3"
        self.device_index = None   # Default microphone index
        
        # 6. Windows Applications Cataloging
        print("[SYSTEM] Loading application catalog...")
        self.installed_apps = self.load_or_build_catalog()
        print(f"[SYSTEM] Catalog ready. {len(self.installed_apps)} apps registered.")
        
        # Auto-register startup shortcut
        self.add_to_startup()
        
        # Define local overrides
        self.fallback_commands = {
            "open notepad": lambda: self.execute_app("notepad"),
            "launch notepad": lambda: self.execute_app("notepad"),
            "open calculator": lambda: self.execute_app("calc"),
            "open calc": lambda: self.execute_app("calc"),
            "open chrome": lambda: self.execute_app("chrome"),
            "open browser": lambda: self.execute_app("chrome"),
            "open vscode": lambda: self.execute_app("vscode"),
            "open vs code": lambda: self.execute_app("vscode"),
            "open explorer": lambda: self.open_folder("explorer"),
            "open files": lambda: self.open_folder("explorer"),
            "open downloads": lambda: self.open_folder("downloads"),
            "open documents": lambda: self.open_folder("documents"),
            "open desktop": lambda: self.open_folder("desktop"),
            "open pictures": lambda: self.open_folder("pictures"),
            "open music": lambda: self.open_folder("music"),
            "open videos": lambda: self.open_folder("videos"),
            "volume up": lambda: self.adjust_volume("up"),
            "volume down": lambda: self.adjust_volume("down"),
            "mute volume": lambda: self.adjust_volume("mute"),
            "mute": lambda: self.adjust_volume("mute"),
            "lock screen": self.lock_pc,
            "lock laptop": self.lock_pc,
            "lock pc": self.lock_pc,
            "take screenshot": self.take_screenshot,
            "screenshot": self.take_screenshot,
        }

    def load_or_build_catalog(self):
        """Loads app_catalog.json or runs build_app_catalog.py to generate it fresh."""
        catalog_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_catalog.json")
        builder_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_app_catalog.py")
        
        # Build catalog if missing or older than 7 days
        needs_build = not os.path.exists(catalog_path)
        if not needs_build:
            age_days = (time.time() - os.path.getmtime(catalog_path)) / 86400
            if age_days > 7:
                needs_build = True
                print("[CATALOG] Catalog is over 7 days old, rebuilding...")
        
        if needs_build and os.path.exists(builder_path):
            print("[CATALOG] Building full app catalog from your laptop... (this takes ~30 seconds)")
            try:
                subprocess.run(
                    [sys.executable, builder_path],
                    capture_output=False, timeout=120
                )
            except Exception as e:
                print(f"[CATALOG] Build failed: {e}")

        # Load catalog JSON
        apps = {}
        if os.path.exists(catalog_path):
            try:
                with open(catalog_path, "r") as f:
                    raw = json.load(f)
                for name, info in raw.items():
                    apps[name] = info.get("shortcut") or info.get("exe", "")
                print(f"[CATALOG] Loaded {len(apps)} apps from catalog.")
                return apps
            except Exception as e:
                print(f"[CATALOG] Failed to load catalog: {e}")
        
        # Fallback: scan Start Menu only
        print("[CATALOG] Falling back to Start Menu scan...")
        apps = {}
        paths = [
            r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
            os.path.join(os.getenv("APPDATA"), r"Microsoft\Windows\Start Menu\Programs")
        ]
        for base_path in paths:
            if os.path.exists(base_path):
                for root, _, files in os.walk(base_path):
                    for file in files:
                        if file.endswith(".lnk"):
                            name = file[:-4].lower().strip()
                            apps[name] = os.path.join(root, file)
        return apps

    def add_to_startup(self):
        """Adds a shortcut of the background launcher to Windows Startup folder"""
        try:
            startup_folder = os.path.join(os.getenv("APPDATA"), r"Microsoft\Windows\Start Menu\Programs\Startup")
            vbs_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "run_jarvis_background.vbs")
            working_dir = os.path.dirname(os.path.abspath(__file__))
            
            shortcut_path = os.path.join(startup_folder, "Jarvis.lnk")
            if not os.path.exists(shortcut_path):
                # Powershell command to generate shortcut
                ps_cmd = (
                    f"$s=(New-Object -COM WScript.Shell).CreateShortcut('{shortcut_path}');"
                    f"$s.TargetPath='{vbs_path}';"
                    f"$s.WorkingDirectory='{working_dir}';"
                    f"$s.Save()"
                )
                subprocess.run(["powershell", "-Command", ps_cmd], capture_output=True)
                print("[SYSTEM] J.A.R.V.I.S. added to Windows Startup folder.")
        except Exception as e:
            print(f"[WARNING] Startup registration failed: {e}")

    def load_memory(self):
        """Loads user facts and conversation logs from memory.json"""
        if os.path.exists(self.memory_path):
            try:
                with open(self.memory_path, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        
        default_mem = {
            "user_name": "Boss",
            "facts": {},
            "conversation_history": []
        }
        self.save_memory_data(default_mem)
        return default_mem

    def save_memory_data(self, data):
        """Saves current memory state to disk"""
        try:
            with open(self.memory_path, 'w') as f:
                json.dump(data, f, indent=4)
        except Exception as e:
            print(f"[ERROR] Failed to write memory: {e}")

    def remember_fact(self, key, value):
        """Records a customized user fact to memory"""
        self.memory["facts"][key.lower()] = value
        self.save_memory_data(self.memory)

    def retrieve_fact(self, key):
        """Fetches a fact from memory"""
        return self.memory["facts"].get(key.lower(), None)
        
    def setup_tts_voice(self):
        """Finds and sets an English-speaking voice (preferably British for JARVIS)"""
        voices = self.tts_engine.getProperty('voices')
        self.tts_engine.setProperty('rate', 190)
        
        selected_voice = None
        for voice in voices:
            if "Hazel" in voice.name or "Great Britain" in voice.name or "en-GB" in voice.languages:
                selected_voice = voice.id
                break
        
        if not selected_voice and voices:
            selected_voice = voices[0].id
            
        if selected_voice:
            self.tts_engine.setProperty('voice', selected_voice)

    def speak(self, text):
        """Offline Text-to-Speech synthesis updating GUI state"""
        old_state = self.gui_state
        self.gui_state = "speaking"
        print(f"[JARVIS] {text}")
        self.tts_engine.say(text)
        self.tts_engine.runAndWait()
        self.gui_state = old_state

    def listen(self):
        """Microphone audio capture and transcription via Google Web STT"""
        self.gui_state = "standby"
        with sr.Microphone(device_index=self.device_index) as source:
            try:
                # Capture audio with a 4-second timeout to check wake word frequently
                audio = self.recognizer.listen(source, timeout=4, phrase_time_limit=6)
                self.gui_state = "speaking"  # update while transcribing/talking
                print("\n[STT] Transcribing voice...")
                query = self.recognizer.recognize_google(audio)
                print(f"[USER] You said: \"{query}\"")
                return query.strip()
                
            except sr.WaitTimeoutError:
                # Polling indicator
                print(".", end="", flush=True)
                return None
            except sr.UnknownValueError:
                return None
            except sr.RequestError as e:
                print(f"\n[ERROR] STT Request failure: {e}")
                self.speak("My communication links are impaired, Boss. I cannot reach the voice servers.")
                return None
            except Exception as e:
                print(f"\n[ERROR] Microphone capture failed: {e}")
                return None

    def execute_app(self, app_name):
        """Launches Windows desktop applications using a 4-tier fallback system"""
        normalized_name = app_name.lower().strip()
        user_home = os.path.expanduser("~")
        
        # --- TIER 1: Built-in system commands ---
        try:
            if normalized_name in ["notepad", "text editor"]:
                subprocess.Popen(["notepad.exe"])
                return "Initializing Notepad workspace."
            elif normalized_name in ["calculator", "calc"]:
                subprocess.Popen(["calc.exe"])
                return "Opening Calculator interface."
            elif normalized_name in ["chrome", "google chrome", "browser"]:
                subprocess.Popen(["cmd.exe", "/c", "start chrome"])
                return "Launching Google Chrome, Boss."
            elif normalized_name in ["vscode", "vs code", "visual studio code"]:
                subprocess.Popen(["cmd.exe", "/c", "code"], shell=True)
                return "Opening VS Code workspace."
            elif normalized_name in ["task manager", "taskmanager"]:
                subprocess.Popen(["taskmgr.exe"])
                return "Opening Task Manager."
            elif normalized_name in ["control panel"]:
                subprocess.Popen(["control.exe"])
                return "Opening Control Panel."
            elif normalized_name in ["settings", "windows settings"]:
                subprocess.Popen(["ms-settings:"], shell=True)
                return "Opening Windows Settings."
        except Exception:
            pass

        # --- TIER 2: Known direct executable paths (UWP / AppData installs) ---
        known_paths = {
            "spotify": [
                os.path.join(user_home, "AppData", "Roaming", "Spotify", "Spotify.exe"),
                os.path.join(user_home, "AppData", "Local", "Microsoft", "WindowsApps", "Spotify.exe"),
            ],
            "discord": [
                os.path.join(user_home, "AppData", "Local", "Discord", "Update.exe"),
                os.path.join(user_home, "AppData", "Local", "Discord", "app-1.0.9179", "Discord.exe"),
                os.path.join(user_home, "AppData", "Local", "Microsoft", "WindowsApps", "Discord.exe"),
            ],
            "whatsapp": [
                os.path.join(user_home, "AppData", "Local", "WhatsApp", "WhatsApp.exe"),
                os.path.join(user_home, "AppData", "Local", "Microsoft", "WindowsApps", "WhatsApp.exe"),
            ],
            "what app": [
                os.path.join(user_home, "AppData", "Local", "WhatsApp", "WhatsApp.exe"),
            ],
            "whatapp": [
                os.path.join(user_home, "AppData", "Local", "WhatsApp", "WhatsApp.exe"),
            ],
            "telegram": [
                os.path.join(user_home, "AppData", "Roaming", "Telegram Desktop", "Telegram.exe"),
                os.path.join(user_home, "AppData", "Local", "Microsoft", "WindowsApps", "Telegram.exe"),
            ],
            "steam": [
                r"C:\Program Files (x86)\Steam\Steam.exe",
                r"C:\Program Files\Steam\Steam.exe",
            ],
            "vlc": [
                r"C:\Program Files\VideoLAN\VLC\vlc.exe",
                r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
            ],
            "word": [r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE"],
            "excel": [r"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE"],
            "powerpoint": [r"C:\Program Files\Microsoft Office\root\Office16\POWERPNT.EXE"],
            "zoom": [os.path.join(user_home, "AppData", "Roaming", "Zoom", "bin", "Zoom.exe")],
            "obs": [r"C:\Program Files\obs-studio\bin\64bit\obs64.exe"],
            "teams": [os.path.join(user_home, "AppData", "Local", "Microsoft", "Teams", "current", "Teams.exe")],
        }
        
        for key, path_list in known_paths.items():
            if key in normalized_name or normalized_name in key:
                for exe_path in path_list:
                    if os.path.exists(exe_path):
                        # Spotify needs --update flag to launch app not just updater
                        if "discord" in exe_path.lower() and "update" in exe_path.lower():
                            subprocess.Popen([exe_path, "--processStart", "Discord.exe"])
                        else:
                            subprocess.Popen([exe_path])
                        print(f"[APP] Launched via known path: {exe_path}")
                        return f"Launching {app_name.capitalize()}, Boss."

        # --- TIER 3: Start Menu .lnk catalog scan ---
        matched_shortcut = None
        for name, shortcut_path in self.installed_apps.items():
            if name == normalized_name or normalized_name in name or name in normalized_name:
                matched_shortcut = shortcut_path
                break
                
        if matched_shortcut:
            try:
                os.startfile(matched_shortcut)
                print(f"[APP] Launched via Start Menu shortcut: {matched_shortcut}")
                return f"Launching {app_name.capitalize()}, Boss."
            except Exception as e:
                print(f"[APP] Shortcut launch failed: {e}")

        # --- TIER 4: Windows shell 'start' command (last resort — works for UWP & PATH apps) ---
        try:
            subprocess.Popen(["cmd.exe", "/c", f"start {normalized_name}"], shell=True)
            print(f"[APP] Attempted shell launch: start {normalized_name}")
            return f"Attempting to open {app_name.capitalize()} via system shell, Boss."
        except Exception as e:
            return f"I could not locate {app_name} on this system. Error: {str(e)}"

    def open_folder(self, folder_name):
        """Natively opens system directories or custom folders inside user profile"""
        try:
            user_profile = os.path.expanduser("~")
            paths = {
                "downloads": os.path.join(user_profile, "Downloads"),
                "documents": os.path.join(user_profile, "Documents"),
                "desktop": os.path.join(user_profile, "Desktop"),
                "pictures": os.path.join(user_profile, "Pictures"),
                "music": os.path.join(user_profile, "Music"),
                "videos": os.path.join(user_profile, "Videos"),
                "explorer": user_profile,
                "c drive": "C:\\",
                "d drive": "D:\\"
            }
            normalized = folder_name.lower().strip()
            path = paths.get(normalized)
            
            # Dynamic lookup in User directory if not matching presets
            if not path:
                for item in os.listdir(user_profile):
                    item_path = os.path.join(user_profile, item)
                    if os.path.isdir(item_path) and item.lower() == normalized:
                        path = item_path
                        break
                        
            if path and os.path.exists(path):
                os.startfile(path)
                return f"Accessing local {folder_name} folder, Boss."
            else:
                return f"Folder {folder_name} could not be resolved."
        except Exception as e:
            return f"Failed to open folder: {str(e)}"

    def adjust_volume(self, action):
        """Controls Windows master volume using pyautogui keystrokes"""
        try:
            if action == "up":
                for _ in range(5):
                    pyautogui.press('volumeup')
                return "Raising system volume."
            elif action == "down":
                for _ in range(5):
                    pyautogui.press('volumedown')
                return "Lowering system volume."
            elif action == "mute":
                pyautogui.press('volumemute')
                return "Toggling volume mute."
        except Exception as e:
            return f"Failed to adjust volume: {str(e)}"

    def lock_pc(self):
        """Locks the Windows workstation natively"""
        try:
            os.system("rundll32.exe user32.dll,LockWorkStation")
            return "Securing console. Workstation is locked."
        except Exception as e:
            return f"PC lock failed: {str(e)}"

    def take_screenshot(self):
        """Captures a screenshot and saves it locally"""
        try:
            filename = f"screenshot_{int(time.time())}.png"
            pyautogui.screenshot(filename)
            return f"Screenshot saved successfully as {filename}."
        except Exception as e:
            return f"Failed to capture screenshot: {str(e)}"

    def search_web(self, query):
        """Searches Google or YouTube in the default browser"""
        try:
            if "youtube" in query.lower():
                search_term = query.lower().replace("search youtube for", "").replace("search on youtube for", "").replace("youtube", "").strip()
                url = f"https://www.youtube.com/results?search_query={search_term}"
                webbrowser.open(url)
                return f"Searching YouTube for \"{search_term}\", Boss."
            else:
                search_term = query.lower().replace("search google for", "").replace("search for", "").replace("search", "").strip()
                url = f"https://www.google.com/search?q={search_term}"
                webbrowser.open(url)
                return f"Opening search results for \"{search_term}\"."
        except Exception as e:
            return f"Web search failed: {str(e)}"

    def run_python_code(self, code_str):
        """Evaluates simple mathematical calculations or safe inline python scripts"""
        try:
            cleaned = code_str.replace("run code", "").replace("calculate", "").replace("python", "").strip()
            result = eval(cleaned, {"__builtins__": None}, {})
            return f"Computation result is: {result}"
        except Exception:
            try:
                temp_file = "temp_exec.py"
                with open(temp_file, "w") as f:
                    f.write(cleaned)
                proc = subprocess.run([sys.executable, temp_file], capture_output=True, text=True, timeout=3)
                os.remove(temp_file)
                if proc.returncode == 0:
                    return f"Execution output:\n{proc.stdout.strip()}"
                else:
                    return f"Execution error: {proc.stderr.strip()}"
            except Exception as e:
                return f"Code execution failed: {str(e)}"

    def query_brain(self, query):
        """Consults Ollama AI or fallback keyword parsing to execute actions"""
        normalized_query = query.lower().strip()
        user_name = self.memory.get("user_name", "Boss")

        # Dynamic Memory updates from speech
        if "my name is " in normalized_query:
            new_name = query.split("name is")[-1].strip().replace(".", "")
            self.memory["user_name"] = new_name
            self.save_memory_data(self.memory)
            return f"Understood. I will call you {new_name} from now on."

        if "remember that" in normalized_query:
            fact_part = query.lower().split("remember that")[-1].strip()
            if "is" in fact_part:
                k, v = fact_part.split("is", 1)
                self.remember_fact(k.strip(), v.strip())
                return f"Understood. I have recorded that {k.strip()} is {v.strip()}."

        if "what do you know about" in normalized_query or "do you remember" in normalized_query:
            lookup = normalized_query.replace("what do you know about", "").replace("do you remember", "").replace("?", "").strip()
            fact = self.retrieve_fact(lookup)
            if fact:
                return f"According to my memory logs, {lookup} is {fact}."
            else:
                return f"I have no records regarding {lookup} in my database."

        # Web search matches
        if "search" in normalized_query or "browse" in normalized_query:
            return self.search_web(query)

        # Code execution matches
        if "calculate" in normalized_query or "run python" in normalized_query or "run code" in normalized_query:
            return self.run_python_code(query)

        # Direct application launches: e.g., "open spotify" or "open steam"
        if normalized_query.startswith("open ") or normalized_query.startswith("launch "):
            app_to_open = normalized_query.replace("open ", "").replace("launch ", "").strip()
            # If asking for a folder (e.g. "open downloads folder" or "open documents folder")
            if "folder" in app_to_open or "drive" in app_to_open:
                clean_folder = app_to_open.replace("folder", "").strip()
                return self.open_folder(clean_folder)
            return self.execute_app(app_to_open)

        # OS Commands overrides (fast path)
        for key, action_func in self.fallback_commands.items():
            if normalized_query.startswith(key) or key in normalized_query:
                reply = action_func()
                if isinstance(reply, str):
                    return reply
                return "System action completed, Boss."

        # 2. Try local Ollama AI
        try:
            history_context = []
            for h in self.memory.get("conversation_history", [])[-4:]:
                history_context.append({"role": "user", "content": h["user"]})
                history_context.append({"role": "assistant", "content": h["assistant"]})

            system_prompt = (
                f"You are JARVIS, Tony Stark's advanced personal AI assistant. The user's name is {user_name}. "
                "Respond in JSON format matching this schema exactly:\n"
                "{\n"
                "  \"reply\": \"Conversational text response to speak out loud\",\n"
                "  \"tool\": \"open_app\" | \"open_folder\" | \"system_volume\" | \"lock_pc\" | \"take_screenshot\" | \"search_web\" | \"run_python\" | null,\n"
                "  \"params\": {\"app\": \"notepad\"|\"calc\"|\"chrome\"|\"vscode\"|\"whatsapp\" (or any other custom app name), \"folder\": \"downloads\"|\"documents\"|\"desktop\"|\"pictures\"|\"explorer\" (or any other custom folder name), \"action\": \"up\"|\"down\"|\"mute\", \"cmd\": \"python code/math expression\", \"query\": \"search query\"} (or empty)\n"
                "}\n"
                "If the user asks to launch an app, open a folder, lock the PC, take a screenshot, search google/youtube, calculate math, or adjust volume, specify the tool and parameters. "
                "Keep spoken replies short, professional, and slightly witty."
            )
            
            payload = {
                "model": self.model_name,
                "messages": [
                    {"role": "system", "content": system_prompt}
                ] + history_context + [
                    {"role": "user", "content": query}
                ],
                "stream": False,
                "format": "json"
            }
            
            response = requests.post(self.ollama_url, json=payload, timeout=15.0)
            if response.status_code == 200:
                result = response.json()
                content = json.loads(result["message"]["content"])
                
                tool = content.get("tool")
                reply = content.get("reply", "Command understood.")
                params = content.get("params", {})
                
                if tool:
                    print(f"[BRAIN] Tool match: {tool} with params {params}")
                    if tool == "open_app":
                        exec_reply = self.execute_app(params.get("app"))
                        return f"{reply} {exec_reply}"
                    elif tool == "open_folder":
                        exec_reply = self.open_folder(params.get("folder"))
                        return f"{reply} {exec_reply}"
                    elif tool == "system_volume":
                        exec_reply = self.adjust_volume(params.get("action"))
                        return f"{reply} {exec_reply}"
                    elif tool == "lock_pc":
                        exec_reply = self.lock_pc()
                        return f"{reply} {exec_reply}"
                    elif tool == "take_screenshot":
                        exec_reply = self.take_screenshot()
                        return f"{reply} {exec_reply}"
                    elif tool == "search_web":
                        exec_reply = self.search_web(params.get("query", query))
                        return f"{reply} {exec_reply}"
                    elif tool == "run_python":
                        exec_reply = self.run_python_code(params.get("cmd"))
                        return f"{reply} {exec_reply}"
                
                self.record_history(query, reply)
                return reply
                
        except Exception:
            pass
            
        responses = [
            f"At your service, {user_name}. The local Ollama brain core is currently offline, but my OS automation modules are active.",
            f"Diagnostics indicate the local LLM server is unresponsive, {user_name}. Please tell me to 'open Notepad', 'lock screen', or 'search Google' for direct shell execution."
        ]
        import random
        return random.choice(responses)

    def record_history(self, user_text, jarvis_text):
        """Logs conversation turns in memory.json"""
        self.memory["conversation_history"].append({
            "user": user_text,
            "assistant": jarvis_text,
            "timestamp": int(time.time())
        })
        self.memory["conversation_history"] = self.memory["conversation_history"][-20:]
        self.save_memory_data(self.memory)

    def run_loop(self):
        """Continuous background loop for speech recognition and automation triggers"""
        time.sleep(0.5)
        user_name = self.memory.get("user_name", "Boss")
        
        # Calibration phase (once at boot)
        print("\n[SYSTEM] Calibrating microphone for ambient room noise...")
        self.speak("Calibrating microphone sensors, Boss. Please stand by.")
        try:
            with sr.Microphone(device_index=self.device_index) as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=1.5)
            if self.recognizer.energy_threshold > 800:
                self.recognizer.energy_threshold = 800
            print(f"[SYSTEM] Calibration complete. Energy threshold set to: {int(self.recognizer.energy_threshold)}")
        except Exception as e:
            print(f"[ERROR] Calibration failed: {e}. Using default threshold.")
            self.recognizer.energy_threshold = 300
            
        self.speak(f"Ji {user_name}, systems online. Ready for command.")
        
        is_awake = False
        print("\n[STATUS] J.A.R.V.I.S. is currently in STANDBY mode.")
        print("[STANDBY] Say 'Hey Jarvis' or 'Jarvis' to activate.")

        while True:
            if not is_awake:
                self.gui_state = "standby"
            else:
                self.gui_state = "listening"

            query = self.listen()
            
            if not query:
                time.sleep(0.1)
                continue
                
            query_lower = query.lower()

            # Exit conditions
            if any(term in query_lower for term in ["shut down jarvis", "terminate cores", "goodbye jarvis", "go offline", "go ofline"]):
                self.gui_state = "offline"
                self.speak(f"Very well, {user_name}. Powering down systems. Offline.")
                os._exit(0)

            if not is_awake:
                wake_words = [
                    "hey jarvis", "jarvis", "jarvise", "hey jarvise",
                    "hello jarvis", "hi jarvis", "wake up jarvis",
                    "wake up", "jarvis wake up", "hey j", "yo jarvis",
                    "ok jarvis", "okay jarvis", "come online", "go online"
                ]
                if any(wake in query_lower for wake in wake_words):
                    is_awake = True
                    import random
                    wake_responses = [
                        f"At your service, {user_name}.",
                        "Yes Boss, systems online. What is your command?",
                        "Active and listening, Boss.",
                        "Cores fully engaged. What can I do for you?"
                    ]
                    self.speak(random.choice(wake_responses))
                    time.sleep(0.4)
                else:
                    print(f"\n[STANDBY IGNORED] Captured: \"{query}\" (did not contain wake word)")
                continue

            # If awake, process command
            if is_awake:
                if any(sleep_word in query_lower for sleep_word in ["go to sleep", "go to standby", "standby", "stop listening"]):
                    self.speak("Understood, Boss. Standing by.")
                    is_awake = False
                    print("\n[STATUS] J.A.R.V.I.S. is back in STANDBY mode.")
                    continue

                reply = self.query_brain(query)
                self.speak(reply)
                
                is_awake = False
                print("\n[STATUS] J.A.R.V.I.S. has returned to STANDBY mode.")
                time.sleep(0.8)


# =====================================================================
# T K I N T E R   F L O A T I N G   H U D   P O P U P   C A R D
# =====================================================================

class JarvisHUD:
    def __init__(self, assistant):
        self.assistant = assistant
        self.root = tk.Tk()
        self.root.title("J.A.R.V.I.S. HUD")
        
        # Borderless window and always topmost
        self.root.overrideredirect(True)
        self.root.wm_attributes("-topmost", True)
        
        # Sizing (180x45 px)
        width, height = 180, 45
        
        # Position top-center of primary screen
        screen_width = self.root.winfo_screenwidth()
        x = (screen_width // 2) - (width // 2)
        y = 5  # 5 pixels from top edge
        self.root.geometry(f"{width}x{height}+{x}+{y}")
        
        # Sleek dark futuristic frame: Slate dark background with cyan border
        self.root.config(bg="#00d2ff") # outer border color
        
        # Inner content frame
        self.frame = tk.Frame(self.root, bg="#0f172a", width=width-2, height=height-2)
        self.frame.pack_propagate(False)
        self.frame.pack(padx=1, pady=1)
        
        # Status glowing circle Canvas (left side)
        self.canvas = tk.Canvas(self.frame, width=24, height=24, bg="#0f172a", highlightthickness=0)
        self.canvas.pack(side=tk.LEFT, padx=12)
        self.dot = self.canvas.create_oval(2, 2, 22, 22, fill="#00d2ff", outline="")
        
        # Status text label (right side)
        self.label = tk.Label(self.frame, text="STANDBY", fg="#00d2ff", bg="#0f172a", font=("Courier New", 11, "bold"))
        self.label.pack(side=tk.LEFT, padx=5)
        
        # Draggable bindings
        self.frame.bind("<Button-1>", self.start_drag)
        self.frame.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<Button-1>", self.start_drag)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.label.bind("<Button-1>", self.start_drag)
        self.label.bind("<B1-Motion>", self.on_drag)
        
        # Start state polling loop
        self.update_gui()
        
    def start_drag(self, event):
        self.x = event.x
        self.y = event.y
        
    def on_drag(self, event):
        deltax = event.x - self.x
        deltay = event.y - self.y
        x = self.root.winfo_x() + deltax
        y = self.root.winfo_y() + deltay
        self.root.geometry(f"+{x}+{y}")
        
    def update_gui(self):
        state = self.assistant.gui_state
        
        if state == "standby":
            self.canvas.itemconfig(self.dot, fill="#00d2ff") # Blue
            self.label.config(text="STANDBY", fg="#00d2ff")
        elif state == "listening":
            self.canvas.itemconfig(self.dot, fill="#39ff14") # Green
            self.label.config(text="LISTENING...", fg="#39ff14")
        elif state == "speaking":
            self.canvas.itemconfig(self.dot, fill="#ffb703") # Orange/Yellow
            self.label.config(text="THINKING...", fg="#ffb703")
        elif state == "offline":
            self.canvas.itemconfig(self.dot, fill="#ff003c") # Red
            self.label.config(text="OFFLINE", fg="#ff003c")
            self.root.after(1200, self.root.destroy)
            return
            
        # Poll state every 150ms
        self.root.after(150, self.update_gui)


if __name__ == "__main__":
    assistant = JarvisAssistant()
    
    # Run the voice listener in a daemon background thread
    listener_thread = threading.Thread(target=assistant.run_loop, daemon=True)
    listener_thread.start()
    
    # Run the Tkinter HUD Popup Card in the main thread
    hud = JarvisHUD(assistant)
    hud.root.mainloop()

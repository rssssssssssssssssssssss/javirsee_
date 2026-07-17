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

# =====================================================================
# J.A.R.V.I.S. NATIVE SYSTEM ASSISTANT (ADVANCED VERSION)
# =====================================================================
# This script runs locally on your Windows laptop.
# Integrated capabilities:
# - Offline SAPI5 Speech Synthesis (pyttsx3)
# - Online Speech Recognition (speech_recognition using Google Web STT)
# - JSON Memory Core (remembers user facts and logs session history)
# - App Automation (Notepad, Chrome, VS Code, Calculator, Explorer)
# - System Automation (Volume, Secure Locking, Screenshots)
# - Web Browsing (Direct Google/YouTube search navigation)
# - Safe Code Execution Core (evaluates simple math and scripts)
# - LLM Brain Integration (Ollama local proxy + Fallback rulebase)
# =====================================================================

class JarvisAssistant:
    def __init__(self):
        print("[SYSTEM] Initializing J.A.R.V.I.S. advanced cores...")
        
        # 1. Initialize Memory File
        self.memory_path = "memory.json"
        self.memory = self.load_memory()
        
        # 2. Initialize Text-to-Speech Engine
        self.tts_engine = pyttsx3.init()
        self.setup_tts_voice()
        
        # 3. Initialize Speech Recognition Engine
        self.recognizer = sr.Recognizer()
        self.recognizer.dynamic_energy_threshold = True
        
        # 4. Connection and AI Configurations
        self.ollama_url = "http://localhost:11434/api/chat"
        self.model_name = "llama3" # default local model
        
        # Define local command overrides (for offline matching / safety)
        self.fallback_commands = {
            "open notepad": lambda: self.execute_app("notepad"),
            "launch notepad": lambda: self.execute_app("notepad"),
            "open calculator": lambda: self.execute_app("calc"),
            "open calc": lambda: self.execute_app("calc"),
            "open chrome": lambda: self.execute_app("chrome"),
            "open browser": lambda: self.execute_app("chrome"),
            "open vscode": lambda: self.execute_app("vscode"),
            "open vs code": lambda: self.execute_app("vscode"),
            "open explorer": lambda: self.execute_app("explorer"),
            "open files": lambda: self.execute_app("explorer"),
            "open whatsapp": lambda: self.execute_app("whatsapp"),
            "open what app": lambda: self.execute_app("whatsapp"),
            "open whatapp": lambda: self.execute_app("whatsapp"),
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

    def load_memory(self):
        """Loads user facts and conversation logs from memory.json"""
        if os.path.exists(self.memory_path):
            try:
                with open(self.memory_path, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        
        # Default memory structure
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
        print(f"[MEMORY] Recorded: {key} -> {value}")

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
        """Offline Text-to-Speech synthesis"""
        print(f"[JARVIS] {text}")
        self.tts_engine.say(text)
        self.tts_engine.runAndWait()

    def listen(self):
        """Microphone audio capture and transcription via Google Web STT"""
        with sr.Microphone() as source:
            print("\n[LISTENING] Adjusting for ambient noise...")
            self.recognizer.adjust_for_ambient_noise(source, duration=0.8)
            print("[LISTENING] Speak now, Boss...")
            
            try:
                audio = self.recognizer.listen(source, timeout=6, phrase_time_limit=8)
                print("[STT] Transcribing voice...")
                query = self.recognizer.recognize_google(audio)
                print(f"[USER] You said: \"{query}\"")
                return query.strip()
                
            except sr.WaitTimeoutError:
                return None
            except sr.UnknownValueError:
                return None
            except sr.RequestError as e:
                print(f"[ERROR] STT Request failure: {e}")
                self.speak("My communication links are impaired, Boss. I cannot reach the voice servers.")
                return None
            except Exception as e:
                print(f"[ERROR] Microphone capture failed: {e}")
                return None

    def execute_app(self, app_name):
        """Launches Windows desktop applications natively"""
        try:
            if app_name == "notepad":
                subprocess.Popen(["notepad.exe"])
                return "Initializing Notepad workspace."
            elif app_name == "calc":
                subprocess.Popen(["calc.exe"])
                return "Opening Calculator interface."
            elif app_name == "chrome":
                subprocess.Popen(["cmd.exe", "/c", "start chrome"])
                return "Launching Google Chrome, Boss."
            elif app_name == "vscode":
                subprocess.Popen(["cmd.exe", "/c", "code"], shell=True)
                return "Opening VS Code workspace."
            elif app_name == "explorer":
                subprocess.Popen(["explorer.exe"])
                return "Accessing local file system."
            elif app_name == "whatsapp":
                try:
                    subprocess.Popen(["cmd.exe", "/c", "start whatsapp://"], shell=True)
                    return "Launching WhatsApp, Boss."
                except Exception:
                    webbrowser.open("https://web.whatsapp.com/")
                    return "Opening WhatsApp Web in your browser."
            else:
                return f"Application '{app_name}' is not registered."
        except Exception as e:
            return f"Failed to open {app_name}. Error: {str(e)}"

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
            # Clean expression
            cleaned = code_str.replace("run code", "").replace("calculate", "").replace("python", "").strip()
            # Simple eval sandbox for basic math
            result = eval(cleaned, {"__builtins__": None}, {})
            return f"Computation result is: {result}"
        except Exception:
            try:
                # If complex, run in a separate subprocess safely (without printing private vars)
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

        # OS Commands overrides (fast path)
        for key, action_func in self.fallback_commands.items():
            if normalized_query.startswith(key) or key in normalized_query:
                reply = action_func()
                if isinstance(reply, str):
                    return reply
                return "System action completed, Boss."

        # 2. Try local Ollama AI
        try:
            # Build conversation history context
            history_context = []
            for h in self.memory.get("conversation_history", [])[-4:]: # last 4 turns
                history_context.append({"role": "user", "content": h["user"]})
                history_context.append({"role": "assistant", "content": h["assistant"]})

            system_prompt = (
                f"You are JARVIS, Tony Stark's advanced personal AI assistant. The user's name is {user_name}. "
                "Respond in JSON format matching this schema exactly:\n"
                "{\n"
                "  \"reply\": \"Conversational text response to speak out loud\",\n"
                "  \"tool\": \"open_app\" | \"system_volume\" | \"lock_pc\" | \"take_screenshot\" | \"search_web\" | \"run_python\" | null,\n"
                "  \"params\": {\"app\": \"notepad\"|\"calc\"|\"chrome\"|\"vscode\"|\"explorer\"|\"whatsapp\", \"action\": \"up\"|\"down\"|\"mute\", \"cmd\": \"python code/math expression\", \"query\": \"search query\"} (or empty)\n"
                "}\n"
                "If the user asks to launch an app, lock the PC, take a screenshot, search google/youtube, calculate math, or adjust volume, specify the tool and parameters. "
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
                
                # Execute tool if returned
                if tool:
                    print(f"[BRAIN] Tool match: {tool} with params {params}")
                    if tool == "open_app":
                        exec_reply = self.execute_app(params.get("app"))
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
                
                # Update history
                self.record_history(query, reply)
                return reply
                
        except Exception:
            pass
            
        # 3. Default offline rulebase matching
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
        # Cap logs to last 20 messages to keep file small
        self.memory["conversation_history"] = self.memory["conversation_history"][-20:]
        self.save_memory_data(self.memory)

    def run(self):
        """Boot up and start main voice-controlled loop with Standby/Wake support"""
        time.sleep(0.5)
        user_name = self.memory.get("user_name", "Boss")
        self.speak(f"Ji {user_name}, systems online. Ready for command.")
        
        # Starts in standby mode waiting for wake word
        is_awake = False
        print("\n[STATUS] J.A.R.V.I.S. is currently in STANDBY mode.")
        print("[STANDBY] Say 'Hey Jarvis' or 'Jarvis' to activate.")

        while True:
            query = self.listen()
            
            if not query:
                time.sleep(0.5)
                continue
                
            query_lower = query.lower()

            # Exit conditions (always active even if asleep)
            if any(term in query_lower for term in ["shut down jarvis", "terminate cores", "goodbye jarvis"]):
                self.speak(f"Very well, {user_name}. Powering down systems. Offline.")
                break

            if not is_awake:
                # Check for wake words
                wake_words = ["hey jarvis", "jarvis", "jarvise", "hey jarvise", "hello jarvis", "hi jarvis", "wake up jarvis"]
                if any(wake in query_lower for wake in wake_words):
                    is_awake = True
                    # Witty wake response
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
                    # Ignore background talk when in standby
                    print(f"[STANDBY IGNORED] Captured: \"{query}\" (did not contain wake word)")
                continue

            # If awake, process command
            if is_awake:
                # Check if user wants to return to standby manually
                if any(sleep_word in query_lower for sleep_word in ["go to sleep", "go to standby", "standby", "stop listening"]):
                    self.speak("Understood, Boss. Standing by.")
                    is_awake = False
                    print("\n[STATUS] J.A.R.V.I.S. is back in STANDBY mode.")
                    continue

                # Run query through brain / system controller
                reply = self.query_brain(query)
                self.speak(reply)
                
                # Automatically return to standby mode after executing command
                is_awake = False
                print("\n[STATUS] J.A.R.V.I.S. has returned to STANDBY mode.")
                time.sleep(0.8)

if __name__ == "__main__":
    try:
        assistant = JarvisAssistant()
        assistant.run()
    except KeyboardInterrupt:
        print("\n[SYSTEM] J.A.R.V.I.S. terminated manually. Exiting.")
        sys.exit(0)

"""
Targeted WindowsApps shortcut injector - runs instantly.
Creates .lnk shortcuts for every UWP app in WindowsApps folder
and merges them into app_catalog.json immediately.
"""
import os, subprocess, json

USER = os.path.expanduser("~")
WINDOWS_APPS = os.path.join(USER, "AppData", "Local", "Microsoft", "WindowsApps")
OUTPUT_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jarvis_apps")
CATALOG_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_catalog.json")

# System internals to skip
SKIP_INTERNALS = [
    "mcp", "_ac", "autostarter", "native", "session",
    "host", "broker", "package", "config", "winget",
    "wsl", "bash", "python", "pad.", "shellmcp",
    "actionsmcp", "windowspackage"
]

# Human-friendly aliases for UWP exe names
ALIASES = {
    "spotify": ["spotify", "music"],
    "ms-teams": ["teams", "microsoft teams"],
    "mediaplayer": ["media player", "movies", "video player"],
    "mspaint": ["paint", "ms paint"],
    "snippingtool": ["snip", "snipping tool", "screenshot tool"],
    "notepad": ["notepad", "text editor"],
    "wt": ["terminal", "windows terminal", "cmd terminal"],
    "lenovoutility": ["lenovo utility", "lenovo"],
    "microsoftstore": ["store", "microsoft store", "app store"],
    "gethelp": ["get help", "help"],
    "xboxpccapp": ["xbox", "game bar"],
    "olk": ["outlook", "email", "mail"],
    "visualassist": ["visual assist"],
    "mspaint": ["paint"],
    "pbrush": ["paint brush", "paintbrush"],
}

def make_lnk(target, out_path):
    wd = os.path.dirname(target)
    cmd = (
        f"$s=(New-Object -COM WScript.Shell).CreateShortcut('{out_path}');"
        f"$s.TargetPath='{target}';"
        f"$s.WorkingDirectory='{wd}';"
        f"$s.Save()"
    )
    subprocess.run(["powershell", "-WindowStyle", "Hidden", "-Command", cmd],
                   capture_output=True, timeout=8)

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load existing catalog or start fresh
catalog = {}
if os.path.exists(CATALOG_JSON):
    try:
        with open(CATALOG_JSON) as f:
            catalog = json.load(f)
        print(f"[INJECT] Loaded existing catalog with {len(catalog)} entries.")
    except Exception:
        pass

added = 0
print(f"\n[INJECT] Scanning WindowsApps: {WINDOWS_APPS}")

try:
    for fname in os.listdir(WINDOWS_APPS):
        if not fname.lower().endswith(".exe"):
            continue

        raw = fname[:-4].lower().strip()

        # Skip system internals
        if any(s in raw for s in SKIP_INTERNALS):
            continue

        full_path = os.path.join(WINDOWS_APPS, fname)
        lnk_path  = os.path.join(OUTPUT_DIR, f"{raw}.lnk")

        # Create shortcut
        make_lnk(full_path, lnk_path)

        # Build all aliases for this app
        entry = {"exe": full_path, "shortcut": lnk_path}
        names_to_register = [raw]

        # Check if we have custom aliases
        for key, alias_list in ALIASES.items():
            if key in raw or raw in key:
                names_to_register.extend(alias_list)

        # ms-teams → also register as "teams"
        if raw.startswith("ms-"):
            names_to_register.append(raw[3:])
        # obs64 → obs
        if raw.endswith("64") or raw.endswith("32"):
            names_to_register.append(raw[:-2])

        for name in set(names_to_register):
            catalog[name] = entry

        added += 1
        print(f"  [+] {raw:35s}  registered as: {names_to_register}")

except PermissionError as e:
    print(f"[ERROR] Permission denied: {e}")

# Save updated catalog
with open(CATALOG_JSON, "w") as f:
    json.dump(catalog, f, indent=4)

print(f"\n[INJECT] Done! Added {added} WindowsApps entries.")
print(f"[INJECT] Catalog now has {len(catalog)} total entries.")
print(f"[INJECT] Saved to: {CATALOG_JSON}")

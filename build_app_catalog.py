"""
J.A.R.V.I.S. Full System App Catalog Builder
==============================================
Scans common install directories across the entire laptop for executable (.exe) files,
filters out system/junk processes, and creates Windows .lnk shortcut files for every
real application found inside the local 'jarvis_apps/' folder.

J.A.R.V.I.S. then reads this folder to launch any app by voice.

Run this script once manually, or it runs automatically when you launch J.A.R.V.I.S.
"""

import os
import subprocess
import json
import time

# ─────────────────────────────────────────────────────────────
# CONFIG: Where to scan for apps
# ─────────────────────────────────────────────────────────────
USER = os.path.expanduser("~")
APPDATA_ROAMING = os.path.join(USER, "AppData", "Roaming")
APPDATA_LOCAL   = os.path.join(USER, "AppData", "Local")
WINDOWS_APPS    = os.path.join(USER, "AppData", "Local", "Microsoft", "WindowsApps")

SCAN_DIRS = [
    r"C:\Program Files",
    r"C:\Program Files (x86)",
    APPDATA_ROAMING,
    APPDATA_LOCAL,
    r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
    os.path.join(APPDATA_ROAMING, "Microsoft", "Windows", "Start Menu", "Programs"),
    WINDOWS_APPS,   # <-- UWP Store apps (Spotify, Teams, Paint, Terminal, etc.)
]

# Output folder where .lnk shortcuts will be created
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jarvis_apps")
CATALOG_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_catalog.json")

# ─────────────────────────────────────────────────────────────
# FILTER: Skip these noise executables (system/runtime/DLL helpers)
# ─────────────────────────────────────────────────────────────
SKIP_SUBSTRINGS = [
    "uninstall", "update", "setup", "installer", "helper",
    "crash", "report", "crash_handler", "cef", "elevate",
    "register", "repair", "redistributable", "vc_redist",
    "dotnetfx", "ndp", "netfx", "windows", "microsoft.net",
    "splwow", "runtimebroker", "dllhost", "svchost",
    "temp", "tmp", "~", "msedge_", "chrome_",
    "WerFault", "werfault", "watson", "dwm",
    "regasm", "msiexec", "rundll", "regsvr", "taskhostw",
]

# Known "real" apps that are single exes to always include even if small
ALWAYS_INCLUDE = [
    "spotify.exe", "discord.exe", "whatsapp.exe", "telegram.exe",
    "steam.exe", "zoom.exe", "slack.exe", "figma.exe",
    "notepad.exe", "calc.exe", "mspaint.exe", "snippingtool.exe",
    "winamp.exe", "vlc.exe", "mpv.exe", "potplayer.exe",
    "obs64.exe", "obs32.exe", "code.exe", "cursor.exe",
    "postman.exe", "insomnia.exe", "gimp-2.exe",
    "Teams.exe", "OneDrive.exe", "onenote.exe",
]


def should_skip(exe_name, exe_path, is_windowsapps=False):
    """Returns True if this executable should be excluded from catalog."""
    exe_lower = exe_name.lower()
    path_lower = exe_path.lower()

    # Always include known apps regardless of rules
    if exe_lower in [a.lower() for a in ALWAYS_INCLUDE]:
        return False

    # WindowsApps stubs are 0 bytes but are real launchers — never skip them by size
    if is_windowsapps:
        # Only skip obvious system internals
        system_skip = ["mcp", "_ac", "autostarter", "update", "native", "session", "server", "host", "broker", "manager", "package", "config"]
        if any(s in exe_lower for s in system_skip):
            return True
        return False  # Keep all other WindowsApps stubs

    for skip in SKIP_SUBSTRINGS:
        if skip.lower() in exe_lower or skip.lower() in path_lower:
            return True

    # Skip tiny files (likely helpers, not main apps < 200KB)
    try:
        if os.path.getsize(exe_path) < 200 * 1024:
            return True
    except Exception:
        return True

    return False


def make_lnk(target_path, shortcut_path, working_dir=None):
    """Creates a Windows .lnk shortcut using PowerShell WScript.Shell"""
    if not working_dir:
        working_dir = os.path.dirname(target_path)
    ps_cmd = (
        f"$s=(New-Object -COM WScript.Shell).CreateShortcut('{shortcut_path}');"
        f"$s.TargetPath='{target_path}';"
        f"$s.WorkingDirectory='{working_dir}';"
        f"$s.Save()"
    )
    subprocess.run(
        ["powershell", "-WindowStyle", "Hidden", "-Command", ps_cmd],
        capture_output=True, timeout=8
    )


def build_catalog():
    """Main catalog builder: scans dirs, creates .lnk shortcuts, writes app_catalog.json"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    catalog = {}    # { "friendly_name": { "path": "...", "shortcut": "..." } }
    seen_paths = set()
    total_found = 0

    print(f"\n[CATALOG] Scanning {len(SCAN_DIRS)} directories for installed apps...")
    print(f"[CATALOG] Shortcuts will be written to: {OUTPUT_DIR}\n")

    for base_dir in SCAN_DIRS:
        if not os.path.exists(base_dir):
            print(f"[SKIP] Directory not found: {base_dir}")
            continue

        is_windowsapps = (base_dir == WINDOWS_APPS)
        print(f"[SCAN] {base_dir}")

        # WindowsApps is flat — no subdirectory walk needed
        if is_windowsapps:
            try:
                files_in_dir = [(base_dir, [], os.listdir(base_dir))]
            except PermissionError:
                print(f"  [!] Permission denied: {base_dir}")
                continue
        else:
            files_in_dir = os.walk(base_dir)

        for root, dirs, files in files_in_dir:
            if not is_windowsapps:
                dirs[:] = [
                    d for d in dirs
                    if not any(s in d.lower() for s in ["temp", "tmp", "cache", "logs", "crash"])
                ]

            for file in files:
                if file.lower().endswith(".exe"):
                    full_path = os.path.join(root, file)

                    if full_path in seen_paths:
                        continue
                    if should_skip(file, full_path, is_windowsapps=is_windowsapps):
                        continue

                    seen_paths.add(full_path)
                    
                    # Friendly name: exe filename without extension, lowercased
                    raw_name = file[:-4].lower().strip()
                    # Also store common aliases (e.g. "ms-teams" → also "teams")
                    aliases = [raw_name]
                    if raw_name.startswith("ms-"):
                        aliases.append(raw_name[3:])  # "ms-teams" → "teams"
                    if raw_name.endswith("64") or raw_name.endswith("32"):
                        aliases.append(raw_name[:-2])  # "obs64" → "obs"

                    shortcut_filename = f"{raw_name}.lnk"
                    shortcut_path = os.path.join(OUTPUT_DIR, shortcut_filename)

                    # Create the .lnk shortcut
                    try:
                        make_lnk(full_path, shortcut_path)
                        for alias in aliases:
                            catalog[alias] = {
                                "exe": full_path,
                                "shortcut": shortcut_path
                            }
                        total_found += 1
                        print(f"  [+] {raw_name:35s}  →  {full_path}")
                    except Exception as e:
                        print(f"  [!] Failed to create shortcut for {file}: {e}")

                elif file.lower().endswith(".lnk"):
                    full_path = os.path.join(root, file)
                    friendly_name = file[:-4].lower().strip()
                    if friendly_name not in catalog:
                        catalog[friendly_name] = {
                            "exe": None,
                            "shortcut": full_path
                        }

    # Save catalog to JSON
    with open(CATALOG_JSON, "w") as f:
        json.dump(catalog, f, indent=4)

    print(f"\n[CATALOG] ✓ Complete! Found and cataloged {total_found} applications.")
    print(f"[CATALOG] Catalog saved to: {CATALOG_JSON}")
    print(f"[CATALOG] Shortcuts saved to: {OUTPUT_DIR}\n")
    return catalog


if __name__ == "__main__":
    start = time.time()
    build_catalog()
    print(f"[CATALOG] Build time: {time.time() - start:.1f}s")

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import os from 'os';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

// Helper to measure CPU load
function getCPUUsage() {
  return new Promise((resolve) => {
    const startMeasure = cpuAverage();
    setTimeout(() => {
      const endMeasure = cpuAverage();
      const idleDifference = endMeasure.idle - startMeasure.idle;
      const totalDifference = endMeasure.total - startMeasure.total;
      const percentageCPU = 100 - Math.round((100 * idleDifference) / totalDifference);
      resolve(percentageCPU);
    }, 100);
  });
}

function cpuAverage() {
  let totalIdle = 0;
  let totalTick = 0;
  const cpus = os.cpus();
  for (let i = 0, len = cpus.length; i < len; i++) {
    const cpu = cpus[i];
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

// IPC Handlers
ipcMain.handle('get-telemetry', async () => {
  try {
    const cpuLoad = await getCPUUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsage = Math.round((usedMem / totalMem) * 100);

    // Fetch disk info (Windows specific wmic command)
    return new Promise((resolve) => {
      exec('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /value', (err, stdout) => {
        let diskFreePercent = 0;
        let diskDetails = "C: Drive Info Unavailable";

        if (!err && stdout) {
          const lines = stdout.split('\r\n');
          let freeSpace = 0;
          let size = 0;
          lines.forEach(line => {
            if (line.startsWith('FreeSpace=')) {
              freeSpace = parseInt(line.split('=')[1], 10);
            }
            if (line.startsWith('Size=')) {
              size = parseInt(line.split('=')[1], 10);
            }
          });
          if (size > 0) {
            diskFreePercent = Math.round((freeSpace / size) * 100);
            const usedSpaceGB = Math.round((size - freeSpace) / (1024 * 1024 * 1024));
            const totalSpaceGB = Math.round(size / (1024 * 1024 * 1024));
            diskDetails = `${usedSpaceGB}GB / ${totalSpaceGB}GB used (${100 - diskFreePercent}%)`;
          }
        }

        resolve({
          cpu: cpuLoad,
          ram: ramUsage,
          ramRaw: `${Math.round(usedMem / (1024 * 1024 * 1024) * 10) / 10}GB / ${Math.round(totalMem / (1024 * 1024 * 1024))}GB`,
          disk: 100 - diskFreePercent,
          diskRaw: diskDetails,
          uptime: Math.round(os.uptime()),
          platform: os.platform(),
          arch: os.arch(),
          cpuModel: os.cpus()[0].model
        });
      });
    });
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('execute-action', async (event, { command, params }) => {
  console.log(`[IPC EXECUTE] Executing action: ${command}`, params || '');
  let shellCommand = '';
  let responseText = 'Executing instruction, sir.';

  switch (command) {
    case 'open_app':
      const appName = params?.app?.toLowerCase();
      if (appName === 'notepad') {
        shellCommand = 'start notepad';
        responseText = 'Opening Notepad, Boss.';
      } else if (appName === 'calc' || appName === 'calculator') {
        shellCommand = 'start calc';
        responseText = 'Opening Calculator interface.';
      } else if (appName === 'chrome') {
        shellCommand = 'start chrome';
        responseText = 'Launching Google Chrome browser.';
      } else if (appName === 'vscode' || appName === 'vs code') {
        shellCommand = 'code';
        responseText = 'Starting VS Code workspace.';
      } else if (appName === 'explorer' || appName === 'files') {
        shellCommand = 'explorer';
        responseText = 'Accessing File Explorer directory.';
      } else {
        return { success: false, error: `App ${appName} not mapped.` };
      }
      break;

    case 'close_app':
      const targetApp = params?.app?.toLowerCase();
      if (!targetApp) return { success: false, error: 'No application specified.' };
      let procName = targetApp;
      if (targetApp === 'calculator') procName = 'CalculatorApp';
      else if (targetApp === 'calc') procName = 'Calculator';
      
      shellCommand = `taskkill /f /im ${procName}.exe`;
      responseText = `Terminating ${targetApp} process, Boss.`;
      break;

    case 'system_volume':
      const action = params?.action?.toLowerCase();
      if (action === 'up') {
        shellCommand = `powershell -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]175)"`;
        responseText = 'Increasing system volume.';
      } else if (action === 'down') {
        shellCommand = `powershell -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]174)"`;
        responseText = 'Decreasing system volume.';
      } else if (action === 'mute') {
        shellCommand = `powershell -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]173)"`;
        responseText = 'Toggling system mute status.';
      } else {
        return { success: false, error: 'Invalid volume action.' };
      }
      break;

    case 'lock_pc':
      shellCommand = 'rundll32.exe user32.dll,LockWorkStation';
      responseText = 'Securing console. Laptop is locked.';
      break;

    case 'run_command':
      const rawCmd = params?.cmd;
      if (!rawCmd) return { success: false, error: 'Empty command parameter.' };
      const lowerCmd = rawCmd.toLowerCase();
      if (lowerCmd.includes('rmdir /s') || lowerCmd.includes('del /s') || lowerCmd.includes('format')) {
        return { success: false, error: 'Destructive command blocked by JARVIS security core.' };
      }
      shellCommand = rawCmd;
      responseText = `Executing system command: "${rawCmd}".`;
      break;

    default:
      return { success: false, error: `Action '${command}' not recognized.` };
  }

  return new Promise((resolve) => {
    exec(shellCommand, (err, stdout, stderr) => {
      if (err) {
        resolve({
          success: false,
          error: err.message,
          reply: `Execution failed, Boss. Error: ${err.message}`
        });
      } else {
        resolve({
          success: true,
          reply: responseText,
          stdout: stdout,
          stderr: stderr
        });
      }
    });
  });
});

ipcMain.handle('chat-brain', async (event, { message }) => {
  const commandText = message?.trim()?.toLowerCase() || '';

  // Local Matcher Fallback Logic
  const localResponse = matchLocalCommand(commandText);
  if (localResponse) return localResponse;

  // Attempt Ollama API query (similar to server.js)
  return new Promise((resolve) => {
    const ollamaData = JSON.stringify({
      model: "llama3",
      messages: [
        {
          role: "system",
          content: `You are JARVIS, Tony Stark's advanced personal AI assistant. You control this Windows laptop.
          Respond in JSON format only.
          If command matches a system action, specify it:
          - "open_app" (params: { "app": "notepad" | "calc" | "chrome" | "vscode" | "explorer" })
          - "close_app" (params: { "app": "notepad" | "calc" | "chrome" })
          - "system_volume" (params: { "action": "up" | "down" | "mute" })
          - "lock_pc" (params: {})
          - "system_stats" (params: {})
          - "run_command" (params: { "cmd": "raw command" })
          
          Else leave tool as null. Do not use code fences.`
        },
        { role: "user", content: message }
      ],
      stream: false,
      format: "json"
    });

    const req = http.request({
      hostname: 'localhost',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(ollamaData)
      }
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const brainReply = JSON.parse(parsed.message.content);
          resolve({
            reply: brainReply.reply,
            tool: brainReply.tool,
            params: brainReply.params,
            brain: 'Ollama LLM'
          });
        } catch (e) {
          resolve(getOfflineResponse(commandText));
        }
      });
    });

    req.on('error', () => {
      resolve(getOfflineResponse(commandText));
    });

    req.write(ollamaData);
    req.end();
  });
});

function matchLocalCommand(commandText) {
  const matchers = [
    { keys: ['open notepad', 'launch notepad', 'start notepad'], tool: 'open_app', params: { app: 'notepad' }, reply: 'Initializing Notepad, Boss.' },
    { keys: ['open calculator', 'launch calculator', 'start calculator', 'open calc'], tool: 'open_app', params: { app: 'calc' }, reply: 'Opening Calculator UI.' },
    { keys: ['open chrome', 'launch chrome', 'start chrome', 'open browser'], tool: 'open_app', params: { app: 'chrome' }, reply: 'Launching Google Chrome.' },
    { keys: ['open vscode', 'launch vscode', 'open vs code'], tool: 'open_app', params: { app: 'vscode' }, reply: 'Opening VS Code.' },
    { keys: ['open explorer', 'open files', 'file manager'], tool: 'open_app', params: { app: 'explorer' }, reply: 'Accessing folder directories.' },
    { keys: ['close notepad'], tool: 'close_app', params: { app: 'notepad' }, reply: 'Terminating Notepad.' },
    { keys: ['volume up', 'increase volume'], tool: 'system_volume', params: { action: 'up' }, reply: 'Raising master volume.' },
    { keys: ['volume down', 'decrease volume'], tool: 'system_volume', params: { action: 'down' }, reply: 'Lowering master volume.' },
    { keys: ['mute volume', 'mute', 'unmute'], tool: 'system_volume', params: { action: 'mute' }, reply: 'Toggling volume mute.' },
    { keys: ['lock laptop', 'lock screen', 'lock pc'], tool: 'lock_pc', params: {}, reply: 'Locking local workstation console.' },
    { keys: ['system diagnostics', 'check diagnostics', 'system status'], tool: 'system_stats', params: {}, reply: 'Retrieving telemetry values.' }
  ];

  if (commandText.startsWith('run command ') || commandText.startsWith('execute ')) {
    const cmdToRun = commandText.replace('run command ', '').replace('execute ', '');
    return {
      reply: `Executing command ${cmdToRun} on host machine.`,
      tool: 'run_command',
      params: { cmd: cmdToRun },
      brain: 'Fallback Pattern Matcher'
    };
  }

  for (const matcher of matchers) {
    for (const key of matcher.keys) {
      if (commandText.includes(key)) {
        return {
          reply: matcher.reply,
          tool: matcher.tool,
          params: matcher.params,
          brain: 'Jarvis Local Command Matcher'
        };
      }
    }
  }
  return null;
}

function getOfflineResponse(commandText) {
  const responses = [
    "At your service, Boss. I've processed your command locally, but no desktop automation script matches that phrase.",
    "System diagnostics are operational. Local Ollama LLM is offline, running on offline command parser cores. You can command me to open Notepad, Chrome, VS Code, or mute volume.",
    "Yes Boss. Core hardware controls are fully active. Request a command like 'open calculator' or 'system diagnostics'."
  ];
  const randomReply = responses[Math.floor(Math.random() * responses.length)];
  return {
    reply: randomReply,
    tool: null,
    params: {},
    brain: 'Jarvis Core Rulebase (Offline)'
  };
}

// Window Management
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    title: "J.A.R.V.I.S. Personal Terminal",
    backgroundColor: "#030812",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the production compiled file
  mainWindow.loadFile(path.join(__dirname, 'frontend/dist/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

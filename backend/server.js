/**
 * JARVIS Local Assistant Backend
 * 
 * This server runs locally on your laptop to execute system commands,
 * fetch system diagnostics, and interface with the AI brain (Ollama or Fallback).
 * 
 * Core libraries used:
 * - express: Web framework for API endpoints.
 * - cors: Allow the React frontend to make API calls to this local port.
 * - child_process: Executing command-line or PowerShell operations.
 * - os: Native Node.js module to read system resource metrics.
 */

import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import os from 'os';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5002;

app.use(cors());
app.use(express.json());

// Serve compiled static assets from the frontend/dist folder
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Helper function to measure CPU usage over a short interval (100ms)
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

// Extract CPU time details
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

/**
 * TELEMETRY ENDPOINT
 * Returns live metrics of the host machine
 */
app.get('/api/telemetry', async (req, res) => {
  try {
    const cpuLoad = await getCPUUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsage = Math.round((usedMem / totalMem) * 100);
    
    // Disk info via command line (Windows specific wmic command)
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

      res.json({
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
  } catch (error) {
    res.status(500).json({ error: "Failed to read system telemetry: " + error.message });
  }
});

/**
 * SYSTEM CONTROL ENDPOINT
 * Handles requests to run local system tasks
 */
app.post('/api/execute', (req, res) => {
  const { command, params } = req.body;
  console.log(`[EXECUTOR] Received command: ${command}`, params || '');

  let shellCommand = '';
  let responseText = 'Executing instruction, sir.';

  switch (command) {
    case 'open_app':
      const appName = params?.app?.toLowerCase();
      if (appName === 'notepad') {
        shellCommand = 'start notepad';
        responseText = 'Opening Notepad, sir.';
      } else if (appName === 'calc' || appName === 'calculator') {
        shellCommand = 'start calc';
        responseText = 'Initializing Calculator interface.';
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
        res.status(400).json({ error: `Application '${appName}' is not mapped.` });
        return;
      }
      break;

    case 'close_app':
      const targetApp = params?.app?.toLowerCase();
      if (!targetApp) {
        res.status(400).json({ error: 'No application specified to close.' });
        return;
      }
      // Simple mapping to process names
      let procName = targetApp;
      if (targetApp === 'calculator') procName = 'CalculatorApp';
      else if (targetApp === 'calc') procName = 'Calculator';
      
      shellCommand = `taskkill /f /im ${procName}.exe`;
      responseText = `Terminating the process for ${targetApp}, sir.`;
      break;

    case 'system_volume':
      const action = params?.action?.toLowerCase();
      // Using PowerShell's Wscript.Shell SendKeys to control master volume key presses
      if (action === 'up') {
        shellCommand = `powershell -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]175)"`;
        responseText = 'Increasing master volume level.';
      } else if (action === 'down') {
        shellCommand = `powershell -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]174)"`;
        responseText = 'Decreasing master volume level.';
      } else if (action === 'mute') {
        shellCommand = `powershell -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]173)"`;
        responseText = 'Toggling volume mute status.';
      } else {
        res.status(400).json({ error: `Invalid volume operation '${action}'` });
        return;
      }
      break;

    case 'lock_pc':
      shellCommand = 'rundll32.exe user32.dll,LockWorkStation';
      responseText = 'Securing terminal. Laptop is locked.';
      break;

    case 'run_command':
      // Safety warning: running arbitrary command. Restricting dangerous chains.
      const rawCmd = params?.cmd;
      if (!rawCmd) {
        res.status(400).json({ error: 'Command parameter missing.' });
        return;
      }
      // Safe check to avoid critical formatting, deletions or dangerous commands
      const lowerCmd = rawCmd.toLowerCase();
      if (lowerCmd.includes('rmdir /s') || lowerCmd.includes('del /s') || lowerCmd.includes('format')) {
        res.status(403).json({ error: 'Security Protocol Violation: Destructive command rejected.' });
        return;
      }
      shellCommand = rawCmd;
      responseText = `Executing system command: "${rawCmd}".`;
      break;

    default:
      res.status(400).json({ error: `Action '${command}' not recognized.` });
      return;
  }

  exec(shellCommand, (err, stdout, stderr) => {
    if (err) {
      console.error(`[EXEC ERROR] Command failed: ${shellCommand}`, err);
      res.status(500).json({
        success: false,
        error: err.message,
        reply: `Execution failed, sir. There was an error: ${err.message}`
      });
      return;
    }
    
    console.log(`[EXEC SUCCESS] Output:`, stdout || '(empty)');
    res.json({
      success: true,
      reply: responseText,
      stdout: stdout,
      stderr: stderr
    });
  });
});

/**
 * AI BRAIN ROUTE
 * Proxies to local Ollama (Llama 3 / Mistral) or falls back to a smart local intent matcher
 */
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  const commandText = message?.trim()?.toLowerCase() || '';

  console.log(`[BRAIN] Query received: "${commandText}"`);

  // Define fallback pattern matching lists
  const matchers = [
    { keys: ['open notepad', 'launch notepad', 'start notepad'], tool: 'open_app', params: { app: 'notepad' }, reply: 'Initializing Notepad editor, sir.' },
    { keys: ['open calculator', 'launch calculator', 'start calculator', 'open calc'], tool: 'open_app', params: { app: 'calc' }, reply: 'Opening Calculator UI.' },
    { keys: ['open chrome', 'launch chrome', 'start chrome', 'open browser'], tool: 'open_app', params: { app: 'chrome' }, reply: 'Launching Google Chrome, sir.' },
    { keys: ['open vscode', 'launch vscode', 'open vs code'], tool: 'open_app', params: { app: 'vscode' }, reply: 'Opening Visual Studio Code environment.' },
    { keys: ['open explorer', 'open files', 'file manager'], tool: 'open_app', params: { app: 'explorer' }, reply: 'Accessing local folder systems.' },
    { keys: ['close notepad'], tool: 'close_app', params: { app: 'notepad' }, reply: 'Terminating Notepad process.' },
    { keys: ['close calculator', 'close calc'], tool: 'close_app', params: { app: 'calc' }, reply: 'Shutting down Calculator.' },
    { keys: ['close chrome', 'close browser'], tool: 'close_app', params: { app: 'chrome' }, reply: 'Closing Google Chrome instances.' },
    { keys: ['volume up', 'increase volume', 'louder'], tool: 'system_volume', params: { action: 'up' }, reply: 'Raising the master volume level.' },
    { keys: ['volume down', 'decrease volume', 'quieter'], tool: 'system_volume', params: { action: 'down' }, reply: 'Lowering the master volume level.' },
    { keys: ['mute volume', 'mute', 'unmute'], tool: 'system_volume', params: { action: 'mute' }, reply: 'Toggling volume mute protocol.' },
    { keys: ['lock laptop', 'lock screen', 'lock my pc', 'lock pc'], tool: 'lock_pc', params: {}, reply: 'Locking local workstation console.' },
    { keys: ['system diagnostics', 'check diagnostics', 'system status', 'status report', 'telemetry'], tool: 'system_stats', params: {}, reply: 'Retrieving telemetry values. Displaying CPU and Memory allocations on the HUD.' }
  ];

  // Check if user is trying to run a custom cmd
  if (commandText.startsWith('run command ') || commandText.startsWith('execute ')) {
    const cmdToRun = commandText.replace('run command ', '').replace('execute ', '');
    res.json({
      reply: `Executing command ${cmdToRun} on host machine.`,
      tool: 'run_command',
      params: { cmd: cmdToRun },
      brain: 'Fallback Pattern Matcher'
    });
    return;
  }

  // Attempt to contact local Ollama server
  const ollamaData = JSON.stringify({
    model: "llama3", // default local model
    messages: [
      {
        role: "system",
        content: `You are JARVIS, Tony Stark's advanced personal AI assistant. You control this Windows laptop.
        You must respond to the user query in JSON format only.
        
        If the user command matches one of the system commands, specify the tool to execute:
        - "open_app" (params: { "app": "notepad" | "calc" | "chrome" | "vscode" | "explorer" })
        - "close_app" (params: { "app": "notepad" | "calc" | "chrome" })
        - "system_volume" (params: { "action": "up" | "down" | "mute" })
        - "lock_pc" (params: {})
        - "system_stats" (params: {})
        - "run_command" (params: { "cmd": "any raw windows shell command" })
        
        For general conversation or questions that do not require tool usage, leave tool as null.
        
        Your output MUST be a valid JSON object matching this schema exactly (do not output any markdown code fences, just raw JSON):
        {
          "reply": "Conversational text to read to the user, acting as JARVIS",
          "tool": "tool_name_or_null",
          "params": { ... }
        }`
      },
      {
        role: "user",
        content: message
      }
    ],
    stream: false,
    format: "json"
  });

  const requestOptions = {
    hostname: 'localhost',
    port: 11434,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(ollamaData)
    }
  };

  const ollamaReq = http.request(requestOptions, (ollamaRes) => {
    let body = '';
    ollamaRes.setEncoding('utf8');
    ollamaRes.on('data', (chunk) => body += chunk);
    ollamaRes.on('end', () => {
      try {
        const parsedResponse = JSON.parse(body);
        const brainReply = JSON.parse(parsedResponse.message.content);
        console.log('[BRAIN] Ollama Response:', brainReply);
        res.json({
          reply: brainReply.reply,
          tool: brainReply.tool,
          params: brainReply.params,
          brain: 'Ollama LLM'
        });
      } catch (parseErr) {
        console.error('[BRAIN] Failed parsing Ollama response JSON', parseErr);
        runFallback(commandText, res);
      }
    });
  });

  ollamaReq.on('error', (e) => {
    // If Ollama is offline, fall back gracefully to pattern matching without crashing
    console.log('[BRAIN] Ollama not available. Running fallback engine...');
    runFallback(commandText, res);
  });

  ollamaReq.write(ollamaData);
  ollamaReq.end();
});

// Fallback logic function
function runFallback(commandText, res) {
  // Direct matching
  for (const matcher of [
    { keys: ['open notepad', 'launch notepad', 'start notepad'], tool: 'open_app', params: { app: 'notepad' }, reply: 'Initializing Notepad editor, sir.' },
    { keys: ['open calculator', 'launch calculator', 'start calculator', 'open calc'], tool: 'open_app', params: { app: 'calc' }, reply: 'Opening Calculator UI.' },
    { keys: ['open chrome', 'launch chrome', 'start chrome', 'open browser'], tool: 'open_app', params: { app: 'chrome' }, reply: 'Launching Google Chrome, sir.' },
    { keys: ['open vscode', 'launch vscode', 'open vs code'], tool: 'open_app', params: { app: 'vscode' }, reply: 'Opening Visual Studio Code environment.' },
    { keys: ['open explorer', 'open files', 'file manager'], tool: 'open_app', params: { app: 'explorer' }, reply: 'Accessing local folder systems.' },
    { keys: ['close notepad'], tool: 'close_app', params: { app: 'notepad' }, reply: 'Terminating Notepad process.' },
    { keys: ['close calculator', 'close calc'], tool: 'close_app', params: { app: 'calc' }, reply: 'Shutting down Calculator.' },
    { keys: ['close chrome', 'close browser'], tool: 'close_app', params: { app: 'chrome' }, reply: 'Closing Google Chrome instances.' },
    { keys: ['volume up', 'increase volume', 'louder'], tool: 'system_volume', params: { action: 'up' }, reply: 'Raising the master volume level.' },
    { keys: ['volume down', 'decrease volume', 'quieter'], tool: 'system_volume', params: { action: 'down' }, reply: 'Lowering the master volume level.' },
    { keys: ['mute volume', 'mute', 'unmute'], tool: 'system_volume', params: { action: 'mute' }, reply: 'Toggling volume mute protocol.' },
    { keys: ['lock laptop', 'lock screen', 'lock my pc', 'lock pc'], tool: 'lock_pc', params: {}, reply: 'Locking local workstation console.' },
    { keys: ['system diagnostics', 'check diagnostics', 'system status', 'status report', 'telemetry'], tool: 'system_stats', params: {}, reply: 'Retrieving telemetry values. Displaying CPU and Memory allocations on the HUD.' }
  ]) {
    for (const key of matcher.keys) {
      if (commandText.includes(key)) {
        res.json({
          reply: matcher.reply,
          tool: matcher.tool,
          params: matcher.params,
          brain: 'Jarvis Local Command Matcher'
        });
        return;
      }
    }
  }

  // Conversational response list when offline and no system command was matched
  const responses = [
    "At your service, sir. I have processed your input, but there are no matching system scripts mapped for that command. How else may I assist you?",
    "Online and operational, sir. Local Ollama server is offline, so I am running on core hardware logic. You can ask me to open Notepad, Calculator, Chrome, or query system telemetry.",
    "System diagnostics are nominal, sir. Please supply a command such as 'open notepad', 'volume up', 'lock pc', or ask for 'system diagnostics'."
  ];
  
  const randomReply = responses[Math.floor(Math.random() * responses.length)];
  
  res.json({
    reply: randomReply,
    tool: null,
    params: {},
    brain: 'Jarvis Core Rulebase (Offline)'
  });
}

// Fallback route to serve compiled HTML shell for React router
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`   JARVIS ASSISTANT SERVER IS NOW ONLINE        `);
  console.log(`   Listening locally on http://localhost:${PORT}`);
  console.log(`================================================`);
});

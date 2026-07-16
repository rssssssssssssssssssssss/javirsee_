import React, { useState, useEffect, useRef } from 'react';

/**
 * J.A.R.V.I.S. Interactive HUD Frontend (Desktop Compatible)
 * 
 * Exposes dual-mode bindings:
 * 1. Native Electron Mode: Uses window.electronAPI contextBridge to call OS functions.
 * 2. Standalone Web Mode: Uses HTTP fetch requests to node system backend server on port 5002.
 */
export default function App() {
  // Initialization State
  const [isInitialized, setIsInitialized] = useState(false);

  // HUD UI & System States
  const [logs, setLogs] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0); // 0: Standby, 1: Listening, 2: Transcription, 3: Thinking, 4: Executing
  const [lockdownMode, setLockdownMode] = useState(false);
  
  // Settings
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  
  // Telemetry Metrics
  const [telemetry, setTelemetry] = useState({
    cpu: 0,
    ram: 0,
    ramRaw: '0GB / 0GB',
    disk: 0,
    diskRaw: '0GB / 0GB',
    uptime: 0,
    platform: 'N/A',
    arch: 'N/A',
    cpuModel: 'N/A'
  });
  const [backendOnline, setBackendOnline] = useState(false);
  const [brainSource, setBrainSource] = useState('Offline Matcher');

  // Refs
  const canvasRef = useRef(null);
  const logsEndRef = useRef(null);
  const recognitionRef = useRef(null);
  
  const isSpeakingRef = useRef(false);
  const currentStepRef = useRef(0);
  const isInitializedRef = useRef(false);
  const keepListeningRef = useRef(true);

  // Sync refs with states
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    currentStepRef.current = pipelineStep;
  }, [pipelineStep]);

  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  // Initial setup of system logs & SpeechRecognition setup
  useEffect(() => {
    addLog('SYSTEM', 'Initializing JARVIS terminal core...');
    
    // Check if running inside Electron shell
    if (window.electronAPI) {
      addLog('SUCCESS', 'Native Electron Shell interface detected. System bridges verified.');
    } else {
      addLog('SYSTEM', 'Standard browser detected. Falling back to HTTP telemetry...');
    }
    
    addLog('SYSTEM', 'Loading standard libraries: Web Audio, Web Speech, CanvasHUD...');
    
    // Check Web Speech API Availability
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addLog('ERROR', 'Web Speech API (SpeechRecognition) is not supported in this browser. Please use Chrome/Edge.');
    } else {
      addLog('SUCCESS', 'SpeechRecognition engine loaded.');
      
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setPipelineStep(1);
        addLog('SYSTEM', 'Speech recognition activated. Standing by for command, Boss.');
      };

      rec.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.error('SpeechRecognition Error', e);
          addLog('ERROR', `Voice recognition error: ${e.error}`);
        }
        setIsListening(false);
        setPipelineStep(0);
      };

      rec.onend = () => {
        setIsListening(false);
        // Restart speech recognition automatically if system is initialized and not speaking
        if (isInitializedRef.current && !isSpeakingRef.current && keepListeningRef.current) {
          setTimeout(() => {
            startSpeechListening();
          }, 300);
        } else if (currentStepRef.current === 1) {
          setPipelineStep(0);
        }
      };

      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        addLog('USER', `Voice Input: "${transcript}"`);
        setPipelineStep(2); // Transcription step
        setInputVal(transcript);
        processCommand(transcript);
      };

      recognitionRef.current = rec;
    }

    fetchTelemetry();

    // Set up intervals for telemetry polling
    const teleInterval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(teleInterval);
  }, []);

  // Scroll logs to bottom on update
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Draw Holographic Arc Reactor Orb
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let rotationAngle = 0;
    let pulseFactor = 0;
    let waveOffset = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 100;
      rotationAngle += 0.01;
      pulseFactor += 0.05;
      waveOffset += 0.15;

      const themeColor = lockdownMode ? '#ff2a6d' : '#00f3ff';
      const themeGlow = lockdownMode ? 'rgba(255, 42, 109, 0.4)' : 'rgba(0, 243, 255, 0.4)';

      // 1. Grid Background
      ctx.strokeStyle = lockdownMode ? 'rgba(255, 42, 109, 0.05)' : 'rgba(0, 243, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = -150; i <= 150; i += 30) {
        ctx.beginPath();
        ctx.moveTo(centerX + i, centerY - 150);
        ctx.lineTo(centerX + i, centerY + 150);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX - 150, centerY + i);
        ctx.lineTo(centerX + 150, centerY + i);
        ctx.stroke();
      }

      // 2. State Pulses
      let pulseMultiplier = 1.0;
      if (currentStepRef.current === 1) { // Listening
        pulseMultiplier = 1.0 + Math.sin(pulseFactor * 1.5) * 0.15;
      } else if (isSpeakingRef.current) { // Speaking
        pulseMultiplier = 1.0 + Math.sin(pulseFactor * 3.0) * 0.2;
      } else if (currentStepRef.current === 3) { // Thinking
        pulseMultiplier = 1.05 + Math.sin(pulseFactor * 4.0) * 0.05;
      } else { // Standby
        pulseMultiplier = 1.0 + Math.sin(pulseFactor) * 0.03;
      }

      const activeRadius = radius * pulseMultiplier;

      // 3. outer Ticks
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationAngle * 0.5);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 2;
      for (let i = 0; i < 360; i += 15) {
        const rad = (i * Math.PI) / 180;
        const tickStart = activeRadius + 20;
        const tickEnd = activeRadius + 28;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * tickStart, Math.sin(rad) * tickStart);
        ctx.lineTo(Math.cos(rad) * tickEnd, Math.sin(rad) * tickEnd);
        ctx.stroke();
      }
      ctx.restore();

      // 4. Rotating Rings
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-rotationAngle * 0.8);
      ctx.strokeStyle = themeColor;
      ctx.shadowBlur = 10;
      ctx.shadowColor = themeGlow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, activeRadius + 10, 0, Math.PI * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, activeRadius + 10, Math.PI * 0.6, Math.PI * 1.0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, activeRadius + 10, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();

      // 5. Core Spheres
      ctx.beginPath();
      ctx.arc(centerX, centerY, activeRadius - 10, 0, Math.PI * 2);
      ctx.fillStyle = lockdownMode ? 'rgba(255, 42, 109, 0.05)' : 'rgba(0, 243, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Audio waveform rendering
      if (currentStepRef.current === 1) { // Listening
        ctx.strokeStyle = '#05ff9b';
        ctx.shadowColor = 'rgba(5, 255, 155, 0.4)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = -80; x <= 80; x++) {
          const angle = (x / 80) * Math.PI * 4;
          const y = Math.sin(angle + waveOffset) * 15 * Math.sin((x + 80) / 160 * Math.PI);
          if (x === -80) ctx.moveTo(centerX + x, centerY + y);
          else ctx.lineTo(centerX + x, centerY + y);
        }
        ctx.stroke();
      } else if (isSpeakingRef.current) { // Speaking
        ctx.strokeStyle = themeColor;
        ctx.shadowColor = themeGlow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = -85; x <= 85; x++) {
          const angle = (x / 85) * Math.PI * 6;
          const y = (Math.sin(angle + waveOffset) * 20 + Math.cos(angle * 0.5 - waveOffset) * 10) * Math.sin((x + 85) / 170 * Math.PI);
          if (x === -85) ctx.moveTo(centerX + x, centerY + y);
          else ctx.lineTo(centerX + x, centerY + y);
        }
        ctx.stroke();
      } else if (currentStepRef.current === 3) { // Thinking
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle * 2.5);
        ctx.strokeStyle = '#ffaa00';
        ctx.shadowColor = 'rgba(255, 170, 0, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-45, 0); ctx.lineTo(45, 0);
        ctx.moveTo(0, -45); ctx.lineTo(0, 45);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else { // Standby
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle * 0.1);
        ctx.strokeStyle = themeColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = themeGlow;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = lockdownMode ? 'rgba(255, 42, 109, 0.4)' : 'rgba(0, 243, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(-15, 0); ctx.lineTo(15, 0);
        ctx.moveTo(0, -15); ctx.lineTo(0, 15);
        ctx.stroke();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [lockdownMode, isInitialized]);

  // Add Log Entry helper
  const addLog = (tag, text) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setLogs(prev => [...prev, { time, tag, text }]);
  };

  // Query server diagnostics (supports Electron / Web mode)
  const fetchTelemetry = async () => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getTelemetry();
        if (data && !data.error) {
          setTelemetry(data);
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
        return;
      }

      const res = await fetch('http://localhost:5002/api/telemetry');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
        setBackendOnline(true);
      } else {
        setBackendOnline(false);
      }
    } catch (e) {
      setBackendOnline(false);
    }
  };

  // Safe Speech Recognition activation helper
  const startSpeechListening = () => {
    if (!recognitionRef.current || isSpeakingRef.current || isListening) return;
    try {
      recognitionRef.current.start();
    } catch (err) {
      // recognition already running
    }
  };

  // Speech Output synthesis (Speaks and then triggers microphone)
  const speakText = (text) => {
    if (!window.speechSynthesis) return;

    // Set synchronous flags instantly to prevent race-condition mic restarts
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    keepListeningRef.current = false;

    try {
      recognitionRef.current?.stop();
    } catch (e) {}

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;

    const voices = window.speechSynthesis.getVoices();
    const jarvisVoice = voices.find(v => 
      v.name.includes('Google UK English Male') || 
      v.name.includes('Microsoft Hazel') || 
      v.name.includes('Great Britain') ||
      v.lang === 'en-GB'
    );
    if (jarvisVoice) utterance.voice = jarvisVoice;

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      addLog('SYSTEM', `Speaking: "${text}"`);
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setPipelineStep(0);
      
      // Resume continuous speech listening after a safe delay (lets speaker volume clear)
      keepListeningRef.current = true;
      setTimeout(() => {
        startSpeechListening();
      }, 1000);
    };

    utterance.onerror = (err) => {
      console.error('SpeechSynthesis error', err);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setPipelineStep(0);
      keepListeningRef.current = true;
      setTimeout(() => {
        startSpeechListening();
      }, 1000);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Click-to-initialize activation (handles first user interaction)
  const handleBootActivation = () => {
    setIsInitialized(true);
    addLog('SUCCESS', 'User activation complete. Initializing vocal greeting...');
    
    // Greet user immediately: "Ji Boss"
    setTimeout(() => {
      speakText("Ji Boss, systems online. Ready for command.");
    }, 500);
  };

  // Toggle voice recognition manually
  const toggleListening = () => {
    if (isListening) {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
    } else {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      keepListeningRef.current = true;
      startSpeechListening();
    }
  };

  // Process submitted command
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    
    addLog('USER', `Typed Command: "${inputVal}"`);
    setPipelineStep(2);
    processCommand(inputVal);
    setInputVal('');
  };

  // Intent router (supports Electron / Web mode)
  const processCommand = async (commandStr) => {
    setPipelineStep(3);
    addLog('SYSTEM', `Analyzing intent on: "${commandStr}"...`);

    try {
      let data;
      if (window.electronAPI) {
        data = await window.electronAPI.chatBrain(commandStr);
      } else {
        const chatRes = await fetch('http://localhost:5002/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: commandStr })
        });
        if (!chatRes.ok) throw new Error('Communication failed with AI brain.');
        data = await chatRes.json();
      }

      setBrainSource(data.brain || 'Fallback Engine');
      
      if (data.tool) {
        setPipelineStep(4);
        addLog('SYSTEM', `Triggering hardware action: [${data.tool}]`);
        
        let execData;
        if (window.electronAPI) {
          execData = await window.electronAPI.executeAction(data.tool, data.params);
        } else {
          const execRes = await fetch('http://localhost:5002/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: data.tool, params: data.params })
          });
          execData = await execRes.json();
        }
        
        if (execData.success) {
          addLog('SUCCESS', `Action completed. Result: ${execData.reply}`);
          if (execData.stdout) addLog('SYSTEM', `Stdout: ${execData.stdout.trim()}`);
          speakText(execData.reply);
        } else {
          addLog('ERROR', `Action failure: ${execData.error}`);
          speakText(`I was unable to complete the command, Boss.`);
        }
      } else {
        setPipelineStep(4);
        addLog('SUCCESS', 'Conversational query resolved.');
        speakText(data.reply);
      }

      // Special visual themes
      const normalizedCmd = commandStr.toLowerCase();
      if (normalizedCmd.includes('lockdown') || normalizedCmd.includes('red alert')) {
        setLockdownMode(true);
        addLog('SYSTEM', 'WARNING: Lockdown Mode Engaged.');
      } else if (normalizedCmd.includes('disable lockdown') || normalizedCmd.includes('standby mode') || normalizedCmd.includes('systems online')) {
        setLockdownMode(false);
        addLog('SUCCESS', 'Status nominal.');
      }

    } catch (err) {
      console.error(err);
      addLog('ERROR', `Failed processing command: ${err.message}`);
      setPipelineStep(4);
      speakText("I was unable to contact the backend service cores, Boss.");
    }
  };

  // Quick action macros (supports Electron / Web mode)
  const triggerQuickApp = async (appTarget) => {
    addLog('SYSTEM', `Manual Override: Starting app [${appTarget}]`);
    setPipelineStep(4);
    try {
      let data;
      if (window.electronAPI) {
        data = await window.electronAPI.executeAction('open_app', { app: appTarget });
      } else {
        const res = await fetch('http://localhost:5002/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'open_app', params: { app: appTarget } })
        });
        data = await res.json();
      }

      if (data.success) {
        addLog('SUCCESS', data.reply);
        speakText(data.reply);
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      addLog('ERROR', `Failed executing macro: ${e.message}`);
      speakText(`Launch failed, Boss.`);
      setPipelineStep(0);
    }
  };

  const triggerVolume = async (volDir) => {
    addLog('SYSTEM', `Manual Override: Volume [${volDir}]`);
    try {
      let data;
      if (window.electronAPI) {
        data = await window.electronAPI.executeAction('system_volume', { action: volDir });
      } else {
        const res = await fetch('http://localhost:5002/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'system_volume', params: { action: volDir } })
        });
        data = await res.json();
      }
      if (data.success) {
        addLog('SUCCESS', data.reply);
      }
    } catch (e) {
      addLog('ERROR', `Volume failed: ${e.message}`);
    }
  };

  const triggerLock = async () => {
    addLog('SYSTEM', 'Manual Override: Terminal Lock');
    try {
      if (window.electronAPI) {
        await window.electronAPI.executeAction('lock_pc');
      } else {
        await fetch('http://localhost:5002/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'lock_pc' })
        });
      }
      addLog('SUCCESS', 'Dispatched Lock DLL Call.');
    } catch (e) {
      addLog('ERROR', `Terminal lock failed: ${e.message}`);
    }
  };

  const formatUptime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  // If not initialized, show the premium holographic boot overlay
  if (!isInitialized) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="hud-card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '40px 30px' }}>
          <h2 className="glow-cyan" style={{ fontFamily: 'var(--font-hud)', fontSize: '28px', marginBottom: '20px', letterSpacing: '4px' }}>
            {window.electronAPI ? '💠 J.A.R.V.I.S. NATIVE' : '💠 J.A.R.V.I.S. HUD'}
          </h2>
          <p style={{ fontSize: '13px', color: '#6398b3', marginBottom: '40px', lineHeight: '1.6' }}>
            SECURITY PROTOCOLS LOADED.<br />
            USER ACTIVATION REQUIRED TO INITIALIZE AUDIO ENGINE CORES AND BEGIN AUTOMATION LISTENERS.
          </p>
          <div style={{ position: 'relative', height: '180px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '45px' }}>
            {/* Pulsing boot core */}
            <div className="ring-system" style={{ width: '180px', height: '180px' }}>
              <div className="ring-outer" style={{ animationDuration: '8s' }}></div>
              <div className="ring-mid" style={{ animationDuration: '5s' }}></div>
            </div>
            <button 
              onClick={handleBootActivation}
              className="quick-cmd-btn glow-cyan"
              style={{
                width: '100px', height: '100px', borderRadius: '50%',
                background: 'rgba(0, 243, 255, 0.1)', border: '2px solid var(--color-cyan)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                fontFamily: 'var(--font-hud)', fontSize: '12px', cursor: 'pointer', zIndex: 10,
                boxShadow: '0 0 20px rgba(0, 243, 255, 0.3)'
              }}
            >
              BOOT
            </button>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(0, 243, 255, 0.5)' }}>
            {window.electronAPI ? 'ELECTRON NATIVE SHELL VERIFIED • OS DIRECT BRIDGES ACTIVE' : 'LOCAL TELEMETRY PORT: 5002 • SECURE WEB SOCKET CORES'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${lockdownMode ? 'lockdown-theme danger-warning' : ''}`}>
      {/* Header */}
      <header className="hud-header">
        <div className="hud-title glow-cyan">
          {lockdownMode ? '⚡ J.A.R.V.I.S. SECURE SHELL' : '💠 J.A.R.V.I.S. ONLINE'}
        </div>
        <div className="hud-system-status">
          <span>AI BRAIN: <strong style={{color: '#05ff9b'}}>{brainSource}</strong></span>
          <span>•</span>
          <span>{window.electronAPI ? 'NATIVE CONTROLLER: ' : 'PORT 5002 STATUS: '}</span>
          <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`}></span>
          <span>{backendOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="hud-workspace">
        {/* Left Diagnostics Panel */}
        <section className="hud-panel-left">
          <div className="hud-card" style={{ flex: 1 }}>
            <h3 className="console-title glow-cyan">💻 SYSTEM DIAGNOSTICS</h3>
            <div className="telemetry-grid" style={{ marginTop: '15px' }}>
              <div className="gauge-row">
                <div className="gauge-label">
                  <span>CPU ACTIVE LOAD</span>
                  <span>{telemetry.cpu}%</span>
                </div>
                <div className="gauge-bar-container">
                  <div className="gauge-bar-fill" style={{ width: `${telemetry.cpu}%` }}></div>
                </div>
              </div>

              <div className="gauge-row">
                <div className="gauge-label">
                  <span>RAM USAGE</span>
                  <span>{telemetry.ram}%</span>
                </div>
                <div className="gauge-bar-container">
                  <div className="gauge-bar-fill" style={{ width: `${telemetry.ram}%` }}></div>
                </div>
                <span className="gauge-raw-val">{telemetry.ramRaw}</span>
              </div>

              <div className="gauge-row">
                <div className="gauge-label">
                  <span>DISK SYSTEM (C:)</span>
                  <span>{telemetry.disk}%</span>
                </div>
                <div className="gauge-bar-container">
                  <div className="gauge-bar-fill" style={{ width: `${telemetry.disk}%` }}></div>
                </div>
                <span className="gauge-raw-val">{telemetry.diskRaw}</span>
              </div>

              <div style={{ borderTop: '1px solid rgba(0,243,255,0.1)', paddingTop: '12px', marginTop: '5px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'var(--font-mono)' }}>
                <div>PLATFORM: <span style={{color: '#00f3ff'}}>{telemetry.platform} ({telemetry.arch})</span></div>
                <div>UPTIME: <span style={{color: '#00f3ff'}}>{formatUptime(telemetry.uptime)}</span></div>
                <div style={{ wordBreak: 'break-word', fontSize: '10px', color: '#6398b3' }}>CPU: {telemetry.cpuModel}</div>
              </div>
            </div>
          </div>

          <div className="hud-card">
            <h3 className="console-title glow-cyan">⚙️ VOCAL MODULATION</h3>
            <div className="settings-grid" style={{ marginTop: '15px' }}>
              <div className="setting-row">
                <span>PITCH</span>
                <input 
                  type="range" min="0.5" max="2.0" step="0.1" 
                  value={voicePitch} onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                  className="setting-slider"
                />
              </div>
              <div className="setting-row">
                <span>RATE</span>
                <input 
                  type="range" min="0.5" max="1.5" step="0.1" 
                  value={voiceRate} onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                  className="setting-slider"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Center Orb HUD Panel */}
        <section className="hud-panel-center">
          <div className="hud-card" style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div className="core-container">
              <div className="ring-system">
                <div className="ring-outer"></div>
                <div className="ring-mid"></div>
                <div className="ring-inner"></div>
              </div>
              
              <canvas 
                ref={canvasRef} 
                width="320" 
                height="320" 
                className="canvas-orb"
                onClick={toggleListening}
                title="Click core to toggle voice capture"
              />

              <div className="core-status-text glow-cyan">
                {isListening ? '🎙️ LISTENING...' : isSpeaking ? '🔊 SPEAKING' : '⚡ CORE ON STANDBY'}
              </div>
              <div style={{ fontSize: '10px', color: '#6398b3', marginTop: '6px', cursor: 'pointer' }} onClick={toggleListening}>
                (Click core to toggle microphone)
              </div>
            </div>

            <div className="pipeline-container" style={{ borderTop: '1px solid rgba(0, 243, 255, 0.1)', width: '100%' }}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-hud)', color: '#6398b3', textAlign: 'center', letterSpacing: '1px' }}>
                TELEMETRY TRANSMISSION PATHWAY
              </div>
              <div className="pipeline-steps">
                <div className="pipeline-line"></div>
                <div className={`pipeline-step ${pipelineStep === 1 ? 'active' : pipelineStep > 1 ? 'completed' : ''}`}>
                  <div className="pipeline-dot">🎤</div>
                  <div className="pipeline-label">MIC</div>
                </div>
                <div className={`pipeline-step ${pipelineStep === 2 ? 'active' : pipelineStep > 2 ? 'completed' : ''}`}>
                  <div className="pipeline-dot">📝</div>
                  <div className="pipeline-label">STT</div>
                </div>
                <div className={`pipeline-step ${pipelineStep === 3 ? 'active' : pipelineStep > 3 ? 'completed' : ''}`}>
                  <div className="pipeline-dot">🧠</div>
                  <div className="pipeline-label">BRAIN</div>
                </div>
                <div className={`pipeline-step ${pipelineStep === 4 ? 'active' : pipelineStep > 4 ? 'completed' : ''}`}>
                  <div className="pipeline-dot">⚡</div>
                  <div className="pipeline-label">EXEC</div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="chat-container">
            <input 
              type="text" 
              placeholder="Provide instruction to J.A.R.V.I.S..." 
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="chat-input"
            />
            <button type="submit" className="chat-send-btn">
              🎯
            </button>
          </form>
        </section>

        {/* Right Logs Console Panel */}
        <section className="hud-panel-right">
          <div className="hud-card" style={{ flex: 1, minHeight: 0 }}>
            <div className="console-container">
              <h3 className="console-title glow-cyan">📟 HARDWARE SYSTEM LOGS</h3>
              <div className="console-logs">
                {logs.map((log, index) => (
                  <div key={index} className="console-entry">
                    <span className="log-time">[{log.time}]</span>
                    <span className={`log-tag ${log.tag.toLowerCase()}`}>{log.tag}:</span>
                    <span>{log.text}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>

          <div className="hud-card">
            <h3 className="console-title glow-cyan">🎛️ SYSTEM COMMAND OVERRIDES</h3>
            <div className="quick-cmd-grid" style={{ marginTop: '15px' }}>
              <button onClick={() => triggerQuickApp('notepad')} className="quick-cmd-btn">
                <span>📝 notepad</span>
              </button>
              <button onClick={() => triggerQuickApp('calc')} className="quick-cmd-btn">
                <span>🧮 calculator</span>
              </button>
              <button onClick={() => triggerQuickApp('chrome')} className="quick-cmd-btn">
                <span>🌐 chrome</span>
              </button>
              <button onClick={() => triggerQuickApp('vscode')} className="quick-cmd-btn">
                <span>💻 vs code</span>
              </button>
              <button onClick={() => triggerVolume('up')} className="quick-cmd-btn">
                <span>🔊 vol +</span>
              </button>
              <button onClick={() => triggerVolume('down')} className="quick-cmd-btn">
                <span>🔉 vol -</span>
              </button>
              <button onClick={() => triggerVolume('mute')} className="quick-cmd-btn">
                <span>🔇 vol mute</span>
              </button>
              <button onClick={() => triggerLock()} className="quick-cmd-btn" style={{ borderColor: 'rgba(255, 42, 109, 0.4)' }}>
                <span>🔒 lock workstation</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

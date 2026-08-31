/**
 * Mobile Schedule Companion - Engine with PIN Lock Security, Unified History Vault, & Auto Date Matching
 */

document.addEventListener('DOMContentLoaded', () => {
  const DAYS_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let selectedDay = getCurrentDayKey();
  
  // Security PIN State
  let enteredPin = '';
  let isLocked = true;
  
  // Audio Engine State
  let audioCtx = null;
  let isAudioEnabled = localStorage.getItem('schedule_audio_enabled') === 'true';
  let lastActiveTaskIndex = -1;
  let lastTransitionTime = 0;
  let lastReminderBeepTime = 0;

  // DOM Elements - PIN Overlay
  const pinOverlay = document.getElementById('pin-lock-overlay');
  const pinTitleEl = document.getElementById('pin-title');
  const pinSubtitleEl = document.getElementById('pin-subtitle');
  const pinDots = document.querySelectorAll('#pin-dots .dot');
  const keyBtns = document.querySelectorAll('.key-btn[data-key]');
  const keyClearBtn = document.getElementById('key-clear');
  const keyDelBtn = document.getElementById('key-del');
  const pinErrorEl = document.getElementById('pin-error');
  const lockAppBtn = document.getElementById('lock-app-btn');

  // DOM Header & Core
  const liveClockEl = document.getElementById('live-clock');
  const currentDayNameEl = document.getElementById('current-day-name');
  const audioToggleBtn = document.getElementById('audio-toggle-btn');
  const audioIconEl = document.getElementById('audio-icon');
  
  const nowIconEl = document.getElementById('now-icon');
  const nowTitleEl = document.getElementById('now-title');
  const nowTimeRangeEl = document.getElementById('now-time-range');
  const nowDescEl = document.getElementById('now-desc');
  const countdownTimerEl = document.getElementById('countdown-timer');
  const progressFillEl = document.getElementById('progress-fill');
  
  const nextStartTimeEl = document.getElementById('next-start-time');
  const nextIconEl = document.getElementById('next-icon');
  const nextTitleEl = document.getElementById('next-title');
  const nextDescEl = document.getElementById('next-desc');
  
  const statDoneCountEl = document.getElementById('stat-done-count');
  const statMissedCountEl = document.getElementById('stat-missed-count');
  const statPendingCountEl = document.getElementById('stat-pending-count');

  const timelineTitleEl = document.getElementById('timeline-title');
  const taskCountEl = document.getElementById('task-count');
  const timelineListEl = document.getElementById('timeline-list');
  const dayTabs = document.querySelectorAll('.day-tab');

  // History Vault Modal DOM
  const historyBtn = document.getElementById('history-btn');
  const historyModal = document.getElementById('history-modal');
  const closeHistoryBtn = document.getElementById('close-history-btn');
  const historyDatePicker = document.getElementById('history-date-picker');
  const historyStatsCard = document.getElementById('history-stats-card');
  const historyTaskList = document.getElementById('history-task-list');

  // Seed Yesterday's Completed Record (August 31, 2026)
  seedYesterdayRecord();

  // Initialize App Modules
  initSecurityLock();
  initAudioToggle();
  initTabs();
  initHistoryModal();
  renderTimeline(selectedDay);
  updateEngine();
  setInterval(updateEngine, 1000);

  /* -------------------------------------------------------------
     LOCAL DATE HELPERS (Matches Present Date, Month & Year)
  ------------------------------------------------------------- */
  function getTodayDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getYesterdayDateStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getCurrentDayKey() {
    const dayIndex = new Date().getDay();
    return DAYS_MAP[dayIndex];
  }

  function getStorageKey(taskId, dateStr = getTodayDateStr()) {
    return `task_status_${dateStr}_${taskId}`;
  }

  function getTaskStatus(taskId, dateStr = getTodayDateStr()) {
    return localStorage.getItem(getStorageKey(taskId, dateStr)) || 'pending';
  }

  function seedYesterdayRecord() {
    const yestStr = getYesterdayDateStr();
    const yestKey = 'history_record_' + yestStr;
    if (!localStorage.getItem(yestKey)) {
      const monTasks = SCHEDULE_DATA.monday || [];
      const taskSnapshots = monTasks.map(t => {
        localStorage.setItem(getStorageKey(t.id, yestStr), 'completed');
        return { id: t.id, title: t.title, time: `${t.start}-${t.end}`, category: t.category, status: 'completed' };
      });
      const record = {
        date: yestStr,
        dayName: 'monday',
        stats: { done: monTasks.length, missed: 0, pending: 0, total: monTasks.length, completionRate: '100%' },
        tasks: taskSnapshots
      };
      localStorage.setItem(yestKey, JSON.stringify(record));
    }
  }

  /* -------------------------------------------------------------
     SECURITY & PIN LOCK SYSTEM (SHA-256 Hashing)
  ------------------------------------------------------------- */
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function initSecurityLock() {
    const savedPinHash = localStorage.getItem('app_pin_hash');
    if (!savedPinHash) {
      pinTitleEl.textContent = 'Set Secret 4-Digit PIN';
      pinSubtitleEl.textContent = 'Create a 4-digit PIN to secure your schedule';
    } else {
      pinTitleEl.textContent = 'Enter Security PIN';
      pinSubtitleEl.textContent = 'Enter your 4-digit PIN to unlock your companion';
    }
    
    keyBtns.forEach(btn => {
      btn.addEventListener('click', () => handlePinInput(btn.getAttribute('data-key')));
    });

    keyClearBtn.addEventListener('click', clearPinInput);
    keyDelBtn.addEventListener('click', deletePinDigit);
    lockAppBtn.addEventListener('click', lockApp);
  }

  function lockApp() {
    isLocked = true;
    clearPinInput();
    const savedPinHash = localStorage.getItem('app_pin_hash');
    if (savedPinHash) {
      pinTitleEl.textContent = 'Enter Security PIN';
      pinSubtitleEl.textContent = 'Enter your 4-digit PIN to unlock your companion';
    }
    pinOverlay.classList.remove('hidden');
  }

  function unlockApp() {
    isLocked = false;
    pinOverlay.classList.add('hidden');
    clearPinInput();
  }

  function clearPinInput() {
    enteredPin = '';
    pinErrorEl.textContent = '';
    updatePinDots();
  }

  function deletePinDigit() {
    if (enteredPin.length > 0) {
      enteredPin = enteredPin.slice(0, -1);
      pinErrorEl.textContent = '';
      updatePinDots();
    }
  }

  function updatePinDots() {
    pinDots.forEach((dot, idx) => {
      if (idx < enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  async function handlePinInput(digit) {
    if (enteredPin.length < 4) {
      enteredPin += digit;
      updatePinDots();
    }

    if (enteredPin.length === 4) {
      const inputHash = await sha256(enteredPin);
      const savedPinHash = localStorage.getItem('app_pin_hash');

      if (!savedPinHash) {
        localStorage.setItem('app_pin_hash', inputHash);
        unlockApp();
      } else if (inputHash === savedPinHash) {
        unlockApp();
      } else {
        pinErrorEl.textContent = 'Incorrect PIN. Try again.';
        pinDots.forEach(d => d.style.borderColor = 'var(--accent-red)');
        setTimeout(() => {
          pinDots.forEach(d => d.style.borderColor = '');
          clearPinInput();
        }, 800);
      }
    }
  }

  /* -------------------------------------------------------------
     UNIFIED DAILY HISTORY DATA STORE
  ------------------------------------------------------------- */
  function setTaskStatus(taskId, status) {
    const todayStr = getTodayDateStr();
    const currentStatus = getTaskStatus(taskId, todayStr);
    if (currentStatus === status) {
      localStorage.removeItem(getStorageKey(taskId, todayStr));
    } else {
      localStorage.setItem(getStorageKey(taskId, todayStr), status);
    }
    
    saveUnifiedDailySnapshot(todayStr, getCurrentDayKey());
    renderTimeline(selectedDay);
  }

  function saveUnifiedDailySnapshot(dateStr, dayKey) {
    const tasks = SCHEDULE_DATA[dayKey] || [];
    let done = 0, missed = 0, pending = 0;
    const taskSnapshots = tasks.map(t => {
      const st = getTaskStatus(t.id, dateStr);
      if (st === 'completed') done++;
      else if (st === 'incomplete') missed++;
      else pending++;
      return { id: t.id, title: t.title, time: `${t.start}-${t.end}`, category: t.category, status: st };
    });

    const total = tasks.length;
    const rate = total > 0 ? ((done / total) * 100).toFixed(1) + '%' : '0%';

    const record = {
      date: dateStr,
      dayName: dayKey,
      stats: { done, missed, pending, total, completionRate: rate },
      tasks: taskSnapshots
    };

    localStorage.setItem(`history_record_${dateStr}`, JSON.stringify(record));
  }

  function initHistoryModal() {
    historyBtn.addEventListener('click', () => {
      const todayStr = getTodayDateStr();
      historyDatePicker.value = todayStr;
      renderHistoryView(todayStr);
      historyModal.classList.add('active');
    });

    closeHistoryBtn.addEventListener('click', () => {
      historyModal.classList.remove('active');
    });

    historyDatePicker.addEventListener('change', (e) => {
      renderHistoryView(e.target.value);
    });
  }

  function renderHistoryView(dateStr) {
    const savedRecordJSON = localStorage.getItem(`history_record_${dateStr}`);
    
    if (savedRecordJSON) {
      const record = JSON.parse(savedRecordJSON);
      const { done, missed, pending, completionRate } = record.stats;
      
      historyStatsCard.innerHTML = `
        <div class="h-stat"><span class="h-stat-num" style="color:var(--accent-green)">${done}</span><span class="h-stat-label">Done</span></div>
        <div class="h-stat"><span class="h-stat-num" style="color:var(--accent-red)">${missed}</span><span class="h-stat-label">Missed</span></div>
        <div class="h-stat"><span class="h-stat-num" style="color:var(--text-muted)">${pending}</span><span class="h-stat-label">Pending</span></div>
        <div class="h-stat"><span class="h-stat-num" style="color:var(--accent-cyan)">${completionRate}</span><span class="h-stat-label">Rate</span></div>
      `;

      historyTaskList.innerHTML = record.tasks.map(t => `
        <div class="h-task-item">
          <span>${t.time} — <strong>${t.title}</strong></span>
          <span class="h-task-status h-status-${t.status}">${t.status.toUpperCase()}</span>
        </div>
      `).join('');
    } else {
      historyStatsCard.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted);">No snapshot recorded for ${dateStr} yet.</p>`;
      historyTaskList.innerHTML = '';
    }
  }

  /* -------------------------------------------------------------
     AUDIO SYNTHESIZER
  ------------------------------------------------------------- */
  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, delay = 0) {
    if (!isAudioEnabled || !audioCtx) return;
    setTimeout(() => {
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch (e) {}
    }, delay * 1000);
  }

  function playTransitionChime() {
    playTone(880, 'sine', 0.25, 0);
    playTone(1046.5, 'sine', 0.35, 0.2);
  }

  function playReminderBeep() {
    playTone(659.25, 'sine', 0.2, 0);
  }

  function initAudioToggle() {
    updateAudioUI();
    audioToggleBtn.addEventListener('click', () => {
      initAudioContext();
      isAudioEnabled = !isAudioEnabled;
      localStorage.setItem('schedule_audio_enabled', isAudioEnabled);
      updateAudioUI();
      if (isAudioEnabled) playTransitionChime();
    });
  }

  function updateAudioUI() {
    if (isAudioEnabled) {
      audioIconEl.textContent = '🔔';
    } else {
      audioIconEl.textContent = '🔇';
    }
  }

  /* -------------------------------------------------------------
     TIMELINE & TIME ENGINE
  ------------------------------------------------------------- */
  function initTabs() {
    dayTabs.forEach(tab => {
      const dayKey = tab.getAttribute('data-day');
      if (dayKey === selectedDay) {
        tab.classList.add('active');
      }

      tab.addEventListener('click', () => {
        initAudioContext();
        dayTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedDay = dayKey;
        renderTimeline(selectedDay);
        updateEngine();
      });
    });
  }

  function updateEngine() {
    if (isLocked) return;

    const now = new Date();
    const currentDayKey = DAYS_MAP[now.getDay()];
    const nowTimestamp = now.getTime();
    
    // Header Clock
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    liveClockEl.textContent = `${hours}:${minutes}:${seconds}`;
    currentDayNameEl.textContent = currentDayKey.toUpperCase();

    const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const todayTasks = SCHEDULE_DATA[currentDayKey] || [];
    let currentTaskIndex = -1;

    for (let i = 0; i < todayTasks.length; i++) {
      const task = todayTasks[i];
      const startSec = timeToSeconds(task.start);
      const endSec = timeToSeconds(task.end);

      if (nowSeconds >= startSec && nowSeconds < endSec) {
        currentTaskIndex = i;
        break;
      }
    }

    if (currentTaskIndex !== -1) {
      if (lastActiveTaskIndex !== -1 && lastActiveTaskIndex !== currentTaskIndex) {
        lastTransitionTime = nowTimestamp;
        lastReminderBeepTime = nowTimestamp;
        playTransitionChime();
      }
      
      if (lastTransitionTime > 0) {
        const elapsedSec = (nowTimestamp - lastTransitionTime) / 1000;
        if (elapsedSec <= 60) {
          const elapsedBeepSec = (nowTimestamp - lastReminderBeepTime) / 1000;
          if (elapsedBeepSec >= 20) {
            playReminderBeep();
            lastReminderBeepTime = nowTimestamp;
          }
        }
      }

      lastActiveTaskIndex = currentTaskIndex;

      const activeTask = todayTasks[currentTaskIndex];
      const nextTask = todayTasks[(currentTaskIndex + 1) % todayTasks.length];

      const startSec = timeToSeconds(activeTask.start);
      const endSec = timeToSeconds(activeTask.end);
      const totalDuration = endSec - startSec;
      const elapsed = nowSeconds - startSec;
      const remaining = endSec - nowSeconds;

      nowIconEl.textContent = activeTask.icon;
      nowTitleEl.textContent = activeTask.title;
      nowTimeRangeEl.textContent = `${format12Hour(activeTask.start)} - ${format12Hour(activeTask.end)}`;
      nowDescEl.textContent = activeTask.desc;

      countdownTimerEl.textContent = formatCountdown(remaining);
      const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      progressFillEl.style.width = `${progressPercent.toFixed(1)}%`;

      if (nextTask) {
        nextStartTimeEl.textContent = format12Hour(nextTask.start);
        nextIconEl.textContent = nextTask.icon;
        nextTitleEl.textContent = nextTask.title;
        nextDescEl.textContent = nextTask.desc;
      }
    }

    if (selectedDay === currentDayKey) {
      highlightActiveTaskInList(currentTaskIndex);
    }
  }

  function renderTimeline(dayKey) {
    const tasks = SCHEDULE_DATA[dayKey] || [];
    timelineTitleEl.textContent = `${capitalize(dayKey)} Routine`;
    taskCountEl.textContent = `${tasks.length} Tasks`;
    timelineListEl.innerHTML = '';

    const currentDayKey = getCurrentDayKey();
    const todayStr = getTodayDateStr();
    const now = new Date();
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    let doneCount = 0;
    let missedCount = 0;
    let pendingCount = 0;

    tasks.forEach((task, idx) => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.setAttribute('data-index', idx);

      const status = getTaskStatus(task.id, todayStr);
      if (status === 'completed') {
        card.classList.add('task-completed');
        doneCount++;
      } else if (status === 'incomplete') {
        card.classList.add('task-missed');
        missedCount++;
      } else {
        pendingCount++;
      }

      const startSec = timeToSeconds(task.start);
      const endSec = timeToSeconds(task.end);

      if (dayKey === currentDayKey && status === 'pending') {
        if (nowSec >= startSec && nowSec < endSec) {
          card.classList.add('active-item');
        } else if (nowSec >= endSec) {
          card.classList.add('past-item');
        }
      }

      card.innerHTML = `
        <div class="task-main-row">
          <div class="task-time-box">
            <span class="task-time-start">${format12Hour(task.start)}</span>
            <span class="task-time-end">${format12Hour(task.end)}</span>
          </div>
          <div class="task-divider"></div>
          <div class="task-icon">${task.icon}</div>
          <div class="task-info">
            <div class="task-title">${task.title}</div>
            <div class="task-desc">${task.desc}</div>
          </div>
          <span class="task-badge badge-${task.category}">${task.category}</span>
        </div>
        <div class="task-actions">
          <button class="action-btn btn-done ${status === 'completed' ? 'btn-active' : ''}">
            ✓ Done
          </button>
          <button class="action-btn btn-missed ${status === 'incomplete' ? 'btn-active' : ''}">
            ✕ Incomplete
          </button>
        </div>
      `;

      card.querySelector('.btn-done').addEventListener('click', (e) => {
        e.stopPropagation();
        initAudioContext();
        setTaskStatus(task.id, 'completed');
      });

      card.querySelector('.btn-missed').addEventListener('click', (e) => {
        e.stopPropagation();
        initAudioContext();
        setTaskStatus(task.id, 'incomplete');
      });

      timelineListEl.appendChild(card);
    });

    statDoneCountEl.textContent = doneCount;
    statMissedCountEl.textContent = missedCount;
    statPendingCountEl.textContent = pendingCount;
  }

  function highlightActiveTaskInList(activeIndex) {
    const cards = timelineListEl.querySelectorAll('.task-card');
    cards.forEach((card, idx) => {
      const isCompleted = card.classList.contains('task-completed');
      const isMissed = card.classList.contains('task-missed');

      if (!isCompleted && !isMissed) {
        if (idx === activeIndex) {
          card.classList.add('active-item');
          card.classList.remove('past-item');
        } else if (idx < activeIndex) {
          card.classList.remove('active-item');
          card.classList.add('past-item');
        } else {
          card.classList.remove('active-item');
          card.classList.remove('past-item');
        }
      }
    });
  }

  // Helpers
  function timeToSeconds(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60;
  }

  function format12Hour(timeStr) {
    let [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    const mStr = String(m).padStart(2, '0');
    return `${h}:${mStr} ${ampm}`;
  }

  function formatCountdown(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
});

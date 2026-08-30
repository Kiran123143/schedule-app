/**
 * Mobile Schedule Companion - App Engine with Audio Beep Notifications
 */

document.addEventListener('DOMContentLoaded', () => {
  const DAYS_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let selectedDay = getCurrentDayKey();
  
  // Audio Engine State
  let audioCtx = null;
  let isAudioEnabled = localStorage.getItem('schedule_audio_enabled') === 'true';
  let lastActiveTaskIndex = -1;
  let lastTransitionTime = 0;
  let lastReminderBeepTime = 0;

  // DOM Elements
  const liveClockEl = document.getElementById('live-clock');
  const currentDayNameEl = document.getElementById('current-day-name');
  const audioToggleBtn = document.getElementById('audio-toggle-btn');
  const audioIconEl = document.getElementById('audio-icon');
  const audioStatusEl = document.getElementById('audio-status');
  
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

  // Initialize App & Controls
  initAudioToggle();
  initTabs();
  renderTimeline(selectedDay);
  updateEngine();
  setInterval(updateEngine, 1000);

  function getCurrentDayKey() {
    const dayIndex = new Date().getDay();
    return DAYS_MAP[dayIndex];
  }

  function getStorageKey(taskId) {
    const todayStr = new Date().toISOString().split('T')[0];
    return `task_status_${todayStr}_${taskId}`;
  }

  function getTaskStatus(taskId) {
    return localStorage.getItem(getStorageKey(taskId)) || 'pending';
  }

  function setTaskStatus(taskId, status) {
    const currentStatus = getTaskStatus(taskId);
    if (currentStatus === status) {
      localStorage.removeItem(getStorageKey(taskId));
    } else {
      localStorage.setItem(getStorageKey(taskId), status);
    }
    renderTimeline(selectedDay);
  }

  /* Audio Synthesizer using Web Audio API */
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
      } catch (e) {
        console.error('Audio play error', e);
      }
    }, delay * 1000);
  }

  function playTransitionChime() {
    // 2-tone pleasant transition alert chime
    playTone(880, 'sine', 0.25, 0);    // A5
    playTone(1046.5, 'sine', 0.35, 0.2); // C6
  }

  function playReminderBeep() {
    // Gentle 1-minute transition reminder tone
    playTone(659.25, 'sine', 0.2, 0);  // E5
  }

  function initAudioToggle() {
    updateAudioUI();
    audioToggleBtn.addEventListener('click', () => {
      initAudioContext();
      isAudioEnabled = !isAudioEnabled;
      localStorage.setItem('schedule_audio_enabled', isAudioEnabled);
      updateAudioUI();
      if (isAudioEnabled) {
        playTransitionChime(); // Play test chime
      }
    });
  }

  function updateAudioUI() {
    if (isAudioEnabled) {
      audioToggleBtn.classList.add('audio-active');
      audioIconEl.textContent = '🔔';
      audioStatusEl.textContent = 'Sound On';
    } else {
      audioToggleBtn.classList.remove('audio-active');
      audioIconEl.textContent = '🔇';
      audioStatusEl.textContent = 'Sound Off';
    }
  }

  function initTabs() {
    dayTabs.forEach(tab => {
      const dayKey = tab.getAttribute('data-day');
      if (dayKey === selectedDay) {
        tab.classList.add('active');
      }

      tab.addEventListener('click', () => {
        initAudioContext(); // Ensure AudioContext resumes on touch/tap
        dayTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedDay = dayKey;
        renderTimeline(selectedDay);
        updateEngine();
      });
    });
  }

  function updateEngine() {
    const now = new Date();
    const currentDayKey = DAYS_MAP[now.getDay()];
    const nowTimestamp = now.getTime();
    
    // Update Header Clock
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    liveClockEl.textContent = `${hours}:${minutes}:${seconds}`;
    currentDayNameEl.textContent = currentDayKey.toUpperCase();

    // Seconds from midnight
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

    // Check Task Transition for Audio Alerts
    if (currentTaskIndex !== -1) {
      if (lastActiveTaskIndex !== -1 && lastActiveTaskIndex !== currentTaskIndex) {
        // Task Transition Triggered!
        lastTransitionTime = nowTimestamp;
        lastReminderBeepTime = nowTimestamp;
        playTransitionChime();
      }
      
      // Handle 1-Minute Transition Reminder Beeps (Beep every 20s for the 1st minute)
      if (lastTransitionTime > 0) {
        const elapsedSinceTransitionSec = (nowTimestamp - lastTransitionTime) / 1000;
        if (elapsedSinceTransitionSec <= 60) {
          const elapsedSinceLastBeepSec = (nowTimestamp - lastReminderBeepTime) / 1000;
          if (elapsedSinceLastBeepSec >= 20) {
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

      // Update Now Banner
      nowIconEl.textContent = activeTask.icon;
      nowTitleEl.textContent = activeTask.title;
      nowTimeRangeEl.textContent = `${format12Hour(activeTask.start)} - ${format12Hour(activeTask.end)}`;
      nowDescEl.textContent = activeTask.desc;

      // Update Countdown & Progress Bar
      countdownTimerEl.textContent = formatCountdown(remaining);
      const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      progressFillEl.style.width = `${progressPercent.toFixed(1)}%`;

      // Update Next Task Banner
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
    const now = new Date();
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    let doneCount = 0;
    let missedCount = 0;
    let pendingCount = 0;

    tasks.forEach((task, idx) => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.setAttribute('data-index', idx);

      const status = getTaskStatus(task.id);
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
          <button class="action-btn btn-done ${status === 'completed' ? 'btn-active' : ''}" data-id="${task.id}" data-action="completed">
            ✓ Done
          </button>
          <button class="action-btn btn-missed ${status === 'incomplete' ? 'btn-active' : ''}" data-id="${task.id}" data-action="incomplete">
            ✕ Incomplete
          </button>
        </div>
      `;

      const btnDone = card.querySelector('.btn-done');
      const btnMissed = card.querySelector('.btn-missed');

      btnDone.addEventListener('click', (e) => {
        e.stopPropagation();
        initAudioContext();
        setTaskStatus(task.id, 'completed');
      });

      btnMissed.addEventListener('click', (e) => {
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

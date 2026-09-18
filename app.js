/**
 * Mobile Schedule Companion Engine - 12-Hour Indian Clock & Dual Ringtone System
 */

document.addEventListener('DOMContentLoaded', () => {
  const DAYS_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let selectedDay = getCurrentDayKey();
  
  // Audio State & Local Custom Ringtones
  let isAudioEnabled = localStorage.getItem('schedule_audio_enabled') !== 'false';
  let customEndAudio = localStorage.getItem('custom_end_ringtone') || null;
  let customStartAudio = localStorage.getItem('custom_start_ringtone') || null;
  
  let activeTaskId = null;
  let audioCtx = null;

  // Schedule Data Storage
  let userScheduleData = loadUserSchedule();

  // DOM Elements
  const liveClockEl = document.getElementById('live-clock');
  const currentDayNameEl = document.getElementById('current-day-name');
  const audioSettingsBtn = document.getElementById('audio-settings-btn');
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

  // Modals
  const taskModal = document.getElementById('task-modal');
  const openAddTaskBtn = document.getElementById('open-add-task-btn');
  const closeTaskModalBtn = document.getElementById('close-task-modal');
  const taskForm = document.getElementById('task-form');

  const audioModal = document.getElementById('audio-modal');
  const closeAudioModalBtn = document.getElementById('close-audio-modal');
  const toggleSoundStateBtn = document.getElementById('toggle-sound-state');
  const endRingtoneInput = document.getElementById('end-ringtone-input');
  const startRingtoneInput = document.getElementById('start-ringtone-input');
  const endRingtoneStatus = document.getElementById('end-ringtone-status');
  const startRingtoneStatus = document.getElementById('start-ringtone-status');
  const testAudioBtn = document.getElementById('test-audio-btn');

  const historyBtn = document.getElementById('history-btn');
  const historyModal = document.getElementById('history-modal');
  const closeHistoryBtn = document.getElementById('close-history-btn');
  const historyDatePicker = document.getElementById('history-date-picker');
  const historyStatsCard = document.getElementById('history-stats-card');
  const historyTaskList = document.getElementById('history-task-list');

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  initAudioControls();
  initTabs();
  initTaskModal();
  initHistoryModal();
  renderTimeline(selectedDay);
  updateEngine();
  setInterval(updateEngine, 1000);

  /* ------------------- DYNAMIC SCHEDULE STORAGE ------------------- */
  function loadUserSchedule() {
    const saved = localStorage.getItem('user_schedule_data');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return typeof DEFAULT_SCHEDULE !== 'undefined' ? DEFAULT_SCHEDULE : {};
  }

  function saveUserSchedule() {
    localStorage.setItem('user_schedule_data', JSON.stringify(userScheduleData));
    renderTimeline(selectedDay);
    updateEngine();
  }

  /* ------------------- 12-HOUR INDIAN CLOCK & ENGINE ------------------- */
  function updateEngine() {
    const now = new Date();
    const currentDayKey = DAYS_MAP[now.getDay()];
    
    // 12-Hour Indian Clock Formatting (hh:mm:ss AM/PM)
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const formattedHours = String(hours).padStart(2, '0');
    
    liveClockEl.textContent = `${formattedHours}:${minutes}:${seconds} ${ampm}`;
    currentDayNameEl.textContent = currentDayKey.toUpperCase();

    const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const todayTasks = userScheduleData[currentDayKey] || [];
    let currentTaskIndex = -1;

    for (let i = 0; i < todayTasks.length; i++) {
      const startSec = timeToSeconds(todayTasks[i].start);
      const endSec = timeToSeconds(todayTasks[i].end);
      if (nowSeconds >= startSec && nowSeconds < endSec) {
        currentTaskIndex = i;
        break;
      }
    }

    if (currentTaskIndex !== -1) {
      const activeTask = todayTasks[currentTaskIndex];
      
      // Trigger Start Ringtone on new active task detection
      if (activeTaskId !== activeTask.id) {
        if (activeTaskId !== null) {
          playRingtone('end'); // Play end alert for previous task
          setTimeout(() => playRingtone('start'), 1500); // Play start alert for new task
        } else {
          playRingtone('start');
        }
        activeTaskId = activeTask.id;
      }

      const nextTask = todayTasks[(currentTaskIndex + 1) % todayTasks.length];
      const startSec = timeToSeconds(activeTask.start);
      const endSec = timeToSeconds(activeTask.end);
      
      nowIconEl.textContent = activeTask.icon;
      nowTitleEl.textContent = activeTask.title;
      nowTimeRangeEl.textContent = `${format12Hour(activeTask.start)} - ${format12Hour(activeTask.end)}`;
      nowDescEl.textContent = activeTask.desc;

      countdownTimerEl.textContent = formatCountdown(endSec - nowSeconds);
      const progressPercent = Math.min(100, Math.max(0, ((nowSeconds - startSec) / (endSec - startSec)) * 100));
      progressFillEl.style.width = `${progressPercent.toFixed(1)}%`;

      if (nextTask) {
        nextStartTimeEl.textContent = format12Hour(nextTask.start);
        nextIconEl.textContent = nextTask.icon;
        nextTitleEl.textContent = nextTask.title;
        nextDescEl.textContent = nextTask.desc;
      }
    } else {
      if (activeTaskId !== null) {
        playRingtone('end'); // Play end ringtone when task finishes and no task follows
        activeTaskId = null;
      }
      nowIconEl.textContent = '💤';
      nowTitleEl.textContent = 'No Active Task';
      nowTimeRangeEl.textContent = '--:-- - --:--';
      nowDescEl.textContent = 'Free Time / Idle';
      countdownTimerEl.textContent = '00h 00m 00s';
      progressFillEl.style.width = '0%';
    }
  }

  /* ------------------- AUDIO & RINGTONE ENGINE ------------------- */
  function playRingtone(type) {
    if (!isAudioEnabled) return;

    const audioData = type === 'end' ? customEndAudio : customStartAudio;

    if (audioData) {
      const audio = new Audio(audioData);
      audio.play().catch(() => playSynthesizedChime(type));
    } else {
      playSynthesizedChime(type);
    }
  }

  function playSynthesizedChime(type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'start' ? 587.33 : 440, audioCtx.currentTime); // D5 for start, A4 for end
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {}
  }

  function initAudioControls() {
    audioSettingsBtn.addEventListener('click', () => audioModal.classList.add('active'));
    closeAudioModalBtn.addEventListener('click', () => audioModal.classList.remove('active'));

    updateSoundUI();

    toggleSoundStateBtn.addEventListener('click', () => {
      isAudioEnabled = !isAudioEnabled;
      localStorage.setItem('schedule_audio_enabled', isAudioEnabled);
      updateSoundUI();
    });

    endRingtoneInput.addEventListener('change', (e) => handleRingtoneUpload(e, 'end'));
    startRingtoneInput.addEventListener('change', (e) => handleRingtoneUpload(e, 'start'));

    testAudioBtn.addEventListener('click', () => {
      playRingtone('end');
      setTimeout(() => playRingtone('start'), 1500);
    });
  }

  function handleRingtoneUpload(e, type) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Audio = event.target.result;
        if (type === 'end') {
          customEndAudio = base64Audio;
          localStorage.setItem('custom_end_ringtone', base64Audio);
        } else {
          customStartAudio = base64Audio;
          localStorage.setItem('custom_start_ringtone', base64Audio);
        }
        updateSoundUI();
      };
      reader.readAsDataURL(file);
    }
  }

  function updateSoundUI() {
    toggleSoundStateBtn.textContent = `Sound: ${isAudioEnabled ? 'ENABLED' : 'DISABLED'}`;
    audioIconEl.textContent = isAudioEnabled ? '🔔' : '🔇';
    endRingtoneStatus.textContent = customEndAudio ? 'Custom Phone Ringtone Loaded ✓' : 'Default Chime Active';
    startRingtoneStatus.textContent = customStartAudio ? 'Custom Phone Ringtone Loaded ✓' : 'Default Chime Active';
  }

  /* ------------------- TASK CREATION & TIMELINE ------------------- */
  function initTaskModal() {
    openAddTaskBtn.addEventListener('click', () => {
      document.getElementById('task-day').value = selectedDay;
      taskModal.classList.add('active');
    });

    closeTaskModalBtn.addEventListener('click', () => taskModal.classList.remove('active'));

    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const day = document.getElementById('task-day').value;
      const newTask = {
        id: `custom-${Date.now()}`,
        start: document.getElementById('task-start').value,
        end: document.getElementById('task-end').value,
        title: document.getElementById('task-title').value,
        category: document.getElementById('task-category').value,
        icon: document.getElementById('task-icon').value,
        desc: document.getElementById('task-desc').value || 'User Custom Task'
      };

      if (!userScheduleData[day]) userScheduleData[day] = [];
      userScheduleData[day].push(newTask);
      userScheduleData[day].sort((a, b) => timeToSeconds(a.start) - timeToSeconds(b.start));

      saveUserSchedule();
      taskForm.reset();
      taskModal.classList.remove('active');
    });
  }

  function deleteTask(dayKey, taskId) {
    if (userScheduleData[dayKey]) {
      userScheduleData[dayKey] = userScheduleData[dayKey].filter(t => t.id !== taskId);
      saveUserSchedule();
    }
  }

  function renderTimeline(dayKey) {
    const tasks = userScheduleData[dayKey] || [];
    timelineTitleEl.textContent = `${capitalize(dayKey)} Routine`;
    taskCountEl.textContent = `${tasks.length} Tasks`;
    timelineListEl.innerHTML = '';

    const targetDateStr = getDateStrForDayTab(dayKey);
    let done = 0, missed = 0, pending = 0;

    tasks.forEach((task) => {
      const status = getTaskStatus(task.id, targetDateStr);
      if (status === 'completed') done++;
      else if (status === 'incomplete') missed++;
      else pending++;

      const card = document.createElement('div');
      card.className = `task-card ${status === 'completed' ? 'task-completed' : ''}`;
      
      card.innerHTML = `
        <div class="task-main-row">
          <div class="task-time-box">
            <span>${format12Hour(task.start)}</span>
            <span>${format12Hour(task.end)}</span>
          </div>
          <div class="task-icon">${task.icon}</div>
          <div class="task-info">
            <div class="task-title">${task.title}</div>
            <div class="task-desc">${task.desc}</div>
          </div>
          <span class="task-badge">${task.category}</span>
        </div>
        <div class="task-actions">
          <button class="action-btn btn-done ${status === 'completed' ? 'btn-active' : ''}">✓ Done</button>
          <button class="action-btn btn-missed ${status === 'incomplete' ? 'btn-active' : ''}">✕ Missed</button>
          <button class="action-btn btn-delete">🗑 Delete</button>
        </div>
      `;

      card.querySelector('.btn-done').addEventListener('click', () => setTaskStatus(task.id, 'completed', dayKey));
      card.querySelector('.btn-missed').addEventListener('click', () => setTaskStatus(task.id, 'incomplete', dayKey));
      card.querySelector('.btn-delete').addEventListener('click', () => deleteTask(dayKey, task.id));

      timelineListEl.appendChild(card);
    });

    statDoneCountEl.textContent = done;
    statMissedCountEl.textContent = missed;
    statPendingCountEl.textContent = pending;
  }

  /* ------------------- HELPERS & MODALS ------------------- */
  function initTabs() {
    dayTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        dayTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedDay = tab.getAttribute('data-day');
        renderTimeline(selectedDay);
      });
    });
  }

  function initHistoryModal() {
    historyBtn.addEventListener('click', () => {
      const today = getTodayDateStr();
      historyDatePicker.value = today;
      renderHistoryView(today);
      historyModal.classList.add('active');
    });
    closeHistoryBtn.addEventListener('click', () => historyModal.classList.remove('active'));
    historyDatePicker.addEventListener('change', (e) => renderHistoryView(e.target.value));
  }

  function renderHistoryView(dateStr) {
    const dayKey = DAYS_MAP[new Date(dateStr).getDay()];
    const tasks = userScheduleData[dayKey] || [];
    let done = 0, missed = 0, pending = 0;

    const rows = tasks.map(t => {
      const status = getTaskStatus(t.id, dateStr);
      if (status === 'completed') done++;
      else if (status === 'incomplete') missed++;
      else pending++;
      return `<div class="task-card"><div class="task-title">${t.title} (${status.toUpperCase()})</div></div>`;
    });

    historyStatsCard.innerHTML = `<div>Done: ${done}</div><div>Missed: ${missed}</div><div>Pending: ${pending}</div>`;
    historyTaskList.innerHTML = rows.join('');
  }

  function getCurrentDayKey() { return DAYS_MAP[new Date().getDay()]; }
  function getTodayDateStr() { return new Date().toISOString().split('T')[0]; }
  function getDateStrForDayTab(tabKey) {
    const now = new Date();
    const diff = DAYS_MAP.indexOf(tabKey) - now.getDay();
    const target = new Date(now.setDate(now.getDate() + diff));
    return target.toISOString().split('T')[0];
  }

  function getTaskStatus(taskId, dateStr) { return localStorage.getItem(`status_${dateStr}_${taskId}`) || 'pending'; }
  function setTaskStatus(taskId, status, dayKey) {
    const dateStr = getDateStrForDayTab(dayKey);
    const curr = getTaskStatus(taskId, dateStr);
    if (curr === status) localStorage.removeItem(`status_${dateStr}_${taskId}`);
    else localStorage.setItem(`status_${dateStr}_${taskId}`, status);
    renderTimeline(dayKey);
  }

  function timeToSeconds(str) { const [h, m] = str.split(':').map(Number); return h * 3600 + m * 60; }
  function format12Hour(str) {
    let [h, m] = str.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  function formatCountdown(sec) {
    if (sec <= 0) return '00h 00m 00s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
});
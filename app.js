/**
 * Mobile Schedule Companion Engine - Fault-Tolerant Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  const DAYS_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  // Audio State & Phone Ringtone Management
  let isAudioEnabled = localStorage.getItem('schedule_audio_enabled') !== 'false';
  let customEndAudio = localStorage.getItem('custom_end_ringtone') || null;
  let customStartAudio = localStorage.getItem('custom_start_ringtone') || null;
  let activeTaskId = null;
  let audioCtx = null;

  // Safe DOM Element Selector
  const getEl = (id) => document.getElementById(id);

  // Core Header Elements
  const liveClockEl = getEl('live-clock');
  const currentDayNameEl = getEl('current-day-name');
  const audioBtn = getEl('audio-settings-btn') || getEl('audio-toggle-btn');
  const audioIconEl = getEl('audio-icon');

  // Happening Now Elements
  const nowIconEl = getEl('now-icon');
  const nowTitleEl = getEl('now-title');
  const nowTimeRangeEl = getEl('now-time-range');
  const nowDescEl = getEl('now-desc');
  const countdownTimerEl = getEl('countdown-timer');
  const progressFillEl = getEl('progress-fill');

  // Up Next Elements
  const nextStartTimeEl = getEl('next-start-time');
  const nextIconEl = getEl('next-icon');
  const nextTitleEl = getEl('next-title');
  const nextDescEl = getEl('next-desc');

  // Summary Elements
  const statDoneCountEl = getEl('stat-done-count');
  const statMissedCountEl = getEl('stat-missed-count');
  const statPendingCountEl = getEl('stat-pending-count');

  // Timeline Elements
  const timelineTitleEl = getEl('timeline-title');
  const taskCountEl = getEl('task-count');
  const timelineListEl = getEl('timeline-list');
  const dayTabs = document.querySelectorAll('.day-tab');

  // Modal Elements
  const taskModal = getEl('task-modal');
  const openAddTaskBtn = getEl('open-add-task-btn');
  const closeTaskModalBtn = getEl('close-task-modal');
  const taskForm = getEl('task-form');

  const audioModal = getEl('audio-modal');
  const closeAudioModalBtn = getEl('close-audio-modal');
  const toggleSoundStateBtn = getEl('toggle-sound-state');
  const endRingtoneInput = getEl('end-ringtone-input');
  const startRingtoneInput = getEl('start-ringtone-input');
  const endRingtoneStatus = getEl('end-ringtone-status');
  const startRingtoneStatus = getEl('start-ringtone-status');
  const testAudioBtn = getEl('test-audio-btn');

  const historyBtn = getEl('history-btn');
  const historyModal = getEl('history-modal');
  const closeHistoryBtn = getEl('close-history-btn');
  const historyDatePicker = getEl('history-date-picker');
  const historyStatsCard = getEl('history-stats-card');
  const historyTaskList = getEl('history-task-list');

  // State Initialization
  function getTodayKey() { return DAYS_MAP[new Date().getDay()]; }
  let selectedDay = getTodayKey();

  function loadUserSchedule() {
    const saved = localStorage.getItem('user_schedule_data');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return typeof DEFAULT_SCHEDULE !== 'undefined' ? DEFAULT_SCHEDULE : {};
  }

  let userScheduleData = loadUserSchedule();

  function saveUserSchedule() {
    localStorage.setItem('user_schedule_data', JSON.stringify(userScheduleData));
    renderTimeline(selectedDay);
    updateEngine();
  }

  // Local Timezone Helpers (Avoids UTC Shift Bugs)
  function getLocalDateStr(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getDateStrForDayTab(tabKey) {
    const now = new Date();
    const diff = DAYS_MAP.indexOf(tabKey) - now.getDay();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    return getLocalDateStr(target);
  }

  /* ------------------- 12-HOUR CLOCK & CORE ENGINE ------------------- */
  function updateEngine() {
    try {
      const now = new Date();
      const currentDayKey = DAYS_MAP[now.getDay()];
      
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const formattedHours = String(hours).padStart(2, '0');
      
      if (liveClockEl) liveClockEl.textContent = `${formattedHours}:${minutes}:${seconds} ${ampm}`;
      if (currentDayNameEl) currentDayNameEl.textContent = currentDayKey.toUpperCase();

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
        
        if (activeTaskId !== activeTask.id) {
          if (activeTaskId !== null) {
            playRingtone('end');
            setTimeout(() => playRingtone('start'), 1500);
          } else {
            playRingtone('start');
          }
          activeTaskId = activeTask.id;
        }

        const nextTask = todayTasks[(currentTaskIndex + 1) % todayTasks.length];
        const startSec = timeToSeconds(activeTask.start);
        const endSec = timeToSeconds(activeTask.end);
        
        if (nowIconEl) nowIconEl.textContent = activeTask.icon;
        if (nowTitleEl) nowTitleEl.textContent = activeTask.title;
        if (nowTimeRangeEl) nowTimeRangeEl.textContent = `${format12Hour(activeTask.start)} - ${format12Hour(activeTask.end)}`;
        if (nowDescEl) nowDescEl.textContent = activeTask.desc;

        if (countdownTimerEl) countdownTimerEl.textContent = formatCountdown(endSec - nowSeconds);
        const progressPercent = Math.min(100, Math.max(0, ((nowSeconds - startSec) / (endSec - startSec)) * 100));
        if (progressFillEl) progressFillEl.style.width = `${progressPercent.toFixed(1)}%`;

        if (nextTask) {
          if (nextStartTimeEl) nextStartTimeEl.textContent = format12Hour(nextTask.start);
          if (nextIconEl) nextIconEl.textContent = nextTask.icon;
          if (nextTitleEl) nextTitleEl.textContent = nextTask.title;
          if (nextDescEl) nextDescEl.textContent = nextTask.desc;
        }
      } else {
        if (activeTaskId !== null) {
          playRingtone('end');
          activeTaskId = null;
        }
        if (nowIconEl) nowIconEl.textContent = '💤';
        if (nowTitleEl) nowTitleEl.textContent = 'No Active Task';
        if (nowTimeRangeEl) nowTimeRangeEl.textContent = '--:-- - --:--';
        if (nowDescEl) nowDescEl.textContent = 'Free Time / Idle';
        if (countdownTimerEl) countdownTimerEl.textContent = '00h 00m 00s';
        if (progressFillEl) progressFillEl.style.width = '0%';
      }
    } catch (e) {}
  }

  /* ------------------- RINGTONE & AUDIO ENGINE ------------------- */
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
      osc.frequency.setValueAtTime(type === 'start' ? 587.33 : 440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {}
  }

  function updateSoundUI() {
    if (toggleSoundStateBtn) toggleSoundStateBtn.textContent = `Sound: ${isAudioEnabled ? 'ENABLED' : 'DISABLED'}`;
    if (audioIconEl) audioIconEl.textContent = isAudioEnabled ? '🔔' : '🔇';
    if (endRingtoneStatus) endRingtoneStatus.textContent = customEndAudio ? 'Custom Phone Ringtone Loaded ✓' : 'Default Chime Active';
    if (startRingtoneStatus) startRingtoneStatus.textContent = customStartAudio ? 'Custom Phone Ringtone Loaded ✓' : 'Default Chime Active';
  }

  function initAudioControls() {
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        if (audioModal) audioModal.classList.add('active');
        else {
          isAudioEnabled = !isAudioEnabled;
          localStorage.setItem('schedule_audio_enabled', isAudioEnabled);
          updateSoundUI();
        }
      });
    }
    if (closeAudioModalBtn) closeAudioModalBtn.addEventListener('click', () => audioModal.classList.remove('active'));

    updateSoundUI();

    if (toggleSoundStateBtn) {
      toggleSoundStateBtn.addEventListener('click', () => {
        isAudioEnabled = !isAudioEnabled;
        localStorage.setItem('schedule_audio_enabled', isAudioEnabled);
        updateSoundUI();
      });
    }

    if (endRingtoneInput) endRingtoneInput.addEventListener('change', (e) => handleRingtoneUpload(e, 'end'));
    if (startRingtoneInput) startRingtoneInput.addEventListener('change', (e) => handleRingtoneUpload(e, 'start'));

    if (testAudioBtn) {
      testAudioBtn.addEventListener('click', () => {
        playRingtone('end');
        setTimeout(() => playRingtone('start'), 1500);
      });
    }
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
          localStorage.setItem('custom_end_ringtone_name', file.name);
        } else {
          customStartAudio = base64Audio;
          localStorage.setItem('custom_start_ringtone', base64Audio);
          localStorage.setItem('custom_start_ringtone_name', file.name);
        }
        updateSoundUI();
      };
      reader.readAsDataURL(file);
    }
  }

  function updateSoundUI() {
    if (toggleSoundStateBtn) toggleSoundStateBtn.textContent = `Sound: ${isAudioEnabled ? 'ENABLED' : 'DISABLED'}`;
    if (audioIconEl) audioIconEl.textContent = isAudioEnabled ? '🔔' : '🔇';
    
    const endName = localStorage.getItem('custom_end_ringtone_name');
    const startName = localStorage.getItem('custom_start_ringtone_name');

    if (endRingtoneStatus) {
      endRingtoneStatus.textContent = customEndAudio 
        ? `🎵 Loaded: ${endName || 'Custom Ringtone'}` 
        : '✨ Default Chime Active';
    }
    
    if (startRingtoneStatus) {
      startRingtoneStatus.textContent = customStartAudio 
        ? `🎶 Loaded: ${startName || 'Custom Ringtone'}` 
        : '✨ Default Chime Active';
    }
  }

  /* ------------------- TIMELINE & TABS ------------------- */
  function renderTimeline(dayKey) {
    if (!timelineListEl) return;
    const tasks = userScheduleData[dayKey] || [];
    if (timelineTitleEl) timelineTitleEl.textContent = `${capitalize(dayKey)} Routine`;
    if (taskCountEl) taskCountEl.textContent = `${tasks.length} Tasks`;
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

      const doneBtn = card.querySelector('.btn-done');
      const missedBtn = card.querySelector('.btn-missed');
      const deleteBtn = card.querySelector('.btn-delete');

      if (doneBtn) doneBtn.addEventListener('click', () => setTaskStatus(task.id, 'completed', dayKey));
      if (missedBtn) missedBtn.addEventListener('click', () => setTaskStatus(task.id, 'incomplete', dayKey));
      if (deleteBtn) deleteBtn.addEventListener('click', () => deleteTask(dayKey, task.id));

      timelineListEl.appendChild(card);
    });

    if (statDoneCountEl) statDoneCountEl.textContent = done;
    if (statMissedCountEl) statMissedCountEl.textContent = missed;
    if (statPendingCountEl) statPendingCountEl.textContent = pending;
  }

  function initTabs() {
    dayTabs.forEach(tab => {
      const tabDay = tab.getAttribute('data-day');
      if (tabDay === selectedDay) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }

      tab.addEventListener('click', () => {
        dayTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedDay = tabDay;
        renderTimeline(selectedDay);
      });
    });
  }

  function initTaskModal() {
    if (openAddTaskBtn) {
      openAddTaskBtn.addEventListener('click', () => {
        const daySelect = getEl('task-day');
        if (daySelect) daySelect.value = selectedDay;
        if (taskModal) taskModal.classList.add('active');
      });
    }

    if (closeTaskModalBtn) {
      closeTaskModalBtn.addEventListener('click', () => {
        if (taskModal) taskModal.classList.remove('active');
      });
    }

    if (taskForm) {
      taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const day = getEl('task-day') ? getEl('task-day').value : selectedDay;
        const newTask = {
          id: `custom-${Date.now()}`,
          start: getEl('task-start').value,
          end: getEl('task-end').value,
          title: getEl('task-title').value,
          category: getEl('task-category').value,
          icon: getEl('task-icon').value || '⚡',
          desc: getEl('task-desc').value || 'User Custom Task'
        };

        if (!userScheduleData[day]) userScheduleData[day] = [];
        userScheduleData[day].push(newTask);
        userScheduleData[day].sort((a, b) => timeToSeconds(a.start) - timeToSeconds(b.start));

        saveUserSchedule();
        taskForm.reset();
        if (taskModal) taskModal.classList.remove('active');
      });
    }
  }

  function deleteTask(dayKey, taskId) {
    if (userScheduleData[dayKey]) {
      userScheduleData[dayKey] = userScheduleData[dayKey].filter(t => t.id !== taskId);
      saveUserSchedule();
    }
  }

  function initHistoryModal() {
    if (historyBtn) {
      historyBtn.addEventListener('click', () => {
        const today = getLocalDateStr();
        if (historyDatePicker) historyDatePicker.value = today;
        renderHistoryView(today);
        if (historyModal) historyModal.classList.add('active');
      });
    }
    if (closeHistoryBtn) {
      closeHistoryBtn.addEventListener('click', () => {
        if (historyModal) historyModal.classList.remove('active');
      });
    }
    if (historyDatePicker) {
      historyDatePicker.addEventListener('change', (e) => renderHistoryView(e.target.value));
    }
  }

  function renderHistoryView(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayKey = DAYS_MAP[dateObj.getDay()];
    const tasks = userScheduleData[dayKey] || [];
    let done = 0, missed = 0, pending = 0;

    const rows = tasks.map(t => {
      const status = getTaskStatus(t.id, dateStr);
      if (status === 'completed') done++;
      else if (status === 'incomplete') missed++;
      else pending++;
      return `<div class="task-card"><div class="task-title">${t.title} (${status.toUpperCase()})</div></div>`;
    });

    if (historyStatsCard) historyStatsCard.innerHTML = `<div>Done: ${done}</div><div>Missed: ${missed}</div><div>Pending: ${pending}</div>`;
    if (historyTaskList) historyTaskList.innerHTML = rows.join('');
  }

  function getTaskStatus(taskId, dateStr) { return localStorage.getItem(`status_${dateStr}_${taskId}`) || 'pending'; }
  function setTaskStatus(taskId, status, dayKey) {
    const dateStr = getDateStrForDayTab(dayKey);
    const curr = getTaskStatus(taskId, dateStr);
    if (curr === status) localStorage.removeItem(`status_${dateStr}_${taskId}`);
    else localStorage.setItem(`status_${dateStr}_${taskId}`, status);
    renderTimeline(dayKey);
  }

  function timeToSeconds(str) {
    if (!str) return 0;
    const [h, m] = str.split(':').map(Number);
    return h * 3600 + m * 60;
  }

  function format12Hour(str) {
    if (!str) return '--:--';
    let [h, m] = str.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function formatCountdown(sec) {
    if (sec <= 0) return '00h 00m 00s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  function capitalize(str) { if (!str) return ''; return str.charAt(0).toUpperCase() + str.slice(1); }

  // Start Engine Loops & Listeners
  updateEngine();
  setInterval(updateEngine, 1000);
  initAudioControls();
  initTabs();
  initTaskModal();
  initHistoryModal();
  renderTimeline(selectedDay);
});
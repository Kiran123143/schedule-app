/**
 * Mobile Schedule Companion - App Engine with Interactive Status Tracking & LocalStorage
 */

document.addEventListener('DOMContentLoaded', () => {
  const DAYS_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let selectedDay = getCurrentDayKey();
  
  // DOM Elements
  const liveClockEl = document.getElementById('live-clock');
  const currentDayNameEl = document.getElementById('current-day-name');
  
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

  // Initialize App
  initTabs();
  renderTimeline(selectedDay);
  updateEngine();
  setInterval(updateEngine, 1000);

  function getCurrentDayKey() {
    const dayIndex = new Date().getDay();
    return DAYS_MAP[dayIndex];
  }

  function getStorageKey(taskId) {
    // Unique key based on today's date & task ID
    const todayStr = new Date().toISOString().split('T')[0];
    return `task_status_${todayStr}_${taskId}`;
  }

  function getTaskStatus(taskId) {
    return localStorage.getItem(getStorageKey(taskId)) || 'pending';
  }

  function setTaskStatus(taskId, status) {
    const currentStatus = getTaskStatus(taskId);
    if (currentStatus === status) {
      // Toggle back to pending if clicked again
      localStorage.removeItem(getStorageKey(taskId));
    } else {
      localStorage.setItem(getStorageKey(taskId), status);
    }
    renderTimeline(selectedDay);
  }

  function initTabs() {
    dayTabs.forEach(tab => {
      const dayKey = tab.getAttribute('data-day');
      if (dayKey === selectedDay) {
        tab.classList.add('active');
      }

      tab.addEventListener('click', () => {
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
    
    // Update Header Clock
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    liveClockEl.textContent = `${hours}:${minutes}:${seconds}`;
    currentDayNameEl.textContent = currentDayKey.toUpperCase();

    // Calculate current seconds from midnight
    const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    // Get today's schedule
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

    // Refresh active highlights if viewing today's tab
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

      // Event listeners for action buttons
      const btnDone = card.querySelector('.btn-done');
      const btnMissed = card.querySelector('.btn-missed');

      btnDone.addEventListener('click', (e) => {
        e.stopPropagation();
        setTaskStatus(task.id, 'completed');
      });

      btnMissed.addEventListener('click', (e) => {
        e.stopPropagation();
        setTaskStatus(task.id, 'incomplete');
      });

      timelineListEl.appendChild(card);
    });

    // Update Daily Stats Counter
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

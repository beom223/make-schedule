// LocalStorage 데이터 관리
function getDefaultTasks() {
  const data = localStorage.getItem('routine_default_tasks');
  return data ? JSON.parse(data) : [];
}

function saveDefaultTasks(tasks) {
  localStorage.setItem('routine_default_tasks', JSON.stringify(tasks));
}

function getSpecialTasksMap() {
  const data = localStorage.getItem('routine_special_tasks');
  return data ? JSON.parse(data) : {};
}

function saveSpecialTasksMap(map) {
  localStorage.setItem('routine_special_tasks', JSON.stringify(map));
}

// 다채롭고 조화로운 조화 색상 생성 알고리즘 (황금비 Angle 137.5도 활용)
function getHarmoniousColor(index, isOverride = false) {
  const hue = (index * 137.5) % 360; // 각 일정이 서로 겹치지 않고 조화롭게 퍼지는 Hue값
  if (isOverride) {
    // 특정 날짜 우선 일정은 선명도를 조금 더 높여 강조
    return `hsl(${hue}, 80%, 50%)`;
  }
  // 일반 반복 일정은 따뜻하고 조화로운 파스텔/세미비비드 톤
  return `hsl(${hue}, 65%, 52%)`;
}

// 시간 중복 확인 (자정 넘김 지원)
function checkOverlap(taskA, taskB) {
  const toMin = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  let startA = toMin(taskA.startTime);
  let endA = toMin(taskA.endTime);
  if (endA <= startA) endA += 1440;

  let startB = toMin(taskB.startTime);
  let endB = toMin(taskB.endTime);
  if (endB <= startB) endB += 1440;

  return Math.max(startA, startB) < Math.min(endA, endB);
}

// 특정 날짜(YYYY-MM-DD)의 최종 일정 계산 (우선순위 적용)
function getEffectiveTasksForDate(dateStr) {
  const defaults = getDefaultTasks();
  const specialMap = getSpecialTasksMap();
  const specials = specialMap[dateStr] || [];

  if (specials.length === 0) {
    return defaults.map(t => ({ ...t, isOverride: false }));
  }

  const filteredDefaults = defaults.filter(defTask => {
    return !specials.some(specTask => checkOverlap(defTask, specTask));
  }).map(t => ({ ...t, isOverride: false }));

  const markedSpecials = specials.map(t => ({ ...t, isOverride: true }));

  return [...filteredDefaults, ...markedSpecials];
}

// 애플리케이션 상태
let selectedDate = new Date();
let activeScreen = 0; // 0: 시계, 1: 달력
let currentInputMode = 'circle';
let selectedStartHour = 22;
let selectedEndHour = 6;
let activeTarget = 'start';

// DOM 요소
const sliderWrapper = document.getElementById('slider-wrapper');
const navTimelineBtn = document.getElementById('nav-timeline-btn');
const navCalendarBtn = document.getElementById('nav-calendar-btn');

const currentDateDisplay = document.getElementById('current-date-display');
const clockEl = document.getElementById('realtime-clock');
const activeTaskText = document.getElementById('active-task-text');
const taskListEl = document.getElementById('task-list');
const svgCircle = document.getElementById('circle-timeline-svg');

const calMonthTitle = document.getElementById('cal-month-title');
const calDaysGrid = document.getElementById('calendar-days-grid');
const calPrevBtn = document.getElementById('cal-prev-btn');
const calNextBtn = document.getElementById('cal-next-btn');
const summaryDateTitle = document.getElementById('summary-date-title');
const calendarTaskSummary = document.getElementById('calendar-task-summary');

const modal = document.getElementById('task-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const calAddTaskBtn = document.getElementById('cal-add-task-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const taskForm = document.getElementById('task-form');

const scheduleTypeRadios = document.querySelectorAll('input[name="scheduleType"]');
const targetDateGroup = document.getElementById('target-date-group');
const taskTargetDateInput = document.getElementById('task-target-date');
const selectedDateNotice = document.getElementById('selected-date-notice');

const tabCircleMode = document.getElementById('tab-circle-mode');
const tabDirectMode = document.getElementById('tab-direct-mode');
const circleInputSection = document.getElementById('circle-input-section');
const directInputSection = document.getElementById('direct-input-section');

const btnSelectStart = document.getElementById('btn-select-start');
const btnSelectEnd = document.getElementById('btn-select-end');
const startTimeText = document.getElementById('start-time-text');
const endTimeText = document.getElementById('end-time-text');
const pickerGuideText = document.getElementById('picker-guide-text');
const pickerSvg = document.getElementById('picker-circle-svg');

const directStartTime = document.getElementById('direct-start-time');
const directEndTime = document.getElementById('direct-end-time');

// 날짜 포맷
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateHeader(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} (${days[date.getDay()]})`;
}

// 화면 전환
function switchScreen(screenIndex) {
  activeScreen = screenIndex;
  sliderWrapper.style.transform = `translateX(-${screenIndex * 50}%)`;
  if (screenIndex === 0) {
    navTimelineBtn.classList.add('active');
    navCalendarBtn.classList.remove('active');
    renderRoutine();
  } else {
    navCalendarBtn.classList.add('active');
    navTimelineBtn.classList.remove('active');
    renderCalendar();
  }
}

navTimelineBtn.addEventListener('click', () => switchScreen(0));
navCalendarBtn.addEventListener('click', () => switchScreen(1));

// 좌우 스와이프
let touchStartX = 0;
let touchEndX = 0;

sliderWrapper.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

sliderWrapper.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}, { passive: true });

function handleSwipe() {
  const diffX = touchEndX - touchStartX;
  if (diffX < -60 && activeScreen === 0) switchScreen(1);
  else if (diffX > 60 && activeScreen === 1) switchScreen(0);
}

// SVG Arc 그리기
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

function describeArc(x, y, radius, startAngle, endAngle) {
  if (endAngle <= startAngle) endAngle += 360;
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = (endAngle - startAngle) > 180 ? "1" : "0";

  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
}

// 실시간 시계 & 진행 중 일정
function updateClock() {
  const now = new Date();
  clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dateKey = formatDateKey(selectedDate);
  const tasks = getEffectiveTasksForDate(dateKey);

  const active = tasks.find(t => {
    const [sh, sm] = t.startTime.split(':').map(Number);
    const [eh, em] = t.endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (startMin > endMin) {
      return currentMinutes >= startMin || currentMinutes < endMin;
    } else {
      return currentMinutes >= startMin && currentMinutes < endMin;
    }
  });

  if (active) {
    activeTaskText.textContent = `${active.isOverride ? '[우선] ' : ''}${active.title} (${active.startTime} ~ ${active.endTime})`;
  } else {
    activeTaskText.textContent = '현재 예정된 일정이 없습니다.';
  }

  renderMainCircle(tasks, now);
}

// 시계 원판 그리기 (각 일정별 다른 색상 적용)
function renderMainCircle(tasks, now = new Date()) {
  svgCircle.innerHTML = '';
  const cx = 150, cy = 150, r = 105;

  // 배경 베이스 원
  const baseCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  baseCircle.setAttribute('cx', cx);
  baseCircle.setAttribute('cy', cy);
  baseCircle.setAttribute('r', r);
  baseCircle.setAttribute('fill', 'none');
  baseCircle.setAttribute('stroke', '#f1f5f9');
  baseCircle.setAttribute('stroke-width', '18');
  svgCircle.appendChild(baseCircle);

  // 각 일정별 고유 조화 색상 부여
  tasks.forEach((task, index) => {
    const [sh, sm] = task.startTime.split(':').map(Number);
    const [eh, em] = task.endTime.split(':').map(Number);

    const startAngle = (sh + sm / 60) * 15;
    const endAngle = (eh + em / 60) * 15;

    const taskColor = getHarmoniousColor(index, task.isOverride);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', describeArc(cx, cy, r, startAngle, endAngle));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', taskColor);
    path.setAttribute('stroke-width', '18');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('opacity', '0.9');
    svgCircle.appendChild(path);
  });

  // 눈금 및 숫자
  for (let i = 0; i < 24; i++) {
    const angle = (i * 15 - 90) * (Math.PI / 180);
    const isMajor = i % 3 === 0;

    const x1 = cx + (r - (isMajor ? 12 : 8)) * Math.cos(angle);
    const y1 = cy + (r - (isMajor ? 12 : 8)) * Math.sin(angle);
    const x2 = cx + (r + 8) * Math.cos(angle);
    const y2 = cy + (r + 8) * Math.sin(angle);

    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', x1);
    tick.setAttribute('y1', y1);
    tick.setAttribute('x2', x2);
    tick.setAttribute('y2', y2);
    tick.setAttribute('stroke', isMajor ? '#94a3b8' : '#cbd5e1');
    tick.setAttribute('stroke-width', isMajor ? '2' : '1');
    svgCircle.appendChild(tick);

    if (isMajor) {
      const tx = cx + (r - 22) * Math.cos(angle);
      const ty = cy + (r - 22) * Math.sin(angle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', tx);
      text.setAttribute('y', ty + 3.5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '9.5');
      text.setAttribute('font-weight', '700');
      text.setAttribute('fill', '#64748b');
      text.textContent = i;
      svgCircle.appendChild(text);
    }
  }

  // 시침 & 분침
  const currentHourDec = now.getHours() + now.getMinutes() / 60;
  const hourAngle = (currentHourDec * 15 - 90) * (Math.PI / 180);
  const minAngle = (now.getMinutes() * 6 - 90) * (Math.PI / 180);

  const hx = cx + (r - 18) * Math.cos(hourAngle);
  const hy = cy + (r - 18) * Math.sin(hourAngle);
  const hourHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hourHand.setAttribute('x1', cx);
  hourHand.setAttribute('y1', cy);
  hourHand.setAttribute('x2', hx);
  hourHand.setAttribute('y2', hy);
  hourHand.setAttribute('stroke', '#1e293b');
  hourHand.setAttribute('stroke-width', '4');
  hourHand.setAttribute('stroke-linecap', 'round');
  svgCircle.appendChild(hourHand);

  const mx = cx + (r - 6) * Math.cos(minAngle);
  const my = cy + (r - 6) * Math.sin(minAngle);
  const minuteHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  minuteHand.setAttribute('x1', cx);
  minuteHand.setAttribute('y1', cy);
  minuteHand.setAttribute('x2', mx);
  minuteHand.setAttribute('y2', my);
  minuteHand.setAttribute('stroke', '#e53e3e');
  minuteHand.setAttribute('stroke-width', '2');
  minuteHand.setAttribute('stroke-linecap', 'round');
  svgCircle.appendChild(minuteHand);

  const centerPin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  centerPin.setAttribute('cx', cx);
  centerPin.setAttribute('cy', cy);
  centerPin.setAttribute('r', '5');
  centerPin.setAttribute('fill', '#e53e3e');
  svgCircle.appendChild(centerPin);
}

// 일정 목록 표시 (시계 색상과 동일하게 적용)
function renderRoutine() {
  currentDateDisplay.textContent = formatDateHeader(selectedDate);
  const tasks = getEffectiveTasksForDate(formatDateKey(selectedDate));
  tasks.sort((a, b) => a.startTime.localeCompare(b.startTime));

  taskListEl.innerHTML = '';
  if (tasks.length === 0) {
    taskListEl.innerHTML = '<li style="text-align:center; color:#94a3b8; padding:16px; font-size:0.85rem;">등록된 일정이 없습니다.</li>';
    return;
  }

  tasks.forEach((task, index) => {
    const isOvernight = task.startTime > task.endTime;
    const taskColor = getHarmoniousColor(index, task.isOverride);

    const li = document.createElement('li');
    li.className = 'task-item';
    li.style.borderLeftColor = taskColor;

    li.innerHTML = `
      <div>
        ${task.isOverride ? '<span class="badge-override">특정일 우선</span>' : ''}
        <strong style="font-size:0.85rem; color:${taskColor};">
          ${task.startTime} ~ ${task.endTime} ${isOvernight ? '<span style="color:#e53e3e; font-size:0.75rem;">(+1일)</span>' : ''}
        </strong>
        <span style="font-size:0.9rem; margin-left:6px; font-weight:600; color:#1e293b;">${task.title}</span>
      </div>
      <button data-id="${task.id}" data-override="${task.isOverride}" class="delete-btn" style="background:none; border:none; color:#e53e3e; cursor:pointer; font-size:1.2rem; font-weight:bold;">&times;</button>
    `;
    taskListEl.appendChild(li);
  });
}

// 일정 삭제
taskListEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    const isOverride = e.target.dataset.override === 'true';
    const dateKey = formatDateKey(selectedDate);

    if (isOverride) {
      const specialMap = getSpecialTasksMap();
      if (specialMap[dateKey]) {
        specialMap[dateKey] = specialMap[dateKey].filter(t => t.id !== id);
        if (specialMap[dateKey].length === 0) delete specialMap[dateKey];
        saveSpecialTasksMap(specialMap);
      }
    } else {
      let defaults = getDefaultTasks().filter(t => t.id !== id);
      saveDefaultTasks(defaults);
    }

    renderRoutine();
    updateClock();
    renderCalendar();
  }
});

// 달력 그리기 (날짜 클릭 시 화면 전환 없이 요약 및 내역만 갱신)
let calDisplayDate = new Date();

function renderCalendar() {
  const year = calDisplayDate.getFullYear();
  const month = calDisplayDate.getMonth();

  calMonthTitle.textContent = `${year}년 ${month + 1}월`;
  calDaysGrid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const prevLastDate = new Date(year, month, 0).getDate();

  const specialMap = getSpecialTasksMap();
  const defaultTasks = getDefaultTasks();

  // 지난달
  for (let i = firstDay - 1; i >= 0; i--) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'cal-day-cell other-month';
    dayDiv.textContent = prevLastDate - i;
    calDaysGrid.appendChild(dayDiv);
  }

  // 이번달
  const todayKey = formatDateKey(new Date());
  const selectedKey = formatDateKey(selectedDate);

  for (let date = 1; date <= lastDate; date++) {
    const dayDiv = document.createElement('div');
    const cellDateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    
    dayDiv.className = 'cal-day-cell';
    if (cellDateKey === todayKey) dayDiv.classList.add('today');
    if (cellDateKey === selectedKey) dayDiv.classList.add('selected');

    dayDiv.textContent = date;

    const hasSpecials = specialMap[cellDateKey] && specialMap[cellDateKey].length > 0;
    const hasDefaults = defaultTasks.length > 0;

    if (hasSpecials || hasDefaults) {
      const dot = document.createElement('div');
      dot.className = `has-task-dot ${hasSpecials ? 'has-override-dot' : ''}`;
      dayDiv.appendChild(dot);
    }

    // 날짜 클릭 시 페이지 전환 없이 날짜 선택만 반영
    dayDiv.addEventListener('click', () => {
      selectedDate = new Date(year, month, date);
      renderCalendar();
      renderSummary();
      renderRoutine();
      updateClock();
    });

    calDaysGrid.appendChild(dayDiv);
  }

  renderSummary();
}

calPrevBtn.addEventListener('click', () => {
  calDisplayDate.setMonth(calDisplayDate.getMonth() - 1);
  renderCalendar();
});

calNextBtn.addEventListener('click', () => {
  calDisplayDate.setMonth(calDisplayDate.getMonth() + 1);
  renderCalendar();
});

function renderSummary() {
  const dateKey = formatDateKey(selectedDate);
  summaryDateTitle.textContent = `${formatDateHeader(selectedDate)} 일정`;
  const tasks = getEffectiveTasksForDate(dateKey);
  tasks.sort((a, b) => a.startTime.localeCompare(b.startTime));

  calendarTaskSummary.innerHTML = '';
  if (tasks.length === 0) {
    calendarTaskSummary.innerHTML = '<li style="font-size:0.8rem; color:#94a3b8;">일정이 없습니다.</li>';
    return;
  }

  tasks.forEach((t, index) => {
    const taskColor = getHarmoniousColor(index, t.isOverride);
    const li = document.createElement('li');
    li.style.fontSize = '0.85rem';
    li.style.color = '#2d3748';
    li.innerHTML = `
      ${t.isOverride ? '<span class="badge-override">우선</span>' : ''}
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${taskColor}; margin-right:4px;"></span>
      <strong>${t.startTime}~${t.endTime}</strong>: ${t.title}
    `;
    calendarTaskSummary.appendChild(li);
  });
}

// 모달 관리
scheduleTypeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'special') {
      targetDateGroup.style.display = 'block';
    } else {
      targetDateGroup.style.display = 'none';
    }
  });
});

tabCircleMode.addEventListener('click', () => {
  currentInputMode = 'circle';
  tabCircleMode.classList.add('active');
  tabDirectMode.classList.remove('active');
  circleInputSection.classList.remove('hidden');
  directInputSection.classList.add('hidden');
});

tabDirectMode.addEventListener('click', () => {
  currentInputMode = 'direct';
  tabDirectMode.classList.add('active');
  tabCircleMode.classList.remove('active');
  directInputSection.classList.remove('hidden');
  circleInputSection.classList.add('hidden');
});

function renderPickerCircle() {
  pickerSvg.innerHTML = '';
  const cx = 150, cy = 150, r = 95;

  const baseCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  baseCircle.setAttribute('cx', cx);
  baseCircle.setAttribute('cy', cy);
  baseCircle.setAttribute('r', r);
  baseCircle.setAttribute('fill', 'none');
  baseCircle.setAttribute('stroke', '#e2e8f0');
  baseCircle.setAttribute('stroke-width', '24');
  pickerSvg.appendChild(baseCircle);

  const startAngle = selectedStartHour * 15;
  const endAngle = selectedEndHour * 15;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', describeArc(cx, cy, r, startAngle, endAngle));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#3182ce');
  path.setAttribute('stroke-width', '24');
  path.setAttribute('stroke-linecap', 'round');
  pickerSvg.appendChild(path);

  for (let i = 0; i < 24; i++) {
    const angle = (i * 15 - 90) * (Math.PI / 180);
    const tx = cx + r * Math.cos(angle);
    const ty = cy + r * Math.sin(angle);

    let isSelected = false;
    if (selectedStartHour <= selectedEndHour) {
      isSelected = (i >= selectedStartHour && i < selectedEndHour);
    } else {
      isSelected = (i >= selectedStartHour || i < selectedEndHour);
    }

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', tx);
    text.setAttribute('y', ty + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', isSelected ? '#ffffff' : '#475569');
    text.textContent = i;
    pickerSvg.appendChild(text);
  }
}

btnSelectStart.addEventListener('click', () => {
  activeTarget = 'start';
  btnSelectStart.classList.add('active');
  btnSelectEnd.classList.remove('active');
  pickerGuideText.textContent = '원판에서 시작 시간을 터치하세요';
});

btnSelectEnd.addEventListener('click', () => {
  activeTarget = 'end';
  btnSelectEnd.classList.add('active');
  btnSelectStart.classList.remove('active');
  pickerGuideText.textContent = '원판에서 종료 시간을 터치하세요';
});

pickerSvg.addEventListener('click', (e) => {
  const rect = pickerSvg.getBoundingClientRect();
  const x = e.clientX - rect.left - rect.width / 2;
  const y = e.clientY - rect.top - rect.height / 2;

  let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
  if (angle < 0) angle += 360;

  const clickedHour = Math.floor(angle / 15) % 24;

  if (activeTarget === 'start') {
    selectedStartHour = clickedHour;
    btnSelectEnd.click();
  } else {
    selectedEndHour = clickedHour;
  }

  updateTimeText();
  renderPickerCircle();
});

function updateTimeText() {
  const sH = String(selectedStartHour).padStart(2, '0');
  const eH = String(selectedEndHour).padStart(2, '0');
  const isOvernight = selectedStartHour >= selectedEndHour;

  startTimeText.textContent = `${sH}:00`;
  endTimeText.textContent = `${eH}:00${isOvernight ? ' (+1일)' : ''}`;
}

function openModal() {
  modal.classList.remove('hidden');
  taskTargetDateInput.value = formatDateKey(selectedDate);
  selectedDateNotice.textContent = `${formatDateKey(selectedDate)}에만 기본 루틴보다 우선 적용됩니다.`;
  tabCircleMode.click();
  btnSelectStart.click();
  updateTimeText();
  renderPickerCircle();
}

openModalBtn.addEventListener('click', openModal);
calAddTaskBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

// 일정 저장
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('task-title').value;
  const scheduleType = document.querySelector('input[name="scheduleType"]:checked').value;

  let startTime, endTime;
  if (currentInputMode === 'circle') {
    startTime = `${String(selectedStartHour).padStart(2, '0')}:00`;
    endTime = `${String(selectedEndHour).padStart(2, '0')}:00`;
  } else {
    startTime = directStartTime.value;
    endTime = directEndTime.value;
  }

  const newTask = {
    id: 'task_' + Date.now(),
    startTime,
    endTime,
    title
  };

  if (scheduleType === 'special') {
    const targetDateStr = taskTargetDateInput.value;
    const specialMap = getSpecialTasksMap();
    if (!specialMap[targetDateStr]) specialMap[targetDateStr] = [];
    specialMap[targetDateStr].push(newTask);
    saveSpecialTasksMap(specialMap);
  } else {
    const defaults = getDefaultTasks();
    defaults.push(newTask);
    saveDefaultTasks(defaults);
  }

  taskForm.reset();
  modal.classList.add('hidden');
  renderRoutine();
  updateClock();
  renderCalendar();
});

// 타이머 작동 및 초기화
setInterval(updateClock, 1000);
updateClock();
renderRoutine();
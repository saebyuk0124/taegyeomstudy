/* ============================================================
   출동! 태겸 대원의 미션 대작전
   모든 기록은 이 브라우저의 localStorage 에만 저장됩니다.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'taegyeom-mission-board-v1';
  var BOARD_SIZE = 30;

  var DAYS = [
    { key: 'mon', short: '월', name: '월요일' },
    { key: 'tue', short: '화', name: '화요일' },
    { key: 'wed', short: '수', name: '수요일' },
    { key: 'thu', short: '목', name: '목요일' },
    { key: 'fri', short: '금', name: '금요일' },
    { key: 'sat', short: '토', name: '토요일' },
    { key: 'sun', short: '일', name: '일요일' }
  ];

  /* ---------------- 작은 도우미 ---------------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* 월요일 = 0 … 일요일 = 6 */
  function weekdayIndex(d) {
    d = d || new Date();
    return (d.getDay() + 6) % 7;
  }

  function shortDate(key) {
    var p = String(key).split('-');
    return Number(p[1] || 0) + '/' + Number(p[2] || 0);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clampSteps(v) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) return 1;
    return Math.min(5, Math.max(1, n));
  }

  var idSeed = 0;
  function uid() {
    idSeed += 1;
    return 'm' + Date.now().toString(36) + idSeed.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  function makeMission(label, steps) {
    return { id: uid(), label: String(label || ''), steps: clampSteps(steps || 1) };
  }

  /* ---------------- 기본값 ---------------- */
  function defaultState() {
    return {
      version: 1,
      title: '출동! 태겸 대원의 미션 대작전',
      reward: '다이소 가서 원하는 거 고르기',
      missions: {
        mon: [makeMission('퍼플'), makeMission('눈높이한글'), makeMission('눈높이수학'), makeMission('책읽기')],
        tue: [makeMission('퍼플'), makeMission('눈높이한글'), makeMission('눈높이수학'), makeMission('책읽기')],
        wed: [makeMission('퍼플'), makeMission('한자')],
        thu: [makeMission('퍼플'), makeMission('파닉스'), makeMission('유아독해')],
        fri: [makeMission('퍼플'), makeMission('파닉스'), makeMission('유아독해')],
        sat: [makeMission('주중에 못한것')],
        sun: []
      },
      progress: { date: '', done: {} },
      stamps: [],       /* [{ date: 'YYYY-MM-DD' }] */
      boards: 0,        /* 달성한 판 수 */
      lastStamp: '',    /* 마지막으로 도장 찍은 날짜 */
      celebrate: false  /* 30개 완성 축하 대기 */
    };
  }

  /* ---------------- 저장 / 불러오기 ---------------- */
  var storageBroken = false;
  var state = loadState();

  function loadState() {
    var raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      storageBroken = true;
    }
    if (!raw) return defaultState();
    try {
      return normalize(JSON.parse(raw));
    } catch (e) {
      return defaultState();
    }
  }

  function normalize(raw) {
    var base = defaultState();
    if (!raw || typeof raw !== 'object') return base;

    if (typeof raw.title === 'string' && raw.title.trim()) base.title = raw.title.trim().slice(0, 40);
    if (typeof raw.reward === 'string' && raw.reward.trim()) base.reward = raw.reward.trim().slice(0, 40);

    if (raw.missions && typeof raw.missions === 'object') {
      DAYS.forEach(function (d) {
        var list = raw.missions[d.key];
        if (!Array.isArray(list)) return;
        base.missions[d.key] = list.map(function (m) {
          if (!m || typeof m !== 'object') return null;
          return {
            id: String(m.id || uid()),
            label: String(m.label == null ? '' : m.label).slice(0, 30),
            steps: clampSteps(m.steps)
          };
        }).filter(Boolean);
      });
    }

    if (raw.progress && typeof raw.progress === 'object') {
      var done = {};
      var src = raw.progress.done;
      if (src && typeof src === 'object') {
        Object.keys(src).forEach(function (id) {
          var v = Math.round(Number(src[id]));
          if (isFinite(v) && v > 0) done[id] = Math.min(5, v);
        });
      }
      base.progress = {
        date: typeof raw.progress.date === 'string' ? raw.progress.date : '',
        done: done
      };
    }

    if (Array.isArray(raw.stamps)) {
      base.stamps = raw.stamps
        .filter(function (s) { return s && typeof s === 'object' && typeof s.date === 'string'; })
        .slice(0, BOARD_SIZE)
        .map(function (s) { return { date: s.date }; });
    }

    var b = Math.round(Number(raw.boards));
    base.boards = isFinite(b) && b > 0 ? b : 0;
    if (typeof raw.lastStamp === 'string') base.lastStamp = raw.lastStamp;
    base.celebrate = raw.celebrate === true;
    return base;
  }

  function save() {
    if (storageBroken) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      storageBroken = true;
      toast('저장 공간을 쓸 수 없어요. 브라우저 설정을 확인해 주세요.');
    }
  }

  /* 매일 처음 열면 오늘 미션 체크는 새로 시작 */
  function syncToday() {
    var t = todayKey();
    if (!state.progress || state.progress.date !== t) {
      state.progress = { date: t, done: {} };
      save();
    }
  }

  /* ---------------- 상태 읽기 ---------------- */
  var viewDay = weekdayIndex();     /* 지금 보고 있는 요일 */

  function isTodayView() { return viewDay === weekdayIndex(); }
  function dayKeyOf(i) { return DAYS[i].key; }
  function missionsOf(i) { return state.missions[dayKeyOf(i)] || []; }
  function doneSteps(id) {
    if (!state.progress || state.progress.date !== todayKey()) return 0;
    return Number(state.progress.done[id] || 0);
  }
  function isMissionDone(m) { return doneSteps(m.id) >= m.steps; }

  function todayStats() {
    var list = missionsOf(weekdayIndex());
    var done = list.filter(isMissionDone).length;
    return { total: list.length, done: done, all: list.length > 0 && done === list.length };
  }

  /* ---------------- 화면 그리기 ---------------- */
  var el = {};
  ['heroTitle', 'rewardText', 'goalFill', 'goalCount', 'dayTag', 'missionProgress', 'tabs',
    'previewNote', 'missionList', 'restCard', 'missionTip', 'stampBtn', 'stampBtnText',
    'stampHint', 'board', 'boardCount', 'trophy', 'boardReward', 'momBtn', 'settingsWrap',
    'gateBlock', 'gateQuestion', 'gateForm', 'gateInput', 'gateHint', 'settingsBody',
    'rewardInput', 'titleInput', 'editDays', 'editList', 'addMission', 'manualMinus',
    'manualPlus', 'manualCount', 'resetBtn', 'backupBox', 'exportBtn', 'importBtn',
    'celebrateWrap', 'celebrateTitle', 'celebrateLine', 'celebrateReward', 'celebrateBtn',
    'toast'
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  var justStamped = false;

  function render() {
    renderHead();
    renderTabs();
    renderMissions();
    renderStamp();
    renderBoard();
  }

  function renderHead() {
    el.heroTitle.textContent = state.title;
    el.rewardText.textContent = state.reward;
    el.boardReward.textContent = state.reward;
    var n = state.stamps.length;
    el.goalCount.textContent = n + ' / ' + BOARD_SIZE;
    el.goalFill.style.width = (n / BOARD_SIZE * 100) + '%';
    el.boardCount.textContent = n + ' / ' + BOARD_SIZE;
    el.trophy.textContent = '🏆 달성한 판 ' + state.boards + '개';
    document.title = state.title + ' 🐾';
  }

  function renderTabs() {
    var todayIdx = weekdayIndex();
    el.tabs.innerHTML = DAYS.map(function (d, i) {
      var isRest = (state.missions[d.key] || []).length === 0;
      var cls = 'tab';
      if (i === todayIdx) cls += ' is-today';
      if (i === viewDay) cls += ' is-active';
      if (isRest) cls += ' is-rest';
      return '<button type="button" class="' + cls + '" role="tab" data-day="' + i + '"' +
        ' aria-selected="' + (i === viewDay) + '" aria-label="' + d.name + (isRest ? ' (쉬는 날)' : '') + ' 미션 보기">' +
        '<span>' + d.short + '</span>' +
        '</button>';
    }).join('');
  }

  function renderMissions() {
    var list = missionsOf(viewDay);
    var today = isTodayView();
    var stats = todayStats();

    el.dayTag.textContent = ' · ' + DAYS[viewDay].name;
    el.missionProgress.textContent = today
      ? stats.done + ' / ' + stats.total
      : list.length + '개';

    if (today) {
      el.previewNote.hidden = true;
    } else {
      el.previewNote.hidden = false;
      el.previewNote.textContent = '👀 ' + DAYS[viewDay].name + ' 미션 미리 보기예요. 체크는 오늘만 할 수 있어요.';
    }

    el.restCard.hidden = list.length > 0;
    el.missionTip.hidden = list.length === 0;

    el.missionList.innerHTML = list.map(function (m) {
      var cur = today ? doneSteps(m.id) : 0;
      var done = cur >= m.steps;
      var cls = 'mission';
      if (done && today) cls += ' is-done';
      if (!today) cls += ' is-locked';

      var steps = '';
      if (m.steps > 1) {
        var chips = '';
        for (var i = 1; i <= m.steps; i += 1) {
          chips += '<button type="button" class="step' + (today && cur >= i ? ' is-done' : '') +
            '" data-act="step" data-step="' + i + '"' + (today ? '' : ' disabled') +
            ' aria-pressed="' + (today && cur >= i) + '" aria-label="' + esc(m.label) + ' ' + i + '단계">' +
            i + '</button>';
        }
        steps = '<div class="steps">' + chips + '</div>';
      }

      var count = (m.steps > 1 && today) ? '<span class="mission-count">' + cur + '/' + m.steps + '</span>' : '';

      return '<li class="' + cls + '" data-id="' + esc(m.id) + '">' +
        '<button type="button" class="check" data-act="toggle"' + (today ? '' : ' disabled') +
        ' aria-pressed="' + (done && today) + '" aria-label="' + esc(m.label) + ' 완료">' +
        '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#paw" /></svg></button>' +
        '<div class="mission-main"><p class="mission-label">' + esc(m.label || '미션') + '</p>' + steps + '</div>' +
        count +
        '</li>';
    }).join('');
  }

  function renderStamp() {
    var today = isTodayView();
    var list = missionsOf(weekdayIndex());
    var stats = todayStats();
    var stampedToday = state.lastStamp === todayKey();
    var ready = today && !stampedToday && stats.all;

    el.stampBtn.disabled = !ready;
    el.stampBtn.classList.toggle('is-ready', ready);
    el.stampBtnText.textContent = stampedToday ? '오늘 발자국 완료!' : '발자국 스티커 받기!';

    var hint;
    if (!today) {
      hint = '다른 요일을 보고 있어요. 오늘 탭으로 돌아오면 스티커를 받을 수 있어요.';
    } else if (list.length === 0) {
      hint = '오늘은 쉬는 날이라 스티커가 필요 없어요 🌞';
    } else if (stampedToday) {
      hint = '오늘 발자국 스티커를 받았어요! 내일 또 만나요 🐾';
    } else if (stats.all) {
      hint = '준비 완료! 버튼을 눌러 발자국을 찍어요 🐾';
    } else {
      var left = stats.total - stats.done;
      hint = '미션이 ' + left + '개 남았어요. 다 하면 버튼이 켜져요!';
    }
    el.stampHint.textContent = hint;
  }

  function renderBoard() {
    var n = state.stamps.length;
    var out = '';
    for (var i = 0; i < BOARD_SIZE; i += 1) {
      var s = state.stamps[i];
      if (s) {
        var fresh = justStamped && i === n - 1 ? ' brand-new' : '';
        out += '<li class="slot stamped' + fresh + '">' +
          '<span class="slot-no">' + (i + 1) + '</span>' +
          '<svg class="slot-paw" viewBox="0 0 100 100" aria-hidden="true"><use href="#paw" /></svg>' +
          '<span class="slot-date">' + esc(shortDate(s.date)) + '</span>' +
          '<span class="sr-only">' + (i + 1) + '번 스티커, ' + esc(s.date) + ' 찍음</span>' +
          '</li>';
      } else {
        out += '<li class="slot"><span class="slot-no">' + (i + 1) + '</span></li>';
      }
    }
    el.board.innerHTML = out;
    justStamped = false;
  }

  /* ---------------- 토스트 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.toast.classList.remove('show'); }, 2200);
  }

  /* ---------------- 미션 상호작용 ---------------- */
  el.missionList.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-act]');
    if (!btn || btn.disabled) return;
    var li = btn.closest('.mission');
    if (!li) return;
    var id = li.getAttribute('data-id');
    var list = missionsOf(weekdayIndex());
    var m = null;
    for (var i = 0; i < list.length; i += 1) { if (list[i].id === id) { m = list[i]; break; } }
    if (!m) return;
    if (!state.progress || state.progress.date !== todayKey()) {
      state.progress = { date: todayKey(), done: {} };
    }

    if (btn.getAttribute('data-act') === 'toggle') {
      if (doneSteps(m.id) >= m.steps) delete state.progress.done[m.id];
      else state.progress.done[m.id] = m.steps;
    } else {
      var step = Number(btn.getAttribute('data-step'));
      var cur = doneSteps(m.id);
      var next = cur >= step ? step - 1 : step;
      if (next <= 0) delete state.progress.done[m.id];
      else state.progress.done[m.id] = Math.min(m.steps, next);
    }
    save();
    render();
  });

  el.tabs.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.tab');
    if (!btn) return;
    viewDay = Number(btn.getAttribute('data-day'));
    render();
  });

  /* ---------------- 스티커 받기 ---------------- */
  el.stampBtn.addEventListener('click', function () {
    var t = todayKey();
    if (state.lastStamp === t) { toast('오늘은 이미 발자국을 찍었어요!'); return; }
    if (!todayStats().all) { toast('미션을 모두 완료해야 스티커를 받을 수 있어요.'); return; }
    if (state.stamps.length >= BOARD_SIZE) return;

    state.stamps.push({ date: t });
    state.lastStamp = t;
    justStamped = true;

    if (state.stamps.length >= BOARD_SIZE) {
      state.boards += 1;
      state.celebrate = true;
      save();
      render();
      showCelebration();
    } else {
      save();
      render();
      toast('발자국 스티커를 받았어요! 🐾');
    }
  });

  /* ---------------- 한 판 완성 축하 ---------------- */
  function showCelebration() {
    el.celebrateLine.textContent = state.boards + '번째 판을 가득 채웠어요. 정말 대단해요, 태겸 대원!';
    el.celebrateReward.textContent = state.reward;
    el.celebrateWrap.hidden = false;
  }

  el.celebrateBtn.addEventListener('click', function () {
    state.stamps = [];
    state.celebrate = false;
    state.lastStamp = todayKey();
    justStamped = false;
    save();
    render();
    el.celebrateWrap.hidden = true;
    toast('새 판이 시작됐어요! 🐾');
  });

  /* ---------------- 엄마 설정 ---------------- */
  var gateAnswer = 0;
  var editDay = weekdayIndex();

  function newGateQuestion() {
    var a = 2 + Math.floor(Math.random() * 8);
    var b = 1 + Math.floor(Math.random() * 9);
    gateAnswer = a + b;
    el.gateQuestion.textContent = a + ' + ' + b + ' = ?';
    el.gateInput.value = '';
    el.gateHint.textContent = '';
  }

  function openSettings() {
    el.settingsWrap.hidden = false;
    el.gateBlock.hidden = false;
    el.settingsBody.hidden = true;
    editDay = weekdayIndex();
    newGateQuestion();
    window.setTimeout(function () { el.gateInput.focus(); }, 120);
  }

  function closeSettings() {
    el.settingsWrap.hidden = true;
  }

  el.momBtn.addEventListener('click', openSettings);

  el.settingsWrap.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-close]')) closeSettings();
  });

  el.gateForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var val = Number(el.gateInput.value);
    if (String(el.gateInput.value).trim() === '' || isNaN(val)) {
      el.gateHint.textContent = '정답을 숫자로 적어 주세요.';
      return;
    }
    if (val !== gateAnswer) {
      newGateQuestion();
      el.gateHint.textContent = '정답이 아니에요. 다시 계산해 보세요.';
      el.gateInput.focus();
      return;
    }
    el.gateBlock.hidden = true;
    el.settingsBody.hidden = false;
    renderSettings();
  });

  function renderSettings() {
    el.rewardInput.value = state.reward;
    el.titleInput.value = state.title;
    el.manualCount.textContent = state.stamps.length + ' / ' + BOARD_SIZE;
    renderEditDays();
    renderEditList();
  }

  function renderEditDays() {
    el.editDays.innerHTML = DAYS.map(function (d, i) {
      return '<button type="button" class="chip' + (i === editDay ? ' is-active' : '') +
        '" data-edit-day="' + i + '">' + d.short + '</button>';
    }).join('');
  }

  function renderEditList() {
    var list = state.missions[dayKeyOf(editDay)] || [];
    if (!list.length) {
      el.editList.innerHTML = '<li class="empty-edit">' + DAYS[editDay].name +
        '은(는) 미션이 없어요. 쉬는 날이에요 🌞<br>필요하면 아래에서 추가해요.</li>';
      return;
    }
    el.editList.innerHTML = list.map(function (m) {
      return '<li class="edit-row" data-id="' + esc(m.id) + '">' +
        '<input class="text-input" type="text" maxlength="20" value="' + esc(m.label) +
        '" data-act="label" aria-label="미션 이름" />' +
        '<div class="edit-steps">' +
        '<button type="button" class="mini-btn" data-act="minus"' + (m.steps <= 1 ? ' disabled' : '') + ' aria-label="단계 줄이기">－</button>' +
        '<span class="val">' + m.steps + '</span>' +
        '<button type="button" class="mini-btn" data-act="plus"' + (m.steps >= 5 ? ' disabled' : '') + ' aria-label="단계 늘리기">＋</button>' +
        '</div>' +
        '<button type="button" class="del-btn" data-act="del" aria-label="미션 삭제">✕</button>' +
        '</li>';
    }).join('');
  }

  el.editDays.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-edit-day]');
    if (!b) return;
    editDay = Number(b.getAttribute('data-edit-day'));
    renderEditDays();
    renderEditList();
  });

  el.editList.addEventListener('input', function (ev) {
    var input = ev.target.closest('input[data-act="label"]');
    if (!input) return;
    var row = input.closest('.edit-row');
    var m = findMission(row.getAttribute('data-id'));
    if (!m) return;
    m.label = input.value.slice(0, 20);
    save();
    render();
  });

  el.editList.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-act]');
    if (!b) return;
    var row = b.closest('.edit-row');
    var m = findMission(row.getAttribute('data-id'));
    if (!m) return;
    var act = b.getAttribute('data-act');
    if (act === 'plus') m.steps = clampSteps(m.steps + 1);
    else if (act === 'minus') m.steps = clampSteps(m.steps - 1);
    else if (act === 'del') {
      var list = state.missions[dayKeyOf(editDay)] || [];
      state.missions[dayKeyOf(editDay)] = list.filter(function (x) { return x.id !== m.id; });
      if (state.progress && state.progress.done) delete state.progress.done[m.id];
    }
    save();
    renderEditList();
    render();
  });

  function findMission(id) {
    var list = state.missions[dayKeyOf(editDay)] || [];
    for (var i = 0; i < list.length; i += 1) { if (list[i].id === id) return list[i]; }
    return null;
  }

  el.addMission.addEventListener('click', function () {
    if (!state.missions[dayKeyOf(editDay)]) state.missions[dayKeyOf(editDay)] = [];
    state.missions[dayKeyOf(editDay)].push(makeMission('새 미션', 1));
    save();
    renderEditList();
    render();
    var inputs = el.editList.querySelectorAll('input[data-act="label"]');
    if (inputs.length) { inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
  });

  el.rewardInput.addEventListener('input', function () {
    state.reward = el.rewardInput.value.slice(0, 40);
    save();
    renderHead();
  });

  el.titleInput.addEventListener('input', function () {
    state.title = el.titleInput.value.slice(0, 40);
    save();
    renderHead();
  });

  el.manualPlus.addEventListener('click', function () {
    if (state.stamps.length >= BOARD_SIZE) { toast('이미 30개가 가득 찼어요!'); return; }
    state.stamps.push({ date: todayKey() });
    justStamped = true;
    if (state.stamps.length >= BOARD_SIZE) {
      state.boards += 1;
      state.celebrate = true;
      save();
    } else {
      save();
    }
    render();
    renderSettings();
    closeSettings();
    if (state.celebrate) showCelebration();
  });

  el.manualMinus.addEventListener('click', function () {
    if (!state.stamps.length) { toast('뺄 스티커가 없어요.'); return; }
    state.stamps.pop();
    if (state.celebrate) { state.celebrate = false; el.celebrateWrap.hidden = true; }
    save();
    render();
    renderSettings();
  });

  el.resetBtn.addEventListener('click', function () {
    var ok = window.confirm('정말 모든 기록을 지울까요?\n미션, 스티커, 달성한 판 기록이 모두 사라져요.');
    if (!ok) return;
    state = defaultState();
    state.progress = { date: todayKey(), done: {} };
    save();
    render();
    renderSettings();
    closeSettings();
    toast('모든 기록을 지웠어요.');
  });

  /* ---------------- 백업 / 복원 ---------------- */
  el.exportBtn.addEventListener('click', function () {
    var payload = JSON.stringify(state);
    el.backupBox.value = payload;
    try {
      el.backupBox.select();
      el.backupBox.setSelectionRange(0, payload.length);
    } catch (e) { /* 무시 */ }
    var done = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(function () {
        toast('백업 코드를 복사했어요!');
      }).catch(function () {
        toast('코드를 선택했어요. 길게 눌러 복사해 주세요.');
      });
      done = true;
    }
    if (!done) {
      try { document.execCommand('copy'); toast('백업 코드를 복사했어요!'); }
      catch (e) { toast('코드를 선택했어요. 길게 눌러 복사해 주세요.'); }
    }
  });

  el.importBtn.addEventListener('click', function () {
    var text = (el.backupBox.value || '').trim();
    if (!text) { toast('복원할 백업 코드를 붙여넣어 주세요.'); return; }
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { toast('백업 코드를 읽을 수 없어요.'); return; }
    if (!parsed || typeof parsed !== 'object' || !parsed.missions) {
      toast('이 백업 코드는 이 스티커판 것이 아니에요.');
      return;
    }
    var ok = window.confirm('지금 기록을 백업 코드 내용으로 바꿀까요?');
    if (!ok) return;
    state = normalize(parsed);
    syncToday();
    save();
    render();
    renderSettings();
    closeSettings();
    if (state.celebrate) showCelebration();
    toast('복원했어요!');
  });

  /* ---------------- 날짜가 바뀌면 ---------------- */
  function onWake() {
    var t = todayKey();
    if (t !== todayDate) {
      todayDate = t;
      viewDay = weekdayIndex();
      syncToday();
      render();
    }
  }
  var todayDate = todayKey();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) onWake();
  });
  window.addEventListener('focus', onWake);

  /* ---------------- 시작 ---------------- */
  syncToday();
  render();
  if (state.celebrate) showCelebration();
})();

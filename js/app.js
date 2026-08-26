/* 单页应用控制器：负责路由、课程渲染与互动实验室。 */
(function () {
  const course = window.CourseData;
  const lessons = [...window.StageOneLessons, ...window.StageTwoLessons, ...window.StageThreeLessons, ...window.StageFourLessons, ...window.StageFiveLessons, ...window.StageSixLessons, ...window.StageSevenLessons, ...window.StageEightLessons, ...window.StageNineLessons];
  const ui = window.GuitarComponents;
  const main = document.getElementById('main-content');
  const breadcrumb = document.getElementById('breadcrumb');
  const toast = document.getElementById('toast');
  let rhythmTimer = null;
  let rhythmStep = 0;
  let rhythmBpm = 60;
  let rhythmSubdivision = 8;
  let rhythmPattern = 'quarter';
  let rhythmPlayer = null;
  let rhythmPlayerReopen = null;
  let tunerStream = null;
  let tunerAudioContext = null;
  let tunerSource = null;
  let tunerAnalyser = null;
  let tunerSilentGain = null;
  let tunerTrack = null;
  let tunerFrame = null;
  let tunerTarget = 'auto';
  let tunerReferenceMidi = null;
  let tunerHistory = [];
  let tunerLastAnalysis = 0;
  let tunerBuffer = null;
  let tunerMisses = 0;

  const standardTuning = [
    { string: 6, midi: 40, note: 'E2', frequency: 82.41 },
    { string: 5, midi: 45, note: 'A2', frequency: 110 },
    { string: 4, midi: 50, note: 'D3', frequency: 146.83 },
    { string: 3, midi: 55, note: 'G3', frequency: 196 },
    { string: 2, midi: 59, note: 'B3', frequency: 246.94 },
    { string: 1, midi: 64, note: 'E4', frequency: 329.63 }
  ];

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function stageLessons(stageId) {
    return lessons.filter(item => item.stage === Number(stageId));
  }

  function stageInfo(stageId) {
    return course.stages.find(item => item.id === Number(stageId));
  }

  function routeParts() {
    const hash = (location.hash || '#/home').replace(/^#\/?/, '');
    const pathOnly = hash.split('?')[0];
    return pathOnly.split('/').filter(Boolean);
  }

  function setActiveNav(route) {
    document.querySelectorAll('[data-route]').forEach(link => link.classList.toggle('active', link.dataset.route === route));
  }

  function pageIntro(eyebrow, title, lead) {
    return `<header><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="lede">${lead}</p></header>`;
  }

  // 首页视觉只使用网页原生图形，保证在电脑和 iPad 上都能清晰缩放。
  function homeFretboardPreview() {
    const strings = [62, 82, 102, 122, 142, 162];
    const frets = [112, 180, 248, 316, 384, 452];
    return `<div class="home-visual" aria-label="吉他指板与和弦学习预览">
      <div class="visual-heading"><span>今天从这里开始</span><strong>第 1 课 · 认识六根弦</strong></div>
      <svg class="home-fretboard" viewBox="0 0 520 220" role="img" aria-label="带音名提示的吉他指板">
        <defs><linearGradient id="home-neck" x1="0" x2="1"><stop stop-color="#9d6035"/><stop offset="1" stop-color="#c4874e"/></linearGradient></defs>
        <rect x="34" y="43" width="452" height="140" rx="18" fill="url(#home-neck)"/>
        ${strings.map((y,index) => `<line x1="34" y1="${y}" x2="486" y2="${y}" stroke="#f3e5cb" stroke-width="${1.3 + index * .34}"/>`).join('')}
        ${frets.map((x,index) => `<line x1="${x}" y1="43" x2="${x}" y2="183" stroke="#ead9bd" stroke-width="${index === 0 ? 7 : 3}"/>`).join('')}
        <circle cx="214" cy="122" r="16" fill="#1e5b45"/><text x="214" y="127" text-anchor="middle" fill="white" font-size="13" font-weight="800">C</text>
        <circle cx="282" cy="82" r="16" fill="#f3c476"/><text x="282" y="87" text-anchor="middle" fill="#173c2e" font-size="13" font-weight="800">E</text>
        <circle cx="350" cy="142" r="16" fill="#f8f3e7"/><text x="350" y="147" text-anchor="middle" fill="#1e5b45" font-size="13" font-weight="800">G</text>
        <text x="52" y="28" fill="#627068" font-size="12">音名不是要硬背，而是一次次在琴上遇见</text>
        <text x="45" y="207" fill="#68736c" font-size="11">低音弦</text><text x="443" y="207" fill="#68736c" font-size="11">高音弦</text>
      </svg>
      <div class="visual-mini-cards">
        <span><b>Em</b> 看按法 · 听声音</span>
        <span><b>4/4</b> 跟节拍 · 练扫弦</span>
      </div>
    </div>`;
  }

  function renderHome() {
    breadcrumb.textContent = '学习首页';
    main.innerHTML = `<div class="page">
      <section class="home-hero">
        <div class="home-hero-copy">
          <div class="home-kicker"><span></span> 零基础也能直接开始</div>
          <h1>把吉他学明白，<br>也真正弹起来。</h1>
          <p>不先塞给你一堆术语。每一课都从看得见的指法、听得到的声音和做得出的练习开始，再把乐理讲清楚。</p>
          <div class="hero-actions">
            <a class="primary-button" href="#/lesson/1-1">开始第一课 <span>→</span></a>
            <a class="secondary-button" href="#/course">浏览全部课程</a>
          </div>
          <div class="home-method"><span>看图</span><i>→</i><span>听声音</span><i>→</i><span>上手练</span></div>
        </div>
        ${homeFretboardPreview()}
      </section>

      <section class="home-section">
        <div class="home-section-heading"><div><div class="eyebrow">从这里选择</div><h2>九个阶段，从基本动作走到看懂和弦</h2></div><a href="#/course">查看完整课程路线 →</a></div>
        <div class="home-stage-grid">
          ${course.stages.slice(0,9).map((stage,index) => `<a class="home-stage-card stage-tone-${index + 1}" href="#/lesson/${stage.id}-1">
            <div class="home-stage-top"><span>阶段 ${String(stage.id).padStart(2,'0')}</span><b>${stage.tone}</b></div>
            <h3>${stage.title}</h3>
            <p>${stage.short}</p>
            <div class="home-stage-meta"><span>${stageLessons(stage.id).length} 节完整课程</span><strong>进入阶段 →</strong></div>
          </a>`).join('')}
        </div>
      </section>

      <section class="home-section home-lab-section">
        <div class="home-section-heading"><div><div class="eyebrow">互动实验室</div><h2>不确定？马上看、听、试一下</h2></div><p>把抽象概念变成手和耳朵能验证的东西。</p></div>
        <div class="home-lab-grid">
          ${[
            ['#/fretboard','01','指板实验室','点一下就能找音、看音阶和音程','六根弦 · 12 个音'],
            ['#/chords','02','和弦实验室','看清每根手指的位置，并试听和弦','指法图 · 真实听感'],
            ['#/rhythm','03','节奏实验室','打开节拍器，跟着扫弦格子练习','节拍器 · 扫弦型'],
            ['#/tuner','04','琴弦调音器','用麦克风判断每根弦偏高还是偏低','实时收音 · 标准调弦']
          ].map(item => `<a class="home-lab-card" href="${item[0]}"><span class="home-lab-number">${item[1]}</span><div><h3>${item[2]}</h3><p>${item[3]}</p><small>${item[4]}</small></div><b>↗</b></a>`).join('')}
        </div>
        <div class="home-reference-links"><span>随手查一查</span><a href="#/map">知识地图 →</a><a href="#/glossary">小白词典 →</a><a href="#/practice">生成今日练习 →</a></div>
      </section>

      <section class="home-route-callout">
        <div><span class="eyebrow">完整学习路线</span><h2>现在先学会弹，之后再一步步理解为什么。</h2></div>
        <p>整套课程共规划 24 个阶段、120 节课。从开放和弦和节奏开始，逐渐走向指板、和声、即兴与独立编配。</p>
        <a class="secondary-button" href="#/course">看看后面会学什么</a>
      </section>
    </div>`;
  }

  function stageDetail(stageId) {
    const stage = course.stages.find(item => item.id === Number(stageId)) || course.stages[0];
    const available = stage.id <= 9;
    const availableLessons = stageLessons(stage.id);
    const firstInStage = availableLessons[0];
    return `<div class="card stage-detail" id="stage-detail">
      <span class="tag">阶段 ${String(stage.id).padStart(2,'0')} · ${stage.tone}</span>
      <h2 style="margin-top:14px">${stage.title}</h2>
      <p class="muted">${stage.short}</p>
      <div class="lesson-mini-list">
        ${stage.lessons.map((title,index) => {
          const id = `${stage.id}-${index+1}`;
          return available ? `<a href="#/lesson/${id}"><span class="lesson-dot">${index+1}</span>${title}</a>` : `<span><span class="lesson-dot">${index+1}</span>${title}</span>`;
        }).join('')}
      </div>
      ${available ? `<a class="primary-button" style="width:100%;margin-top:18px" href="#/lesson/${firstInStage.id}">从本阶段第 1 课开始</a>` : '<p class="tiny muted" style="margin-top:18px">课程体系已规划；正文将在后续开发中按知识依赖逐步开放。</p>'}
    </div>`;
  }

  function renderCourse() {
    const query = location.hash.split('?')[1];
    const params = new URLSearchParams(query || '');
    const selected = Number(params.get('stage') || 1);
    breadcrumb.textContent = '完整课程 · 24 阶段';
    main.innerHTML = `<div class="page">
      ${pageIntro('Course map','完整课程路线','120 节课被组织为 24 个阶段。顺序不是按术语难度排列，而是按“先能在琴上体验，再解释为什么”排列。')}
      <section class="available-course section">
        <div class="section-heading"><div><div class="eyebrow">Available now</div><h2>已上线 · 前 9 个完整阶段</h2></div><span class="tag">51 节课可立即学习</span></div>
        <div class="stage-jump-nav">${course.stages.slice(0,9).map(stage => `<button data-jump-stage="${stage.id}">阶段 ${stage.id} · ${stage.tone}</button>`).join('')}</div>
        ${course.stages.slice(0,9).map(stage => `<div class="available-stage-group" id="available-stage-${stage.id}"><h3>第 ${stage.id} 阶段 · ${stage.title}</h3><div class="available-course-grid">${stageLessons(stage.id).map(lesson => {
          return `<a class="available-lesson-card" href="#/lesson/${lesson.id}"><span class="available-number">${String(lesson.number).padStart(2,'0')}</span><span><small>第 ${lesson.number} 课 · ${lesson.duration} 分钟</small><strong>${lesson.title}</strong></span><b>进入 →</b></a>`;
        }).join('')}</div></div>`).join('')}
      </section>
      <div class="course-layout section">
        <div class="stage-list">
          ${course.stages.map(stage => `<button class="stage-row" data-stage-open="${stage.id}">
            <span class="stage-index">${String(stage.id).padStart(2,'0')}</span>
            <span style="text-align:left"><h3>${stage.title}</h3><p>${stage.short}</p></span>
            <span class="stage-count">${stage.lessons.length} 课 · ${stage.tone}</span>
          </button>`).join('')}
        </div>
        <div id="stage-detail-slot">${stageDetail(selected)}</div>
      </div>
    </div>`;
    document.querySelectorAll('[data-stage-open]').forEach(button => button.addEventListener('click', () => {
      document.getElementById('stage-detail-slot').innerHTML = stageDetail(button.dataset.stageOpen);
      if (window.innerWidth < 1025) document.getElementById('stage-detail-slot').scrollIntoView({behavior:'smooth'});
    }));
    document.querySelectorAll('[data-jump-stage]').forEach(button => button.addEventListener('click', () => {
      document.getElementById(`available-stage-${button.dataset.jumpStage}`).scrollIntoView({behavior:'smooth', block:'start'});
    }));
  }

  const lessonChordSets = {
    '2-1': ['Em'],
    '2-2': ['C','Am'],
    '2-3': ['Em','G'],
    '2-4': ['D','Dm','A'],
    '2-5': ['E','Em','C','G','D'],
    '2-6': ['C','D','Dm','E','Em','G','A','Am'],
    '9-4': ['C','G','Am','Em','Dm']
  };

  function chordStartString(name) {
    const firstSounding = ui.chordData[name].frets.findIndex(fret => fret >= 0);
    return 6 - firstSounding;
  }

  function lessonChordGuide(lessonId) {
    const names = lessonChordSets[lessonId];
    if (!names) return '';
    return `<section class="lesson-section lesson-chord-guide">
      <div class="eyebrow">看图 + 听声音</div>
      <h2>先看清手指，再把它放到琴上</h2>
      <p class="muted">图中 1 = 食指、2 = 中指、3 = 无名指、4 = 小指；左边是粗 6 弦，右边是细 1 弦。橙色圆点是根音，○ 是空弦，× 是不弹。</p>
      <div class="lesson-chord-grid">${names.map(name => {
        const data = ui.chordData[name];
        return `<article class="lesson-chord-card">
          <div class="lesson-chord-title"><div><span>${data.cn}</span><h3>${name}</h3></div><span class="tag">从 ${chordStartString(name)} 弦弹</span></div>
          <div class="lesson-chord-visual">${ui.chordSvg(name)}</div>
          <div class="finger-steps">${ui.chordPositions(name).map(position=>`<span><b>${position.finger}</b>${position.text}</span>`).join('')}</div>
          <button class="secondary-button chord-sound-button" data-play-lesson-chord="${name}" aria-label="播放 ${name} 和弦声音">▶ 听 ${name} 和弦</button>
        </article>`;
      }).join('')}</div>
      <p class="audio-hint">建议：先听一次，再按图放手指；逐弦检查清楚后，再听一次并比较。</p>
    </section>`;
  }

  function tabDemoCard(lesson) {
    if (!lesson.demo) return '';
    return `<section class="lesson-section tab-demo-section">
      <div class="eyebrow">谱例试听</div>
      <h2>先读一遍，再听声音</h2>
      <div class="tab-demo-card">
        <div><span class="tag">${lesson.demo.bpm} BPM</span><h3>${lesson.demo.title}</h3><p class="tab-notation">${ui.escapeHtml(lesson.demo.notation)}</p></div>
        <button class="primary-button tab-demo-button" data-play-tab-demo>▶ 播放谱例</button>
      </div>
      <p class="tiny muted">试听只帮助核对音高顺序；击弦、勾弦、滑音等动作仍要在真实吉他上完成。</p>
    </section>`;
  }

  function earDemoCard(lesson) {
    if (!lesson.earDemo) return '';
    return `<section class="lesson-section ear-demo-section">
      <div class="eyebrow">听觉实验</div>
      <h2>点一下，让名字落到真实声音</h2>
      <div class="ear-demo-card"><div><h3>${lesson.earDemo.title}</h3><p>${lesson.earDemo.hint}</p></div>
        ${lesson.earDemo.groups.map((group,groupIndex)=>`<article class="ear-demo-group"><div class="ear-demo-group-head"><strong>${group.label}</strong><button class="secondary-button compact" data-play-ear-group="${groupIndex}">▶ 连续播放</button></div><div class="ear-note-buttons">${group.notes.map((note,noteIndex)=>`<button type="button" data-play-ear-note="${groupIndex}-${noteIndex}"><span>${note[0]}</span><small>点击试听</small></button>`).join('')}</div></article>`).join('')}
      </div>
    </section>`;
  }

  function fretboardDemoCard(lesson) {
    const demo = lesson.fretboardDemo;
    if (!demo) return '';
    const frets = demo.frets || Array.from({length: 13}, (_, index) => index);
    const noteLabel = midi => {
      const note = ui.noteFromMidi(midi);
      return demo.showFlats && ui.flatNames[note] ? `${note}/${ui.flatNames[note]}` : note;
    };
    return `<section class="lesson-section fretboard-demo-section">
      <div class="fretboard-demo-heading"><div><div class="eyebrow">可点击指板</div><h2>${demo.title}</h2><p>${demo.hint}</p></div><button class="secondary-button compact" type="button" data-toggle-fret-notes>${demo.startHidden ? '显示全部音名' : '隐藏音名练记忆'}</button></div>
      <div class="lesson-fretboard" data-notes-hidden="${demo.startHidden ? 'true' : 'false'}">
        <div class="lesson-fret-scroll"><div class="lesson-fret-grid" style="--lesson-fret-count:${frets.length}">
          ${demo.strings.map(stringNumber => {
            const openMidi = ui.openMidi[stringNumber - 1];
            return `<div class="lesson-fret-row"><div class="lesson-string-label"><strong>${stringNumber} 弦</strong><small>${ui.noteFromMidi(openMidi)} 空弦</small></div>${frets.map(fret => {
              const midi = openMidi + fret;
              const label = noteLabel(midi);
              const highlighted = !demo.highlight || demo.highlight.includes(ui.noteFromMidi(midi));
              return `<button class="lesson-fret-note ${highlighted ? 'highlighted' : 'dimmed'}" type="button" data-fret-demo-note data-midi="${midi}" data-note="${label}" aria-label="${stringNumber} 弦 ${fret} 品 ${label}"><small>${fret === 0 ? '空弦' : `${fret} 品`}</small><b>${demo.startHidden ? '?' : label}</b></button>`;
            }).join('')}</div>`;
          }).join('')}
        </div></div>
      </div>
      <p class="audio-hint">点任意一格可以听声音；隐藏音名后，先在心里回答，再点格子揭晓。</p>
    </section>`;
  }

  // 音程卡把两个具体指板位置、半音数和声音放在同一次操作里。
  function intervalDemoCard(lesson) {
    const demo = lesson.intervalDemo;
    if (!demo) return '';
    return `<section class="lesson-section interval-demo-section">
      <div class="eyebrow">音程实验</div><h2>${demo.title}</h2><p class="muted">${demo.hint}</p>
      <div class="interval-pair-grid">${demo.pairs.map((pair,index) => `<button class="interval-pair-card" type="button" data-play-interval-pair="${index}" aria-label="播放${pair.name}：${pair.from[0]}到${pair.to[0]}">
        <span class="interval-pair-name">${pair.name}</span>
        <span class="interval-pair-route"><b>${pair.from[0]}</b><i aria-hidden="true">→</i><b>${pair.to[0]}</b></span>
        <span class="interval-step-track" style="--interval-steps:${Math.max(1,pair.semitones)}">${Array.from({length:Math.max(1,pair.semitones)},(_,step) => `<i class="${pair.semitones === 0 ? 'same' : ''}">${pair.semitones === 0 ? '同音' : step + 1}</i>`).join('')}</span>
        <small>${pair.semitones} 个半音 · 点击试听</small>
      </button>`).join('')}</div>
    </section>`;
  }

  // 音阶实验把音名、级数、全半音结构和声音放进同一条可操作的路径。
  function scaleDemoCard(lesson) {
    const demo = lesson.scaleDemo;
    if (!demo) return '';
    return `<section class="lesson-section scale-demo-section">
      <div class="eyebrow">音阶实验</div><h2>${demo.title}</h2><p class="muted">${demo.hint}</p>
      <div class="scale-run-grid">${demo.scales.map((scale,scaleIndex) => `<article class="scale-run-card">
        <div class="scale-run-head"><div><span>${scale.kicker || 'Major scale'}</span><h3>${scale.name}</h3></div><div><button class="secondary-button compact" type="button" data-play-scale-run="${scaleIndex}-up">▶ 上行</button><button class="secondary-button compact" type="button" data-play-scale-run="${scaleIndex}-down">↓ 下行</button></div></div>
        <div class="scale-note-path">${scale.notes.map((note,noteIndex) => `<div class="scale-note-step ${scale.changed?.includes(noteIndex) ? 'changed' : ''}"><button type="button" data-play-scale-note="${scaleIndex}-${noteIndex}" aria-label="试听 ${note[0]}"><b>${note[0]}</b><small>${note[2] || `${noteIndex + 1} 级`}</small></button>${noteIndex < scale.steps.length ? `<span class="scale-gap ${scale.steps[noteIndex] === '半' ? 'half' : ''}"><i></i><em>${scale.steps[noteIndex]}</em></span>` : ''}</div>`).join('')}</div>
        ${scale.note ? `<p class="scale-run-note">${scale.note}</p>` : ''}
      </article>`).join('')}</div>
    </section>`;
  }

  // 三和弦实验把根音、三音、五音与开放弦实际发声放在同一张可听卡片里。
  function triadDemoCard(lesson) {
    const demo = lesson.triadDemo;
    if (!demo) return '';
    return `<section class="lesson-section triad-demo-section">
      <div class="eyebrow">和弦组成实验</div><h2>${demo.title}</h2><p class="muted">${demo.hint}</p>
      <div class="triad-card-grid">${demo.triads.map((triad,triadIndex) => {
        const chord = ui.chordData[triad.name];
        return `<article class="triad-card">
          <div class="triad-card-head"><div><span>${triad.kind}</span><h3>${triad.name}</h3></div><strong>${triad.formula}</strong></div>
          <div class="triad-note-row">${triad.notes.map((note,noteIndex) => `<button type="button" class="triad-note ${noteIndex === 0 ? 'root' : noteIndex === 1 ? 'third' : 'fifth'}" data-play-triad-note="${triadIndex}-${noteIndex}" aria-label="试听 ${note[0]}"><b>${note[0]}</b><small>${note[2]}</small></button>`).join('<i>+</i>')}</div>
          ${demo.showStrings && chord ? `<div class="triad-string-anatomy"><span>6弦</span>${chord.sounded.map((note,index) => `<b class="${note === 'X' ? 'muted-string' : chord.roots.includes(index) ? 'root-string' : ''}">${note}<small>${6-index}</small></b>`).join('')}<span>1弦</span></div>` : ''}
          <div class="triad-actions"><button class="secondary-button compact" type="button" data-play-triad="${triadIndex}-arp">▶ 分开听</button><button class="secondary-button compact" type="button" data-play-triad="${triadIndex}-stack">▶ 三音一起</button>${chord ? `<button class="secondary-button compact" type="button" data-play-triad-chord="${triad.name}">▶ 开放和弦</button>` : ''}</div>
        </article>`;
      }).join('')}</div>
    </section>`;
  }

  function renderLesson(id) {
    const lesson = lessons.find(item => item.id === id);
    if (!lesson) {
      main.innerHTML = `<div class="page narrow"><div class="empty-state"><h2>这节课仍在编写中</h2><p>完整位置已经放入课程路线。当前可完整学习前 9 个阶段的 51 节课。</p><a class="primary-button" href="#/course">返回课程目录</a></div></div>`;
      return;
    }
    const lessonIndex = lessons.findIndex(item => item.id === lesson.id);
    const previous = lessons[lessonIndex - 1];
    const next = lessons[lessonIndex + 1];
    const info = stageInfo(lesson.stage);
    const inStage = stageLessons(lesson.stage);
    breadcrumb.textContent = `第 ${lesson.stage} 阶段 · 第 ${lesson.number} 课`;
    main.innerHTML = `<article class="page narrow">
      <header class="lesson-header">
        <div class="lesson-meta"><span class="tag">第 ${lesson.stage} 阶段 · ${info.tone}</span><span>第 ${lesson.number} / ${inStage.length} 课</span><span>约 ${lesson.duration} 分钟</span></div>
        <h1 style="margin-top:16px">${lesson.title}</h1><p class="lede">${lesson.lead}</p>
      </header>

      <section class="lesson-section"><div class="eyebrow">你要搞懂什么</div><h2>完成后，你能够</h2><ul class="goal-list">${lesson.goals.map(item=>`<li>${item}</li>`).join('')}</ul></section>

      <section class="lesson-section"><div class="experiment"><div class="eyebrow" style="color:#e7bc78">Hands first</div><h2>${lesson.experiment.title}</h2><ol>${lesson.experiment.steps.map(item=>`<li>${item}</li>`).join('')}</ol><div class="finish-line"><strong>做到什么算完成：</strong>${lesson.experiment.finish}</div></div></section>

      ${lessonChordGuide(lesson.id)}
      ${tabDemoCard(lesson)}
      ${earDemoCard(lesson)}
      ${intervalDemoCard(lesson)}
      ${scaleDemoCard(lesson)}
      ${triadDemoCard(lesson)}
      ${fretboardDemoCard(lesson)}

      <section class="lesson-section"><div class="eyebrow">核心概念</div><h2>给刚才的体验一个名字</h2><div class="concept-grid">${lesson.concepts.map(concept=>`<article class="concept-card"><h3>${concept.term}</h3><dl class="concept-lines"><dt>它是什么</dt><dd>${concept.plain}</dd><dt>为什么需要</dt><dd>${concept.why}</dd><dt>在吉他上</dt><dd>${concept.guitar}</dd></dl></article>`).join('')}</div></section>

      <section class="lesson-section"><div class="eyebrow">为什么会这样</div><h2>把动作背后的逻辑接起来</h2><div class="why-box">${lesson.why}</div><div class="diagram-card">${ui.renderLessonDiagram(lesson.diagram)}</div></section>

      <section class="lesson-section"><div class="eyebrow">小白最容易搞错</div><h2>先避开这些弯路</h2><ul class="goal-list mistake-list">${lesson.mistakes.map(item=>`<li>${item}</li>`).join('')}</ul></section>

      <section class="lesson-section"><div class="eyebrow">记忆控制</div><h2>今天只把注意力放在这里</h2><div class="three-columns">
        <div class="memory-card must"><h3>现在必须记住</h3><ul>${lesson.remember.map(item=>`<li>${item}</li>`).join('')}</ul></div>
        <div class="memory-card understand"><h3>现在理解即可</h3><p>${lesson.understand}</p></div>
        <div class="memory-card later"><h3>以后再学</h3><p>${lesson.later}</p></div>
      </div></section>

      <section class="lesson-section"><div class="eyebrow">今日练习</div><h2>练完，而不是看完</h2><div class="card practice-list">${lesson.practice.map((item,index)=>`<div class="practice-row"><strong>${item[0]}</strong><label for="practice-${id}-${index}">${item[1]}</label><input id="practice-${id}-${index}" type="checkbox"></div>`).join('')}</div></section>

      <section class="lesson-section"><div class="eyebrow">自测</div><h2>不看上文，试着回答</h2>${lesson.quiz.map((quiz,index)=>`<div class="quiz-card" data-quiz="${index}"><fieldset><legend>${index+1}. ${quiz.q}</legend><div class="quiz-options">${quiz.options.map((option,choice)=>`<label class="quiz-option"><input type="radio" name="quiz-${id}-${index}" value="${choice}" data-answer="${quiz.answer}"><span>${option}</span></label>`).join('')}</div></fieldset><div class="quiz-result" data-correct-text="${ui.escapeHtml(quiz.explain)}"></div></div>`).join('')}</section>

      ${lesson.stageTest ? renderStageTest(lesson.stageTest, lesson.stage) : ''}

      <footer class="lesson-footer">
        ${previous?`<a class="secondary-button" href="#/lesson/${previous.id}">← 上一课</a>`:'<a class="secondary-button" href="#/course">← 课程目录</a>'}
        ${lesson.stage===2?'<a class="primary-button" href="#/chords">打开完整和弦实验室</a>':''}
        ${next?`<a class="secondary-button" href="#/lesson/${next.id}">下一课 →</a>`:'<a class="secondary-button" href="#/practice">今日练习 →</a>'}
      </footer>
    </article>`;
    bindLessonEvents(lesson);
  }

  function renderStageTest(test, stageNumber) {
    const block = (title,items) => `<div class="test-card"><h3>${title}</h3><ul>${items.map(item=>`<li>${item}</li>`).join('')}</ul></div>`;
    return `<section class="lesson-section"><div class="eyebrow">Stage check</div><h2>第 ${stageNumber} 阶段测试</h2><p class="muted">这不是考试。它只帮你判断下一步该往前走，还是回到某个动作再练几天。</p><div class="stage-test-grid">${block('理论理解',test.theory)}${block('吉他实操',test.playing)}${block('节奏',test.rhythm)}${block('听觉',test.ear)}</div><div class="why-box" style="margin-top:14px"><strong>达标标准：</strong>${test.pass}<br><strong>未达标怎么办：</strong>${test.retry}</div></section>`;
  }

  function bindLessonEvents(lesson) {
    document.querySelectorAll('[data-play-lesson-chord]').forEach(button => button.addEventListener('click', () => {
      ui.playChord(button.dataset.playLessonChord);
      button.classList.add('playing');
      button.textContent = `♪ 正在播放 ${button.dataset.playLessonChord}`;
      setTimeout(() => {
        if (!button.isConnected) return;
        button.classList.remove('playing');
        button.textContent = `▶ 听 ${button.dataset.playLessonChord} 和弦`;
      }, 1450);
    }));
    const tabButton = document.querySelector('[data-play-tab-demo]');
    if (tabButton && lesson.demo) tabButton.addEventListener('click', () => {
      const duration = ui.playTabSequence(lesson.demo.sequence, lesson.demo.bpm);
      tabButton.disabled = true;
      tabButton.textContent = '♪ 正在播放谱例';
      setTimeout(() => {
        if (!tabButton.isConnected) return;
        tabButton.disabled = false;
        tabButton.textContent = '▶ 播放谱例';
      }, duration * 1000 + 120);
    });
    if (lesson.earDemo) {
      document.querySelectorAll('[data-play-ear-note]').forEach(button => button.addEventListener('click', () => {
        const [groupIndex,noteIndex] = button.dataset.playEarNote.split('-').map(Number);
        ui.playTone(lesson.earDemo.groups[groupIndex].notes[noteIndex][1], .9, .12);
        button.classList.add('playing');
        setTimeout(() => button.isConnected && button.classList.remove('playing'), 650);
      }));
      document.querySelectorAll('[data-play-ear-group]').forEach(button => button.addEventListener('click', () => {
        const notes = lesson.earDemo.groups[Number(button.dataset.playEarGroup)].notes;
        notes.forEach((note,index) => ui.playTone(note[1], .72, .105, index * .46));
        button.disabled = true;
        button.textContent = '♪ 正在播放';
        setTimeout(() => {
          if (!button.isConnected) return;
          button.disabled = false;
          button.textContent = '▶ 连续播放';
        }, notes.length * 460 + 450);
      }));
    }
    if (lesson.intervalDemo) {
      document.querySelectorAll('[data-play-interval-pair]').forEach(button => button.addEventListener('click', () => {
        const pair = lesson.intervalDemo.pairs[Number(button.dataset.playIntervalPair)];
        ui.playTone(pair.from[1], .78, .11);
        ui.playTone(pair.to[1], .9, .115, .5);
        button.classList.add('playing');
        setTimeout(() => button.isConnected && button.classList.remove('playing'), 1150);
      }));
    }
    if (lesson.scaleDemo) {
      document.querySelectorAll('[data-play-scale-note]').forEach(button => button.addEventListener('click', () => {
        const [scaleIndex,noteIndex] = button.dataset.playScaleNote.split('-').map(Number);
        ui.playTone(lesson.scaleDemo.scales[scaleIndex].notes[noteIndex][1], .82, .11);
        button.classList.add('playing');
        setTimeout(() => button.isConnected && button.classList.remove('playing'), 620);
      }));
      document.querySelectorAll('[data-play-scale-run]').forEach(button => button.addEventListener('click', () => {
        const [scaleIndex,direction] = button.dataset.playScaleRun.split('-');
        const scale = lesson.scaleDemo.scales[Number(scaleIndex)];
        const indexedNotes = scale.notes.map((note,index) => ({note,index}));
        const sequence = direction === 'down' ? indexedNotes.reverse() : indexedNotes;
        const card = button.closest('.scale-run-card');
        const noteButtons = [...card.querySelectorAll('[data-play-scale-note]')];
        sequence.forEach((item,step) => {
          ui.playTone(item.note[1], .68, .105, step * .42);
          setTimeout(() => {
            if (!card.isConnected) return;
            noteButtons.forEach(noteButton => noteButton.classList.remove('playing'));
            noteButtons[item.index].classList.add('playing');
          }, step * 420);
        });
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = '♪ 播放中';
        setTimeout(() => {
          if (!button.isConnected) return;
          button.disabled = false;
          button.textContent = originalText;
          noteButtons.forEach(noteButton => noteButton.classList.remove('playing'));
        }, sequence.length * 420 + 300);
      }));
    }
    if (lesson.triadDemo) {
      document.querySelectorAll('[data-play-triad-note]').forEach(button => button.addEventListener('click', () => {
        const [triadIndex,noteIndex] = button.dataset.playTriadNote.split('-').map(Number);
        ui.playTone(lesson.triadDemo.triads[triadIndex].notes[noteIndex][1], .88, .115);
        button.classList.add('playing');
        setTimeout(() => button.isConnected && button.classList.remove('playing'), 650);
      }));
      document.querySelectorAll('[data-play-triad]').forEach(button => button.addEventListener('click', () => {
        const [triadIndex,mode] = button.dataset.playTriad.split('-');
        const triad = lesson.triadDemo.triads[Number(triadIndex)];
        triad.notes.forEach((note,index) => ui.playTone(note[1], 1.15, .095, mode === 'arp' ? index * .36 : 0));
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = '♪ 播放中';
        setTimeout(() => {
          if (!button.isConnected) return;
          button.disabled = false;
          button.textContent = originalText;
        }, mode === 'arp' ? 1300 : 850);
      }));
      document.querySelectorAll('[data-play-triad-chord]').forEach(button => button.addEventListener('click', () => {
        ui.playChord(button.dataset.playTriadChord);
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = '♪ 开放和弦播放中';
        setTimeout(() => {
          if (!button.isConnected) return;
          button.disabled = false;
          button.textContent = originalText;
        }, 1450);
      }));
    }
    const fretboard = document.querySelector('.lesson-fretboard');
    const fretToggle = document.querySelector('[data-toggle-fret-notes]');
    if (fretboard && fretToggle) {
      const fretButtons = [...fretboard.querySelectorAll('[data-fret-demo-note]')];
      fretToggle.addEventListener('click', () => {
        const hidden = fretboard.dataset.notesHidden !== 'true';
        fretboard.dataset.notesHidden = String(hidden);
        fretToggle.textContent = hidden ? '显示全部音名' : '隐藏音名练记忆';
        fretButtons.forEach(button => {
          button.classList.remove('revealed');
          button.querySelector('b').textContent = hidden ? '?' : button.dataset.note;
        });
      });
      fretButtons.forEach(button => button.addEventListener('click', () => {
        ui.playTone(Number(button.dataset.midi), .82, .11);
        button.classList.add('playing');
        if (fretboard.dataset.notesHidden === 'true') {
          button.classList.add('revealed');
          button.querySelector('b').textContent = button.dataset.note;
        }
        setTimeout(() => button.isConnected && button.classList.remove('playing'), 620);
      }));
    }
    document.querySelectorAll('.quiz-card input').forEach(input => input.addEventListener('change', () => {
      const card = input.closest('.quiz-card');
      const result = card.querySelector('.quiz-result');
      const correct = Number(input.value) === Number(input.dataset.answer);
      result.className = `quiz-result show ${correct?'correct':'wrong'}`;
      result.textContent = correct ? `回答正确。${result.dataset.correctText}` : `再想一步。${result.dataset.correctText}`;
    }));
  }

  function renderFretboard() {
    breadcrumb.textContent = '指板实验室';
    main.innerHTML = `<div class="page">
      ${pageIntro('Fretboard lab','吉他指板实验室','每移动一品，就是一个半音。点亮一个音、一个音阶或一个音程，再点击圆点听它的实际音高。')}
      <div class="lab-toolbar card">
        <div class="field"><label for="fret-root">根音</label><select id="fret-root">${ui.noteNames.map(note=>`<option>${note}</option>`).join('')}</select></div>
        <div class="field"><label for="fret-mode">显示内容</label><select id="fret-mode"><option value="note">只显示这个音</option><option value="major">大调音阶</option><option value="minor">自然小调音阶</option><option value="interval-4">根音 + 大三度</option><option value="interval-7">根音 + 纯五度</option><option value="interval-12">根音 + 八度</option></select></div>
        <button class="secondary-button" id="fret-reset">重置为 C</button>
      </div>
      <div class="fret-legend"><span><i class="legend-dot root"></i>根音</span><span><i class="legend-dot"></i>音阶音 / 音程音</span><span>显示 0–12 品；12 品后音名循环</span></div>
      <div id="fretboard-slot">${ui.renderFretboard({selected:'C',mode:'note'})}</div>
      <div class="card"><h3>先做一个实验</h3><p>选择 E，只显示这个音。观察两端的 E 空弦，也观察 6 弦 12 品的 E。为什么 12 品又回到 E？因为经过了完整的 12 个半音，音名开始下一轮循环；声音更高，但仍属于 E 这个音名类别。</p></div>
    </div>`;
    const root = document.getElementById('fret-root');
    const mode = document.getElementById('fret-mode');
    const update = () => {
      document.getElementById('fretboard-slot').innerHTML = ui.renderFretboard({selected:root.value,mode:mode.value});
      bindFretNotes();
    };
    root.addEventListener('change', update); mode.addEventListener('change', update);
    document.getElementById('fret-reset').addEventListener('click',()=>{root.value='C';mode.value='note';update();});
    bindFretNotes();
  }

  function bindFretNotes() {
    document.querySelectorAll('.note-dot').forEach(dot => dot.addEventListener('click', () => ui.playTone(Number(dot.dataset.midi))));
  }

  function renderChords(selectedName = 'C') {
    breadcrumb.textContent = '和弦实验室';
    main.innerHTML = `<div class="page">
      ${pageIntro('Chord lab','和弦实验室','和弦图不是手指谜题。选一个和弦，看它由哪些音组成、六根弦真正发出什么，以及根音在哪里。')}
      <div class="chord-layout section">
        <div class="chord-picker">${Object.keys(ui.chordData).map(name=>`<button class="chord-button ${name===selectedName?'active':''}" data-chord="${name}">${name}</button>`).join('')}</div>
        <div class="card" id="chord-detail">${chordDetail(selectedName)}</div>
      </div>
    </div>`;
    bindChordEvents();
  }

  function chordDetail(name) {
    const data = ui.chordData[name];
    return `<div class="chord-display"><div>${ui.chordSvg(name)}<button class="secondary-button" style="width:100%" id="play-chord" data-chord-play="${name}">▶ 听和弦</button></div><div>
      <span class="tag">${data.cn}</span><h2 style="margin-top:12px">${data.full}</h2>
      <h3>手指放置</h3><div class="finger-steps">${ui.chordPositions(name).map(position=>`<span><b>${position.finger}</b>${position.text}</span>`).join('')}</div>
      <div class="fact-grid"><div class="fact"><small>组成音</small><strong>${data.notes}</strong></div><div class="fact"><small>音程结构</small><strong>${data.formula}</strong></div></div>
      <h3 style="margin-top:22px">六根弦实际发出的音</h3><div class="sounding-strings">${data.sounded.map((note,i)=>`<span class="${note==='X'?'muted-string':''}">${6-i}弦<br><strong>${note}</strong></span>`).join('')}</div>
      <div class="why-box" style="margin-top:20px"><strong>为什么这样按仍是 ${name} 和弦？</strong><br>${data.reason}</div>
      <p class="tiny muted" style="margin-top:16px">橙色按弦点表示根音位置；圆圈 O 表示空弦，× 表示这根弦不弹。</p>
    </div></div>`;
  }

  function bindChordEvents() {
    document.querySelectorAll('[data-chord]').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('[data-chord]').forEach(item=>item.classList.toggle('active',item===button));
      document.getElementById('chord-detail').innerHTML = chordDetail(button.dataset.chord);
      bindPlayChord();
    }));
    bindPlayChord();
  }

  function bindPlayChord() {
    const button = document.getElementById('play-chord');
    if (!button) return;
    button.addEventListener('click', () => {
      ui.playChord(button.dataset.chordPlay);
      button.textContent = '♪ 正在播放';
      setTimeout(() => { if (button.isConnected) button.textContent = '▶ 听和弦'; }, 1450);
    });
  }

  function renderTuner() {
    stopTuner(false);
    tunerTarget = 'auto';
    tunerReferenceMidi = null;
    breadcrumb.textContent = '琴弦调音器';
    main.innerHTML = `<div class="page">
      ${pageIntro('Tuner lab','琴弦调音器','拨响一根空弦，调音器会通过麦克风判断它偏高还是偏低。默认自动识别，也可以先指定琴弦，减少环境声音造成的误判。')}
      <div class="tuner-layout section">
        <section class="tuner-stage" id="tuner-stage" data-state="idle" aria-live="polite">
          <div class="tuner-listening"><span class="tuner-mic-dot"></span><strong id="tuner-status">麦克风尚未开启</strong></div>
          <div class="tuner-target-label" id="tuner-target-label">自动识别琴弦</div>
          <div class="tuner-note"><strong id="tuner-note">—</strong><span id="tuner-octave"></span></div>
          <div class="tuner-detected" id="tuner-detected">等待开始</div>
          <div class="tuner-input-meter" id="tuner-input-meter" data-level="none">
            <div class="tuner-input-track"><span id="tuner-input-bar"></span></div>
            <div class="tuner-input-copy"><span>麦克风输入强度</span><strong id="tuner-input-label">未开启</strong></div>
          </div>
          <div class="tuner-meter" aria-label="音高偏差表，左侧偏低，右侧偏高">
            <div class="tuner-meter-track"><i id="tuner-needle"></i><b></b></div>
            <div class="tuner-meter-labels"><span>−50</span><span>偏低</span><strong>准</strong><span>偏高</span><span>+50</span></div>
          </div>
          <div class="tuner-reading"><strong id="tuner-frequency">— Hz</strong><span id="tuner-cents">等待拨弦</span></div>
          <h2 id="tuner-guidance">先开启麦克风，再拨响一根空弦</h2>
          <div class="tuner-actions">
            <button class="primary-button" id="tuner-toggle" type="button">◎ 开启麦克风</button>
            <button class="secondary-button" id="tuner-reference" type="button" disabled>▶ 听目标音</button>
          </div>
        </section>

        <aside class="tuner-side">
          <section class="card tuner-string-card">
            <div class="eyebrow">标准调弦 E A D G B E</div>
            <h2>选择要调的琴弦</h2>
            <p>环境较安静时用自动识别；周围有人说话或有音乐时，先点具体琴弦会更稳定。</p>
            <div class="tuner-strings">
              <button class="active tuner-auto" data-tuner-target="auto" type="button"><strong>自动</strong><span>识别琴弦</span></button>
              ${standardTuning.map(item => `<button data-tuner-target="${item.midi}" type="button"><strong>${item.string} 弦</strong><span>${item.note}</span><small>${item.frequency.toFixed(2)} Hz</small></button>`).join('')}
            </div>
          </section>
          <section class="card tuner-help-card">
            <h3>怎样调得更准</h3>
            <ol><li>开启后先轻敲一下琴身，确认“麦克风输入强度”会变化。</li><li>把手机或 iPad 放在音孔前方约 10–25 厘米，一次只拨一根空弦。</li><li>显示“偏低”时慢慢拧紧；显示“偏高”时慢慢放松。</li><li>指针进入中间绿色区域并稳定两三次，就可以停下。</li></ol>
            <div class="tuner-privacy"><span>●</span><div><strong>声音只在设备里分析</strong><small>网页不会录音、保存或上传。离开本页时麦克风会自动关闭。</small></div></div>
          </section>
        </aside>
      </div>
    </div>`;
    bindTunerEvents();
  }

  function bindTunerEvents() {
    document.getElementById('tuner-toggle').addEventListener('click', () => tunerStream ? stopTuner() : startTuner());
    document.getElementById('tuner-reference').addEventListener('click', () => {
      if (tunerReferenceMidi !== null) ui.playTone(tunerReferenceMidi, 1.1, .1);
    });
    document.querySelectorAll('[data-tuner-target]').forEach(button => button.addEventListener('click', () => {
      tunerTarget = button.dataset.tunerTarget;
      document.querySelectorAll('[data-tuner-target]').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('[data-tuner-target]').forEach(item => item.classList.remove('detected'));
      const target = tunerTarget === 'auto' ? null : standardTuning.find(item => item.midi === Number(tunerTarget));
      tunerReferenceMidi = target ? target.midi : null;
      document.getElementById('tuner-reference').disabled = !target;
      document.getElementById('tuner-target-label').textContent = target ? `${target.string} 弦目标音` : '自动识别琴弦';
      document.getElementById('tuner-note').textContent = target ? target.note.slice(0, -1) : '—';
      document.getElementById('tuner-octave').textContent = target ? target.note.slice(-1) : '';
      document.getElementById('tuner-guidance').textContent = tunerStream ? `拨响 ${target ? `${target.string} 弦空弦` : '任意一根空弦'}` : '先开启麦克风，再拨响一根空弦';
      tunerHistory = [];
    }));
  }

  async function startTuner() {
    const toggle = document.getElementById('tuner-toggle');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setTunerMessage('error', '当前打开方式不能使用麦克风', '请通过 HTTPS 网页链接，并使用 Safari、Chrome 或 Edge 打开。');
      return;
    }
    if (rhythmTimer) {
      pauseRhythm();
      showToast('调音时已暂停背景节奏');
    }
    toggle.disabled = true;
    toggle.textContent = '正在请求权限…';
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      tunerAudioContext = new AudioContextClass();
      if (tunerAudioContext.state === 'suspended') await tunerAudioContext.resume();
      tunerStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { echoCancellation: { ideal: false }, noiseSuppression: { ideal: false }, autoGainControl: { ideal: true }, channelCount: { ideal: 1 } }
      });
      // 用户可能在权限提示期间离开调音页，此时立即释放刚取得的麦克风。
      if (!toggle.isConnected || routeParts()[0] !== 'tuner') {
        stopTuner(false);
        return;
      }
      tunerSource = tunerAudioContext.createMediaStreamSource(tunerStream);
      tunerAnalyser = tunerAudioContext.createAnalyser();
      tunerAnalyser.fftSize = 4096;
      tunerAnalyser.smoothingTimeConstant = 0;
      tunerBuffer = new Float32Array(tunerAnalyser.fftSize);
      tunerSource.connect(tunerAnalyser);
      // 部分 Safari/WebKit 只有在分析节点接入输出图时才会持续拉取数据；零音量连接不会产生回授声。
      tunerSilentGain = tunerAudioContext.createGain();
      tunerSilentGain.gain.value = 0;
      tunerAnalyser.connect(tunerSilentGain).connect(tunerAudioContext.destination);
      tunerTrack = tunerStream.getAudioTracks()[0] || null;
      if (!tunerTrack) throw new DOMException('没有可用的音频轨道', 'NotFoundError');
      tunerTrack.addEventListener('mute', showTunerMuted);
      tunerTrack.addEventListener('ended', showTunerEnded);
      if (tunerAudioContext.state === 'suspended') await tunerAudioContext.resume();
      tunerHistory = [];
      tunerMisses = 0;
      tunerLastAnalysis = 0;
      toggle.disabled = false;
      toggle.textContent = '■ 关闭麦克风';
      setTunerMessage('listening', '麦克风已开启，正在听', `拨响 ${tunerTarget === 'auto' ? '任意一根空弦' : `${standardTuning.find(item => item.midi === Number(tunerTarget)).string} 弦空弦`}`);
      updateTunerInputLevel(0);
      tunerFrame = requestAnimationFrame(analyseTuner);
    } catch (error) {
      stopTuner(false);
      toggle.disabled = false;
      toggle.textContent = '◎ 重新开启麦克风';
      const messages = {
        NotAllowedError: ['没有获得麦克风权限', '请在浏览器的网站设置中允许麦克风，然后再试一次。'],
        NotFoundError: ['没有找到可用的麦克风', '请检查设备麦克风，或连接一个音频输入设备。'],
        NotReadableError: ['麦克风暂时无法使用', '它可能正被其他应用占用。关闭占用麦克风的应用后再试。'],
        AbortError: ['麦克风启动失败', '请刷新页面，再重新开启麦克风。']
      };
      const message = messages[error.name] || ['无法开启麦克风', '请检查浏览器权限与系统麦克风设置后再试。'];
      setTunerMessage('error', message[0], message[1]);
    }
  }

  function analyseTuner(timestamp) {
    if (!tunerAnalyser || !tunerAudioContext) return;
    tunerFrame = requestAnimationFrame(analyseTuner);
    if (timestamp - tunerLastAnalysis < 85) return;
    tunerLastAnalysis = timestamp;
    if (tunerTrack?.muted) {
      updateTunerInputLevel(0);
      return;
    }
    tunerAnalyser.getFloatTimeDomainData(tunerBuffer);
    let energy = 0;
    for (let index = 0; index < tunerBuffer.length; index += 1) energy += tunerBuffer[index] * tunerBuffer[index];
    const inputVolume = Math.sqrt(energy / tunerBuffer.length);
    updateTunerInputLevel(inputVolume);
    const pitch = ui.detectPitch(tunerBuffer, tunerAudioContext.sampleRate, 60, 380);
    if (!pitch || pitch.clarity < .62) {
      tunerMisses += 1;
      if (tunerMisses > 2) showTunerWaiting(inputVolume);
      return;
    }
    tunerMisses = 0;
    tunerHistory.push(pitch.frequency);
    if (tunerHistory.length > 5) tunerHistory.shift();
    const sorted = [...tunerHistory].sort((a, b) => a - b);
    updateTunerReading(sorted[Math.floor(sorted.length / 2)]);
  }

  function updateTunerReading(frequency) {
    const detectedMidi = 69 + 12 * Math.log2(frequency / 440);
    const roundedMidi = Math.round(detectedMidi);
    const detectedName = `${ui.noteFromMidi(roundedMidi)}${Math.floor(roundedMidi / 12) - 1}`;
    const target = tunerTarget === 'auto'
      ? standardTuning.reduce((best, item) => Math.abs(1200 * Math.log2(frequency / item.frequency)) < Math.abs(1200 * Math.log2(frequency / best.frequency)) ? item : best)
      : standardTuning.find(item => item.midi === Number(tunerTarget));
    const cents = 1200 * Math.log2(frequency / target.frequency);
    const absoluteCents = Math.abs(cents);
    const state = absoluteCents <= 5 ? 'tuned' : cents < 0 ? 'flat' : 'sharp';
    const guidance = absoluteCents <= 5 ? '准了，保持这个位置' : cents < 0 ? '偏低：慢慢拧紧一点' : '偏高：慢慢放松一点';
    tunerReferenceMidi = target.midi;
    document.getElementById('tuner-stage').dataset.state = state;
    document.getElementById('tuner-status').textContent = '正在实时收音';
    document.getElementById('tuner-target-label').textContent = `${target.string} 弦目标音`;
    document.getElementById('tuner-note').textContent = target.note.slice(0, -1);
    document.getElementById('tuner-octave').textContent = target.note.slice(-1);
    document.getElementById('tuner-detected').textContent = `检测到 ${detectedName}`;
    document.getElementById('tuner-frequency').textContent = `${frequency.toFixed(1)} Hz`;
    document.getElementById('tuner-cents').textContent = `${cents > 0 ? '+' : ''}${Math.round(cents)} 音分`;
    document.getElementById('tuner-guidance').textContent = guidance;
    document.getElementById('tuner-needle').style.transform = `translateX(-50%) rotate(${Math.max(-50, Math.min(50, cents)) * .9}deg)`;
    document.getElementById('tuner-reference').disabled = false;
    document.querySelectorAll('[data-tuner-target]').forEach(button => button.classList.toggle('detected', tunerTarget === 'auto' && Number(button.dataset.tunerTarget) === target.midi));
  }

  function updateTunerInputLevel(volume) {
    const bar = document.getElementById('tuner-input-bar');
    const label = document.getElementById('tuner-input-label');
    const meter = document.getElementById('tuner-input-meter');
    if (!bar || !label || !meter) return;
    const decibels = volume > 0 ? 20 * Math.log10(volume) : -80;
    const percent = Math.max(0, Math.min(100, (decibels + 60) * 2.5));
    const level = volume < .0007 ? 'none' : volume < .0025 ? 'weak' : volume < .012 ? 'heard' : 'strong';
    const labels = { none:'等待声音', weak:'声音偏弱', heard:'已收到声音', strong:'声音清楚' };
    bar.style.width = `${percent}%`;
    label.textContent = labels[level];
    meter.dataset.level = level;
  }

  function showTunerWaiting(inputVolume = 0) {
    if (!tunerStream) return;
    document.getElementById('tuner-stage').dataset.state = 'listening';
    const heard = inputVolume >= .0025;
    const weak = inputVolume >= .0007;
    document.getElementById('tuner-status').textContent = heard ? '收到声音，正在判断' : weak ? '麦克风输入声音偏弱' : '麦克风已开启，等待声音';
    document.getElementById('tuner-detected').textContent = heard ? '听到了，但音高还不够稳定' : weak ? '已经收到一点声音' : '还没有收到明显的琴弦声';
    document.getElementById('tuner-frequency').textContent = '— Hz';
    document.getElementById('tuner-cents').textContent = heard ? '继续让弦振动' : '请再拨一次';
    document.getElementById('tuner-guidance').textContent = heard ? '只拨一根空弦，等声音稳定下来' : weak ? '把设备靠近音孔，再用力拨一次' : '轻敲琴身测试；强度条不动时请检查系统麦克风';
    document.getElementById('tuner-needle').style.transform = 'translateX(-50%) rotate(0deg)';
  }

  function showTunerMuted() {
    if (!tunerStream || !document.getElementById('tuner-stage')) return;
    updateTunerInputLevel(0);
    setTunerMessage('error', '麦克风暂时没有输入', '请确认浏览器没有被静音，并回到本页再试一次。');
  }

  function showTunerEnded() {
    if (!tunerStream || !document.getElementById('tuner-stage')) return;
    stopTuner(false);
    const toggle = document.getElementById('tuner-toggle');
    if (toggle) {
      toggle.disabled = false;
      toggle.textContent = '◎ 重新开启麦克风';
    }
    setTunerMessage('error', '麦克风连接已中断', '请重新开启麦克风。');
    updateTunerInputLevel(0);
  }

  function setTunerMessage(state, status, guidance) {
    const stage = document.getElementById('tuner-stage');
    if (!stage) return;
    stage.dataset.state = state;
    document.getElementById('tuner-status').textContent = status;
    document.getElementById('tuner-guidance').textContent = guidance;
  }

  function stopTuner(updateInterface = true) {
    if (tunerFrame) cancelAnimationFrame(tunerFrame);
    tunerFrame = null;
    if (tunerSource) tunerSource.disconnect();
    if (tunerAnalyser) tunerAnalyser.disconnect();
    if (tunerSilentGain) tunerSilentGain.disconnect();
    if (tunerTrack) {
      tunerTrack.removeEventListener('mute', showTunerMuted);
      tunerTrack.removeEventListener('ended', showTunerEnded);
    }
    if (tunerStream) tunerStream.getTracks().forEach(track => track.stop());
    if (tunerAudioContext && tunerAudioContext.state !== 'closed') tunerAudioContext.close().catch(() => {});
    tunerStream = null;
    tunerSource = null;
    tunerAnalyser = null;
    tunerSilentGain = null;
    tunerTrack = null;
    tunerAudioContext = null;
    tunerBuffer = null;
    tunerHistory = [];
    tunerMisses = 0;
    if (!updateInterface || !document.getElementById('tuner-stage')) return;
    document.getElementById('tuner-stage').dataset.state = 'idle';
    document.getElementById('tuner-status').textContent = '麦克风已关闭';
    document.getElementById('tuner-toggle').textContent = '◎ 开启麦克风';
    document.getElementById('tuner-guidance').textContent = '需要时可以重新开启';
    document.getElementById('tuner-detected').textContent = '未在收音';
    updateTunerInputLevel(0);
    document.getElementById('tuner-input-label').textContent = '未开启';
  }

  const rhythmPatterns = {
    quarter: {label:'四分音符', marks:['↓','·','↓','·','↓','·','↓','·']},
    eighth: {label:'八分音符', marks:['↓','↑','↓','↑','↓','↑','↓','↑']},
    pop: {label:'流行基础型', marks:['↓','·','↓','↑','·','↑','↓','↑']},
    rest: {label:'带休止练习', marks:['↓','·','·','↑','↓','·','↓','↑']}
  };

  // 悬浮播放器独立于页面正文存在，切换课程时节拍不会被重新渲染掉。
  function initRhythmPlayer() {
    rhythmPlayer = document.createElement('aside');
    rhythmPlayer.className = 'rhythm-player';
    rhythmPlayer.setAttribute('aria-label', '背景节奏播放器');
    rhythmPlayer.innerHTML = `<div class="rhythm-player-head">
      <div><span class="rhythm-live-dot"></span><small>背景节奏</small><strong id="player-pattern-name">${rhythmPatterns[rhythmPattern].label}</strong></div>
      <button class="rhythm-icon-button" id="player-collapse" type="button" aria-label="收起播放器">—</button>
    </div>
    <div class="rhythm-player-main">
      <button class="rhythm-bpm-button" id="player-bpm-down" type="button" aria-label="速度减 5">−</button>
      <div class="rhythm-player-bpm"><strong id="player-bpm-value">${rhythmBpm}</strong><span>BPM</span></div>
      <button class="rhythm-bpm-button" id="player-bpm-up" type="button" aria-label="速度加 5">＋</button>
    </div>
    <div class="rhythm-player-beats" aria-label="当前拍号">
      ${[1,2,3,4].map(beat => `<span data-player-beat="${beat - 1}">${beat}</span>`).join('')}
    </div>
    <div class="rhythm-player-actions">
      <button class="rhythm-play-button" id="player-toggle" type="button">▶ 播放</button>
      <button class="rhythm-stop-button" id="player-stop" type="button">■ 停止</button>
      <a href="#/rhythm">完整实验室 ↗</a>
    </div>`;
    rhythmPlayerReopen = document.createElement('button');
    rhythmPlayerReopen.className = 'rhythm-player-reopen';
    rhythmPlayerReopen.type = 'button';
    rhythmPlayerReopen.setAttribute('aria-label', '打开背景节奏播放器');
    rhythmPlayerReopen.innerHTML = `<span>♩</span><small>${rhythmBpm}</small>`;
    document.body.append(rhythmPlayer, rhythmPlayerReopen);

    document.getElementById('player-collapse').addEventListener('click', closeRhythmPlayer);
    rhythmPlayerReopen.addEventListener('click', openRhythmPlayer);
    document.getElementById('player-toggle').addEventListener('click', () => rhythmTimer ? pauseRhythm() : startRhythm());
    document.getElementById('player-stop').addEventListener('click', stopRhythm);
    document.getElementById('player-bpm-down').addEventListener('click', () => setRhythmBpm(rhythmBpm - 5));
    document.getElementById('player-bpm-up').addEventListener('click', () => setRhythmBpm(rhythmBpm + 5));
    closeRhythmPlayer();
    syncRhythmUI();
  }

  function openRhythmPlayer() {
    rhythmPlayer.classList.add('open');
    rhythmPlayer.setAttribute('aria-hidden', 'false');
    rhythmPlayerReopen.classList.remove('show');
  }

  function closeRhythmPlayer() {
    rhythmPlayer.classList.remove('open');
    rhythmPlayer.setAttribute('aria-hidden', 'true');
    rhythmPlayerReopen.classList.add('show');
  }

  function setRhythmBpm(value) {
    rhythmBpm = Math.max(40, Math.min(200, Number(value)));
    if (rhythmTimer) restartRhythmTimer();
    syncRhythmUI();
  }

  function syncRhythmUI() {
    const bpmRange = document.getElementById('bpm-range');
    const bpmValue = document.getElementById('bpm-value');
    const pageToggle = document.getElementById('metronome-toggle');
    const playerToggle = document.getElementById('player-toggle');
    const playerStop = document.getElementById('player-stop');
    if (bpmRange) bpmRange.value = rhythmBpm;
    if (bpmValue) bpmValue.textContent = rhythmBpm;
    if (pageToggle) pageToggle.textContent = rhythmTimer ? '❚❚ 暂停' : '▶ 开始背景播放';
    if (playerToggle) playerToggle.textContent = rhythmTimer ? '❚❚ 暂停' : '▶ 播放';
    if (playerStop) playerStop.disabled = !rhythmTimer && rhythmStep === 0;
    if (rhythmPlayer) {
      document.getElementById('player-bpm-value').textContent = rhythmBpm;
      document.getElementById('player-pattern-name').textContent = rhythmPatterns[rhythmPattern].label;
      rhythmPlayer.classList.toggle('playing', Boolean(rhythmTimer));
    }
    if (rhythmPlayerReopen) {
      rhythmPlayerReopen.querySelector('small').textContent = rhythmBpm;
      rhythmPlayerReopen.setAttribute('aria-label', `打开背景节奏播放器，当前 ${rhythmBpm} BPM`);
      rhythmPlayerReopen.classList.toggle('playing', Boolean(rhythmTimer));
    }
  }

  function renderRhythm() {
    breadcrumb.textContent = '节奏实验室';
    main.innerHTML = `<div class="page">
      ${pageIntro('Rhythm lab','节奏实验室','右手像钟摆一样持续运动；开始播放后，可以离开本页继续学习其他课程，节拍会在悬浮播放器中持续。')}
      <div class="rhythm-background-note"><span>♩</span><div><strong>这是全站背景播放器</strong><small>切换课程不会停止；需要安静时可以暂停或完全停止。</small></div></div>
      <div class="lab-toolbar card"><div class="field"><label for="pattern-select">节奏型</label><select id="pattern-select">${Object.entries(rhythmPatterns).map(([key,val])=>`<option value="${key}" ${key === rhythmPattern ? 'selected' : ''}>${val.label}</option>`).join('')}</select></div><div class="field"><label for="subdivision-select">显示细分</label><select id="subdivision-select"><option value="8" ${rhythmSubdivision === 8 ? 'selected' : ''}>八分音符：1 & 2 & 3 & 4 &</option><option value="16" ${rhythmSubdivision === 16 ? 'selected' : ''}>十六分音符：1 e & a</option></select></div></div>
      <section class="rhythm-stage">
        <div class="bpm-display"><strong id="bpm-value">${rhythmBpm}</strong><span>BPM</span></div>
        <div class="range-row"><input id="bpm-range" type="range" min="40" max="200" value="${rhythmBpm}"><span>40 — 200</span></div>
        <div class="beat-grid" id="beat-grid" style="grid-template-columns:repeat(${rhythmSubdivision},1fr)">${renderBeatCells(rhythmSubdivision)}</div>
        <div class="strum-pattern" id="strum-pattern">${renderStrums(rhythmPattern)}</div>
        <div class="hero-actions"><button class="primary-button" id="metronome-toggle">${rhythmTimer ? '❚❚ 暂停' : '▶ 开始背景播放'}</button><button class="secondary-button" id="metronome-stop">■ 停止</button><button class="secondary-button" id="tap-tempo">敲击测速</button></div>
      </section>
      <div class="card section"><h3>怎样跟，而不是追</h3><ol><li>先听 2 小节，只让脚轻点地。</li><li>口数“1 & 2 & 3 & 4 &”，右手持续下上。</li><li>节奏型里的“·”表示不碰弦，但右手仍经过。</li><li>连续稳定 30 秒，再提高 3–5 BPM。</li></ol></div>
    </div>`;
    bindRhythmEvents();
    closeRhythmPlayer();
    syncRhythmUI();
  }

  function renderBeatCells(count) {
    const labels = count===8 ? ['1','&','2','&','3','&','4','&'] : ['1','e','&','a','2','e','&','a','3','e','&','a','4','e','&','a'];
    return labels.map((label,i)=>`<div class="beat" data-beat="${i}"><strong>${label}</strong><small>${i%(count===8?2:4)===0?'拍':'细分'}</small></div>`).join('');
  }

  function renderStrums(key) {
    return rhythmPatterns[key].marks.map((mark,i)=>`<div class="strum ${mark==='·'?'rest':''}" data-strum="${i}">${mark}</div>`).join('');
  }

  function bindRhythmEvents() {
    const bpmRange=document.getElementById('bpm-range'), bpmValue=document.getElementById('bpm-value'), pattern=document.getElementById('pattern-select'), subdivision=document.getElementById('subdivision-select');
    bpmRange.addEventListener('input',()=>{bpmValue.textContent=bpmRange.value;setRhythmBpm(bpmRange.value);});
    pattern.addEventListener('change',()=>{rhythmPattern=pattern.value;document.getElementById('strum-pattern').innerHTML=renderStrums(rhythmPattern);syncRhythmUI();});
    subdivision.addEventListener('change',()=>{rhythmSubdivision=Number(subdivision.value);rhythmStep=0;document.getElementById('beat-grid').style.gridTemplateColumns=`repeat(${rhythmSubdivision},1fr)`;document.getElementById('beat-grid').innerHTML=renderBeatCells(rhythmSubdivision);if(rhythmTimer)restartRhythmTimer();syncRhythmUI();});
    document.getElementById('metronome-toggle').addEventListener('click',()=>rhythmTimer?pauseRhythm():startRhythm());
    document.getElementById('metronome-stop').addEventListener('click',stopRhythm);
    let taps=[];
    document.getElementById('tap-tempo').addEventListener('click',()=>{const now=Date.now();taps=taps.filter(t=>now-t<3000);taps.push(now);if(taps.length>1){const gaps=taps.slice(1).map((t,i)=>t-taps[i]);setRhythmBpm(Math.round(60000/(gaps.reduce((a,b)=>a+b,0)/gaps.length)));}});
  }

  function startRhythm() {
    const tick=()=>{
      const beats=document.querySelectorAll('.beat'),strums=document.querySelectorAll('.strum');
      const divisionsPerBeat=rhythmSubdivision===8?2:4;
      beats.forEach((beat,index)=>beat.classList.toggle('active',index===rhythmStep));
      strums.forEach((strum,index)=>strum.classList.toggle('active',index===rhythmStep%(strums.length||1)));
      document.querySelectorAll('[data-player-beat]').forEach((beat,index)=>beat.classList.toggle('active',index===Math.floor(rhythmStep/divisionsPerBeat)));
      if(rhythmStep%divisionsPerBeat===0)ui.playClick(rhythmStep===0);
      rhythmStep=(rhythmStep+1)%rhythmSubdivision;
    };
    tick();
    rhythmTimer=setInterval(tick,60000/rhythmBpm/(rhythmSubdivision===8?2:4));
    syncRhythmUI();
  }

  function restartRhythmTimer() {
    clearInterval(rhythmTimer);
    rhythmTimer=null;
    startRhythm();
  }

  function pauseRhythm() {
    clearInterval(rhythmTimer);
    rhythmTimer=null;
    syncRhythmUI();
  }

  function stopRhythm() {
    clearInterval(rhythmTimer);rhythmTimer=null;rhythmStep=0;
    document.querySelectorAll('.beat,.strum').forEach(item=>item.classList.remove('active'));
    document.querySelectorAll('[data-player-beat]').forEach(item=>item.classList.remove('active'));
    syncRhythmUI();
  }

  function renderMap() {
    breadcrumb.textContent = '乐理知识地图';
    const groups = [
      ['声音与时间','先用耳朵和身体建立参照','声音 → 振动 → 频率 → 音高；拍 → 小节 → 拍号 → 节奏型'],
      ['音高系统','给听到的高低建立名字','音名 → 十二个音 → 半音/全音 → 指板音名'],
      ['距离与材料','认识音与音之间的关系','音程 → 大调音阶 → 三和弦 → 扩展和弦'],
      ['调与和声','理解音乐为何有“回家感”','调性 → 调内和弦 → 级数 → 和弦功能'],
      ['指板系统','把抽象关系变成形状','根音 → 八度 → 横按 → CAGED → 五声音阶'],
      ['歌曲应用','把规律用回真实音乐','节奏 + 级数 → 歌曲分析 → 移调 → 伴奏编配'],
      ['听觉与扒谱','从描述感觉到判断关系','主音听感 → 大小调 → 低音 → 和弦进行'],
      ['表达与即兴','用有限材料组织乐句','五声音阶 → 节奏 → 停顿 → 重复与变化']
    ];
    main.innerHTML=`<div class="page">${pageIntro('Knowledge map','乐理知识地图','乐理不是一堆散落名词。点击路线回看前置关系：先能听见和做到，再给它命名，最后在歌曲里反复使用。')}<div class="knowledge-map section">${groups.map((g,i)=>`<article class="knowledge-node"><small>路径 ${i+1}</small><h3>${g[0]}</h3><p>${g[1]}</p><small>${g[2]}</small></article>`).join('')}</div><section class="section"><div class="section-heading"><h2>关键依赖</h2><p class="muted">箭头左侧是右侧概念的前置知识。</p></div><div class="dependency-list">${course.dependencies.map(pair=>`<div class="dependency"><b>${pair[0]}</b>　→　${pair[1]}</div>`).join('')}</div></section><div class="why-box section"><strong>初学阶段采用的解释：</strong>我们先使用十二平均律、固定音名与流行音乐常见级数记法。首调唱名等另一套描述方式会并列说明，但不会在前置概念稳定前混用。</div></div>`;
  }

  const practicePlansByStage = {
    1: {
      20: [['3 分钟','放松坐姿与空弦热身'],['7 分钟','本课核心动作：慢、干净'],['6 分钟','节拍器单弦或爬格子'],['4 分钟','复述一个“为什么”']],
      30: [['4 分钟','持琴检查与空弦热身'],['10 分钟','本课核心动作'],['8 分钟','50–60 BPM 协调训练'],['5 分钟','回看上一课易错点'],['3 分钟','记录完成速度与感受']],
      45: [['5 分钟','放松与空弦热身'],['14 分钟','本课核心动作'],['10 分钟','节拍器协调训练'],['8 分钟','前两课间隔复习'],['5 分钟','指板或和弦实验室'],['3 分钟','练习记录']],
      60: [['7 分钟','姿势、发声与手指热身'],['18 分钟','本课核心动作'],['12 分钟','节拍器协调训练'],['10 分钟','前两课间隔复习'],['8 分钟','自由探索或简单曲目片段'],['5 分钟','自测与练习记录']]
    },
    2: {
      20: [['3 分钟','指尖热身与逐弦发声'],['7 分钟','本课和弦逐弦检查'],['6 分钟','两和弦慢速转换'],['4 分钟','记录一个具体卡点']],
      30: [['4 分钟','两个旧和弦热身'],['10 分钟','本课新和弦与按法'],['8 分钟','保留指或领路手指转换'],['5 分钟','四和弦慢循环'],['3 分钟','记录清楚转换次数']],
      45: [['5 分钟','开放和弦逐弦热身'],['14 分钟','本课核心和弦转换'],['10 分钟','最弱转换专项'],['8 分钟','Em–C–G–D 慢循环'],['5 分钟','和弦实验室核对组成音'],['3 分钟','练习记录']],
      60: [['7 分钟','八个开放和弦轮换热身'],['18 分钟','本课核心转换'],['12 分钟','定时转换与错误拆解'],['10 分钟','两组和弦循环'],['8 分钟','简单歌曲和弦片段'],['5 分钟','复盘与放松']]
    },
    3: {
      20: [['3 分钟','拍腿并数 1 2 3 4'],['7 分钟','本课右手空气运动'],['6 分钟','节拍器单和弦练习'],['4 分钟','录音回听速度']],
      30: [['4 分钟','脚点拍与口数'],['10 分钟','持续下上运动'],['8 分钟','本课节奏型单和弦'],['5 分钟','每四拍换和弦'],['3 分钟','记录稳定 BPM']],
      45: [['5 分钟','拍、小节与空气扫弦'],['14 分钟','本课节奏型拆解'],['10 分钟','休止或空过专项'],['8 分钟','Em–C–G–D 循环'],['5 分钟','节奏实验室跟拍'],['3 分钟','录音自查']],
      60: [['7 分钟','身体脉搏与八分细分'],['18 分钟','本课核心节奏'],['12 分钟','节拍器分段提速'],['10 分钟','四和弦完整循环'],['8 分钟','简单歌曲伴奏片段'],['5 分钟','回听并标记抢拍或拖拍']]
    },
    4: {
      20: [['3 分钟','六根弦方向快速确认'],['7 分钟','本课谱例慢速预读'],['6 分钟','把数字弹成声音'],['4 分钟','复述一个新记号']],
      30: [['4 分钟','弦号与品位随机反应'],['10 分钟','本课谱例分层练习'],['8 分钟','55–65 BPM 连续读谱'],['5 分钟','单独处理最难符号'],['3 分钟','不看正文口述规则']],
      45: [['5 分钟','空弦与弦号热身'],['14 分钟','新谱例预读与定位'],['10 分钟','节拍器慢速读谱'],['8 分钟','击弦、勾弦或滑音专项'],['5 分钟','回读前两课谱例'],['3 分钟','记录读错类型']],
      60: [['7 分钟','弦号、品位与节拍热身'],['18 分钟','本课综合谱例'],['12 分钟','难点分层与慢练'],['10 分钟','两个旧谱例间隔复习'],['8 分钟','自行抄写一小节六线谱'],['5 分钟','试听核对并放松']]
    },
    5: {
      20: [['3 分钟','空弦与12品高低比较'],['6 分钟','本课听觉按钮实验'],['6 分钟','同弦半音或全音定位'],['5 分钟','口述一个核心规律']],
      30: [['4 分钟','高低与音量辨别'],['8 分钟','本课十二音位置练习'],['7 分钟','音名与唱名对照'],['7 分钟','指板同弦数品'],['4 分钟','闭眼听辨与记录']],
      45: [['5 分钟','空弦、12品与振动热身'],['12 分钟','本课听觉实验'],['10 分钟','半音全音随机反应'],['8 分钟','十二音正逆序'],['6 分钟','前两课间隔复习'],['4 分钟','口述总结']],
      60: [['7 分钟','声音高低与同名八度热身'],['15 分钟','本课音名和指板位置'],['12 分钟','十二音与升降号练习'],['10 分钟','唱名跟唱与移调对照'],['9 分钟','第五阶段旧课随机复习'],['7 分钟','听辨、自测与记录']]
    },
    6: {
      20: [['3 分钟','六根空弦音名热身'],['7 分钟','六弦或五弦 0–12 品寻音'],['6 分钟','隐藏音名随机揭晓'],['4 分钟','口述一个指板循环规律']],
      30: [['4 分钟','标准调弦顺序与试听'],['8 分钟','六弦十二音正逆序'],['7 分钟','五弦十二音正逆序'],['7 分钟','同音跨弦寻找'],['4 分钟','记录最慢的三个位置']],
      45: [['5 分钟','空弦与 12 品同名热身'],['12 分钟','六弦和五弦锚点定位'],['10 分钟','半音逐品移动'],['8 分钟','随机指定音寻位'],['6 分钟','指板实验室核对'],['4 分钟','闭眼口述循环']],
      60: [['7 分钟','六根空弦与八度热身'],['15 分钟','两根低音弦完整十二音'],['12 分钟','六根弦同音位置'],['10 分钟','隐藏音名限时寻音'],['9 分钟','第六阶段综合测试'],['7 分钟','错位复盘与放松']]
    },
    7: {
      20: [['3 分钟','共同起点音听觉热身'],['6 分钟','七种重点音程试听'],['7 分钟','同弦品数构造音程'],['4 分钟','口述度数与半音区别']],
      30: [['4 分钟','上行下行与远近判断'],['8 分钟','小二大二、小三大三对照'],['7 分钟','纯四度纯五度形状'],['7 分钟','音程形状整体平移'],['4 分钟','记录最易混淆的一组']],
      45: [['5 分钟','一度到八度字母计数'],['12 分钟','七种重点音程听与说'],['10 分钟','五弦根音构造音程'],['8 分钟','跨弦形状与2弦修正'],['6 分钟','前两课间隔复习'],['4 分钟','口述总结']],
      60: [['7 分钟','方向、远近与八度热身'],['15 分钟','大小二度与大小三度专项'],['12 分钟','纯四度纯五度与八度形状'],['10 分钟','随机根音整体平移'],['9 分钟','第七阶段综合测试'],['7 分钟','错题验证与放松']]
    },
    8: {
      20: [['3 分钟','唱 C 大调上行下行'],['6 分钟','全全半结构点击试听'],['7 分钟','单弦或两弦音阶定位'],['4 分钟','口述 E–F、B–C 为什么是半音']],
      30: [['4 分钟','主音回家感听觉热身'],['8 分钟','C 大调音名与级数'],['7 分钟','全半音结构边弹边说'],['7 分钟','G 或 D 大调推导'],['4 分钟','记录升号出现的位置']],
      45: [['5 分钟','C、G、D 主音听感'],['12 分钟','C 大调指板路线'],['10 分钟','全全半全全全半构造'],['8 分钟','G 大调 F# 专项'],['6 分钟','D 大调 F#、C# 专项'],['4 分钟','闭眼口述结构']],
      60: [['7 分钟','三条大调音阶唱与听'],['15 分钟','C 大调两处指板路线'],['12 分钟','从不同主音推导结构'],['10 分钟','G、D 大调升号核对'],['9 分钟','第八阶段综合测试'],['7 分钟','错音修正与放松']]
    }
  };

  function renderPractice(minutes=30, stageNumber=1) {
    const stage = Math.min(8, Math.max(1, Number(stageNumber)));
    const stageFirstLesson = stageLessons(stage)[0];
    const plan=practicePlansByStage[stage][minutes];
    breadcrumb.textContent='今日练习';
    main.innerHTML=`<div class="page narrow">${pageIntro('Daily practice','今天练什么','先选择你正在学的阶段，再选择今天实际拥有的时间。这里不判断进度，只给你一份可立即照做的练习单。')}<div class="card section"><span class="tag">选择练习重点</span><h2 style="margin-top:12px">第 ${stage} 阶段 · ${stageInfo(stage).title}</h2><div class="practice-time-picker">${[1,2,3,4,5,6,7,8].map(n=>`<button class="time-button ${n===stage?'active':''}" data-practice-stage="${n}">阶段 ${n}</button>`).join('')}</div><p class="muted" style="margin-top:18px">再选择今天的练习时长，不需要为了“完整”勉强练满一小时。</p><div class="practice-time-picker">${[20,30,45,60].map(n=>`<button class="time-button ${n===Number(minutes)?'active':''}" data-minutes="${n}">${n} 分钟</button>`).join('')}</div></div><section class="section"><div class="section-heading"><h2>${minutes} 分钟方案</h2><span class="tag">合计 ${minutes} 分钟</span></div><div class="daily-plan">${plan.map((item,i)=>`<label class="plan-item"><span class="plan-time">${item[0]}</span><span><strong>${item[1]}</strong><small class="muted">${i===plan.length-1?'结束前放松双手，不带着紧张离开。':'完成质量优先，不追求速度。'}</small></span><input type="checkbox"></label>`).join('')}</div></section><div class="lesson-footer"><a class="secondary-button" href="#/lesson/${stageFirstLesson.id}">打开本阶段第 1 课</a><button class="primary-button" id="finish-practice">完成今日练习</button></div></div>`;
    document.querySelectorAll('[data-minutes]').forEach(button=>button.addEventListener('click',()=>renderPractice(Number(button.dataset.minutes),stage)));
    document.querySelectorAll('[data-practice-stage]').forEach(button=>button.addEventListener('click',()=>renderPractice(Number(minutes),Number(button.dataset.practiceStage))));
    document.getElementById('finish-practice').addEventListener('click',()=>showToast('今天的练习已完成。停在质量好的地方。'));
  }

  function renderGlossary() {
    breadcrumb.textContent='小白词典';
    main.innerHTML=`<div class="page">${pageIntro('Plain-language glossary','吉他与乐理小白词典','词典只能帮助回想。任何术语第一次出现在课程正文中，仍会用普通话重新解释。')}<div class="glossary-tools"><input class="search-input" id="glossary-search" type="search" placeholder="搜索：半音、BPM、根音……" aria-label="搜索术语"><span class="tag" id="glossary-count">${course.glossary.length} 个词</span></div><table class="glossary-table"><thead><tr><th>术语</th><th>最简单解释</th><th>什么时候用到</th></tr></thead><tbody id="glossary-body">${glossaryRows(course.glossary)}</tbody></table></div>`;
    document.getElementById('glossary-search').addEventListener('input',event=>{const q=event.target.value.trim().toLowerCase();const rows=course.glossary.filter(row=>row.join(' ').toLowerCase().includes(q));document.getElementById('glossary-body').innerHTML=glossaryRows(rows);document.getElementById('glossary-count').textContent=`${rows.length} 个词`;});
  }

  function glossaryRows(rows) {
    return rows.map(row=>`<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`).join('') || '<tr><td colspan="3" class="empty-state">没有找到这个词。试试更短的关键词。</td></tr>';
  }

  function renderNotFound() {
    breadcrumb.textContent='页面未找到';
    main.innerHTML='<div class="page narrow"><div class="empty-state"><h1>这里没有这节课</h1><p>可能是链接已改变。返回学习首页继续。</p><a class="primary-button" href="#/home">返回首页</a></div></div>';
  }

  function navigate() {
    const [route,param] = routeParts();
    if (route !== 'tuner') stopTuner(false);
    closeRhythmPlayer();
    document.body.classList.remove('nav-open');
    setActiveNav(route==='lesson'?'course':route);
    ({home:renderHome,course:renderCourse,lesson:()=>renderLesson(param),fretboard:renderFretboard,chords:renderChords,rhythm:renderRhythm,tuner:renderTuner,map:renderMap,practice:()=>renderPractice(),glossary:renderGlossary}[route] || renderNotFound)();
    window.scrollTo(0,0);
  }

  document.getElementById('menu-button').addEventListener('click',()=>document.body.classList.add('nav-open'));
  document.getElementById('close-nav').addEventListener('click',()=>document.body.classList.remove('nav-open'));
  document.getElementById('mobile-overlay').addEventListener('click',()=>document.body.classList.remove('nav-open'));
  document.getElementById('focus-button').addEventListener('click',()=>{document.body.classList.toggle('focus-mode');showToast(document.body.classList.contains('focus-mode')?'已进入专注阅读，按 Esc 退出':'已退出专注阅读');});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.body.classList.remove('focus-mode','nav-open');}});
  // iPad 从权限提示或后台回到网页时可能暂停音频上下文，重新激活后继续收音。
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && tunerStream && tunerAudioContext?.state === 'suspended') tunerAudioContext.resume().catch(() => {});
  });
  window.addEventListener('hashchange',navigate);
  window.addEventListener('beforeunload',()=>{stopRhythm();stopTuner(false);});
  initRhythmPlayer();
  navigate();
})();

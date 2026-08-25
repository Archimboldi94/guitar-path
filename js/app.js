/* 单页应用控制器：负责路由、课程渲染与互动实验室。 */
(function () {
  const course = window.CourseData;
  const lessons = [...window.StageOneLessons, ...window.StageTwoLessons, ...window.StageThreeLessons, ...window.StageFourLessons];
  const ui = window.GuitarComponents;
  const main = document.getElementById('main-content');
  const breadcrumb = document.getElementById('breadcrumb');
  const toast = document.getElementById('toast');
  let rhythmTimer = null;
  let rhythmStep = 0;

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
        <div class="home-section-heading"><div><div class="eyebrow">从这里选择</div><h2>四个阶段，先建立真正能用的基础</h2></div><a href="#/course">查看完整课程路线 →</a></div>
        <div class="home-stage-grid">
          ${course.stages.slice(0,4).map((stage,index) => `<a class="home-stage-card stage-tone-${index + 1}" href="#/lesson/${stage.id}-1">
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
            ['#/rhythm','03','节奏实验室','打开节拍器，跟着扫弦格子练习','节拍器 · 扫弦型']
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
    const available = stage.id <= 4;
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
        <div class="section-heading"><div><div class="eyebrow">Available now</div><h2>已上线 · 前 4 个完整阶段</h2></div><span class="tag">23 节课可立即学习</span></div>
        <div class="stage-jump-nav">${course.stages.slice(0,4).map(stage => `<button data-jump-stage="${stage.id}">阶段 ${stage.id} · ${stage.tone}</button>`).join('')}</div>
        ${course.stages.slice(0,4).map(stage => `<div class="available-stage-group" id="available-stage-${stage.id}"><h3>第 ${stage.id} 阶段 · ${stage.title}</h3><div class="available-course-grid">${stageLessons(stage.id).map(lesson => {
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
    '2-6': ['C','D','Dm','E','Em','G','A','Am']
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

  function renderLesson(id) {
    const lesson = lessons.find(item => item.id === id);
    if (!lesson) {
      main.innerHTML = `<div class="page narrow"><div class="empty-state"><h2>这节课仍在编写中</h2><p>完整位置已经放入课程路线。当前可完整学习前 4 个阶段的 23 节课。</p><a class="primary-button" href="#/course">返回课程目录</a></div></div>`;
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

  const rhythmPatterns = {
    quarter: {label:'四分音符', marks:['↓','·','↓','·','↓','·','↓','·']},
    eighth: {label:'八分音符', marks:['↓','↑','↓','↑','↓','↑','↓','↑']},
    pop: {label:'流行基础型', marks:['↓','·','↓','↑','·','↑','↓','↑']},
    rest: {label:'带休止练习', marks:['↓','·','·','↑','↓','·','↓','↑']}
  };

  function renderRhythm() {
    stopRhythm();
    breadcrumb.textContent = '节奏实验室';
    main.innerHTML = `<div class="page">
      ${pageIntro('Rhythm lab','节奏实验室','右手像钟摆一样持续运动；有些位置碰弦，有些位置只是经过。先看清，再跟着点击声练。')}
      <div class="lab-toolbar card"><div class="field"><label for="pattern-select">节奏型</label><select id="pattern-select">${Object.entries(rhythmPatterns).map(([key,val])=>`<option value="${key}">${val.label}</option>`).join('')}</select></div><div class="field"><label for="subdivision-select">显示细分</label><select id="subdivision-select"><option value="8">八分音符：1 & 2 & 3 & 4 &</option><option value="16">十六分音符：1 e & a</option></select></div></div>
      <section class="rhythm-stage">
        <div class="bpm-display"><strong id="bpm-value">60</strong><span>BPM</span></div>
        <div class="range-row"><input id="bpm-range" type="range" min="40" max="200" value="60"><span>40 — 200</span></div>
        <div class="beat-grid" id="beat-grid">${renderBeatCells(8)}</div>
        <div class="strum-pattern" id="strum-pattern">${renderStrums('quarter')}</div>
        <div class="hero-actions"><button class="primary-button" id="metronome-toggle">▶ 开始</button><button class="secondary-button" id="tap-tempo">敲击测速</button></div>
      </section>
      <div class="card section"><h3>怎样跟，而不是追</h3><ol><li>先听 2 小节，只让脚轻点地。</li><li>口数“1 & 2 & 3 & 4 &”，右手持续下上。</li><li>节奏型里的“·”表示不碰弦，但右手仍经过。</li><li>连续稳定 30 秒，再提高 3–5 BPM。</li></ol></div>
    </div>`;
    bindRhythmEvents();
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
    bpmRange.addEventListener('input',()=>{bpmValue.textContent=bpmRange.value;if(rhythmTimer){stopRhythm();startRhythm();}});
    pattern.addEventListener('change',()=>{document.getElementById('strum-pattern').innerHTML=renderStrums(pattern.value);});
    subdivision.addEventListener('change',()=>{stopRhythm();const count=Number(subdivision.value);document.getElementById('beat-grid').style.gridTemplateColumns=`repeat(${count},1fr)`;document.getElementById('beat-grid').innerHTML=renderBeatCells(count);});
    document.getElementById('metronome-toggle').addEventListener('click',()=>rhythmTimer?stopRhythm():startRhythm());
    let taps=[];
    document.getElementById('tap-tempo').addEventListener('click',()=>{const now=Date.now();taps=taps.filter(t=>now-t<3000);taps.push(now);if(taps.length>1){const gaps=taps.slice(1).map((t,i)=>t-taps[i]);const bpm=Math.round(60000/(gaps.reduce((a,b)=>a+b,0)/gaps.length));const value=Math.max(40,Math.min(200,bpm));bpmRange.value=value;bpmValue.textContent=value;}});
  }

  function startRhythm() {
    const bpm=Number(document.getElementById('bpm-range').value), count=Number(document.getElementById('subdivision-select').value);
    const interval=60000/bpm/(count===8?2:4);
    const tick=()=>{const beats=document.querySelectorAll('.beat'),strums=document.querySelectorAll('.strum');beats.forEach((b,i)=>b.classList.toggle('active',i===rhythmStep));strums.forEach((s,i)=>s.classList.toggle('active',i===rhythmStep%(strums.length||1)));if(rhythmStep%(count===8?2:4)===0)ui.playClick(rhythmStep===0);rhythmStep=(rhythmStep+1)%count;};
    tick();rhythmTimer=setInterval(tick,interval);document.getElementById('metronome-toggle').textContent='■ 停止';
  }

  function stopRhythm() {
    clearInterval(rhythmTimer);rhythmTimer=null;rhythmStep=0;
    document.querySelectorAll('.beat,.strum').forEach(item=>item.classList.remove('active'));
    const toggle=document.getElementById('metronome-toggle');if(toggle)toggle.textContent='▶ 开始';
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
    }
  };

  function renderPractice(minutes=30, stageNumber=1) {
    const stage = Math.min(4, Math.max(1, Number(stageNumber)));
    const stageFirstLesson = stageLessons(stage)[0];
    const plan=practicePlansByStage[stage][minutes];
    breadcrumb.textContent='今日练习';
    main.innerHTML=`<div class="page narrow">${pageIntro('Daily practice','今天练什么','先选择你正在学的阶段，再选择今天实际拥有的时间。这里不判断进度，只给你一份可立即照做的练习单。')}<div class="card section"><span class="tag">选择练习重点</span><h2 style="margin-top:12px">第 ${stage} 阶段 · ${stageInfo(stage).title}</h2><div class="practice-time-picker">${[1,2,3,4].map(n=>`<button class="time-button ${n===stage?'active':''}" data-practice-stage="${n}">阶段 ${n}</button>`).join('')}</div><p class="muted" style="margin-top:18px">再选择今天的练习时长，不需要为了“完整”勉强练满一小时。</p><div class="practice-time-picker">${[20,30,45,60].map(n=>`<button class="time-button ${n===Number(minutes)?'active':''}" data-minutes="${n}">${n} 分钟</button>`).join('')}</div></div><section class="section"><div class="section-heading"><h2>${minutes} 分钟方案</h2><span class="tag">合计 ${minutes} 分钟</span></div><div class="daily-plan">${plan.map((item,i)=>`<label class="plan-item"><span class="plan-time">${item[0]}</span><span><strong>${item[1]}</strong><small class="muted">${i===plan.length-1?'结束前放松双手，不带着紧张离开。':'完成质量优先，不追求速度。'}</small></span><input type="checkbox"></label>`).join('')}</div></section><div class="lesson-footer"><a class="secondary-button" href="#/lesson/${stageFirstLesson.id}">打开本阶段第 1 课</a><button class="primary-button" id="finish-practice">完成今日练习</button></div></div>`;
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
    stopRhythm();
    const [route,param] = routeParts();
    document.body.classList.remove('nav-open');
    setActiveNav(route==='lesson'?'course':route);
    ({home:renderHome,course:renderCourse,lesson:()=>renderLesson(param),fretboard:renderFretboard,chords:renderChords,rhythm:renderRhythm,map:renderMap,practice:()=>renderPractice(),glossary:renderGlossary}[route] || renderNotFound)();
    window.scrollTo(0,0);
  }

  document.getElementById('menu-button').addEventListener('click',()=>document.body.classList.add('nav-open'));
  document.getElementById('close-nav').addEventListener('click',()=>document.body.classList.remove('nav-open'));
  document.getElementById('mobile-overlay').addEventListener('click',()=>document.body.classList.remove('nav-open'));
  document.getElementById('focus-button').addEventListener('click',()=>{document.body.classList.toggle('focus-mode');showToast(document.body.classList.contains('focus-mode')?'已进入专注阅读，按 Esc 退出':'已退出专注阅读');});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.body.classList.remove('focus-mode','nav-open');}});
  window.addEventListener('hashchange',navigate);
  window.addEventListener('beforeunload',stopRhythm);
  navigate();
})();

/* 复用型教学组件：图解、指板、和弦图与简单声音合成。 */
(function () {
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const flatNames = { 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb' };
  const openMidi = [64, 59, 55, 50, 45, 40]; // 从 1 弦到 6 弦

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function noteFromMidi(midi) {
    return noteNames[midi % 12];
  }

  function frequencyFromMidi(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  let audioContext;
  function getAudioContext() {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  function playTone(midi, duration = .75, volume = .12, delay = 0) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequencyFromMidi(midi);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .03);
  }

  // 用快速衰减的基音与泛音模拟拨弦，比单一持续波形更接近吉他的听感。
  function playPluckedTone(midi, duration = 1.7, volume = .065, delay = 0) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const start = ctx.currentTime + delay;
    const frequency = frequencyFromMidi(midi);
    const filter = ctx.createBiquadFilter();
    const bodyGain = ctx.createGain();
    const fundamental = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, start);
    filter.frequency.exponentialRampToValueAtTime(850, start + duration);
    fundamental.type = 'triangle';
    fundamental.frequency.setValueAtTime(frequency, start);
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(frequency * 2.01, start);

    bodyGain.gain.setValueAtTime(.0001, start);
    bodyGain.gain.exponentialRampToValueAtTime(volume, start + .008);
    bodyGain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    overtoneGain.gain.setValueAtTime(volume * .32, start);
    overtoneGain.gain.exponentialRampToValueAtTime(.0001, start + Math.min(.55, duration));

    fundamental.connect(filter);
    overtone.connect(overtoneGain).connect(filter);
    filter.connect(bodyGain).connect(ctx.destination);
    fundamental.start(start);
    overtone.start(start);
    fundamental.stop(start + duration + .03);
    overtone.stop(start + duration + .03);
  }

  function playClick(accent) {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = accent ? 1050 : 720;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(accent ? .22 : .13, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .055);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + .06);
  }

  function anatomyDiagram() {
    return `<svg viewBox="0 0 900 260" role="img" aria-label="吉他主要结构图">
      <defs><linearGradient id="wood" x1="0" x2="1"><stop stop-color="#d7a066"/><stop offset="1" stop-color="#b8733e"/></linearGradient></defs>
      <path d="M705 47 C633 22 588 68 601 108 C608 128 608 132 601 152 C588 192 633 238 705 213 C785 268 878 206 855 130 C878 54 785 -8 705 47Z" fill="url(#wood)" stroke="#634025" stroke-width="4"/>
      <circle cx="742" cy="130" r="34" fill="#30241b" stroke="#f2d4a7" stroke-width="8"/>
      <rect x="172" y="106" width="548" height="48" rx="8" fill="#413126"/>
      <rect x="44" y="99" width="135" height="62" rx="18" fill="#8b582f" stroke="#634025" stroke-width="3"/>
      <g stroke="#e5d6b8">${Array.from({length:6},(_,i)=>`<line x1="70" y1="${113+i*7}" x2="825" y2="${113+i*7}" stroke-width="${1+i*.35}"/>`).join('')}</g>
      <g stroke="#b9a88d">${Array.from({length:12},(_,i)=>`<line x1="${210+i*39}" y1="106" x2="${210+i*39}" y2="154"/>`).join('')}</g>
      <g fill="#1e5b45" font-size="14" font-weight="700">
        <text x="48" y="38">琴头 / 弦钮</text><line x1="91" y1="45" x2="110" y2="98" stroke="#1e5b45"/>
        <text x="320" y="38">琴颈 · 指板 · 品丝</text><line x1="395" y1="45" x2="395" y2="104" stroke="#1e5b45"/>
        <text x="688" y="24">琴身</text><line x1="710" y1="30" x2="710" y2="48" stroke="#1e5b45"/>
        <text x="712" y="250">音孔</text><line x1="736" y1="230" x2="740" y2="167" stroke="#1e5b45"/>
        <text x="826" y="238">琴桥</text><line x1="840" y1="220" x2="826" y2="145" stroke="#1e5b45"/>
      </g>
    </svg>`;
  }

  function postureDiagram() {
    return `<svg viewBox="0 0 760 280" role="img" aria-label="稳定持琴三点支撑图">
      <g fill="none" stroke="#1e5b45" stroke-width="8" stroke-linecap="round"><circle cx="150" cy="52" r="29"/><path d="M150 82 L150 174 L110 253 M150 174 L215 249 M150 116 L250 146"/></g>
      <path d="M326 75 C277 56 247 87 256 117 C262 135 262 143 256 158 C247 189 279 220 326 199 C372 231 439 195 426 140 C439 86 372 46 326 75Z" fill="#c88b4e" stroke="#684328" stroke-width="3"/>
      <rect x="147" y="121" width="158" height="34" rx="5" fill="#49352a"/>
      <circle cx="340" cy="139" r="24" fill="#34251c"/>
      <g font-size="15" font-weight="700"><circle cx="249" cy="114" r="18" fill="#e2eee7"/><text x="244" y="120">1</text><text x="462" y="107" fill="#405048">身体贴住琴背</text>
      <circle cx="321" cy="205" r="18" fill="#e2eee7"/><text x="316" y="211">2</text><text x="462" y="151" fill="#405048">琴腰落在大腿</text>
      <circle cx="263" cy="158" r="18" fill="#f7ead9"/><text x="258" y="164">3</text><text x="462" y="195" fill="#405048">右前臂轻搭琴身</text></g>
      <text x="462" y="237" fill="#a64c46" font-size="13">左手不承担“托琴”的任务</text>
    </svg>`;
  }

  function pressureDiagram() {
    return `<svg viewBox="0 0 760 250" role="img" aria-label="正确按弦位置图">
      <rect x="35" y="40" width="690" height="155" rx="10" fill="#bc8148"/>
      ${[180,325,470,615].map(x=>`<line x1="${x}" y1="40" x2="${x}" y2="195" stroke="#e5dac6" stroke-width="8"/>`).join('')}
      <line x1="35" y1="118" x2="725" y2="118" stroke="#f3e8d3" stroke-width="4"/>
      <ellipse cx="277" cy="114" rx="26" ry="52" fill="#dca67a" stroke="#825d45" stroke-width="3"/>
      <path d="M276 58 L276 21" stroke="#1e5b45" stroke-width="3"/><text x="205" y="18" fill="#1e5b45" font-weight="700">正确：靠近前方品丝</text>
      <ellipse cx="390" cy="114" rx="27" ry="52" fill="#dca67a" opacity=".35" stroke="#a64c46" stroke-width="3"/>
      <path d="M390 169 L390 224" stroke="#a64c46" stroke-width="3"/><text x="329" y="244" fill="#a64c46" font-weight="700">较费力：按在格子中间</text>
      <text x="78" y="224" fill="#68736c">品格</text><text x="167" y="224" fill="#68736c">品丝</text>
    </svg>`;
  }

  function pickDiagram() {
    return `<svg viewBox="0 0 760 250" role="img" aria-label="拨片握法和交替拨弦图">
      <path d="M145 48 Q205 92 139 184 Q73 92 145 48" fill="#d98f3b" stroke="#71471f" stroke-width="4"/>
      <path d="M59 77 C96 57 127 69 153 95 L124 129 C95 119 68 108 45 115" fill="#e3af87" stroke="#865e47" stroke-width="3"/>
      <text x="72" y="221" fill="#1e5b45" font-weight="700">只露出 3–5 mm</text>
      <g stroke="#514438">${[76,104,132,160,188,216].map((y,i)=>`<line x1="330" y1="${y}" x2="690" y2="${y}" stroke-width="${1+i*.55}"/>`).join('')}</g>
      <path d="M470 52 L470 114" stroke="#1e5b45" stroke-width="5" marker-end="url(#down)"/><path d="M550 210 L550 147" stroke="#d98f3b" stroke-width="5" marker-end="url(#up)"/>
      <defs><marker id="down" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#1e5b45"/></marker><marker id="up" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#d98f3b"/></marker></defs>
      <text x="440" y="36" fill="#1e5b45" font-weight="700">下拨</text><text x="528" y="236" fill="#a46020" font-weight="700">上拨</text>
      <text x="350" y="235" fill="#68736c">动作小 · 手腕松 · 越过目标弦一点点</text>
    </svg>`;
  }

  function spiderDiagram() {
    return `<svg viewBox="0 0 760 255" role="img" aria-label="一二三四爬格子节拍图">
      <g transform="translate(45 35)"><rect width="670" height="122" rx="10" fill="#c18a50"/>
      ${[0,1,2,3,4].map(i=>`<line x1="${134*i}" y1="0" x2="${134*i}" y2="122" stroke="#ecdfc5" stroke-width="${i?5:2}"/>`).join('')}
      <line x1="0" y1="61" x2="670" y2="61" stroke="#f7eee0" stroke-width="3"/>
      ${[1,2,3,4].map((n,i)=>`<circle cx="${67+134*i}" cy="61" r="25" fill="${i===0?'#d98f3b':'#1e5b45'}"/><text x="${60+134*i}" y="69" fill="white" font-size="22" font-weight="800">${n}</text>`).join('')}</g>
      <g fill="#405048" font-size="16" font-weight="700">${[1,2,3,4].map((n,i)=>`<text x="${99+134*i}" y="205">拍 ${n}</text>`).join('')}</g>
      <text x="45" y="236" fill="#68736c">点击到达时：左手已按稳 → 右手拨响 → 保持余音到下一拍</text>
    </svg>`;
  }

  function chordReadingDiagram() {
    const strings = [190,250,310,370,430,490];
    return `<svg viewBox="0 0 760 290" role="img" aria-label="和弦图阅读方法">
      <g transform="translate(0 0)"><rect x="150" y="40" width="380" height="200" rx="10" fill="#f5f3ed" stroke="#d9d7cf"/>
      ${strings.map(x=>`<line x1="${x}" y1="72" x2="${x}" y2="218" stroke="#35443c" stroke-width="2"/>`).join('')}
      ${[72,108,145,182,218].map((y,i)=>`<line x1="190" y1="${y}" x2="490" y2="${y}" stroke="#35443c" stroke-width="${i===0?7:2}"/>`).join('')}
      <text x="190" y="60" text-anchor="middle" fill="#a64c46" font-size="20">×</text><circle cx="250" cy="53" r="8" fill="none" stroke="#1e5b45" stroke-width="2"/>
      <circle cx="310" cy="126" r="16" fill="#1e5b45"/><text x="310" y="132" text-anchor="middle" fill="white" font-weight="700">2</text>
      <circle cx="370" cy="126" r="16" fill="#d98f3b"/><text x="370" y="132" text-anchor="middle" fill="white" font-weight="700">3</text></g>
      <g fill="#405048" font-size="14" font-weight="700"><text x="35" y="66">左边 = 粗 6 弦</text><line x1="135" y1="62" x2="185" y2="62" stroke="#1e5b45"/>
      <text x="558" y="66">右边 = 细 1 弦</text><line x1="495" y1="62" x2="548" y2="62" stroke="#1e5b45"/>
      <text x="35" y="138">数字 = 手指</text><line x1="130" y1="135" x2="290" y2="126" stroke="#1e5b45"/>
      <text x="558" y="138">横格 = 品位</text><line x1="490" y1="145" x2="548" y2="137" stroke="#1e5b45"/></g>
      <text x="180" y="276" fill="#68736c">× 不发声　○ 空弦　黑点所在格看品位　点内数字看手指</text>
    </svg>`;
  }

  function tabLessonDiagram(type) {
    const configs = {
      'tab-orientation': {
        title:'六线谱方向：上细下粗',
        items:[{string:1,x:300,text:'最细 · 1弦'},{string:6,x:470,text:'最粗 · 6弦'}],
        footer:'谱面从上往下：1、2、3、4、5、6 弦'
      },
      'tab-numbers': {
        title:'先看横线，再读数字',
        items:[{string:1,x:170,text:'0'},{string:1,x:270,text:'1'},{string:1,x:370,text:'3'},{string:1,x:470,text:'1'}],
        bars:[120,320,520], footer:'0 = 空弦　数字 = 品位　竖线 = 小节线'
      },
      'tab-legato': {
        title:'数字之间的符号说明“怎样连接”',
        items:[{string:1,x:155,text:'0 h 2'},{string:1,x:300,text:'2 p 0'},{string:1,x:445,text:'3 / 5'},{string:1,x:590,text:'5 \\ 3'}],
        footer:'h 击弦　p 勾弦　/ 向高品滑　\\ 向低品滑'
      },
      'tab-articulation': {
        title:'同样是记号，改变的声音维度不同',
        items:[{string:2,x:160,text:'8 b 10'},{string:6,x:315,text:'PM——'},{string:4,x:460,text:'× × ×'},{string:2,x:600,text:'7 ~'}],
        footer:'b 改音高　PM 改延音　× 做打击　~ 做波动'
      },
      'tab-reading-check': {
        title:'两小节综合预读',
        items:[{string:1,x:150,text:'0'},{string:1,x:230,text:'1'},{string:1,x:310,text:'3'},{string:1,x:390,text:'1'},{string:2,x:485,text:'0'},{string:2,x:555,text:'1'},{string:1,x:640,text:'0h1'}],
        bars:[105,430,690], footer:'结构 → 弦与品 → 节奏 → 技巧'
      }
    };
    const config = configs[type] || configs['tab-numbers'];
    const lineY = stringNumber => 64 + (stringNumber - 1) * 31;
    return `<svg viewBox="0 0 760 285" role="img" aria-label="${config.title}">
      <text x="380" y="28" text-anchor="middle" fill="#1e5b45" font-size="16" font-weight="800">${config.title}</text>
      ${[1,2,3,4,5,6].map(stringNumber=>`<g><text x="54" y="${lineY(stringNumber)+5}" text-anchor="end" fill="#68736c" font-size="12">${stringNumber}弦</text><line x1="72" y1="${lineY(stringNumber)}" x2="704" y2="${lineY(stringNumber)}" stroke="#59645e" stroke-width="${1+(stringNumber-1)*.28}"/></g>`).join('')}
      ${(config.bars||[]).map(x=>`<line x1="${x}" y1="52" x2="${x}" y2="231" stroke="#aeb4af" stroke-width="2"/>`).join('')}
      ${config.items.map(item=>`<g><rect x="${item.x-31}" y="${lineY(item.string)-15}" width="62" height="29" rx="10" fill="#fffef9" stroke="#d9d7cf"/><text x="${item.x}" y="${lineY(item.string)+6}" text-anchor="middle" fill="${item.text.includes('1弦')||item.text.includes('0h1')?'#d17f2f':'#1e5b45'}" font-size="14" font-weight="800">${item.text}</text></g>`).join('')}
      <text x="380" y="270" text-anchor="middle" fill="#68736c" font-size="13">${config.footer}</text>
    </svg>`;
  }

  function chordSheetDiagram() {
    return `<svg viewBox="0 0 760 270" role="img" aria-label="和弦名称与节奏信息分工图">
      <text x="380" y="28" text-anchor="middle" fill="#1e5b45" font-size="16" font-weight="800">左手看和弦名，右手看时间网格</text>
      ${['Em','C','G','D'].map((name,index)=>`<g><rect x="${55+index*174}" y="58" width="130" height="72" rx="13" fill="${index%2?'#f7ead9':'#e2eee7'}" stroke="#d9d7cf"/><text x="${120+index*174}" y="88" text-anchor="middle" fill="#18221d" font-size="22" font-weight="800">${name}</text><text x="${120+index*174}" y="114" text-anchor="middle" fill="#68736c" font-size="11">一个小节 · 4 拍</text></g>`).join('')}
      ${['1','2','3','4'].map((beat,index)=>`<g><circle cx="${245+index*88}" cy="183" r="19" fill="${index===0?'#d98f3b':'#1e5b45'}"/><text x="${245+index*88}" y="189" text-anchor="middle" fill="white" font-weight="800">${beat}</text></g>`).join('')}
      <text x="150" y="189" text-anchor="middle" fill="#68736c" font-size="13">右手节奏</text>
      <text x="380" y="244" text-anchor="middle" fill="#68736c" font-size="13">只有和弦名时，仍要另外确认拍号、速度、持续拍数与扫弦型</text>
    </svg>`;
  }

  function processDiagram(type) {
    const configs = {
      'anchor-change': [['C','保留食指 + 中指','移动无名指','Am'],'少动一根手指，就少一次重新定位'],
      'lead-finger': [['Em','中指先去 6弦3品','其他手指跟上','G'],'固定落指顺序，熟练后自然合并'],
      'small-chords': [['D：从4弦','比较 1 弦','Dm：从4弦','A：从5弦'],'空间拥挤时先调角度，不先加力'],
      'chord-loop': [['Em · 4拍','C · 4拍','G · 4拍','D · 4拍'],'第 4 拍仍在响时，脑中已知道下一个和弦'],
      'change-test': [['按清目标','计时 60秒','只计可用','拆解卡点'],'测试负责发现问题，慢练负责解决问题']
    };
    const config = configs[type] || configs['anchor-change'];
    return `<svg viewBox="0 0 760 245" role="img" aria-label="${config[1]}">
      ${config[0].map((text,i)=>`<g><rect x="${28+i*184}" y="58" width="150" height="92" rx="14" fill="${i===0||i===3?'#e2eee7':'#f7ead9'}" stroke="${i===0||i===3?'#8eb6a4':'#dcb47f'}"/><text x="${103+i*184}" y="98" text-anchor="middle" fill="#18221d" font-size="15" font-weight="700">${text}</text><text x="${103+i*184}" y="124" text-anchor="middle" fill="#68736c" font-size="11">步骤 ${i+1}</text>${i<3?`<text x="${190+i*184}" y="111" text-anchor="middle" fill="#1e5b45" font-size="24">→</text>`:''}</g>`).join('')}
      <text x="380" y="205" text-anchor="middle" fill="#1e5b45" font-size="15" font-weight="700">${config[1]}</text>
    </svg>`;
  }

  function rhythmLessonDiagram(type) {
    const configs = {
      'beat-bar': {labels:['1','2','3','4','1','2','3','4'], marks:['●','●','●','●','●','●','●','●'], footer:'拍持续前进；小节线只负责分组，不让时间停下'},
      'meter-bpm': {labels:['1','2','3','4','1','2','3','4'], marks:['60','60','60','60','80','80','80','80'], footer:'4/4 决定每组四拍；BPM 决定这些拍走多快'},
      'quarter-strum': {labels:['1','&','2','&','3','&','4','&'], marks:['↓','·','↓','·','↓','·','↓','·'], footer:'发声的下扫与不发声的回程，共同组成持续往返'},
      'eighth-strum': {labels:['1','&','2','&','3','&','4','&'], marks:['↓','↑','↓','↑','↓','↑','↓','↑'], footer:'数字向下，& 向上；每个位置之间的时间相等'},
      'rest-strum': {labels:['1','&','2','&','3','&','4','&'], marks:['↓','↑','空','↑','↓','↑','↓','↑'], footer:'“空”仍有向下运动，只是拨片没有碰到琴弦'},
      'pop-strum': {labels:['1','&','2','&','3','&','4','&'], marks:['↓','·','↓','↑','·','↑','↓','↑'], footer:'↓ · ↓ ↑ · ↑ ↓ ↑：六次发声，八次经过'}
    };
    const c = configs[type] || configs['eighth-strum'];
    return `<svg viewBox="0 0 760 250" role="img" aria-label="${c.footer}">
      <line x1="58" y1="104" x2="702" y2="104" stroke="#b8b6ae" stroke-width="3"/>
      ${c.labels.map((label,i)=>{const x=74+i*88;const strong=i===0||i===4;const silent=c.marks[i]==='·'||c.marks[i]==='空';return `<g><circle cx="${x}" cy="104" r="${strong?24:19}" fill="${silent?'#e7e5df':strong?'#d98f3b':'#1e5b45'}"/><text x="${x}" y="110" text-anchor="middle" fill="${silent?'#68736c':'white'}" font-size="${c.marks[i].length>1?11:20}" font-weight="800">${c.marks[i]}</text><text x="${x}" y="55" text-anchor="middle" fill="#405048" font-size="17" font-weight="700">${label}</text>${i===3?'<line x1="118" y1="25" x2="118" y2="186" transform="translate(308 0)" stroke="#d9d7cf" stroke-dasharray="5 5"/>':''}</g>`;}).join('')}
      <text x="380" y="208" text-anchor="middle" fill="#1e5b45" font-size="15" font-weight="700">${c.footer}</text>
    </svg>`;
  }

  function renderLessonDiagram(type) {
    const fixed = {'guitar-anatomy': anatomyDiagram, 'posture': postureDiagram, 'fret-pressure': pressureDiagram, 'pick-motion': pickDiagram, 'spider-grid': spiderDiagram, 'chord-reading': chordReadingDiagram};
    if (fixed[type]) return fixed[type]();
    if (type === 'chord-sheet-reading') return chordSheetDiagram();
    if (['tab-orientation','tab-numbers','tab-legato','tab-articulation','tab-reading-check'].includes(type)) return tabLessonDiagram(type);
    if (['anchor-change','lead-finger','small-chords','chord-loop','change-test'].includes(type)) return processDiagram(type);
    if (['beat-bar','meter-bpm','quarter-strum','eighth-strum','rest-strum','pop-strum'].includes(type)) return rhythmLessonDiagram(type);
    return anatomyDiagram();
  }

  const chordData = {
    C:  { full:'C Major', cn:'C 大三和弦', notes:'C · E · G', formula:'根音 + 大三度 + 纯五度', frets:[-1,3,2,0,1,0], fingers:[0,3,2,0,1,0], sounded:['X','C','E','G','C','E'], roots:[1,4], reason:'从 5 弦开始，实际发出 C、E、G。C 和 E 重复出现，但不同音仍只有这三类，所以和弦性质不变。' },
    D:  { full:'D Major', cn:'D 大三和弦', notes:'D · F# · A', formula:'根音 + 大三度 + 纯五度', frets:[-1,-1,0,2,3,2], fingers:[0,0,0,1,3,2], sounded:['X','X','D','A','D','F#'], roots:[2,4], reason:'从 4 弦 D 开始，D、F#、A 共同形成 D 大三和弦。' },
    Dm: { full:'D Minor', cn:'D 小三和弦', notes:'D · F · A', formula:'根音 + 小三度 + 纯五度', frets:[-1,-1,0,2,3,1], fingers:[0,0,0,2,3,1], sounded:['X','X','D','A','D','F'], roots:[2,4], reason:'D 到 F 是小三度；它与纯五度 A 一起形成 D 小三和弦。' },
    E:  { full:'E Major', cn:'E 大三和弦', notes:'E · G# · B', formula:'根音 + 大三度 + 纯五度', frets:[0,2,2,1,0,0], fingers:[0,2,3,1,0,0], sounded:['E','B','E','G#','B','E'], roots:[0,2,5], reason:'六根弦都属于 E、G#、B 三类音；最低音就是根音 E。' },
    Em: { full:'E Minor', cn:'E 小三和弦', notes:'E · G · B', formula:'根音 + 小三度 + 纯五度', frets:[0,2,2,0,0,0], fingers:[0,2,3,0,0,0], sounded:['E','B','E','G','B','E'], roots:[0,2,5], reason:'只把 E 大三和弦的 G# 降半音到 G，就把大三度变成小三度。' },
    F:  { full:'F Major', cn:'F 大三和弦', notes:'F · A · C', formula:'根音 + 大三度 + 纯五度', frets:[1,3,3,2,1,1], fingers:[1,3,4,2,1,1], sounded:['F','C','F','A','C','F'], roots:[0,2,5], barre:1, reason:'它相当于把 E 形状整体升高一品；食指替代了原本的开放弦，所以需要横按。' },
    G:  { full:'G Major', cn:'G 大三和弦', notes:'G · B · D', formula:'根音 + 大三度 + 纯五度', frets:[3,2,0,0,0,3], fingers:[2,1,0,0,0,3], sounded:['G','B','D','G','B','G'], roots:[0,3,5], reason:'最低的 6 弦 3 品是 G；所有发声音归并后是 G、B、D。' },
    A:  { full:'A Major', cn:'A 大三和弦', notes:'A · C# · E', formula:'根音 + 大三度 + 纯五度', frets:[-1,0,2,2,2,0], fingers:[0,0,1,2,3,0], sounded:['X','A','E','A','C#','E'], roots:[1,3], reason:'从 5 弦 A 开始，发出的 A、C#、E 满足大三和弦结构。' },
    Am: { full:'A Minor', cn:'A 小三和弦', notes:'A · C · E', formula:'根音 + 小三度 + 纯五度', frets:[-1,0,2,2,1,0], fingers:[0,0,2,3,1,0], sounded:['X','A','E','A','C','E'], roots:[1,3], reason:'A 到 C 是小三度；与 E 组成 A、C、E，因此是 A 小三和弦。' }
  };

  const fingerNames = ['','食指','中指','无名指','小指'];

  function chordPositions(name) {
    const data = chordData[name];
    if (!data) return [];
    if (data.barre) {
      return [{finger:1, text:`食指横按第 ${data.barre} 品`}, ...data.frets.map((fret, index) => {
        const finger = data.fingers[index];
        return fret > data.barre && finger > 1 ? {finger, text:`${fingerNames[finger]}：${6-index} 弦 ${fret} 品`} : null;
      }).filter(Boolean)];
    }
    return data.frets.map((fret, index) => {
      const finger = data.fingers[index];
      return fret > 0 && finger ? {finger, text:`${fingerNames[finger]}：${6-index} 弦 ${fret} 品`} : null;
    }).filter(Boolean);
  }

  function playChord(name) {
    const data = chordData[name];
    if (!data) return;
    data.frets.forEach((fret, stringIndex) => {
      if (fret >= 0) playPluckedTone(openMidi[5-stringIndex] + fret, 1.8, .058, stringIndex * .065);
    });
  }

  // 按“琴弦、品位、拍数”播放短谱例，供读谱课程把符号与声音对应起来。
  function playTabSequence(sequence, bpm = 72) {
    const beatSeconds = 60 / bpm;
    let cursor = 0;
    sequence.forEach(([stringNumber, fret, beats = 1]) => {
      playPluckedTone(openMidi[stringNumber - 1] + fret, Math.min(1.55, beatSeconds * beats * .92), .07, cursor);
      cursor += beatSeconds * beats;
    });
    return cursor;
  }

  function chordSvg(name) {
    const data = chordData[name];
    const xPositions = [40,72,104,136,168,200];
    let svg = `<svg class="chord-svg" viewBox="0 0 240 330" role="img" aria-label="${escapeHtml(name)} 和弦图">`;
    svg += `<text x="120" y="28" text-anchor="middle" font-size="22" font-weight="800" fill="#18221d">${escapeHtml(name)}</text>`;
    for (let f=0; f<=5; f++) svg += `<line x1="40" y1="${70+f*42}" x2="200" y2="${70+f*42}" stroke="#3d443f" stroke-width="${f===0?7:2}"/>`;
    xPositions.forEach(x => { svg += `<line x1="${x}" y1="70" x2="${x}" y2="280" stroke="#3d443f" stroke-width="2"/>`; });
    if (data.barre) svg += `<rect x="31" y="82" width="178" height="28" rx="14" fill="#1e5b45" opacity=".88"/>`;
    data.frets.forEach((f, i) => {
      const x=xPositions[i];
      if (f === -1) svg += `<text x="${x}" y="57" text-anchor="middle" font-size="18" fill="#a64c46">×</text>`;
      else if (f === 0) svg += `<circle cx="${x}" cy="51" r="7" fill="none" stroke="#1e5b45" stroke-width="2"/>`;
      else { const y=70+(f-.5)*42; svg += `<circle cx="${x}" cy="${y}" r="14" fill="${data.roots.includes(i)?'#d98f3b':'#1e5b45'}"/><text x="${x}" y="${y+5}" text-anchor="middle" font-size="12" font-weight="800" fill="white">${data.fingers[i] || ''}</text>`; }
    });
    svg += `<text x="120" y="312" text-anchor="middle" font-size="12" fill="#68736c">从左到右：6 弦 → 1 弦</text></svg>`;
    return svg;
  }

  function renderFretboard(options) {
    const selected = options.selected || 'C';
    const mode = options.mode || 'note';
    const rootIndex = noteNames.indexOf(selected);
    const scaleSteps = mode === 'major' ? [0,2,4,5,7,9,11] : mode === 'minor' ? [0,2,3,5,7,8,10] : [0];
    const intervalSteps = mode.startsWith('interval-') ? [0, Number(mode.split('-')[1])] : null;
    const shownSteps = intervalSteps || scaleSteps;
    const rows = openMidi.map((open, stringIndex) => {
      const cells = Array.from({length:13}, (_, fret) => {
        const midi = open + fret;
        const note = noteFromMidi(midi);
        const step = (noteNames.indexOf(note) - rootIndex + 12) % 12;
        const visible = shownSteps.includes(step);
        const display = flatNames[note] ? `${note}/${flatNames[note]}` : note;
        return `<div class="fret-cell ${fret===0?'open':''}" data-fret="${fret}"><span class="string-line" style="--string-size:${1+(5-stringIndex)*.45}px"></span>${visible ? `<button class="note-dot ${step===0?'root':''}" data-midi="${midi}" title="${display} · ${fret} 品">${display}</button>` : ''}</div>`;
      }).join('');
      return `<div class="fret-string">${cells}</div>`;
    }).join('');
    const numbers = Array.from({length:13},(_,i)=>`<span>${i}</span>`).join('');
    return `<div class="fretboard-wrap"><div class="fretboard">${rows}</div><div class="fret-numbers">${numbers}</div></div>`;
  }

  window.GuitarComponents = { noteNames, flatNames, openMidi, chordData, chordSvg, chordPositions, playChord, playTabSequence, renderFretboard, renderLessonDiagram, playTone, playClick, escapeHtml, noteFromMidi };
})();

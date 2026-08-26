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

  // 使用 YIN 差分法从麦克风波形中估算基频，避免把较强的泛音误判成目标音。
  function detectPitch(samples, sampleRate, minFrequency = 70, maxFrequency = 380) {
    if (!samples || samples.length < 1024 || !sampleRate) return null;
    const length = Math.min(samples.length, 4096);
    let mean = 0;
    let energy = 0;
    for (let index = 0; index < length; index += 1) mean += samples[index];
    mean /= length;
    for (let index = 0; index < length; index += 1) {
      const centered = samples[index] - mean;
      energy += centered * centered;
    }
    const volume = Math.sqrt(energy / length);
    // 手机与 iPad 距离木吉他稍远时输入会很弱；降低门槛后仍由 YIN 清晰度过滤环境噪声。
    if (volume < .0025) return null;

    const minimumLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
    const maximumLag = Math.min(Math.ceil(sampleRate / minFrequency), Math.floor(length / 2));
    const compareLength = length - maximumLag;
    const difference = new Float32Array(maximumLag + 1);
    for (let lag = 1; lag <= maximumLag; lag += 1) {
      let sum = 0;
      for (let index = 0; index < compareLength; index += 1) {
        const delta = (samples[index] - mean) - (samples[index + lag] - mean);
        sum += delta * delta;
      }
      difference[lag] = sum;
    }

    let runningSum = 0;
    for (let lag = 1; lag <= maximumLag; lag += 1) {
      runningSum += difference[lag];
      difference[lag] = runningSum ? difference[lag] * lag / runningSum : 1;
    }

    let bestLag = -1;
    for (let lag = minimumLag; lag < maximumLag; lag += 1) {
      if (difference[lag] < .17) {
        while (lag + 1 <= maximumLag && difference[lag + 1] < difference[lag]) lag += 1;
        bestLag = lag;
        break;
      }
    }
    if (bestLag < 0) {
      let bestValue = .38;
      for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
        if (difference[lag] < bestValue) {
          bestValue = difference[lag];
          bestLag = lag;
        }
      }
    }
    if (bestLag < 0) return null;

    const left = difference[bestLag - 1] || difference[bestLag];
    const center = difference[bestLag];
    const right = difference[bestLag + 1] || difference[bestLag];
    const curve = left - 2 * center + right;
    const refinedLag = curve ? bestLag + .5 * (left - right) / curve : bestLag;
    const frequency = sampleRate / refinedLag;
    if (!Number.isFinite(frequency) || frequency < minFrequency || frequency > maxFrequency) return null;
    return { frequency, clarity: 1 - center, volume };
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

  // 第五阶段用同一套紫色视觉区分“固定音高”和“相对位置”两类坐标。
  function pitchLessonDiagram(type) {
    if (type === 'pitch-vibration') {
      const wave = (y,cycles) => Array.from({length:121},(_,i)=>`${i?'L':'M'} ${70+i*5.2} ${y+Math.sin(i/120*Math.PI*2*cycles)*28}`).join(' ');
      return `<svg viewBox="0 0 760 285" role="img" aria-label="振动快慢与音高关系图">
        <text x="65" y="32" fill="#405048" font-size="14" font-weight="800">振动较慢 · 听起来较低</text><path d="${wave(86,3)}" fill="none" stroke="#1e5b45" stroke-width="5" stroke-linecap="round"/>
        <text x="65" y="157" fill="#405048" font-size="14" font-weight="800">振动较快 · 听起来较高</text><path d="${wave(214,8)}" fill="none" stroke="#77558c" stroke-width="5" stroke-linecap="round"/>
        <text x="380" y="276" text-anchor="middle" fill="#68736c" font-size="12">同样时间里往返次数更多，音高通常更高</text>
      </svg>`;
    }
    if (type === 'note-dual-names') {
      const names=[['C','Do'],['D','Re'],['E','Mi'],['F','Fa'],['G','Sol'],['A','La'],['B','Si']];
      return `<svg viewBox="0 0 760 285" role="img" aria-label="音名与唱名双层对照图">
        <text x="48" y="44" fill="#68736c" font-size="12">固定音名</text><text x="48" y="201" fill="#68736c" font-size="12">唱名</text>
        ${names.map((item,index)=>{const x=115+index*91;return `<g><rect x="${x-34}" y="64" width="68" height="68" rx="16" fill="${index===0?'#77558c':'#e7edf0'}"/><text x="${x}" y="107" text-anchor="middle" fill="${index===0?'white':'#26352e'}" font-size="24" font-weight="800">${item[0]}</text><path d="M${x} 137 L${x} 174" stroke="#b8b6ae" stroke-width="2"/><circle cx="${x}" cy="211" r="30" fill="${index===0?'#f0c272':'#e2eee7'}"/><text x="${x}" y="217" text-anchor="middle" fill="#26352e" font-size="14" font-weight="800">${item[1]}</text></g>`;}).join('')}
        <text x="380" y="272" text-anchor="middle" fill="#77558c" font-size="13" font-weight="800">两套名字在 C 大调语境中整齐对齐，但解决的问题不同</text>
      </svg>`;
    }
    if (type === 'chromatic-wheel') {
      const names=['C','C# / Db','D','D# / Eb','E','F','F# / Gb','G','G# / Ab','A','A# / Bb','B'];
      return `<svg viewBox="0 0 760 320" role="img" aria-label="十二个音循环图">
        <circle cx="380" cy="158" r="112" fill="none" stroke="#d9d7cf" stroke-width="3"/>
        ${names.map((name,index)=>{const angle=-Math.PI/2+index*Math.PI*2/12;const x=380+Math.cos(angle)*112;const y=158+Math.sin(angle)*112;const basic=!name.includes('/');return `<g><circle cx="${x}" cy="${y}" r="${basic?30:26}" fill="${index===0?'#d98f3b':basic?'#1e5b45':'#77558c'}"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="white" font-size="${name.length>3?9:13}" font-weight="800">${name}</text></g>`;}).join('')}
        <circle cx="380" cy="158" r="55" fill="#f5f3ed" stroke="#d9d7cf"/><text x="380" y="151" text-anchor="middle" fill="#77558c" font-size="25" font-weight="800">12</text><text x="380" y="175" text-anchor="middle" fill="#68736c" font-size="12">半音一整轮</text>
        <text x="380" y="313" text-anchor="middle" fill="#68736c" font-size="12">走完第 12 步，回到更高的同名音</text>
      </svg>`;
    }
    if (type === 'semitone-whole') {
      return `<svg viewBox="0 0 760 285" role="img" aria-label="吉他上一品半音两品全音图">
        <rect x="70" y="78" width="620" height="94" rx="12" fill="#b97b43"/>
        ${[70,225,380,535,690].map((x,index)=>`<line x1="${x}" y1="78" x2="${x}" y2="172" stroke="#ecdfc5" stroke-width="${index===0?3:7}"/>`).join('')}
        <line x1="70" y1="125" x2="690" y2="125" stroke="#f5ead6" stroke-width="4"/>
        ${[['C',147,'#1e5b45'],['C# / Db',302,'#77558c'],['D',457,'#d98f3b']].map(item=>`<g><circle cx="${item[1]}" cy="125" r="24" fill="${item[2]}"/><text x="${item[1]}" y="131" text-anchor="middle" fill="white" font-size="${item[0].length>3?10:16}" font-weight="800">${item[0]}</text></g>`).join('')}
        <path d="M147 61 Q224 22 302 61" fill="none" stroke="#77558c" stroke-width="3"/><text x="224" y="29" text-anchor="middle" fill="#77558c" font-size="13" font-weight="800">一品 = 半音</text>
        <path d="M147 199 Q302 255 457 199" fill="none" stroke="#d98f3b" stroke-width="3"/><text x="302" y="260" text-anchor="middle" fill="#a35f20" font-size="13" font-weight="800">两品 = 全音</text>
        <text x="612" y="207" fill="#68736c" font-size="11">向琴身升高 →</text>
      </svg>`;
    }
    if (type === 'natural-neighbors') {
      const whites=['C','D','E','F','G','A','B','C'];
      const blacks=[1,2,4,5,6];
      return `<svg viewBox="0 0 760 300" role="img" aria-label="钢琴键盘上 E-F 与 B-C 相邻图">
        <g transform="translate(76 45)">${whites.map((name,index)=>`<g><rect x="${index*76}" width="76" height="178" fill="white" stroke="#3d443f" stroke-width="2"/><text x="${index*76+38}" y="158" text-anchor="middle" fill="#26352e" font-size="17" font-weight="800">${name}</text></g>`).join('')}${blacks.map(index=>`<rect x="${index*76-23}" width="46" height="108" rx="0 0 7 7" fill="#26352e"/>`).join('')}</g>
        <path d="M266 232 L266 251 L342 251 L342 232" fill="none" stroke="#d98f3b" stroke-width="4"/><text x="304" y="278" text-anchor="middle" fill="#a35f20" font-size="13" font-weight="800">E–F：没有中间键 · 半音</text>
        <path d="M570 232 L570 251 L646 251 L646 232" fill="none" stroke="#77558c" stroke-width="4"/><text x="608" y="295" text-anchor="middle" fill="#77558c" font-size="13" font-weight="800">B–C：没有中间键 · 半音</text>
      </svg>`;
    }
    const rows=[{title:'固定唱名',start:'C 大调',notes:[['C','Do'],['D','Re'],['E','Mi'],['F','Fa'],['G','Sol']]},{title:'首调唱名',start:'G 大调',notes:[['G','Do'],['A','Re'],['B','Mi'],['C','Fa'],['D','Sol']]}];
    return `<svg viewBox="0 0 760 310" role="img" aria-label="固定唱名与首调唱名对照图">
      ${rows.map((row,rowIndex)=>{const y=48+rowIndex*130;return `<g><text x="38" y="${y+10}" fill="${rowIndex?'#77558c':'#1e5b45'}" font-size="15" font-weight="800">${row.title}</text><text x="38" y="${y+34}" fill="#68736c" font-size="11">${row.start}</text>${row.notes.map((note,index)=>{const x=235+index*101;return `<g><rect x="${x-39}" y="${y-16}" width="78" height="76" rx="14" fill="${index===0?(rowIndex?'#eee6f3':'#e2eee7'):'#fffef9'}" stroke="#d9d7cf"/><text x="${x}" y="${y+12}" text-anchor="middle" fill="#26352e" font-size="18" font-weight="800">${note[0]}</text><text x="${x}" y="${y+39}" text-anchor="middle" fill="${rowIndex?'#77558c':'#1e5b45'}" font-size="12" font-weight="800">${note[1]}</text></g>`;}).join('')}</g>`;}).join('')}
      <text x="380" y="299" text-anchor="middle" fill="#68736c" font-size="12">固定唱名固定 C=Do；首调唱名让当前主音成为 Do</text>
    </svg>`;
  }

  // 第六阶段用指板形状反复呈现“相邻一品”和“十二品循环”两条主线。
  function fretboardTheoryDiagram(type) {
    const pitchName = midi => noteNames[midi % 12];
    const sequenceSvg = (open, title, anchors = []) => `<svg viewBox="0 0 760 245" role="img" aria-label="${title}">
      <text x="380" y="28" text-anchor="middle" fill="#2f7771" font-size="16" font-weight="800">${title}</text>
      <rect x="48" y="58" width="664" height="112" rx="14" fill="#9a663d"/>
      ${Array.from({length:13},(_,fret)=>{const x=61+fret*52;const anchor=anchors.includes(fret);return `<g><line x1="${x+39}" y1="58" x2="${x+39}" y2="170" stroke="#e9d8bd" stroke-width="${fret===0?5:2}"/><circle cx="${x+15}" cy="114" r="${anchor?19:16}" fill="${anchor?'#f1bd68':'#245e55'}"/><text x="${x+15}" y="119" text-anchor="middle" fill="${anchor?'#293f37':'white'}" font-size="${pitchName(open+fret).length>1?10:13}" font-weight="800">${pitchName(open+fret)}</text><text x="${x+15}" y="194" text-anchor="middle" fill="#68736c" font-size="9">${fret}品</text></g>`;}).join('')}
      <text x="380" y="228" text-anchor="middle" fill="#68736c" font-size="12">从左向右每格一个半音；0 品与 12 品同名，12 品声音更高</text>
    </svg>`;
    if (type === 'sixth-string-cycle') return sequenceSvg(40, '6 弦：E 出发，走十二品回到 E', [0,1,5,7,8,12]);
    if (type === 'fifth-string-cycle') return sequenceSvg(45, '5 弦：A 出发，走十二品回到 A', [0,3,5,7,10,12]);
    if (type === 'tuning-strings') {
      const tuning = [[6,'E',40],[5,'A',45],[4,'D',50],[3,'G',55],[2,'B',59],[1,'E',64]];
      return `<svg viewBox="0 0 760 300" role="img" aria-label="标准调弦与十二品同名图">
        <text x="380" y="28" text-anchor="middle" fill="#2f7771" font-size="16" font-weight="800">标准调弦：从粗 6 弦到细 1 弦</text>
        ${tuning.map((item,index)=>{const y=62+index*36;return `<g><text x="54" y="${y+5}" text-anchor="end" fill="#405048" font-size="12" font-weight="800">${item[0]}弦</text><line x1="76" y1="${y}" x2="675" y2="${y}" stroke="#8b6a4d" stroke-width="${4-index*.45}"/><circle cx="105" cy="${y}" r="16" fill="#245e55"/><text x="105" y="${y+5}" text-anchor="middle" fill="white" font-size="13" font-weight="800">${item[1]}</text><text x="143" y="${y+4}" fill="#68736c" font-size="10">空弦</text><path d="M185 ${y} H590" stroke="#c6cbc8" stroke-width="2" stroke-dasharray="5 6"/><circle cx="625" cy="${y}" r="16" fill="#f1bd68"/><text x="625" y="${y+5}" text-anchor="middle" fill="#293f37" font-size="13" font-weight="800">${item[1]}</text><text x="652" y="${y+4}" fill="#68736c" font-size="10">12品</text></g>`;}).join('')}
        <text x="380" y="288" text-anchor="middle" fill="#68736c" font-size="12">两根 E 弦音名相同但音区不同；每根弦的 12 品都回到自己的空弦音名</text>
      </svg>`;
    }
    if (type === 'fret-semitone-grid') {
      const notes = ['E','F','F#','G','G#','A'];
      return `<svg viewBox="0 0 760 260" role="img" aria-label="每移动一品就是一个半音图">
        <text x="380" y="30" text-anchor="middle" fill="#2f7771" font-size="16" font-weight="800">一格一格走：每移动一品 = 一个半音</text>
        ${notes.map((note,index)=>{const x=95+index*112;return `<g><rect x="${x-38}" y="78" width="76" height="84" rx="13" fill="${index===0||index===5?'#dfeeed':'#fffef9'}" stroke="#abc9c5"/><text x="${x}" y="112" text-anchor="middle" fill="#245e55" font-size="19" font-weight="800">${note}</text><text x="${x}" y="143" text-anchor="middle" fill="#68736c" font-size="10">${index} 品</text>${index<5?`<g><text x="${x+56}" y="106" text-anchor="middle" fill="#d18c3e" font-size="17">→</text><text x="${x+56}" y="129" text-anchor="middle" fill="#68736c" font-size="9">半音</text></g>`:''}</g>`;}).join('')}
        <text x="380" y="218" text-anchor="middle" fill="#405048" font-size="13">跳过一格才是全音；E–F 虽然字母相邻，也仍只移动一品</text>
      </svg>`;
    }
    if (type === 'same-note-positions') {
      const tuning = [64,59,55,50,45,40];
      return `<svg viewBox="0 0 760 330" role="img" aria-label="E 音在指板上的多个位置图">
        <text x="380" y="28" text-anchor="middle" fill="#2f7771" font-size="16" font-weight="800">同一个 E，可以出现在多根弦与多个品位</text>
        ${tuning.map((open,index)=>{const y=60+index*40;return `<g><text x="48" y="${y+5}" text-anchor="end" fill="#68736c" font-size="10">${index+1}弦</text><line x1="67" y1="${y}" x2="711" y2="${y}" stroke="#8b6a4d" stroke-width="${1+index*.35}"/>${Array.from({length:13},(_,fret)=>{const x=78+fret*50;const isE=pitchName(open+fret)==='E';return `<g><line x1="${x+22}" y1="${y-15}" x2="${x+22}" y2="${y+15}" stroke="#d9d7cf"/>${isE?`<circle cx="${x}" cy="${y}" r="14" fill="#f1bd68"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="#293f37" font-size="11" font-weight="800">E</text>`:''}</g>`;}).join('')}</g>`;}).join('')}
        <text x="380" y="310" text-anchor="middle" fill="#68736c" font-size="12">位置不同、音区可能不同，但音名类别仍是 E</text>
      </svg>`;
    }
    const tasks = [['6弦 1品','F'],['6弦 8品','C'],['5弦 3品','C'],['5弦 7品','E'],['4弦 5品','G'],['2弦 5品','E']];
    return `<svg viewBox="0 0 760 280" role="img" aria-label="第一次指板寻音测试图">
      <text x="380" y="30" text-anchor="middle" fill="#2f7771" font-size="16" font-weight="800">先遮住答案：位置 → 数半音 → 说音名</text>
      ${tasks.map((task,index)=>{const x=55+(index%3)*235;const y=62+Math.floor(index/3)*92;return `<g><rect x="${x}" y="${y}" width="205" height="70" rx="13" fill="#fffef9" stroke="#abc9c5"/><text x="${x+18}" y="${y+27}" fill="#68736c" font-size="11">${task[0]}</text><text x="${x+165}" y="${y+45}" text-anchor="middle" fill="#2f7771" font-size="24" font-weight="800">${task[1]}</text><path d="M${x+18} ${y+49} H${x+118}" stroke="#d9d7cf" stroke-dasharray="4 4"/></g>`;}).join('')}
      <text x="380" y="264" text-anchor="middle" fill="#68736c" font-size="12">先把 6 弦与 5 弦练成锚点，再逐步扩展到其他琴弦</text>
    </svg>`;
  }

  // 第七阶段用同一套颜色区分起点、终点和半音距离，避免把音程变成纯数字表。
  function intervalTheoryDiagram(type) {
    const rootColor = '#965568';
    const targetColor = '#2f7771';
    const warmColor = '#d89446';
    if (type === 'interval-listen-first') {
      const targets = [['Db',1,'很近'],['D',2,'较近'],['E',4,'展开'],['G',7,'开阔'],['C',12,'同名']];
      return `<svg viewBox="0 0 760 285" role="img" aria-label="从同一个 C 走向五个不同距离的音程图">
        <text x="380" y="30" text-anchor="middle" fill="${rootColor}" font-size="16" font-weight="800">固定起点，先听终点离它有多远</text>
        <circle cx="82" cy="141" r="31" fill="${rootColor}"/><text x="82" y="148" text-anchor="middle" fill="white" font-size="23" font-weight="800">C</text>
        ${targets.map((target,index)=>{const x=210+index*105;const y=72+index*30;return `<g><path d="M113 141 Q${(113+x)/2} ${y-28} ${x-25} ${y}" fill="none" stroke="#cfc4c7" stroke-width="2"/><circle cx="${x}" cy="${y}" r="24" fill="${index===4?warmColor:targetColor}"/><text x="${x}" y="${y+6}" text-anchor="middle" fill="white" font-size="15" font-weight="800">${target[0]}</text><text x="${x}" y="${y+43}" text-anchor="middle" fill="#68736c" font-size="10">${target[1]} 半音 · ${target[2]}</text></g>`;}).join('')}
        <text x="380" y="270" text-anchor="middle" fill="#68736c" font-size="12">音程比较的是关系：起点相同，终点不同，距离感随之改变</text>
      </svg>`;
    }
    if (type === 'interval-degrees') {
      const degrees = [['C','一度','0'],['D','二度','2'],['E','三度','4'],['F','四度','5'],['G','五度','7'],['A','六度','9'],['B','七度','11'],['C','八度','12']];
      return `<svg viewBox="0 0 760 270" role="img" aria-label="C 到 C 的一度至八度计数图">
        <text x="380" y="31" text-anchor="middle" fill="${rootColor}" font-size="16" font-weight="800">从 C 开始，起点也算 1：一度 → 八度</text>
        ${degrees.map((item,index)=>{const x=62+index*91;return `<g><rect x="${x-35}" y="68" width="70" height="91" rx="13" fill="${index===0||index===7?'#f1e2e7':'#fffef9'}" stroke="${index===0||index===7?rootColor:'#d9d7cf'}"/><text x="${x}" y="102" text-anchor="middle" fill="${index===0||index===7?rootColor:'#26352e'}" font-size="22" font-weight="800">${item[0]}</text><text x="${x}" y="128" text-anchor="middle" fill="#405048" font-size="11" font-weight="800">${item[1]}</text><text x="${x}" y="146" text-anchor="middle" fill="#68736c" font-size="9">距C ${item[2]}半音</text>${index<7?`<text x="${x+45}" y="116" text-anchor="middle" fill="#b9b4b5" font-size="16">→</text>`:''}</g>`;}).join('')}
        <text x="380" y="206" text-anchor="middle" fill="#405048" font-size="13">数字数音名字母；具体是大、小还是纯，再看实际半音数</text>
        <text x="380" y="236" text-anchor="middle" fill="#68736c" font-size="11">八度不是 8 个半音：它数了 8 个字母位置，实际走完 12 个半音</text>
      </svg>`;
    }
    if (type === 'thirds-compare') {
      const rows = [{name:'小三度',end:'Eb',steps:3,y:84,color:targetColor},{name:'大三度',end:'E',steps:4,y:190,color:warmColor}];
      return `<svg viewBox="0 0 760 300" role="img" aria-label="C 到降 E 与 C 到 E 的大小三度对照图">
        <text x="380" y="31" text-anchor="middle" fill="${rootColor}" font-size="16" font-weight="800">都数 C–D–E，所以都是三度；差别在半音数</text>
        ${rows.map(row=>`<g><text x="45" y="${row.y+7}" fill="${row.color}" font-size="13" font-weight="800">${row.name}</text><circle cx="154" cy="${row.y}" r="24" fill="${rootColor}"/><text x="154" y="${row.y+6}" text-anchor="middle" fill="white" font-weight="800">C</text>${Array.from({length:row.steps},(_,i)=>{const x=214+i*94;return `<g><line x1="${x-34}" y1="${row.y}" x2="${x+34}" y2="${row.y}" stroke="#c9c4c4" stroke-width="3"/><circle cx="${x}" cy="${row.y}" r="14" fill="#eadde1"/><text x="${x}" y="${row.y+4}" text-anchor="middle" fill="#765260" font-size="9">${i+1}</text></g>`;}).join('')}<circle cx="${214+row.steps*94}" cy="${row.y}" r="24" fill="${row.color}"/><text x="${214+row.steps*94}" y="${row.y+6}" text-anchor="middle" fill="white" font-weight="800">${row.end}</text><text x="674" y="${row.y+6}" text-anchor="end" fill="#68736c" font-size="11">${row.steps} 半音</text></g>`).join('')}
        <text x="380" y="279" text-anchor="middle" fill="#68736c" font-size="12">终点从 E 降到 Eb，只移动一品，大三度就缩成小三度</text>
      </svg>`;
    }
    if (type === 'fourth-fifth') {
      const rows = [{name:'纯四度',end:'F',steps:5,y:92},{name:'纯五度',end:'G',steps:7,y:196}];
      return `<svg viewBox="0 0 760 300" role="img" aria-label="纯四度五个半音与纯五度七个半音图">
        <text x="380" y="31" text-anchor="middle" fill="${rootColor}" font-size="16" font-weight="800">C → F 是纯四度；C → G 是纯五度</text>
        ${rows.map((row,rowIndex)=>`<g><text x="43" y="${row.y+5}" fill="${rowIndex?warmColor:targetColor}" font-size="13" font-weight="800">${row.name}</text><circle cx="154" cy="${row.y}" r="23" fill="${rootColor}"/><text x="154" y="${row.y+6}" text-anchor="middle" fill="white" font-weight="800">C</text><line x1="179" y1="${row.y}" x2="607" y2="${row.y}" stroke="#d5d0d0" stroke-width="4"/>${Array.from({length:row.steps},(_,i)=>`<circle cx="${210+i*(370/(row.steps-1||1))}" cy="${row.y}" r="7" fill="#d9c7cc"/>`).join('')}<circle cx="630" cy="${row.y}" r="23" fill="${rowIndex?warmColor:targetColor}"/><text x="630" y="${row.y+6}" text-anchor="middle" fill="white" font-weight="800">${row.end}</text><text x="678" y="${row.y+5}" fill="#68736c" font-size="10">${row.steps}半音</text></g>`).join('')}
        <text x="380" y="276" text-anchor="middle" fill="#68736c" font-size="12">“纯”是性质名称，不是音色评价；四度和五度仍要分别数 5 与 7 个半音</text>
      </svg>`;
    }
    if (type === 'interval-shapes') {
      const points = [{s:5,f:3,n:'C',role:'root'},{s:5,f:5,n:'D',role:'root'},{s:4,f:3,n:'F',role:'target'},{s:4,f:5,n:'G',role:'target'},{s:4,f:7,n:'A',role:'target'},{s:3,f:5,n:'C',role:'octave'}];
      return `<svg viewBox="0 0 760 310" role="img" aria-label="音程形状从 C 平移到 D 的指板图">
        <defs><marker id="interval-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="${rootColor}"/></marker></defs>
        <text x="380" y="29" text-anchor="middle" fill="${rootColor}" font-size="16" font-weight="800">形状整体向右两品：音名改变，关系不变</text>
        <rect x="92" y="57" width="600" height="170" rx="14" fill="#9a663d"/>
        ${[5,4,3].map((stringNumber,index)=>{const y=91+index*55;return `<g><text x="70" y="${y+5}" text-anchor="end" fill="#68736c" font-size="11">${stringNumber}弦</text><line x1="92" y1="${y}" x2="692" y2="${y}" stroke="#f0e2cc" stroke-width="${2.9-index*.7}"/></g>`;}).join('')}
        ${[3,4,5,6,7].map((fret,index)=>{const x=126+index*132;return `<g><line x1="${x+58}" y1="57" x2="${x+58}" y2="227" stroke="#ead9bd" stroke-width="3"/><text x="${x}" y="249" text-anchor="middle" fill="#68736c" font-size="10">${fret}品</text></g>`;}).join('')}
        ${points.map(point=>{const x=126+(point.f-3)*132;const y=91+(5-point.s)*55;const fill=point.role==='root'?rootColor:(point.role==='octave'?warmColor:targetColor);return `<g><circle cx="${x}" cy="${y}" r="17" fill="${fill}" stroke="white" stroke-width="2"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="white" font-size="11" font-weight="800">${point.n}</text></g>`;}).join('')}
        <path d="M126 274 H378" stroke="${rootColor}" stroke-width="3" marker-end="url(#interval-arrow)"/><text x="252" y="297" text-anchor="middle" fill="${rootColor}" font-size="11" font-weight="800">整体右移 2 品</text>
      </svg>`;
    }
    const summary = [['小二度','1'],['大二度','2'],['小三度','3'],['大三度','4'],['纯四度','5'],['纯五度','7'],['纯八度','12']];
    return `<svg viewBox="0 0 760 300" role="img" aria-label="七种重点音程与半音数复习图">
      <text x="380" y="30" text-anchor="middle" fill="${rootColor}" font-size="16" font-weight="800">先听类别，再用半音数和指板位置核对</text>
      ${summary.map((item,index)=>{const x=73+(index%4)*174;const y=65+Math.floor(index/4)*95;return `<g><rect x="${x}" y="${y}" width="148" height="70" rx="13" fill="${index<4?'#faf0f3':'#edf5f3'}" stroke="${index<4?'#d7b6c0':'#b9d4cf'}"/><text x="${x+18}" y="${y+29}" fill="${index<4?rootColor:targetColor}" font-size="13" font-weight="800">${item[0]}</text><text x="${x+125}" y="${y+48}" text-anchor="end" fill="#26352e" font-size="25" font-weight="800">${item[1]}</text><text x="${x+18}" y="${y+52}" fill="#68736c" font-size="9">半音</text></g>`;}).join('')}
      <text x="380" y="277" text-anchor="middle" fill="#68736c" font-size="12">小2 1 · 大2 2 · 小3 3 · 大3 4 · 纯4 5 · 纯5 7 · 纯8 12</text>
    </svg>`;
  }

  // 第八阶段用台阶长短与重点升音呈现音阶结构，让升降号有可追溯的原因。
  function scaleTheoryDiagram(type) {
    const scaleColor = '#9a6a2f';
    const naturalColor = '#2f7771';
    const sharpColor = '#c87337';
    const mutedColor = '#68736c';
    const drawScale = (notes, steps, y, changed = []) => notes.map((note,index) => {
      const x = 56 + index * 93;
      const raised = changed.includes(index);
      return `<g><rect x="${x-29}" y="${y-(index*12)}" width="58" height="54" rx="11" fill="${raised?'#f6d9be':(index===0||index===7?'#eadbc8':'#fffef9')}" stroke="${raised?sharpColor:'#d8c8b3'}"/><text x="${x}" y="${y+32-(index*12)}" text-anchor="middle" fill="${raised?sharpColor:scaleColor}" font-size="16" font-weight="800">${note}</text>${index<7?`<g><path d="M${x+30} ${y+22-(index*12)} H${x+63}" stroke="${steps[index]==='半'?sharpColor:'#c8ad86'}" stroke-width="2"/><text x="${x+46}" y="${y+13-(index*12)}" text-anchor="middle" fill="${steps[index]==='半'?sharpColor:mutedColor}" font-size="8" font-weight="800">${steps[index]}</text></g>`:''}</g>`;
    }).join('');
    if (type === 'scale-stair-listen') {
      const notes = ['C','D','E','F','G','A','B','C'];
      return `<svg viewBox="0 0 760 300" role="img" aria-label="C 大调七级台阶上行图">
        <text x="380" y="28" text-anchor="middle" fill="${scaleColor}" font-size="16" font-weight="800">七个不同音，走向高八度的同名主音</text>
        ${drawScale(notes,['全','全','半','全','全','全','半'],202)}
        <text x="380" y="278" text-anchor="middle" fill="${mutedColor}" font-size="12">听见向上、向下与回到 C，再给每一级命名</text>
      </svg>`;
    }
    if (type === 'c-major-natural') {
      const notes = ['C','D','E','F','G','A','B','C'];
      return `<svg viewBox="0 0 760 290" role="img" aria-label="C 大调自然音与两处半音图">
        <text x="380" y="29" text-anchor="middle" fill="${scaleColor}" font-size="16" font-weight="800">C 大调只用自然音，但自然音间距并不平均</text>
        ${notes.map((note,index)=>{const x=56+index*93;const isHalfAfter=index===2||index===6;return `<g><circle cx="${x}" cy="124" r="25" fill="${index===0||index===7?scaleColor:naturalColor}"/><text x="${x}" y="130" text-anchor="middle" fill="white" font-size="17" font-weight="800">${note}</text>${index<7?`<g><line x1="${x+27}" y1="124" x2="${x+65}" y2="124" stroke="${isHalfAfter?sharpColor:'#b8c8c0'}" stroke-width="${isHalfAfter?5:2}"/><text x="${x+46}" y="106" text-anchor="middle" fill="${isHalfAfter?sharpColor:mutedColor}" font-size="9" font-weight="800">${isHalfAfter?'半音':'全音'}</text></g>`:''}</g>`;}).join('')}
        <rect x="215" y="187" width="145" height="48" rx="12" fill="#fff0df" stroke="#d79a64"/><text x="287" y="208" text-anchor="middle" fill="${sharpColor}" font-size="12" font-weight="800">E → F</text><text x="287" y="225" text-anchor="middle" fill="${mutedColor}" font-size="9">相邻一品</text>
        <rect x="494" y="187" width="145" height="48" rx="12" fill="#fff0df" stroke="#d79a64"/><text x="566" y="208" text-anchor="middle" fill="${sharpColor}" font-size="12" font-weight="800">B → C</text><text x="566" y="225" text-anchor="middle" fill="${mutedColor}" font-size="9">相邻一品</text>
        <text x="380" y="270" text-anchor="middle" fill="${mutedColor}" font-size="11">2+2+1+2+2+2+1 = 12 个半音</text>
      </svg>`;
    }
    if (type === 'major-step-formula') {
      const steps = [['全','2'],['全','2'],['半','1'],['全','2'],['全','2'],['全','2'],['半','1']];
      return `<svg viewBox="0 0 760 280" role="img" aria-label="大调全全半全全全半结构图">
        <text x="380" y="30" text-anchor="middle" fill="${scaleColor}" font-size="16" font-weight="800">大调的身份证：距离顺序不随主音改变</text>
        ${steps.map((step,index)=>{const x=44+index*101;const isHalf=step[0]==='半';return `<g><rect x="${x}" y="76" width="82" height="92" rx="15" fill="${isHalf?'#f6d9cf':'#f2e7d6'}" stroke="${isHalf?sharpColor:'#cbae83'}"/><text x="${x+41}" y="115" text-anchor="middle" fill="${isHalf?sharpColor:scaleColor}" font-size="23" font-weight="800">${step[0]}</text><text x="${x+41}" y="142" text-anchor="middle" fill="${mutedColor}" font-size="10">${step[1]} 个半音</text><text x="${x+41}" y="190" text-anchor="middle" fill="${mutedColor}" font-size="9">${index+1}→${index+2} 级</text></g>`;}).join('')}
        <text x="380" y="231" text-anchor="middle" fill="${naturalColor}" font-size="13" font-weight="800">累计落点：0 · 2 · 4 · 5 · 7 · 9 · 11 · 12</text>
        <text x="380" y="258" text-anchor="middle" fill="${mutedColor}" font-size="11">吉他同弦对应：2 · 2 · 1 · 2 · 2 · 2 · 1 品</text>
      </svg>`;
    }
    if (type === 'c-major-fretboard') {
      const points = [{s:5,f:3,n:'C'},{s:4,f:0,n:'D'},{s:4,f:2,n:'E'},{s:4,f:3,n:'F'},{s:3,f:0,n:'G'},{s:3,f:2,n:'A'},{s:2,f:0,n:'B'},{s:2,f:1,n:'C'}];
      return `<svg viewBox="0 0 760 320" role="img" aria-label="C 大调开放把位指板路线图">
        <text x="380" y="29" text-anchor="middle" fill="${scaleColor}" font-size="16" font-weight="800">同一条音阶折叠到多根弦：品数重来，音高继续向上</text>
        <rect x="105" y="58" width="575" height="190" rx="14" fill="#9a663d"/>
        ${[5,4,3,2].map((stringNumber,index)=>{const y=86+index*49;return `<g><text x="84" y="${y+5}" text-anchor="end" fill="${mutedColor}" font-size="11">${stringNumber}弦</text><line x1="105" y1="${y}" x2="680" y2="${y}" stroke="#f0e2cc" stroke-width="${3-index*.45}"/></g>`;}).join('')}
        ${[0,1,2,3].map((fret,index)=>{const x=148+index*155;return `<g><line x1="${x+70}" y1="58" x2="${x+70}" y2="248" stroke="#ead9bd" stroke-width="${index===0?6:3}"/><text x="${x}" y="270" text-anchor="middle" fill="${mutedColor}" font-size="10">${fret===0?'空弦':`${fret}品`}</text></g>`;}).join('')}
        ${points.map((point,index)=>{const x=148+point.f*155;const y=86+(5-point.s)*49;return `<g><circle cx="${x}" cy="${y}" r="16" fill="${point.n==='C'?scaleColor:naturalColor}" stroke="white" stroke-width="2"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="white" font-size="11" font-weight="800">${point.n}</text><text x="${x}" y="${y-22}" text-anchor="middle" fill="#fff4df" font-size="8">${index+1}</text></g>`;}).join('')}
        <text x="380" y="300" text-anchor="middle" fill="${mutedColor}" font-size="11">5弦3品 C → 2弦1品 C：音名与级数保持连续</text>
      </svg>`;
    }
    if (type === 'g-major-derive') {
      const notes = ['G','A','B','C','D','E','F#','G'];
      return `<svg viewBox="0 0 760 310" role="img" aria-label="G 大调把 F 修正为 F 升图">
        <text x="380" y="28" text-anchor="middle" fill="${scaleColor}" font-size="16" font-weight="800">检查最后三音：E → F# → G 才是“全 → 半”</text>
        ${drawScale(notes,['全','全','半','全','全','全','半'],206,[6])}
        <path d="M614 241 C614 279 570 279 570 244" fill="none" stroke="${sharpColor}" stroke-width="2"/><text x="592" y="292" text-anchor="middle" fill="${sharpColor}" font-size="10" font-weight="800">F 向上移动一品</text>
      </svg>`;
    }
    const notes = ['D','E','F#','G','A','B','C#','D'];
    return `<svg viewBox="0 0 760 320" role="img" aria-label="D 大调 F 升与 C 升推导图">
      <text x="380" y="28" text-anchor="middle" fill="${scaleColor}" font-size="16" font-weight="800">D 大调的两个升号，都在修正结构</text>
      ${drawScale(notes,['全','全','半','全','全','全','半'],208,[2,6])}
      <rect x="176" y="253" width="170" height="43" rx="11" fill="#fff0df" stroke="#d79a64"/><text x="261" y="271" text-anchor="middle" fill="${sharpColor}" font-size="10" font-weight="800">E → F# = 全音</text><text x="261" y="287" text-anchor="middle" fill="${mutedColor}" font-size="8">F# → G = 半音</text>
      <rect x="452" y="253" width="170" height="43" rx="11" fill="#fff0df" stroke="#d79a64"/><text x="537" y="271" text-anchor="middle" fill="${sharpColor}" font-size="10" font-weight="800">B → C# = 全音</text><text x="537" y="287" text-anchor="middle" fill="${mutedColor}" font-size="8">C# → D = 半音</text>
    </svg>`;
  }

  // 第九阶段用三种固定颜色表示根音、三音、五音，强化“结构相同、根音可变”的理解。
  function triadTheoryDiagram(type) {
    const root = '#d98f3b';
    const third = '#8f5e96';
    const fifth = '#2f7771';
    const ink = '#25362e';
    const muted = '#6c766f';
    const note = (x,label,role,color) => `<g><circle cx="${x}" cy="125" r="38" fill="${color}"/><text x="${x}" y="121" text-anchor="middle" fill="white" font-size="22" font-weight="800">${label}</text><text x="${x}" y="143" text-anchor="middle" fill="white" font-size="9">${role}</text></g>`;
    if (type === 'triad-root-center') {
      return `<svg viewBox="0 0 760 285" role="img" aria-label="根音是和弦命名和距离中心">
        <text x="380" y="30" text-anchor="middle" fill="${ink}" font-size="16" font-weight="800">先确定根音，三度与五度才有起点</text>
        ${note(180,'C','根音 · 名字起点',root)}${note(380,'E','从 C 量三度',third)}${note(580,'G','从 C 量五度',fifth)}
        <path d="M220 125 H338" stroke="#d9c7b4" stroke-width="3"/><path d="M422 125 H538" stroke="#d9c7b4" stroke-width="3"/>
        <text x="280" y="108" text-anchor="middle" fill="${muted}" font-size="10">4 个半音</text><text x="480" y="108" text-anchor="middle" fill="${muted}" font-size="10">从根音共 7 个</text>
        <rect x="155" y="205" width="450" height="43" rx="12" fill="#f7efe3" stroke="#e3c7a4"/><text x="380" y="231" text-anchor="middle" fill="${ink}" font-size="12">C 是“姓”，E 与 G 的身份都以 C 为参照</text>
      </svg>`;
    }
    if (type === 'major-triad-formula' || type === 'minor-triad-formula') {
      const minor = type === 'minor-triad-formula';
      const middle = minor ? '小三度' : '大三度';
      const semitones = minor ? 3 : 4;
      return `<svg viewBox="0 0 760 300" role="img" aria-label="${minor?'小':'大'}三和弦半音配方">
        <text x="380" y="30" text-anchor="middle" fill="${ink}" font-size="16" font-weight="800">${minor?'小':'大'}三和弦 = 0 + ${semitones} + 7</text>
        ${note(155,'0','根音',root)}${note(380,String(semitones),middle,third)}${note(605,'7','纯五度',fifth)}
        <path d="M196 125 H338" stroke="#d9c7b4" stroke-width="3"/><path d="M422 125 H563" stroke="#d9c7b4" stroke-width="3"/>
        <text x="267" y="108" text-anchor="middle" fill="${muted}" font-size="10">从根音向上 ${semitones} 个半音</text><text x="493" y="108" text-anchor="middle" fill="${muted}" font-size="10">从根音向上 7 个半音</text>
        <rect x="118" y="205" width="524" height="48" rx="12" fill="${minor?'#f3edf5':'#fbf1df'}" stroke="${minor?'#cdb8d2':'#e2c28f'}"/>
        <text x="380" y="225" text-anchor="middle" fill="${ink}" font-size="11">${minor?'与大三和弦相比：只把三音从 4 移到 3':'换任何根音都保留 0、4、7，手型可以不同'}</text><text x="380" y="242" text-anchor="middle" fill="${muted}" font-size="9">所有数字都从根音重新起算</text>
      </svg>`;
    }
    const stringNotes = [['×','6'],['C','5'],['E','4'],['G','3'],['C','2'],['E','1']];
    return `<svg viewBox="0 0 760 300" role="img" aria-label="开放 C 和弦六根弦组成音拆解">
      <text x="380" y="29" text-anchor="middle" fill="${ink}" font-size="16" font-weight="800">开放 C：五根弦发声，三类组成音</text>
      ${stringNotes.map((item,index)=>{const x=104+index*110;const color=item[0]==='C'?root:item[0]==='E'?third:item[0]==='G'?fifth:'#c8ccc9';return `<g><circle cx="${x}" cy="112" r="32" fill="${color}"/><text x="${x}" y="108" text-anchor="middle" fill="${item[0]==='×'?muted:'white'}" font-size="20" font-weight="800">${item[0]}</text><text x="${x}" y="128" text-anchor="middle" fill="${item[0]==='×'?muted:'white'}" font-size="9">${item[1]} 弦</text></g>`;}).join('')}
      <path d="M160 180 H600" stroke="#d7d4cd" stroke-width="2" stroke-dasharray="5 6"/>
      ${note(215,'C','根音',root).replaceAll('cy="125"','cy="225"').replaceAll('y="121"','y="221"').replaceAll('y="143"','y="243"')}${note(380,'E','大三度',third).replaceAll('cy="125"','cy="225"').replaceAll('y="121"','y="221"').replaceAll('y="143"','y="243"')}${note(545,'G','纯五度',fifth).replaceAll('cy="125"','cy="225"').replaceAll('y="121"','y="221"').replaceAll('y="143"','y="243"')}
      <text x="380" y="286" text-anchor="middle" fill="${muted}" font-size="10">合并重复的 C 与 E，得到 C · E · G</text>
    </svg>`;
  }

  function renderLessonDiagram(type) {
    const fixed = {'guitar-anatomy': anatomyDiagram, 'posture': postureDiagram, 'fret-pressure': pressureDiagram, 'pick-motion': pickDiagram, 'spider-grid': spiderDiagram, 'chord-reading': chordReadingDiagram};
    if (fixed[type]) return fixed[type]();
    if (type === 'chord-sheet-reading') return chordSheetDiagram();
    if (['tab-orientation','tab-numbers','tab-legato','tab-articulation','tab-reading-check'].includes(type)) return tabLessonDiagram(type);
    if (['anchor-change','lead-finger','small-chords','chord-loop','change-test'].includes(type)) return processDiagram(type);
    if (['beat-bar','meter-bpm','quarter-strum','eighth-strum','rest-strum','pop-strum'].includes(type)) return rhythmLessonDiagram(type);
    if (['pitch-vibration','note-dual-names','chromatic-wheel','semitone-whole','natural-neighbors','solfege-systems'].includes(type)) return pitchLessonDiagram(type);
    if (['tuning-strings','sixth-string-cycle','fifth-string-cycle','fret-semitone-grid','same-note-positions','fret-hunt-test'].includes(type)) return fretboardTheoryDiagram(type);
    if (['interval-listen-first','interval-degrees','thirds-compare','fourth-fifth','interval-shapes','interval-ear-check'].includes(type)) return intervalTheoryDiagram(type);
    if (['scale-stair-listen','c-major-natural','major-step-formula','c-major-fretboard','g-major-derive','d-major-derive'].includes(type)) return scaleTheoryDiagram(type);
    if (['triad-root-center','major-triad-formula','minor-triad-formula','open-chord-anatomy'].includes(type)) return triadTheoryDiagram(type);
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

  window.GuitarComponents = { noteNames, flatNames, openMidi, chordData, chordSvg, chordPositions, playChord, playTabSequence, renderFretboard, renderLessonDiagram, playTone, playClick, escapeHtml, noteFromMidi, detectPitch };
})();

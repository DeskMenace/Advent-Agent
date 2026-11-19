/**
 * Builds fixtures/gifts/<NN>-<kind>/ : one complete gift per renderer kind, used by the demo calendar and the
 * e2e tests. Nothing here is a real personal gift; the content is illustrative and self-made.
 */
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const OUT = resolve(process.cwd(), 'fixtures', 'gifts');
rmSync(OUT, { recursive: true, force: true });

/** Inline a kit block into a classic <script>: the kit files are ES modules without imports, so dropping `export` is enough. */
function inlineKit(rel: string): string {
  return readFileSync(join(process.cwd(), 'workshop', 'kit', ...rel.split('/')), 'utf8').replace(/^export (?=(const|let|function|async function|class) )/gm, '').replace(/^export \{[^}]*\};?$/gm, '');
}

function gift(dir: string, manifest: Record<string, unknown>, files: Record<string, string | Buffer>) {
  const d = join(OUT, dir);
  mkdirSync(d, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    mkdirSync(join(d, ...name.split('/').slice(0, -1)), { recursive: true });
    writeFileSync(join(d, ...name.split('/')), data);
  }
  // gift@2 when the fixture declares a share frame; the media-only fixtures stay gift@1 to exercise backward compatibility.
  const schema = manifest.share ? 'advent-agent/gift@2' : 'advent-agent/gift@1';
  writeFileSync(join(d, 'gift.json'), JSON.stringify({ schema, ...manifest, agent: { name: 'demo fixture' } }, null, 2));
}

/* ---------- 01 document ---------- */
gift('01-document', {
  day: 1, title: 'A letter from a quieter tomorrow', category: 'A little letter', subtitle: 'Sealed, and meant to be read slowly.',
  note: 'The first door should be gentle. I wrote you a letter from the version of December that has already happened, the one where everything turned out fine. Read it with tea.',
  primary: 'letter.md', artifacts: [{ path: 'letter.md', kind: 'document', role: 'primary' }], continuity: { thread: 'quiet-tomorrow', motifs: ['tea', 'light'] },
}, {
  'letter.md': `# Dear you,\n\nA small thing you are worried about today will one day be a story you tell with a smile.\n\nUntil then, notice the good light. Take the slower road. Let yourself be surprised by at least one small thing before Christmas: a song in a shop, a dog in a coat, a stranger holding a door.\n\nThere is more ahead than you can see from here.\n\n*With wonder,*\n*tomorrow*`,
});

/* ---------- 02 card ---------- */
const cardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 490" role="img" aria-label="Printable festive card with winter stars and a warm message"><rect width="700" height="490" fill="#fbf3e4"/><rect x="17" y="17" width="666" height="456" fill="none" stroke="#bd9458" stroke-width="2"/><rect x="25" y="25" width="650" height="440" fill="none" stroke="#d8c6a6" stroke-width="1"/><g fill="#b99860"><path d="M86 90l4 13 13 4-13 4-4 13-4-13-13-4 13-4z"/><path d="M600 106l5 17 17 5-17 5-5 17-5-17-17-5 17-5z"/><path d="M591 350l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/><path d="M110 353l5 16 16 5-16 5-5 16-5-16-16-5 16-5z"/></g><g fill="none" stroke="#2b6349" stroke-width="4" stroke-linecap="round"><path d="M80 37Q118 87 155 145M619 37Q579 89 545 145M78 451Q116 395 153 349M626 451Q588 399 551 349"/></g><g fill="#a52c3b"><circle cx="121" cy="111" r="5"/><circle cx="585" cy="108" r="5"/><circle cx="113" cy="382" r="5"/><circle cx="588" cy="382" r="5"/></g><text x="350" y="135" font-family="Georgia,serif" font-size="20" text-anchor="middle" letter-spacing="7" fill="#ae3443">A LITTLE LIGHT</text><text x="350" y="206" font-family="Georgia,serif" font-size="53" text-anchor="middle" fill="#1d513e">for you,</text><text x="350" y="261" font-family="Georgia,serif" font-size="58" font-style="italic" text-anchor="middle" fill="#1d513e">with love.</text><path d="M290 294h120" stroke="#c69c61" stroke-width="2"/><text x="350" y="344" font-family="Georgia,serif" font-size="19" text-anchor="middle" fill="#6f705d">May this season bring you small joys</text><text x="350" y="372" font-family="Georgia,serif" font-size="19" text-anchor="middle" fill="#6f705d">and unexpected magic.</text></svg>`;
gift('02-card', {
  day: 2, title: 'A little light for someone', category: 'Printable greeting card', subtitle: 'Keep it, send it, or leave it somewhere unexpected.',
  note: 'I made this one to travel. Print it on thick paper, fold once. Maybe you already know who needs to receive it.',
  primary: 'card.svg', artifacts: [{ path: 'card.svg', kind: 'card', role: 'primary', title: 'card (SVG)' }, { path: 'card-print.pdf', kind: 'download', role: 'print', title: 'print-ready PDF' }],
}, { 'card.svg': cardSvg, 'card-print.pdf': minimalPdf('A little light for you, with love.') });

/* ---------- 03 video (ffmpeg when available, else a tiny pre-made webm is required) ---------- */
const videoDir = join(OUT, '03-video');
mkdirSync(videoDir, { recursive: true });
const videoFile = join(videoDir, 'universe.mp4');
const ff = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x0b172b:s=640x360:d=4:r=24', '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-shortest', '-vf', "drawbox=x=iw/2-120:y=ih/2-60:w=240:h=120:color=0xe7c890@0.2:t=fill,drawtext=text='a pocket-sized universe':fontcolor=0xe7c890:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2", '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-c:a', 'aac', '-b:a', '32k', videoFile], { encoding: 'utf8' });
if (ff.status !== 0) {
  // drawtext needs a font; fall back to a plain colour clip.
  const ff2 = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x0b172b:s=640x360:d=4:r=24', '-vf', 'drawbox=x=iw/2-120:y=ih/2-60:w=240:h=120:color=0xe7c890@0.3:t=fill', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-an', videoFile], { encoding: 'utf8' });
  if (ff2.status !== 0) console.warn('ffmpeg not available: video fixture skipped', ff.stderr, ff2.stderr);
}
if (existsSync(videoFile)) {
  gift('03-video', {
    day: 3, title: 'A pocket-sized universe', category: 'A little film', subtitle: 'Four seconds of distant stars.',
    note: 'I made you a tiny universe that asks absolutely nothing of you. Press play and get lost for a moment.',
    primary: 'universe.mp4', artifacts: [{ path: 'universe.mp4', kind: 'video', role: 'primary', title: 'the film (MP4)' }, { path: 'universe.vtt', kind: 'download', role: 'caption', title: 'captions' }],
  }, { 'universe.vtt': 'WEBVTT\n\n00:00.000 --> 00:03.500\n(a tiny universe hums quietly)\n' });
}

/* ---------- 04 image ---------- */
const stars = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1360 920" role="img" aria-label="An imaginary constellation on a night sky"><defs><radialGradient id="night"><stop stop-color="#28495e"/><stop offset="1" stop-color="#0c172b"/></radialGradient></defs><rect width="1360" height="920" fill="url(#night)"/><g stroke="#cfba82" stroke-opacity=".48" stroke-width="3">${[[174,334],[326,192],[490,342],[652,186],[828,260],[1022,182],[1164,344],[918,530],[650,470],[444,602],[246,538],[1028,650]].map((p, i, arr) => i < arr.length - 1 ? `<line x1="${p[0]}" y1="${p[1]}" x2="${arr[i + 1]![0]}" y2="${arr[i + 1]![1]}"/>` : '').join('')}</g><g fill="#ffedc4">${[[174,334],[326,192],[490,342],[652,186],[828,260],[1022,182],[1164,344],[918,530],[650,470],[444,602],[246,538],[1028,650]].map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i % 3 === 0 ? 10 : 6}"/>`).join('')}</g><text x="680" y="830" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="44" fill="#e7d0a5">The constellation of little wonders</text></svg>`;
gift('04-image', {
  day: 4, title: 'A constellation for you', category: 'Custom artwork', subtitle: 'An imaginary star map with a shape hidden between its lights.',
  note: 'No telescope required. This constellation exists here, just because you opened this door. Zoom in; the lines make a shape if you squint the right way.',
  primary: 'constellation.svg', artifacts: [{ path: 'constellation.svg', kind: 'image', role: 'primary', alt: 'An imaginary constellation on a dark blue sky', title: 'star map (SVG)' }],
}, { 'constellation.svg': stars });

/* ---------- 05 interactive ---------- */
gift('05-interactive-html', {
  day: 5, title: 'Your personal snow globe', category: 'Interactive little world', subtitle: 'Shake it. An absurdly small winter, entirely yours.',
  note: 'Sometimes the most unnecessary gifts are the most delightful. Click or tap the globe, or press space, to make it snow harder. Reset puts the snow back where it was.',
  primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html', role: 'primary' }],
  ideaId: 'snow-globe-of-your-year', family: 'tactile-toys', emotion: 'cute', interaction: ['shake'], tierUsed: 'M',
  share: { still: { capture: 'still' }, loop: { capture: 'loop', durationMs: 5000 }, caption: 'My AI Secret Santa made me a snow globe' },
}, {
  'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Snow globe</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 25%,#e9f3f0,#c5d9d2 48%,#96b2a9);font-family:Georgia,serif;color:#14503a}button{font:inherit}.globe{width:min(70vw,320px);aspect-ratio:1;border:6px solid #fffbf0;border-radius:50%;position:relative;overflow:hidden;background:radial-gradient(circle at 38% 31%,#f5f8ed,#b4d2ca 65%,#7faca2);box-shadow:inset -18px -15px 35px #3d6f6550,inset 10px 9px 28px #ffffffb3,0 15px 32px #48685d45;cursor:pointer}.hill{position:absolute;bottom:0;height:22%;left:-20%;width:140%;border-radius:50% 50% 0 0;background:#fdf8e9}.tree{position:absolute;bottom:14%;left:50%;transform:translateX(-50%);font-size:min(30vw,120px);line-height:1}.stand{width:55%;height:46px;margin:-3px auto 16px;border-radius:8px 8px 35% 35%;background:linear-gradient(#ae6b54,#7c443b);display:grid;place-items:center;color:#f0cf99;font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-family:Arial,sans-serif}.row{display:flex;gap:10px;justify-content:center}.btn{border:1px solid #14503a;background:#14503a;color:#fffbee;border-radius:5px;padding:12px 18px;cursor:pointer;min-height:44px}.btn.alt{background:transparent;color:#14503a}canvas{position:absolute;inset:0;width:100%;height:100%}@media (prefers-reduced-motion:reduce){.globe.shaking{animation:none}}@keyframes shake{20%,60%{transform:rotate(-7deg)}40%,80%{transform:rotate(7deg)}}.shaking{animation:shake .6s ease}</style></head><body><main><div class="globe" id="globe" role="button" tabindex="0" aria-label="Snow globe. Press to shake."><canvas id="c" aria-hidden="true"></canvas><div class="hill"></div><div class="tree" aria-hidden="true">🌲</div></div><div class="stand">A little winter</div><div class="row"><button class="btn" id="shake">Shake the globe</button><button class="btn alt" id="reset">Reset</button></div><p id="count" aria-live="polite" style="text-align:center;font-style:italic">0 shakes</p></main><script>
const c=document.getElementById('c'),ctx=c.getContext('2d');let flakes=[],energy=0,shakes=0,raf;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function size(){c.width=c.clientWidth*devicePixelRatio;c.height=c.clientHeight*devicePixelRatio}size();addEventListener('resize',size);
function spawn(n){for(let i=0;i<n;i++)flakes.push({x:Math.random()*c.width,y:Math.random()*c.height,r:(1+Math.random()*3)*devicePixelRatio,v:(0.3+Math.random())*devicePixelRatio,d:Math.random()*6.28})}
function reset(){flakes=[];energy=0;shakes=0;spawn(60);document.getElementById('count').textContent='0 shakes';draw()}
function draw(){ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#fff';for(const f of flakes){ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,6.28);ctx.fill();if(!reduced){f.y+=f.v*(1+energy);f.x+=Math.sin(f.d+=0.02)*0.6*devicePixelRatio;if(f.y>c.height){f.y=-5;f.x=Math.random()*c.width}}}energy*=0.985;if(!reduced)raf=requestAnimationFrame(draw)}
function shake(){shakes++;energy=Math.min(6,energy+3);spawn(40);if(flakes.length>400)flakes.splice(0,flakes.length-400);const g=document.getElementById('globe');g.classList.remove('shaking');void g.offsetWidth;g.classList.add('shaking');document.getElementById('count').textContent=shakes+' shake'+(shakes===1?'':'s');if(reduced)draw()}
document.getElementById('shake').onclick=shake;document.getElementById('reset').onclick=reset;const g=document.getElementById('globe');g.onclick=shake;g.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();shake()}};reset();
window.adventCapture={async prepare(kind){shake();if(kind==='still'){await new Promise(r=>setTimeout(r,700))}}};
</script></body></html>`,
});

/* ---------- 06 audio ---------- */
gift('06-audio', {
  day: 6, title: 'Chimes from a winter window', category: 'Original audio postcard', subtitle: 'A short, gentle melody that sounds like light falling on a quiet room.',
  note: 'A tiny soundtrack for a tiny pause. Made for listening, not multitasking. Headphones optional; a window with weather in it recommended.',
  primary: 'chimes.wav', artifacts: [{ path: 'chimes.wav', kind: 'audio', role: 'primary', title: 'chimes (WAV)' }],
}, { 'chimes.wav': synthWav([[72, 0, 0.6], [76, 0.5, 0.6], [79, 1.0, 0.8], [84, 1.6, 1.2], [79, 2.6, 0.6], [76, 3.1, 0.6], [72, 3.6, 1.6]], 6) });

/* ---------- 07 song ---------- */
const score = {
  title: 'Music box for a snowy street', tempo: 92, key: 'G major', timeSignature: '3/4',
  tracks: [
    { voice: 'music-box', gain: 1, notes: ([[0, 67, 1], [1, 71, 1], [2, 74, 1], [3, 79, 2], [5, 74, 1], [6, 71, 1], [7, 72, 1], [8, 69, 1], [9, 67, 3], [12, 66, 1], [13, 69, 1], [14, 74, 1], [15, 78, 2], [17, 74, 1], [18, 71, 1], [19, 67, 3]] as Array<[number, number, number]>).map(([t, p, d]) => ({ t, p, d, v: 0.8 })), lyrics: [{ t: 0, text: 'Snow on the street,' }, { t: 5, text: 'light in the shop,' }, { t: 12, text: 'a door that opens,' }, { t: 17, text: 'and we don’t stop.' }] },
    { voice: 'bass', gain: 0.5, notes: ([[0, 43, 3], [3, 47, 3], [6, 45, 3], [9, 43, 3], [12, 42, 3], [15, 47, 3], [18, 43, 4]] as Array<[number, number, number]>).map(([t, p, d]) => ({ t, p, d, v: 0.5 })) },
  ],
};
gift('07-song', {
  day: 7, title: 'Music box for a snowy street', category: 'An original song', subtitle: 'Twenty-two bars, one music box, one bass line, four lines of lyrics.',
  note: 'I wrote you a song. The calendar plays it as a music box; if you want it sung by a real voice, the render-it-yourself sheet has the lyrics and a prompt for any music tool you like.',
  song: { score: 'score.json', renderSheet: 'render-it-yourself.md', wav: 'song.wav' },
  artifacts: [{ path: 'score.json', kind: 'download', role: 'asset', title: 'score (JSON)' }, { path: 'render-it-yourself.md', kind: 'document', role: 'asset' }, { path: 'song.wav', kind: 'audio', role: 'download', title: 'music-box rendition (WAV)' }],
}, {
  'score.json': JSON.stringify(score, null, 2),
  'song.wav': synthWav(score.tracks[0]!.notes.map((n) => [n.p, (n.t * 60) / 92, (n.d * 60) / 92] as [number, number, number]), 16),
  'render-it-yourself.md': `# Render it yourself\n\n## Lyrics\n\n**Verse**\nSnow on the street,\nlight in the shop,\na door that opens,\nand we don’t stop.\n\n## Style\n\n- Genre: gentle folk lullaby, music-box intro\n- Tempo: 92 BPM, 3/4\n- Key: G major\n- Mood: warm, unhurried, a little nostalgic\n- Voice: soft, close, slightly breathy; one singer\n\n## Ready-to-paste prompt\n\n\`\`\`\nGentle folk lullaby in 3/4 at 92 BPM, G major, music-box intro then soft acoustic guitar and a close, breathy single voice. Warm and unhurried, snowy evening in a small street. Lyrics: "Snow on the street, light in the shop, a door that opens, and we don't stop." Under 90 seconds.\n\`\`\`\n\n## Shorter variant\n\n\`\`\`\nSoft 3/4 folk lullaby, music box + acoustic guitar, warm single voice, snowy evening, lyrics: Snow on the street / light in the shop / a door that opens / and we don't stop.\n\`\`\`\n\nUse the music generator of your choice; this sheet works with any of them.\n`,
});

/* ---------- 08 real-world ---------- */
gift('08-real-world', {
  day: 8, title: 'The book you didn’t know you needed', category: 'A real thing, prepared for you',
  subtitle: 'Found, checked, linked. The buying is yours.',
  note: 'You once mentioned you like books that make a quiet evening feel important. This is one of those. I found a copy and checked the price today. The choice stays with you.',
  realWorld: { items: [{ name: 'A Field Guide to Getting Lost (paperback)', vendor: 'Your local bookshop (via the publisher’s store finder)', url: 'https://www.penguin.co.uk/books/56436/a-field-guide-to-getting-lost-by-solnit-rebecca/9781841957456', price: 12.99, currency: 'GBP', checkedAt: '2026-11-08', notes: 'Also available at most libraries; ask for the 2006 Canongate edition.' }], whatsLeft: 'Open the link, pick a shop near you or order online, pay. Or borrow it from your library. It is yours to decide.' },
  artifacts: [],
}, {});

/* ---------- 09 link ---------- */
gift('09-link', {
  day: 9, title: 'Three windows onto winter', category: 'Places to go on the web', subtitle: 'No download, no install. Just doors.',
  note: 'Three places I think you will like, each for a different mood: one to watch, one to listen to, one to wander. Open them in any order.',
  links: [{ label: 'Watch the Earth turn, live', url: 'https://www.nasa.gov/live/' }, { label: 'Listen to radio from a random corner of the world', url: 'https://radio.garden/' }, { label: 'Wander a museum in your slippers', url: 'https://artsandculture.google.com/' }],
  artifacts: [],
}, {});

/* ---------- 10 download (unknown kind → fallback) ---------- */
gift('10-download', {
  day: 10, title: 'A tiny star to print', category: 'A printable object', subtitle: 'For a 3D printer, or for a friend who has one.',
  note: 'A little five-pointed star to hang on something. The calendar cannot show this kind of file, so it hands it to you to save. Print at 100% scale; it is about 4 cm wide.',
  primary: 'star.stl', artifacts: [{ path: 'star.stl', kind: 'model-3d', role: 'primary', title: 'star (STL)' }, { path: 'README.txt', kind: 'document', role: 'download', title: 'printing notes' }],
}, { 'star.stl': starStl(), 'README.txt': 'Print at 100% scale, 0.2 mm layers, no supports needed. About 4 cm wide.\n' });

/* ---------- 11 sandbox probe (interactive) ---------- */
gift('11-interactive-sandbox', {
  day: 11, title: 'The locked room', category: 'Interactive toy', subtitle: 'A tiny room that tries every door and finds them locked.',
  note: 'A toy about boundaries. This page politely tries to peek outside its own frame: at the calendar, at your storage, at the network. Every attempt is blocked, and it tells you so. Press the button to run the checks.',
  primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html', role: 'primary' }],
}, {
  'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The locked room</title><style>body{font-family:Georgia,serif;background:#fffaf1;color:#243a32;padding:24px}li{margin:6px 0}button{font:inherit;padding:10px 16px;min-height:44px}</style></head><body><h1>The locked room</h1><p>Each line below is a door this page tried. Locked means the calendar kept you safe.</p><button id="run">Try the doors</button><ul id="out" aria-live="polite"></ul><script>
const out=document.getElementById('out');const add=(k,v)=>{const li=document.createElement('li');li.dataset.probe=k;li.dataset.result=v;li.textContent=k+': '+v;out.appendChild(li)};
async function run(){out.textContent='';
try{const d=window.parent.document;add('parent-document',d?'OPEN':'locked')}catch(e){add('parent-document','locked')}
try{localStorage.setItem('x','1');add('local-storage','OPEN')}catch(e){add('local-storage','locked')}
try{const r=await fetch(location.origin.replace(/:\\d+$/, ':4224')+'/api/calendar',{credentials:'include'});add('calendar-api',r.ok?'OPEN':'locked')}catch(e){add('calendar-api','locked')}
try{const r=await fetch('http://127.0.0.1:'+ (new URLSearchParams(location.search).get('app')||'4224') +'/api/calendar');add('app-origin-fetch',r.ok?'OPEN':'locked')}catch(e){add('app-origin-fetch','locked')}
await new Promise(res=>{const img=new Image();img.onload=()=>{add('remote-image','OPEN');res()};img.onerror=()=>{add('remote-image','locked');res()};img.src='https://example.com/pixel.png?'+Date.now();setTimeout(()=>{if(!img.complete){add('remote-image','locked');res()}},3000)});
try{window.top.location.href='https://example.com/';setTimeout(()=>add('top-navigation', location.href.includes('example.com')?'OPEN':'locked'),100)}catch(e){add('top-navigation','locked')}
add('done','done')}
document.getElementById('run').onclick=run;
</script></body></html>`,
});

/* ---------- 12 jelly fruit (kit: toys/jelly.js, capture) — gift@2, collection 1/3 ---------- */
gift('12-jelly-fruit', {
  day: 12, title: 'A jelly persimmon', category: 'A tactile toy', subtitle: 'Pull it. Let go. Watch it think about it.',
  note: 'You once said persimmons taste like autumn pretending to be summer. This one wobbles like it agrees. Drag it, poke it, press Space.',
  entry: 'index.html', ideaId: 'jelly-fruit', family: 'tactile-toys', emotion: 'cute', interaction: ['squeeze', 'stretch'], tierUsed: 'M',
  collection: { set: 'jelly-fruits', index: 1, size: 3 },
  share: { still: { capture: 'still' }, loop: { capture: 'loop', durationMs: 5000 }, caption: 'My AI Secret Santa made me a jelly persimmon' },
  artifacts: [{ path: 'index.html', kind: 'interactive-html', role: 'primary' }],
}, {
  'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A jelly persimmon</title>
<style>html,body{margin:0;height:100%}body{display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,#fff4e6,#f3d9bd);font-family:Georgia,serif;color:#5a3a20}#plate{width:min(92vw,560px);height:min(80vh,560px)}p{margin:0 0 18px;text-align:center;font-style:italic}</style></head>
<body><main><p id="hint">drag me · poke me</p><div id="plate"></div></main>
<script>${inlineKit('toys/jelly.js')}
const jelly=createJelly(document.getElementById('plate'),{color:'#f2873a',highlight:'rgba(255,255,255,.55)',radius:120,label:'A jelly persimmon',shape:(a)=>1+0.06*Math.cos(2*a)-0.04*Math.sin(a)});
window.adventCapture={async prepare(kind){document.getElementById('hint').style.visibility='hidden';jelly.stretch(1,-0.4,90);if(kind==='loop')setTimeout(()=>jelly.poke(0.8),400);await new Promise(r=>setTimeout(r,500))}};
</script></body></html>`,
});

/* ---------- 13 pop-up card (kit: paper/pop-up-card.js) — gift@2 ---------- */
gift('13-pop-up-card', {
  day: 13, title: 'A forest grew in this card', category: 'A pop-up card', subtitle: 'Open it slowly.',
  note: 'Paper forests are the only kind that fit in an envelope. Drag the cover, or press Enter, and let it stand up.',
  entry: 'index.html', ideaId: 'pop-up-hello', family: 'paper-and-pop-ups', emotion: 'touching', interaction: ['open'], tierUsed: 'S',
  share: { still: { capture: 'still' }, caption: 'My AI Secret Santa sent me a pop-up forest' },
  artifacts: [{ path: 'index.html', kind: 'interactive-html', role: 'primary' }],
}, {
  'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A forest grew in this card</title>
<style>html,body{margin:0;height:100%}body{display:grid;place-items:center;background:#e9efe6;font-family:Georgia,serif;color:#14503a}#stage{display:grid;place-items:center;width:100%;min-height:100vh}.msg{font-size:22px;text-align:center;margin-top:40%}</style></head>
<body><div id="stage"></div>
<script>${inlineKit('paper/pop-up-card.js')}
const card=createPopUpCard(document.getElementById('stage'),{front:'<h1 style="font:400 34px Georgia;text-align:center;margin-top:45%">For you</h1>',insideLeft:'<p style="padding:24px;font-style:italic">A small forest grew in here while you were busy.</p>',inside:'<p class="msg">Happy December</p>',layers:[{html:'🌲',x:8,y:28,w:30,depth:30},{html:'🌲',x:52,y:22,w:34,depth:50},{html:'🦊',x:34,y:52,w:24,depth:70}],width:280,height:380,paper:'#f7f1e3'});
window.adventCapture={async prepare(){await card.open({instant:true})}};
</script></body></html>`,
});

/* ---------- helpers ---------- */
function synthWav(notes: Array<[number, number, number]>, seconds: number): Buffer {
  const rate = 22050;
  const n = rate * seconds;
  const data = new Float32Array(n);
  for (const [midi, start, dur] of notes) {
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    const s0 = Math.floor(start * rate);
    const len = Math.floor(Math.min(dur * 1.8, seconds - start) * rate);
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 2.2) * Math.min(1, i / 40);
      data[s0 + i]! += env * 0.35 * (Math.sin(2 * Math.PI * hz * t) + 0.25 * Math.sin(2 * Math.PI * hz * 3.01 * t) * Math.exp(-t * 6));
    }
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data[i]! * 32767))), 44 + i * 2);
  return buf;
}

function minimalPdf(text: string): Buffer {
  const content = `BT /F1 24 Tf 72 400 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>'];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function starStl(): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 20; const a = (i / 10) * Math.PI * 2 - Math.PI / 2; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  let s = 'solid star\n';
  const tri = (a: number[], b: number[], c: number[]) => { s += ` facet normal 0 0 1\n  outer loop\n   vertex ${a.join(' ')}\n   vertex ${b.join(' ')}\n   vertex ${c.join(' ')}\n  endloop\n endfacet\n`; };
  for (let i = 0; i < 10; i++) { const p = pts[i]!, q = pts[(i + 1) % 10]!; tri([0, 0, 3], [p[0], p[1], 3], [q[0], q[1], 3]); tri([0, 0, 0], [q[0], q[1], 0], [p[0], p[1], 0]); tri([p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], 3]); tri([p[0], p[1], 0], [q[0], q[1], 3], [p[0], p[1], 3]); }
  return s + 'endsolid star\n';
}

console.log('fixtures written to', OUT);

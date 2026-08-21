const $ = (selector) => document.querySelector(selector);
const player = $('#player');
const input = $('#fileInput');
const playlist = $('#playlist');
const dropZone = $('#dropZone');
const completeBtn = $('#completeBtn');
const prevBtn = $('#prevBtn');
const nextBtn = $('#nextBtn');
const STORAGE_KEY = 'music-cafe-course-state';

let lessons = [];
let activeId = null;
let saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
};

const cleanTitle = (name) => name.replace(/\.[^.]+$/, '').replace(/^\d+[._ -]*/, '').replace(/[_-]+/g, ' ').trim();
const lessonKey = (file) => `${file.name}:${file.size}:${file.lastModified}`;
const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
const toast = (message) => { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2200); };

async function loadManifest() {
  try {
    const response = await fetch('content/manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    lessons = manifest.lessons.map((item) => ({
      ...item,
      url: `content/videos/${item.file.split('/').map(encodeURIComponent).join('/')}`,
    }));
    render();
    if (lessons.length) selectLesson(lessons[0].id);
  } catch (error) {
    console.warn('강의 매니페스트를 불러오지 못했습니다.', error);
    render();
    toast('자동 목차를 불러오지 못했습니다. 영상을 직접 선택해주세요.');
  }
}

function addFiles(fileList) {
  const videos = [...fileList].filter(file => file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|ogv)$/i.test(file.name));
  if (!videos.length) return toast('재생 가능한 동영상 파일을 선택해주세요.');
  const known = new Set(lessons.map(item => item.id));
  videos.sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true})).forEach(file => {
    const id = lessonKey(file);
    if (!known.has(id)) lessons.push({id, file, title:cleanTitle(file.name), url:URL.createObjectURL(file), duration:0});
  });
  render();
  if (!activeId && lessons.length) selectLesson(lessons[0].id);
  toast(`${videos.length}개 동영상을 불러왔습니다.`);
}

function selectLesson(id, shouldPlay = false) {
  const lesson = lessons.find(item => item.id === id);
  if (!lesson) return;
  if (activeId && Number.isFinite(player.currentTime)) {
    saved[activeId] = {...saved[activeId], time:player.currentTime}; persist();
  }
  activeId = id;
  player.src = lesson.url;
  dropZone.classList.add('has-video');
  $('#currentTitle').textContent = lesson.title;
  completeBtn.disabled = false;
  render();
  player.addEventListener('loadedmetadata', function restore() {
    lesson.duration = player.duration;
    const prior = saved[id]?.time || 0;
    if (prior < player.duration - 3) player.currentTime = prior;
    render();
    if (shouldPlay) player.play().catch(() => {});
  }, {once:true});
}

function moveLesson(offset, shouldPlay = true) {
  const index = lessons.findIndex((item) => item.id === activeId);
  const target = lessons[index + offset];
  if (target) selectLesson(target.id, shouldPlay);
}

function toggleComplete(id = activeId, force) {
  if (!id) return;
  const done = force ?? !saved[id]?.done;
  saved[id] = {...saved[id], time:player.currentTime || saved[id]?.time || 0, done};
  persist(); render();
  toast(done ? '수강 완료로 표시했습니다.' : '완료 표시를 취소했습니다.');
}

function completeAndContinue() {
  if (!activeId) return;
  const index = lessons.findIndex((item) => item.id === activeId);
  toggleComplete(activeId, true);
  if (lessons[index + 1]) moveLesson(1);
}

function render() {
  const doneCount = lessons.filter(item => saved[item.id]?.done).length;
  const progress = lessons.length ? Math.round(doneCount / lessons.length * 100) : 0;
  $('#progressText').textContent = `${progress}%`;
  $('#progressBar').style.width = `${progress}%`;
  if (!lessons.length) return;
  playlist.innerHTML = lessons.map((item,index) => {
    const previous = lessons[index - 1];
    const sectionChanged = item.sectionNumber && item.sectionNumber !== previous?.sectionNumber;
    const section = sectionChanged ? `
      <div class="section-title">
        <span>${String(item.sectionNumber).padStart(2, '0')}</span>
        <strong>${escapeHtml(item.sectionTitle)}</strong>
      </div>` : '';
    return `${section}
      <button class="lesson ${item.id===activeId?'active':''} ${saved[item.id]?.done?'done':''}" data-id="${encodeURIComponent(item.id)}">
        <span class="num">${String(item.number ?? index+1).padStart(2,'0')}</span>
        <span><span class="title">${escapeHtml(item.title)}</span><span class="duration">${item.duration?formatTime(item.duration):'재생시간 확인 전'}</span></span>
        <span class="status">${saved[item.id]?.done?'✓':''}</span>
      </button>`;
  }).join('');
  const done = !!saved[activeId]?.done;
  const activeIndex = lessons.findIndex((item) => item.id === activeId);
  completeBtn.classList.toggle('done', done);
  completeBtn.innerHTML = `<span>✓</span> ${activeIndex === lessons.length - 1 ? '수강 완료' : done ? '다음 강의로' : '완료 후 다음 강의'}`;
  prevBtn.disabled = activeIndex <= 0;
  nextBtn.disabled = activeIndex < 0 || activeIndex >= lessons.length - 1;
}

function escapeHtml(value) { const div=document.createElement('div'); div.textContent=value; return div.innerHTML; }

['#pickHero','#pickAside','#pickBottom'].forEach(id => $(id).addEventListener('click',()=>input.click()));
input.addEventListener('change', event => { addFiles(event.target.files); input.value=''; });
playlist.addEventListener('click', event => { const button=event.target.closest('.lesson'); if (button) selectLesson(decodeURIComponent(button.dataset.id)); });
completeBtn.addEventListener('click', completeAndContinue);
prevBtn.addEventListener('click', () => moveLesson(-1));
nextBtn.addEventListener('click', () => moveLesson(1));
player.addEventListener('ended', completeAndContinue);
player.addEventListener('timeupdate',()=>{ if(activeId && Math.floor(player.currentTime)%5===0){ saved[activeId]={...saved[activeId],time:player.currentTime}; persist(); } });

['dragenter','dragover'].forEach(type=>dropZone.addEventListener(type,event=>{event.preventDefault();dropZone.classList.add('dragging')}));
['dragleave','drop'].forEach(type=>dropZone.addEventListener(type,event=>{event.preventDefault();dropZone.classList.remove('dragging')}));
dropZone.addEventListener('drop',event=>addFiles(event.dataTransfer.files));

$('.tabs').addEventListener('click',event=>{
  const button=event.target.closest('button'); if(!button)return;
  document.querySelectorAll('.tabs button').forEach(el=>el.classList.toggle('active',el===button));
  const content=$('#tabContent');
  if(button.dataset.tab==='about') content.innerHTML='<p>로컬에 보관한 영상을 안전하게 재생하세요. 선택한 파일은 외부 서버로 전송되지 않으며, 재생 위치와 완료 상태는 이 브라우저에 저장됩니다.</p>';
  if(button.dataset.tab==='note') { content.innerHTML=`<textarea placeholder="이번 레슨에서 기억할 내용을 적어보세요.">${saved.note||''}</textarea>`; content.querySelector('textarea').addEventListener('input',e=>{saved.note=e.target.value;persist()}); }
  if(button.dataset.tab==='shortcut') content.innerHTML='<div class="shortcut-grid"><div><span>재생 / 일시정지</span><kbd>Space</kbd></div><div><span>10초 뒤로</span><kbd>←</kbd></div><div><span>10초 앞으로</span><kbd>→</kbd></div><div><span>전체 화면</span><kbd>F</kbd></div></div>';
});

document.addEventListener('keydown',event=>{
  if(event.target.matches('textarea,input')) return;
  if(event.code==='Space' && activeId){event.preventDefault();player.paused?player.play():player.pause()}
  if(event.key==='ArrowLeft') player.currentTime=Math.max(0,player.currentTime-10);
  if(event.key==='ArrowRight') player.currentTime=Math.min(player.duration||0,player.currentTime+10);
  if(event.key.toLowerCase()==='f' && activeId) player.requestFullscreen?.();
});

loadManifest();

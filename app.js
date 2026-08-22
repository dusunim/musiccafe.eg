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
let collapsedSections = new Set();
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
    let manifest = window.COURSE_MANIFEST;
    if (!manifest) {
      const response = await fetch('content/manifest.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      manifest = await response.json();
    }
    lessons = manifest.lessons.map((item) => ({
      ...item,
      transcript: window.COURSE_TRANSCRIPTS?.[item.id],
      url: `content/videos/${item.file.split('/').map(encodeURIComponent).join('/')}`,
    }));
    collapsedSections = new Set(manifest.sections.map((section) => section.number));
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
  if (lesson.sectionNumber) collapsedSections.delete(lesson.sectionNumber);
  player.src = lesson.url;
  dropZone.classList.add('has-video');
  $('#currentTitle').textContent = lesson.title;
  completeBtn.disabled = false;
  render();
  renderActiveTab();
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
  let playlistHtml = '';
  let openSection = null;
  lessons.forEach((item,index) => {
    const previous = lessons[index - 1];
    const sectionChanged = item.sectionNumber && item.sectionNumber !== previous?.sectionNumber;
    if (sectionChanged) {
      if (openSection !== null) playlistHtml += '</div></section>';
      openSection = item.sectionNumber;
      const isCurrent = item.sectionNumber === lessons.find((lesson) => lesson.id === activeId)?.sectionNumber;
      const isCollapsed = !isCurrent && collapsedSections.has(item.sectionNumber);
      playlistHtml += `
        <section class="curriculum-section ${isCurrent ? 'current' : ''}">
          <button class="section-toggle" data-section="${item.sectionNumber}" aria-expanded="${!isCollapsed}">
            <span class="section-number">${String(item.sectionNumber).padStart(2, '0')}</span>
            <strong>${escapeHtml(item.sectionTitle)}</strong>
            <span class="section-chevron" aria-hidden="true">⌄</span>
          </button>
          <div class="section-lessons" ${isCollapsed ? 'hidden' : ''}>`;
    }
    playlistHtml += `
      <button class="lesson ${item.id===activeId?'active':''} ${saved[item.id]?.done?'done':''}" data-id="${encodeURIComponent(item.id)}">
        <span class="num">${String(item.number ?? index+1).padStart(2,'0')}</span>
        <span><span class="title">${escapeHtml(item.title)}</span><span class="duration">${item.duration?formatTime(item.duration):'재생시간 확인 전'}</span></span>
        <span class="status">${saved[item.id]?.done?'✓':''}</span>
      </button>`;
  });
  if (openSection !== null) playlistHtml += '</div></section>';
  playlist.innerHTML = playlistHtml;
  const done = !!saved[activeId]?.done;
  const activeIndex = lessons.findIndex((item) => item.id === activeId);
  completeBtn.classList.toggle('done', done);
  completeBtn.innerHTML = `<span>✓</span> ${activeIndex === lessons.length - 1 ? '수강 완료' : done ? '다음 강의로' : '완료 후 다음 강의'}`;
  prevBtn.disabled = activeIndex <= 0;
  nextBtn.disabled = activeIndex < 0 || activeIndex >= lessons.length - 1;
}

function escapeHtml(value) { const div=document.createElement('div'); div.textContent=value; return div.innerHTML; }

function renderAbout() {
  const lesson = lessons.find((item) => item.id === activeId);
  const content = $('#tabContent');
  if (!lesson?.summary) {
    content.innerHTML = '<p>이 강의의 요약을 준비하고 있습니다. 영상은 외부 서버로 전송되지 않으며, 재생 위치와 완료 상태는 이 브라우저에 저장됩니다.</p>';
    return;
  }
  const summary = lesson.summary;
  content.innerHTML = `
    <div class="lesson-summary">
      <p class="summary-overview">${escapeHtml(summary.overview)}</p>
      <h3>핵심 내용</h3>
      <ul>${summary.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
      <h3>연습 포인트</h3>
      <ul>${summary.practiceTips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>
      <h3>타임라인</h3>
      <div class="summary-timeline">${summary.timeline.map((item) => `
        <button data-time="${item.time}"><span>${formatTime(item.time)}</span>${escapeHtml(item.label)}</button>`).join('')}
      </div>
    </div>`;
}

function renderActiveTab() {
  const activeTab = $('.tabs button.active')?.dataset.tab;
  if (activeTab === 'about') renderAbout();
  if (activeTab === 'transcript') renderTranscript();
}

function renderTranscript() {
  const lesson = lessons.find((item) => item.id === activeId);
  const content = $('#tabContent');
  if (!lesson?.transcript?.length) {
    content.innerHTML = '<p>이 강의의 전체 스크립트를 준비하고 있습니다.</p>';
    return;
  }
  content.innerHTML = `
    <div class="transcript-head">
      <strong>전체 스크립트</strong>
      <span>${lesson.transcript.length}개 음성 구간</span>
    </div>
    <div class="transcript-list">${lesson.transcript.map((segment) => `
      <button data-time="${segment.start}">
        <time>${formatTime(segment.start)}</time>
        <span>${escapeHtml(segment.text)}</span>
      </button>`).join('')}
    </div>`;
}

['#pickHero','#pickBottom'].forEach(id => $(id).addEventListener('click',()=>input.click()));
input.addEventListener('change', event => { addFiles(event.target.files); input.value=''; });
$('#expandAll').addEventListener('click', () => {
  collapsedSections.clear();
  render();
});
$('#collapseAll').addEventListener('click', () => {
  collapsedSections = new Set(lessons.map((lesson) => lesson.sectionNumber).filter(Boolean));
  const activeSection = lessons.find((lesson) => lesson.id === activeId)?.sectionNumber;
  if (activeSection) collapsedSections.delete(activeSection);
  render();
});
playlist.addEventListener('click', event => {
  const sectionButton = event.target.closest('.section-toggle');
  if (sectionButton) {
    const sectionNumber = Number(sectionButton.dataset.section);
    const activeSection = lessons.find((lesson) => lesson.id === activeId)?.sectionNumber;
    if (sectionNumber === activeSection) return toast('현재 재생 중인 섹션은 항상 펼쳐져 있습니다.');
    collapsedSections.has(sectionNumber) ? collapsedSections.delete(sectionNumber) : collapsedSections.add(sectionNumber);
    render();
    return;
  }
  const lessonButton = event.target.closest('.lesson');
  if (lessonButton) selectLesson(decodeURIComponent(lessonButton.dataset.id));
});
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
  if(button.dataset.tab==='about') renderAbout();
  if(button.dataset.tab==='transcript') renderTranscript();
  if(button.dataset.tab==='note') { content.innerHTML=`<textarea placeholder="이번 레슨에서 기억할 내용을 적어보세요.">${saved.note||''}</textarea>`; content.querySelector('textarea').addEventListener('input',e=>{saved.note=e.target.value;persist()}); }
  if(button.dataset.tab==='shortcut') content.innerHTML='<div class="shortcut-grid"><div><span>재생 / 일시정지</span><kbd>Space</kbd></div><div><span>10초 뒤로</span><kbd>←</kbd></div><div><span>10초 앞으로</span><kbd>→</kbd></div><div><span>전체 화면</span><kbd>F</kbd></div></div>';
});

$('#tabContent').addEventListener('click', (event) => {
  const button = event.target.closest('[data-time]');
  if (!button || !activeId) return;
  player.currentTime = Number(button.dataset.time);
  player.play().catch(() => {});
});

document.addEventListener('keydown',event=>{
  if(event.target.matches('textarea,input')) return;
  if(event.code==='Space' && activeId){event.preventDefault();player.paused?player.play():player.pause()}
  if(event.key==='ArrowLeft') player.currentTime=Math.max(0,player.currentTime-10);
  if(event.key==='ArrowRight') player.currentTime=Math.min(player.duration||0,player.currentTime+10);
  if(event.key.toLowerCase()==='f' && activeId) player.requestFullscreen?.();
});

window.authReady.then(loadManifest);

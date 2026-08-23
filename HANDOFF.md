# Music Cafe 작업 인수인계

이 문서는 새 Codex 세션에서 프로젝트 작업을 바로 이어가기 위한 현재 상태 기록이다. 저장소 루트는 `D:\repo\musiccafe.eg`이며 기본 브랜치는 `main`이다.

## 프로젝트 목표

개인적으로 보관한 기타 강의 콘텐츠를 로컬 브라우저에서 학습할 수 있는 정적 웹 강의실이다. 별도 웹 서버 없이 `index.html`을 직접 열어도 영상, 목차, 전사, 요약, PDF 및 backing track을 사용할 수 있어야 한다.

디자인과 정보 구조는 Sound Plat 강의 페이지를 참고했지만 현재 UI에 맞게 단순화했다. 강의 콘텐츠에 대한 적법한 접근 권한을 전제로 하며, 영상·전체 전사·교재·음원은 공개 Git 저장소에 올리지 않는다.

## 현재 구현 상태

- 총 73개 MP4 레슨, 11개 커리큘럼 섹션
- 영상 폴더: `content/videos/<section>/`
- 폴더명에는 섹션 번호를 한 자리로 사용한다. 예: `5-c-major-scale-variation`
- 파일명에는 정렬을 위한 두 자리 번호를 사용한다. 예: `01-c-major-scale-variation.mp4`
- 73개 레슨 모두 JSON/TXT 전사와 JSON 요약이 생성되어 있다.
- `좁쌤`이라는 전사 결과는 `조필성`으로 보정한다.
- 강의 소개에는 요약, 핵심 내용, 연습 포인트, 클릭 가능한 타임라인이 표시된다.
- 전체 스크립트 탭의 문장을 클릭하면 해당 영상 시점으로 이동한다.
- 나의 노트, 단축키, 이전/다음 레슨, 수강 완료 및 진도 저장 기능이 있다.
- 목차 섹션은 접고 펼칠 수 있으며 현재 재생 중인 섹션은 항상 펼쳐진다.
- 목차 상단에 `모두 펼치기`와 `모두 접기`가 있다.
- 브라우저의 `localStorage`에 진도·재생 위치·노트를 저장한다.
- 진입 시 암호 게이트가 화면을 dim/blur 처리한다. 평문 암호를 소스나 문서에 추가하지 말고 `auth.js`의 SHA-256 비교 방식을 유지한다.
- 인증 성공 상태는 현재 탭의 `sessionStorage`에 저장된다.

## 강의 자료

`강의 자료` 탭이 있으며 다음 콘텐츠를 제공한다.

- PDF 교재 1개: 새 탭 열기 및 다운로드
- WAV backing track 8개: 페이지 내 재생 및 개별 다운로드

로컬 배치 구조:

```text
content/assets/
├── documents/
│   └── ultimate-guitar-masterclass-part-1.pdf
└── backing-tracks/
    ├── 01-bpm-060-boksuhyeoljeon-full.wav
    ├── 02-bpm-080-c-major-1645.wav
    ├── 03-bpm-080-c-f.wav
    ├── 04-bpm-090-guthrie-am.wav
    ├── 05-bpm-095-am-6543.wav
    ├── 06-bpm-100-gtr-mr.wav
    ├── 07-bpm-110-am-pentatonic-lesson.wav
    └── 08-bpm-120-mode-tr-mr.wav
```

표시용 메타데이터는 추적되는 `content/resources.js`에 있다. PDF와 WAV 파일 자체는 확장자 규칙으로 Git에서 제외된다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `index.html` | 정적 페이지 골격, 탭과 스크립트 로딩 순서 |
| `styles.css` | 강의실, 영상, 목차, 전사 및 인증 화면 스타일 |
| `resources.css` | PDF와 backing track 자료 탭 스타일 |
| `app.js` | 영상 재생, 목차, 진도, 탭, 전사 및 자료 렌더링 |
| `auth.js` | 클라이언트 암호 게이트와 해시 비교 |
| `content/course.json` | 강의 원본 커리큘럼 정의 |
| `content/manifest.json` | 생성된 강의 데이터 |
| `content/manifest.js` | `file://` 실행용 강의 데이터 |
| `content/resources.js` | PDF와 backing track 표시 정보 |
| `content/transcripts.js` | `file://` 실행용 전체 전사 데이터, Git 제외 |
| `content/summaries/` | 레슨별 요약 JSON, Git 추적 |
| `scripts/generate-manifest.mjs` | 커리큘럼·요약·전사를 웹용 데이터로 생성 |
| `scripts/transcribe_course.py` | 전체 영상 일괄 전사 |
| `scripts/transcribe_video.py` | 영상 한 개 전사 |
| `scripts/generate_summaries.py` | 전사 기반 로컬 요약 생성 |

## 콘텐츠와 Git 정책

`.gitignore`에서 다음을 제외한다.

- `content/videos/`
- `content/transcripts/`
- `content/transcripts.js`
- MP4 등 영상 확장자
- MP3/WAV 등 오디오 확장자
- PDF 및 압축 파일
- 미완료 다운로드 파일

따라서 다른 컴퓨터에서 저장소만 clone하면 UI와 요약은 보이지만 영상, 전체 전사, 교재 및 backing track은 별도로 배치해야 한다. 이 파일들을 강제로 `git add -f` 하지 않는다.

## 실행과 데이터 재생성

서버 없이 실행:

```text
index.html 더블클릭
```

로컬 서버를 사용할 때:

```powershell
npx serve .
```

영상이나 커리큘럼 변경 후:

```powershell
node scripts/generate-manifest.mjs
```

전체 전사와 요약을 다시 만들 때:

```powershell
python scripts/transcribe_course.py --model small
python scripts/generate_summaries.py
node scripts/generate-manifest.mjs
```

NVIDIA CUDA가 준비된 환경에서는 전사 명령에 `--device cuda`를 추가할 수 있다. 이전 작업에서는 임시 가상환경의 `faster-whisper` small 모델과 CUDA를 사용했다. CUDA 실행 시 가상환경에 설치된 cuBLAS 및 cuDNN의 `bin` 디렉터리가 `PATH`에 있어야 한다.

## 검증 체크리스트

변경 후 최소한 다음을 확인한다.

```powershell
node --check app.js
node --check content/resources.js
node scripts/generate-manifest.mjs
git diff --check
git status --short --ignored
```

브라우저에서는 다음을 확인한다.

1. `file://`에서 암호 해제 후 첫 영상이 로드되는가
2. 현재 영상이 속한 목차 섹션이 열린 상태인가
3. 강의 소개 타임라인과 전체 스크립트 시점 이동이 동작하는가
4. 강의 자료 탭에서 PDF 열기·다운로드가 가능한가
5. backing track 8개가 재생되고 다운로드되는가
6. 모바일 폭에서 탭과 자료 목록이 잘리지 않는가

## 배포 관련 논의

아직 배포 서버는 구현하지 않았다. 논의한 권장 구조는 다음과 같다.

```text
GitHub Pages 또는 Vercel의 정적 프런트엔드
                ↓ HTTPS
Cloudflare Tunnel을 통한 집의 미디어 서버
```

공유기 DMZ 대신 Cloudflare Tunnel을 우선 고려한다. 실제 외부 서비스로 전환할 때는 다음이 필요하다.

- 영상 서버의 HTTP Range/206 및 HEAD/GET 지원
- 정확한 프런트엔드 origin만 허용하는 CORS
- 디렉터리 목록 차단
- 서버 측 인증 또는 만료되는 서명 URL
- HTTPS 및 접근 로그

현재 `auth.js`는 정적 클라이언트 게이트이므로 직접 영상 URL까지 보호하지 못한다. 외부 공개 단계에서는 반드시 서버 측 접근 제어로 교체해야 한다.

## 최근 기준점

이 문서 작성 직전 기능 커밋은 `1bf5e3d Add downloadable course resources`이다. 해당 커밋까지 `origin/main`에 push되어 있다.

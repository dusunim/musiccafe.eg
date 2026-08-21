# Music Cafe

로컬 디스크의 강의 영상을 브라우저에서 바로 재생하는 개인용 강의실입니다.

## 실행

`index.html`을 더블클릭하면 서버 없이 바로 실행됩니다.

로컬 서버를 사용하려면 다음 명령을 실행합니다.

```powershell
npx serve .
```

표시된 주소(보통 `http://localhost:3000`)를 브라우저에서 엽니다. `content/videos`의 영상은 강의 목차에 자동으로 표시되며 외부 서버로 업로드되지 않습니다. 진도와 노트는 브라우저 로컬 저장소에 유지됩니다.

## 강의 영상 갱신

새 영상을 `content/videos`에 넣은 뒤 매니페스트를 다시 생성합니다.

```powershell
node scripts/generate-manifest.mjs
```

영상은 원래 커리큘럼의 섹션별 폴더로 나뉩니다. 폴더명은 `5-c-major-scale-variation`처럼 섹션 번호를 그대로 쓰고, 파일명은 정렬을 위해 `01-c-major-scale-variation.mp4`처럼 두 자리 번호를 사용합니다.

## 강의 스크립트 생성

로컬 Whisper 환경에서 영상의 한국어 스크립트를 생성할 수 있습니다.

```powershell
pip install faster-whisper
python scripts/transcribe_video.py `
  content/videos/5-c-major-scale-variation/01-c-major-scale-variation.mp4 `
  content/transcripts/5-c-major-scale-variation/01-c-major-scale-variation
```

요약 파일은 같은 상대 경로의 `content/summaries` 아래에 JSON으로 저장합니다. `node scripts/generate-manifest.mjs`를 실행하면 요약이 강의 소개 탭에 포함됩니다.

# Music Cafe

로컬 디스크의 강의 영상을 브라우저에서 바로 재생하는 개인용 강의실입니다.

## 실행

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

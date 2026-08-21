import { mkdir, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const videoRoot = path.join(root, 'content', 'videos');
const courseFile = path.join(root, 'content', 'course.json');

const sections = [
  { number: 1, range: [1, 3], slug: 'picking-fingering-chromatic', title: '피킹, 왼손 핑거링, 그리고 크로매틱 어떻게 해야할까?' },
  { number: 2, range: [4, 9], slug: 'speed-chromatic-basics', title: '속주를 위한 정석 크로매틱의 기본을 배워보자' },
  { number: 3, range: [10, 12], slug: 'chromatic-finger-independence', title: '크로매틱 마스터하기 - 손가락 인디펜던스의 시작' },
  { number: 4, range: [13, 17], slug: 'c-major-scale-fundamentals', title: '모든 KEY의 기본, C 메이저 스케일 완전정복' },
  { number: 5, range: [18, 21], slug: 'c-major-scale-variation', title: 'C 메이저 스케일 활용 - 크로매틱에 적용해보자' },
  { number: 6, range: [22, 24], slug: 'pentatonic-scale', title: '펜타토닉 스케일 - 모든 연주의 시작과 끝' },
  { number: 7, range: [25, 28], slug: 'bending-points', title: '벤딩 포인트 마스터' },
  { number: 8, range: [29, 29], slug: 'slide-points', title: '슬라이드 포인트 마스터' },
  { number: 9, range: [30, 33], slug: 'essential-techniques', title: '필수 기본 테크닉 - 한 번 배운다고 다 아는 것이 아니다' },
  { number: 10, range: [34, 57], slug: 'easy-penta-40-licks', title: '필수 펜타토닉 릭 40가지 (Easy Penta)' },
  { number: 11, range: [58, 61], slug: 'chapter-compilation', title: '챕터 별로 한 번에 몰아보기' },
];

const entries = (await readdir(videoRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp4'));

if (entries.length !== 61) {
  throw new Error(`Expected 61 flat MP4 files, found ${entries.length}.`);
}

const course = { title: '조필성 얼티밋 기타 마스터 클래스 1편', sections: [] };
const pad = (number) => String(number).padStart(2, '0');

for (const section of sections) {
  const folder = `${section.number}-${section.slug}`;
  const targetDirectory = path.join(videoRoot, folder);
  await mkdir(targetDirectory, { recursive: true });
  const lessons = [];

  for (let globalNumber = section.range[0]; globalNumber <= section.range[1]; globalNumber += 1) {
    const entry = entries.find(({ name }) => Number(name.match(/^(\d+)_/)?.[1]) === globalNumber);
    if (!entry) throw new Error(`Missing source video ${globalNumber}.`);

    const localNumber = section.number === 1 ? globalNumber - 1 : globalNumber - section.range[0] + 1;
    const targetName = `${pad(localNumber)}-${section.slug}.mp4`;
    const sourcePath = path.join(videoRoot, entry.name);
    const targetPath = path.join(targetDirectory, targetName);
    const durationMatch = entry.name.match(/\((\d{1,2})_(\d{2})\)\.mp4$/i);
    const duration = durationMatch ? Number(durationMatch[1]) * 60 + Number(durationMatch[2]) : 0;
    const title = entry.name
      .replace(/\.mp4$/i, '')
      .replace(/^\d+_/, '')
      .replace(/\s*\(\d{1,2}_\d{2}\)$/, '')
      .replace(/_/g, '?')
      .trim();

    await rename(sourcePath, targetPath);
    lessons.push({
      number: localNumber,
      title: globalNumber === 1 ? '0) 강의 소개' : title,
      file: `${folder}/${targetName}`,
      duration,
    });
  }

  course.sections.push({ number: section.number, slug: section.slug, title: section.title, lessons });
}

await writeFile(courseFile, `${JSON.stringify(course, null, 2)}\n`, 'utf8');
console.log(`Reorganized 61 videos into ${sections.length} sections.`);

import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const videoDirectory = path.join(root, 'content', 'videos');
const courseFile = path.join(root, 'content', 'course.json');
const output = path.join(root, 'content', 'manifest.json');
const scriptOutput = path.join(root, 'content', 'manifest.js');
const course = JSON.parse(await readFile(courseFile, 'utf8'));
const lessons = course.sections.flatMap((section) => section.lessons.map((lesson) => ({
  ...lesson,
  id: `section-${section.number}-lesson-${lesson.number}`,
  sectionNumber: section.number,
  sectionTitle: section.title,
})));

await Promise.all(lessons.map((lesson) => access(path.join(videoDirectory, ...lesson.file.split('/')))));
const manifest = { title: course.title, sections: course.sections, lessons };
await Promise.all([
  writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  writeFile(scriptOutput, `window.COURSE_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`, 'utf8'),
]);
console.log(`Generated ${path.relative(root, output)} with ${lessons.length} lessons.`);

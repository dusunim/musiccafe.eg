import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const videoRoot = path.join(root, 'content', 'videos');
const courseFile = path.join(root, 'content', 'course.json');
const course = JSON.parse(await readFile(courseFile, 'utf8'));

for (const section of course.sections) {
  for (const lesson of section.lessons) {
    const parts = lesson.file.split('/');
    const oldName = parts.pop();
    const newName = oldName.replace(/^\d+-/, `${String(lesson.number).padStart(2, '0')}-`);
    if (oldName === newName) continue;

    const directory = path.join(videoRoot, ...parts);
    await rename(path.join(directory, oldName), path.join(directory, newName));
    lesson.file = [...parts, newName].join('/');
  }
}

await writeFile(courseFile, `${JSON.stringify(course, null, 2)}\n`, 'utf8');
console.log('Normalized lesson filenames with two-digit prefixes.');

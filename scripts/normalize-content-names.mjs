import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const videoRoot = path.join(root, 'content', 'videos');
const courseFile = path.join(root, 'content', 'course.json');
const course = JSON.parse(await readFile(courseFile, 'utf8'));

for (const section of course.sections) {
  const pending = [];
  for (const [index, lesson] of section.lessons.entries()) {
    const parts = lesson.file.split('/');
    const oldName = parts.pop();
    const newName = oldName.replace(/^\d+-/, `${String(index + 1).padStart(2, '0')}-`);
    if (oldName === newName) continue;

    const directory = path.join(videoRoot, ...parts);
    const temporaryName = `${oldName}.renaming`;
    await rename(path.join(directory, oldName), path.join(directory, temporaryName));
    pending.push({ lesson, parts, directory, temporaryName, newName });
  }

  for (const item of pending) {
    await rename(path.join(item.directory, item.temporaryName), path.join(item.directory, item.newName));
    item.lesson.file = [...item.parts, item.newName].join('/');
  }
}

await writeFile(courseFile, `${JSON.stringify(course, null, 2)}\n`, 'utf8');
console.log('Normalized lesson filenames with two-digit prefixes.');

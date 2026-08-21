import argparse
import json
from pathlib import Path

from faster_whisper import WhisperModel

CORRECTIONS = {"좁쌤": "조필성"}


def correct_text(text: str) -> str:
    for source, target in CORRECTIONS.items():
        text = text.replace(source, target)
    return text


def timestamp(seconds: float) -> str:
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


parser = argparse.ArgumentParser(description="Transcribe every video in the course manifest.")
parser.add_argument("--model", default="small")
parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
parser.add_argument("--compute-type", default=None)
parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

root = args.root.resolve()
manifest = json.loads((root / "content" / "manifest.json").read_text(encoding="utf-8"))
pending = []
for lesson in manifest["lessons"]:
    output = root / "content" / "transcripts" / Path(lesson["file"]).with_suffix("")
    if args.force or not output.with_suffix(".json").exists() or not output.with_suffix(".txt").exists():
        pending.append((lesson, output))

print(f"Course lessons: {len(manifest['lessons'])}; pending: {len(pending)}", flush=True)
if not pending:
    raise SystemExit(0)

compute_type = args.compute_type or ("float16" if args.device == "cuda" else "int8")
model = WhisperModel(args.model, device=args.device, compute_type=compute_type)
for position, (lesson, output) in enumerate(pending, 1):
    video = root / "content" / "videos" / lesson["file"]
    output.parent.mkdir(parents=True, exist_ok=True)
    print(f"[{position}/{len(pending)}] START {lesson['file']}", flush=True)
    segments, info = model.transcribe(
        str(video),
        language="ko",
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=True,
    )
    items = []
    for segment in segments:
        text = correct_text(segment.text.strip())
        if text:
            items.append({"start": round(segment.start, 2), "end": round(segment.end, 2), "text": text})

    payload = {
        "video": video.relative_to(root).as_posix(),
        "language": info.language,
        "language_probability": info.language_probability,
        "model": args.model,
        "segments": items,
    }
    json_temp = output.with_suffix(".json.tmp")
    text_temp = output.with_suffix(".txt.tmp")
    json_temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    text_temp.write_text(
        "\n".join(f"[{timestamp(item['start'])}] {item['text']}" for item in items) + "\n",
        encoding="utf-8",
    )
    json_temp.replace(output.with_suffix(".json"))
    text_temp.replace(output.with_suffix(".txt"))
    print(f"[{position}/{len(pending)}] DONE segments={len(items)}", flush=True)

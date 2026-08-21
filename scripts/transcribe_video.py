import argparse
import json
from pathlib import Path

from faster_whisper import WhisperModel


def timestamp(seconds: float) -> str:
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


parser = argparse.ArgumentParser(description="Transcribe one course video with Whisper.")
parser.add_argument("video", type=Path)
parser.add_argument("output", type=Path, help="Output path without an extension")
parser.add_argument("--model", default="small")
args = parser.parse_args()

args.output.parent.mkdir(parents=True, exist_ok=True)
model = WhisperModel(args.model, device="cpu", compute_type="int8")
segments, info = model.transcribe(
    str(args.video),
    language="ko",
    beam_size=5,
    vad_filter=True,
    condition_on_previous_text=True,
)

items = []
for segment in segments:
    text = segment.text.strip()
    if text:
        items.append({"start": round(segment.start, 2), "end": round(segment.end, 2), "text": text})
        print(f"[{timestamp(segment.start)}] {text}", flush=True)

payload = {
    "video": args.video.as_posix(),
    "language": info.language,
    "language_probability": info.language_probability,
    "model": args.model,
    "segments": items,
}
args.output.with_suffix(".json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
args.output.with_suffix(".txt").write_text(
    "\n".join(f"[{timestamp(item['start'])}] {item['text']}" for item in items) + "\n",
    encoding="utf-8",
)

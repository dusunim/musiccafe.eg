import argparse
import json
import re
from pathlib import Path


SECTION_TIPS = {
    1: ["피킹과 왼손의 타이밍이 어긋나지 않도록 느린 속도부터 시작하세요.", "메트로놈을 사용해 음량과 리듬을 일정하게 유지하세요."],
    2: ["속도를 올리기 전에 각 손가락이 독립적으로 움직이는지 확인하세요.", "힘이 들어가는 순간 템포를 낮추고 작은 동작으로 다시 연습하세요."],
    3: ["취약한 손가락 조합만 분리해 짧게 반복하세요.", "정확도가 유지되는 범위에서 템포를 조금씩 높이세요."],
    4: ["지판 모양만 외우지 말고 루트음과 각 음의 위치를 함께 확인하세요.", "한 포지션을 익힌 뒤 인접 포지션과 자연스럽게 연결하세요."],
    5: ["C 메이저 스케일을 천천히 확인한 뒤 제시된 패턴을 적용하세요.", "막히는 현과 포지션을 표시해 해당 구간만 반복하세요."],
    6: ["펜타토닉 블록의 루트음을 기준으로 현재 위치를 확인하세요.", "메이저 스케일과 펜타토닉의 공통음을 비교하며 연주하세요."],
    7: ["벤딩 전후의 목표음을 먼저 연주해 정확한 음정을 귀로 기억하세요.", "손가락 하나보다 여러 손가락과 손목을 함께 사용하세요."],
    8: ["슬라이드의 시작음과 도착음이 박자 안에 들어오는지 확인하세요.", "불필요한 줄 소음을 막으면서 압력을 일정하게 유지하세요."],
    9: ["테크닉 자체보다 앞뒤 음이 자연스럽게 이어지는지 들어보세요.", "클린 톤과 느린 템포에서 불필요한 잡음을 먼저 정리하세요."],
    10: ["릭을 짧은 단위로 나눈 뒤 연결하고, 마지막에 원래 리듬으로 연주하세요.", "외운 프레이즈를 다른 키와 다른 시작 박자에도 적용해 보세요."],
    11: ["몰아보기 전에 취약한 원본 챕터를 먼저 복습하세요.", "긴 연습은 구간을 나눠 정확도를 점검하며 진행하세요."],
}


def clean_title(title: str) -> str:
    return re.sub(r"^\d+\)\s*", "", title).strip()


def clean_text(text: str, limit: int = 150) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def select_spread(items: list[dict], count: int) -> list[dict]:
    usable = [item for item in items if len(item["text"].strip()) >= 12]
    if len(usable) <= count:
        return usable
    indices = [round(index * (len(usable) - 1) / (count - 1)) for index in range(count)]
    return [usable[index] for index in indices]


parser = argparse.ArgumentParser(description="Generate local, extractive course summaries from transcripts.")
parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

root = args.root.resolve()
manifest = json.loads((root / "content" / "manifest.json").read_text(encoding="utf-8"))
created = 0
skipped = 0
for lesson in manifest["lessons"]:
    relative = Path(lesson["file"]).with_suffix(".json")
    transcript_path = root / "content" / "transcripts" / relative
    summary_path = root / "content" / "summaries" / relative
    if summary_path.exists() and not args.force:
        skipped += 1
        continue
    if not transcript_path.exists():
        continue

    transcript = json.loads(transcript_path.read_text(encoding="utf-8"))
    segments = transcript.get("segments", [])
    key_segments = select_spread(segments, 4)
    timeline_segments = select_spread(segments, 6)
    topic = clean_title(lesson["title"])
    summary = {
        "generated": True,
        "overview": f"{lesson['sectionTitle']} 섹션의 ‘{topic}’을 중심으로 설명과 연주 시범을 따라가며 핵심 동작을 익히는 강의입니다.",
        "keyPoints": [clean_text(item["text"]) for item in key_segments],
        "practiceTips": SECTION_TIPS.get(lesson["sectionNumber"], [
            "느린 템포에서 정확하게 연주한 뒤 속도를 높이세요.",
            "어려운 구간은 짧게 나누어 반복하세요.",
        ]),
        "timeline": [
            {"time": round(item["start"]), "label": clean_text(item["text"], 65)}
            for item in timeline_segments
        ],
    }
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    created += 1

print(f"Created {created} summaries; preserved {skipped} existing summaries.")

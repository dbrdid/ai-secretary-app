"""Synthetic Korean STT probe; no speaker attribution or real-meeting claims."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import subprocess
import time
import unicodedata
import wave
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "sources/stt-validation"
CASES = [
    ("assignment", "준호가 보고서를 작성합니다. 기한은 십월 십이일입니다.", ["준호", "십월", "십이일"]),
    ("negation", "저는 발표 자료를 맡지 않겠습니다.", ["않겠습니다"]),
    ("reversal", "민수가 아니라 지수가 회의록을 작성합니다.", ["민수", "아니라", "지수"]),
    ("necessity", "테스트 계획을 정리해야 합니다. 담당자와 기한은 아직 정하지 않았습니다.", ["정하지", "않았습니다"]),
]
def normalize(text):
    # NFC and removal of punctuation/spacing keep Hangul syllable CER reproducible.
    return "".join(c for c in unicodedata.normalize("NFC", text) if unicodedata.category(c)[0] in "LN")
def distance(a, b):
    row = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        nxt = [i]
        for j, y in enumerate(b, 1):
            nxt.append(min(nxt[-1]+1, row[j]+1, row[j-1]+(x != y)))
        row = nxt
    return row[-1]
def metrics(reference, actual, keywords):
    ref, hyp = normalize(reference), normalize(actual)
    errors = distance(ref, hyp)
    return {"cer": errors / len(ref) if ref else None, "characterErrors": errors,
            "referenceCharacters": len(ref),
            "keywords": {k: normalize(k) in hyp for k in keywords}}
def date_values(text):
    # Only explicit month/day expressions are compared; this is not general semantic scoring.
    numbers = {"일": 1, "이": 2, "삼": 3, "사": 4, "오": 5, "육": 6, "칠": 7, "팔": 8, "구": 9}
    def parse(token):
        if token.isascii() and token.isdigit():
            return int(token)
        if "십" in token:
            tens, units = token.split("십", 1)
            if tens not in ("", "이", "삼") or (units and units not in numbers):
                return None
            return numbers.get(tens, 1) * 10 + numbers.get(units, 0)
        return numbers.get(token)
    values = []
    for match in re.finditer(r"([0-9일이삼사오육칠팔구십]+)월\s*([0-9일이삼사오육칠팔구십]+)일", unicodedata.normalize("NFC", text)):
        month, day = map(parse, match.groups())
        if month is not None and day is not None and 1 <= month <= 12 and 1 <= day <= 31:
            values.append([month, day])
    return values

def semantic_checks(reference, actual):
    expected = date_values(reference)
    return {"dateValues": date_values(actual) == expected if expected else None,
            "criticalTerms": {term: normalize(term) in normalize(actual)
                              for term in ["준호", "기한은", "맡지", "않겠습니다", "민수", "아니라", "지수", "정하지", "않았습니다"]
                              if normalize(term) in normalize(reference)}}

def read_pcm(path):
    import numpy as np
    # Only our declared PCM format is accepted; do not silently reinterpret other audio.
    with wave.open(str(path), "rb") as audio:
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) != (1, 2, 16000, "NONE"):
            raise ValueError("Expected mono PCM16 16000Hz WAV")
        frames = audio.getnframes()
        raw = audio.readframes(frames)
        if len(raw) != frames * 2:
            raise ValueError("Truncated PCM data")
        samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if not len(samples):
        raise ValueError("Empty audio")
    return samples

def main():
    from faster_whisper import WhisperModel
    DATA.mkdir(parents=True, exist_ok=True)
    output = Path(os.environ["STT_REPORT_PATH"]) if os.environ.get("STT_REPORT_PATH") else ROOT / "docs/test-runs" / (datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S.%fZ") + "-stt") / "report.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {"scope": "macOS Yuna synthetic Korean; not real meeting quality", "model": "small",
              "device": "cpu", "computeType": "int8", "normalization": "NFC; Unicode letters/numbers only; no number-word equivalence",
              "versions": {p: importlib.metadata.version(p) for p in ["faster-whisper", "ctranslate2", "av"]},
              "complete": False, "results": []}
    report["cpuThreads"] = 2
    report["numWorkers"] = 1
    report["audioInput"] = "validated PCM16 WAV -> float32 array; bypass PyAV decoder incompatibility"
    def save():
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    save()
    # Downloads are a separate preparation step; validation cannot silently access the network.
    model = WhisperModel("small", device="cpu", compute_type="int8", download_root=str(DATA / "models"), local_files_only=True, cpu_threads=2, num_workers=1)
    for cid, reference, keywords in CASES + [("silence", "", [])]:
        path = DATA / (cid + ".wav")
        try:
            if cid == "silence":
                with wave.open(str(path), "wb") as f:
                    f.setnchannels(1); f.setsampwidth(2); f.setframerate(16000)
                    f.writeframes(bytes(16000 * 2 * 3))
            else:
                subprocess.run(["say", "-v", "Yuna", "-r", "170", "-o", str(path),
                                "--file-format=WAVE", "--data-format=LEI16@16000", reference], check=True, timeout=60)
            samples = read_pcm(path)
            duration = len(samples) / 16000
            start = time.monotonic()
            segments, info = model.transcribe(samples, language="ko", beam_size=5, vad_filter=False,
                                              condition_on_previous_text=False)
            segments = [{"start":s.start, "end":s.end, "text":s.text} for s in segments]
            elapsed = time.monotonic() - start
            actual = "".join(s["text"] for s in segments)
            score = metrics(reference, actual, keywords)
            meaning = semantic_checks(reference, actual)
            checks = {"dateValues": meaning["dateValues"] is not False,
                      "criticalTerms": all(meaning["criticalTerms"].values()),
                      "cer": score["cer"] <= .1 if reference else not actual.strip(),
                      "keywords": all(score["keywords"].values()),
                      "timestampBounds": all(0 <= s["start"] <= s["end"] <= duration + .1 for s in segments)}
            result = {"id":cid, "status":"passed" if all(checks.values()) else "failed", "reference":reference,
                      "actual":actual, "segments":segments, "metrics":score, "semanticChecks":meaning, "checks":checks,
                      "durationSeconds":duration, "elapsedSeconds":elapsed, "realTimeFactor":elapsed/duration,
                      "sha256":hashlib.sha256(path.read_bytes()).hexdigest(), "audioPath":str(path.relative_to(ROOT)),
                      "generation":"digital silence" if cid == "silence" else "macOS say Yuna rate=170",
                      "boundaryAccuracy":"not_measured: no manually annotated speech boundaries"}
        except Exception as e:
            result = {"id":cid, "status":"error", "error":str(e)}
        report["results"].append(result); save()
        print(cid, result["status"], flush=True)
    report["complete"] = True
    report["counts"] = {s:sum(r["status"] == s for r in report["results"]) for s in ["passed","failed","error"]}
    save()
    print(output, flush=True)
    return 1 if report["counts"]["failed"] or report["counts"]["error"] else 0
if __name__ == "__main__":
    raise SystemExit(main())

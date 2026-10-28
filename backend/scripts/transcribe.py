#!/usr/bin/env python3
"""Transcribe audio with faster-whisper. Outputs JSON to stdout."""
import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", default="base")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            json.dumps(
                {
                    "error": "faster-whisper not installed. pip install faster-whisper",
                }
            ),
            file=sys.stderr,
        )
        return 2

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    segments_iter, info = model.transcribe(args.audio, beam_size=5, vad_filter=True)

    segments = []
    full_parts = []
    for idx, seg in enumerate(segments_iter):
        text = seg.text.strip()
        if not text:
            continue
        full_parts.append(text)
        segments.append(
            {
                "index": idx,
                "startSec": float(seg.start),
                "endSec": float(seg.end),
                "text": text,
            }
        )

    payload = {
        "fullText": " ".join(full_parts),
        "language": info.language,
        "model": args.model,
        "segments": segments,
    }
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

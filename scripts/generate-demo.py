#!/usr/bin/env python3
"""Generate the local demo library: artwork, instrumental audio, video and timed files.

Everything is synthesized locally, so the repository has no third-party media.
Requires numpy, Pillow and ffmpeg/ffprobe on PATH.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "public" / "demo"
AUDIO = DEMO / "audio"
COVERS = DEMO / "covers"
VIDEO = DEMO / "video"
SUBS = DEMO / "subtitles"
DANMAKU = DEMO / "danmaku"
for folder in (AUDIO, COVERS, VIDEO, SUBS, DANMAKU):
    folder.mkdir(parents=True, exist_ok=True)

SR = 48000
rng = np.random.default_rng(20261111)


# ----------------------------------------------------------------------------- utils
def env_adsr(n: int, attack: float, decay: float, sustain: float, release: float, sr: int) -> np.ndarray:
    a = max(1, int(attack * sr))
    d = max(1, int(decay * sr))
    r = max(1, int(release * sr))
    s = max(1, n - a - d - r)
    return np.concatenate([
        np.linspace(0, 1, a, endpoint=False),
        np.linspace(1, sustain, d, endpoint=False),
        np.full(s, sustain),
        np.linspace(sustain, 0, r),
    ])[:n]


def note(freq: float, dur: float, sr: int = SR, detune: float = 0.0) -> np.ndarray:
    n = int(dur * sr)
    t = np.arange(n) / sr
    f = freq * (1 + detune)
    wave_ = (
        np.sin(2 * np.pi * f * t)
        + 0.42 * np.sin(2 * np.pi * f * 2 * t + 0.2)
        + 0.18 * np.sin(2 * np.pi * f * 3 * t + 1.1)
        + 0.08 * np.sin(2 * np.pi * f * 4.01 * t)
    )
    # Slight pitch drift makes the pad feel less static.
    wave_ *= 1 + 0.0015 * np.sin(2 * np.pi * 0.17 * t)
    return wave_


def midi(m: int) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def chord_tones(root: int, kind: str) -> list[int]:
    shapes = {
        "maj7": [0, 4, 7, 11],
        "min7": [0, 3, 7, 10],
        "maj9": [0, 4, 7, 11, 14],
        "sus2": [0, 2, 7, 12],
        "min9": [0, 3, 7, 10, 14],
    }
    return [root + i for i in shapes[kind]]


def place(buf: np.ndarray, sound: np.ndarray, at: float, sr: int = SR, gain: float = 1.0) -> None:
    start = int(at * sr)
    end = min(len(buf), start + len(sound))
    if start >= len(buf) or end <= start:
        return
    buf[start:end] += sound[: end - start] * gain


def stereo(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    return np.stack([left, right], axis=1)


def normalize(x: np.ndarray, peak: float = 0.92) -> np.ndarray:
    m = float(np.max(np.abs(x))) or 1.0
    return x / m * peak


def soft_clip(x: np.ndarray) -> np.ndarray:
    return np.tanh(x * 1.15) / np.tanh(1.15)


def write_wav(path: Path, data: np.ndarray, sr: int, bits: int = 16) -> None:
    data = np.clip(data, -1, 1)
    if bits == 16:
        raw = (data * 32767).astype("<i2").tobytes()
        sampwidth = 2
    else:
        ints = np.round(data * 8388607).astype("<i4")
        raw = b"".join(int(v & 0xFFFFFF).to_bytes(3, "little") for v in ints.reshape(-1))
        sampwidth = 3
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(sampwidth)
        f.setframerate(sr)
        f.writeframes(raw)


def make_cover(path: Path, palette: list[tuple[int, int, int]], seed: int, label: str) -> None:
    w = h = 900
    local = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = xx / w, yy / h
    img = np.zeros((h, w, 3), np.float32)
    for i, color in enumerate(palette):
        cx = 0.2 + 0.6 * ((i * 0.37 + local.random() * 0.2) % 1)
        cy = 0.2 + 0.6 * ((i * 0.53 + local.random() * 0.2) % 1)
        radius = 0.35 + local.random() * 0.3
        d = np.sqrt((nx - cx) ** 2 + (ny - cy) ** 2)
        glow = np.exp(-(d / radius) ** 2 * 2.3)
        img += glow[..., None] * np.array(color, np.float32) / 255.0
    # Soft diagonal light bands.
    bands = 0.06 * np.sin((nx * 3 + ny * 2) * math.pi * 2 + seed)
    img += bands[..., None]
    img = np.clip(img, 0, 1)
    img = (img ** 0.85) * 255
    pil = Image.fromarray(img.astype(np.uint8)).filter(ImageFilter.GaussianBlur(18))
    draw = ImageDraw.Draw(pil, "RGBA")
    # Rounded inner frame and a translucent orb.
    draw.rounded_rectangle((52, 52, w - 52, h - 52), radius=48, outline=(255, 255, 255, 55), width=2)
    draw.ellipse((w * 0.27, h * 0.27, w * 0.73, h * 0.73), fill=(255, 255, 255, 20), outline=(255, 255, 255, 80), width=2)
    draw.ellipse((w * 0.37, h * 0.37, w * 0.63, h * 0.63), fill=(255, 255, 255, 28))
    # Grain.
    noise = (local.normal(0, 4, (h, w, 1))).repeat(3, axis=2)
    arr = np.clip(np.asarray(pil, np.float32) + noise, 0, 255).astype(np.uint8)
    Image.fromarray(arr).save(path, quality=90)
    print("cover", path.name, label)


# ----------------------------------------------------------------------------- tracks
def render_aurora() -> np.ndarray:
    sr = SR
    dur = 96
    total = int(dur * sr)
    left = np.zeros(total)
    right = np.zeros(total)
    bpm = 92
    beat = 60 / bpm
    prog = [
        (50, "maj9"), (47, "min9"), (43, "maj7"), (45, "sus2"),
        (50, "maj9"), (47, "min9"), (43, "maj7"), (45, "sus2"),
        (50, "maj9"), (47, "min9"), (43, "maj7"), (45, "sus2"),
    ]
    bar = beat * 4
    for i, (root, kind) in enumerate(prog):
        start = i * bar
        tones = chord_tones(root, kind)
        for ti, m in enumerate(tones):
            dur_note = bar * 0.98
            pad = note(midi(m), dur_note, sr, detune=(ti - 1.5) * 0.0012)
            pad *= env_adsr(len(pad), 1.6, 0.8, 0.7, 1.2, sr)
            pan = 0.5 + (ti - (len(tones) - 1) / 2) * 0.16
            place(left, pad, start, sr, 0.05 * (1 - pan))
            place(right, pad, start, sr, 0.05 * pan * 2)
        # Bass
        b = note(midi(root - 12), bar * 0.9, sr)
        b *= env_adsr(len(b), 0.05, 0.5, 0.5, 0.8, sr)
        place(left, b, start, sr, 0.11)
        place(right, b, start, sr, 0.11)
        # Arpeggio bells, 1/8 notes.
        pattern = [0, 2, 1, 3, 2, 4, 3, 1] if len(tones) > 4 else [0, 2, 1, 3, 2, 1, 3, 2]
        for step in range(8):
            m = tones[pattern[step] % len(tones)] + 12
            at = start + step * beat / 2
            bell = note(midi(m), 1.25, sr)
            bell *= env_adsr(len(bell), 0.005, 0.5, 0.15, 0.75, sr)
            pan = 0.25 if step % 2 == 0 else 0.75
            place(left, bell, at, sr, 0.035 * (1.3 - pan))
            place(right, bell, at, sr, 0.035 * pan * 1.3)
    # Kick and shaker enter after the intro.
    for t in np.arange(8.0, dur - 2, beat * 2):
        n = int(0.5 * sr)
        tt = np.arange(n) / sr
        kick = np.sin(2 * np.pi * (58 - 22 * tt) * tt) * np.exp(-tt * 13)
        place(left, kick, t, sr, 0.22)
        place(right, kick, t, sr, 0.22)
        # off-beat shaker
        n2 = int(0.16 * sr)
        sh = rng.normal(0, 1, n2) * np.exp(-np.arange(n2) / sr * 34)
        sh = np.convolve(sh, np.ones(4) / 4, mode="same")
        place(left, sh, t + beat, sr, 0.018)
        place(right, sh, t + beat, sr, 0.022)
    # Airy noise bed and slow swells.
    bed = rng.normal(0, 1, total)
    bed = np.convolve(bed, np.ones(64) / 64, mode="same")
    bed *= np.linspace(0.01, 0.025, total)
    left += bed
    right += np.roll(bed, 311)
    swell = np.sin(2 * np.pi * 0.035 * np.arange(total) / sr) * 0.5 + 0.5
    shimmer = np.sin(2 * np.pi * midi(86) * np.arange(total) / sr) * swell * 0.008
    left += shimmer
    right += np.roll(shimmer, 900)
    # Simple ping-pong delay on a copy of the arpeggio.
    out = stereo(left, right)
    delay = int(beat * 0.75 * sr)
    echo = np.zeros_like(out)
    echo[delay:] = out[:-delay] * 0.16
    out = out + echo
    return soft_clip(normalize(out, 0.86))


def render_glass() -> np.ndarray:
    sr = 44100
    dur = 84
    total = int(dur * sr)
    left = np.zeros(total)
    right = np.zeros(total)
    bpm = 112
    beat = 60 / bpm
    prog = [(42, "min9"), (38, "maj7"), (45, "maj9"), (40, "min7")] * 5
    bar = beat * 4
    for i, (root, kind) in enumerate(prog):
        start = i * bar
        if start >= dur:
            break
        tones = chord_tones(root, kind)
        for ti, m in enumerate(tones):
            pad = note(midi(m + 12), bar, sr, detune=(ti - 2) * 0.0018)
            pad *= env_adsr(len(pad), 0.9, 1.2, 0.35, 1.2, sr)
            place(left, pad, start, sr, 0.035)
            place(right, pad, start, sr, 0.035)
        for step in range(16):
            m = tones[(step * 2 + i) % len(tones)] + 24
            at = start + step * beat / 4
            blip = note(midi(m), 0.7, sr)
            blip *= env_adsr(len(blip), 0.003, 0.3, 0.05, 0.4, sr)
            place(left, blip, at, sr, 0.028)
            place(right, np.roll(blip, 110), at, sr, 0.028)
        bass = note(midi(root - 12), bar * 0.7, sr)
        bass *= env_adsr(len(bass), 0.02, 0.4, 0.25, 1.0, sr)
        place(left, bass, start, sr, 0.10)
        place(right, bass, start, sr, 0.10)
    for t in np.arange(6.0, dur - 1, beat):
        n = int(0.35 * sr)
        tt = np.arange(n) / sr
        kick = np.sin(2 * np.pi * (48 + 32 * np.exp(-tt * 20)) * tt) * np.exp(-tt * 16)
        place(left, kick, t, sr, 0.16)
        place(right, kick, t, sr, 0.16)
    # Glass chimes at phrase boundaries.
    for t in np.arange(11.0, dur - 3, bar * 2):
        for j, m in enumerate((90, 93, 97, 100)):
            chime = note(midi(m), 3.2, sr)
            chime *= env_adsr(len(chime), 0.002, 1.6, 0.02, 1.5, sr)
            place(left, chime, t + j * 0.12, sr, 0.018)
            place(right, chime, t + j * 0.12 + 0.02, sr, 0.018)
    out = stereo(left, right)
    delay = int(beat * 0.5 * sr)
    echo = np.zeros_like(out)
    echo[delay:] = out[:-delay] * 0.22
    out += echo
    out[:, 0] = np.convolve(out[:, 0], np.ones(3) / 3, mode="same")
    return soft_clip(normalize(out, 0.84))


def render_paper() -> np.ndarray:
    sr = 48000
    dur = 78
    total = int(dur * sr)
    left = np.zeros(total)
    right = np.zeros(total)
    bpm = 84
    beat = 60 / bpm
    prog = [(45, "maj7"), (42, "min7"), (38, "maj9"), (40, "sus2")] * 6
    bar = beat * 4
    melody = [69, 72, 76, 74, 72, 69, 67, 69, 72, 76, 79, 77, 76, 72, 69, 67]
    for i, (root, kind) in enumerate(prog):
        start = i * bar
        if start >= dur:
            break
        tones = chord_tones(root, kind)
        for ti, m in enumerate(tones):
            pad = note(midi(m), bar * 1.02, sr, detune=(ti - 1) * 0.001)
            pad *= env_adsr(len(pad), 1.4, 1.0, 0.5, 1.0, sr)
            pan = 0.35 + ti * 0.1
            place(left, pad, start, sr, 0.045 * (1.2 - pan))
            place(right, pad, start, sr, 0.045 * pan * 1.2)
        bass = note(midi(root - 12), bar * 0.85, sr)
        bass *= env_adsr(len(bass), 0.03, 0.6, 0.4, 0.9, sr)
        place(left, bass, start, sr, 0.09)
        place(right, bass, start, sr, 0.09)
        for step, m in enumerate(melody):
            if step < 8 and i % 2 == 0:
                at = start + step * beat / 2
                tone = note(midi(m), 1.1, sr)
                tone *= env_adsr(len(tone), 0.01, 0.6, 0.1, 0.5, sr)
                place(left, tone, at, sr, 0.052)
                place(right, tone, at + 0.01, sr, 0.046)
    for t in np.arange(9.0, dur - 2, beat * 2):
        n = int(0.4 * sr)
        tt = np.arange(n) / sr
        kick = np.sin(2 * np.pi * (52 - 16 * tt) * tt) * np.exp(-tt * 18)
        place(left, kick, t, sr, 0.14)
        place(right, kick, t, sr, 0.14)
        n2 = int(0.25 * sr)
        brush = rng.normal(0, 1, n2) * np.exp(-np.arange(n2) / sr * 20)
        place(left, brush, t + beat, sr, 0.012)
        place(right, brush, t + beat * 1.5, sr, 0.012)
    # Warm vinyl noise.
    noise = rng.normal(0, 1, total)
    noise = np.convolve(noise, np.ones(24) / 24, mode="same") * 0.006
    left += noise
    right += np.roll(noise, 271)
    out = stereo(left, right)
    out = np.stack([
        np.convolve(out[:, 0], [0.7, 0.2, 0.1], mode="same"),
        np.convolve(out[:, 1], [0.7, 0.2, 0.1], mode="same"),
    ], axis=1)
    return soft_clip(normalize(out, 0.82))


# ----------------------------------------------------------------------------- video
def render_video(audio_path: Path) -> None:
    width, height, fps, seconds = 960, 540, 24, 32
    frames = width * height * 3
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
        "-i", str(audio_path),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
        str(VIDEO / "chromatic-fields.mp4"),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    nx, ny = xx / width, yy / height
    for f in range(seconds * fps):
        t = f / fps
        # Slow flowing aurora ribbons.
        a = np.sin((nx * 5.2 + ny * 2.4) * math.pi + t * 0.45) * 0.5 + 0.5
        b = np.cos((nx * 3.1 - ny * 4.8) * math.pi - t * 0.32) * 0.5 + 0.5
        c = np.sin((nx * 9 + ny * 5) * math.pi + t * 0.8) * 0.5 + 0.5
        img = np.zeros((height, width, 3), np.float32)
        img[..., 0] = 0.05 + 0.30 * a + 0.14 * c
        img[..., 1] = 0.07 + 0.22 * b + 0.16 * a
        img[..., 2] = 0.12 + 0.35 * b + 0.20 * c
        # Central orb.
        d = np.sqrt((nx - 0.5) ** 2 + ((ny - 0.5) * 1.0) ** 2)
        orb = np.exp(-(d / (0.22 + 0.02 * math.sin(t * 0.7))) ** 6)
        img += orb[..., None] * np.array([0.20, 0.42, 0.70], np.float32)
        # Vignette.
        vign = np.clip(1.25 - 1.5 * np.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2), 0.25, 1.0)
        img *= vign[..., None]
        img = np.clip(img, 0, 1) ** 0.85
        if f < fps * 4:
            # Gentle fade in.
            img *= min(1.0, f / (fps * 1.2))
        proc.stdin.write((img * 255).astype(np.uint8).tobytes())
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise SystemExit("ffmpeg video encode failed")
    print("video chromatic-fields.mp4")


# ----------------------------------------------------------------------------- timed files
AURORA_SPL = """[ti:Aurora Drift]
[ar:Asteria]
[al:Neon Meridian]
[offset:0]
[00:09.20]City <00:09.55>lights <00:09.95>are <00:10.25>breathing <00:10.85>slow[00:13.20]
[00:09.20]城市<00:09.55>灯火 <00:09.95>缓缓 <00:10.25>呼吸[00:13.20]
[00:13.50]Silver <00:13.95>rivers <00:14.45>start <00:14.85>to <00:15.05>glow[00:17.50]
[00:13.50]银色<00:13.95>河流 <00:14.45>开始 <00:14.85>发亮[00:17.50]
[00:17.80]We <00:18.05>are <00:18.25>drifting, <00:18.90>undefined[00:22.00]
[00:17.80]我们<00:18.05>在<00:18.25>漂流，<00:18.90>没有边界[00:22.00]
[00:22.10]Leaving <00:22.55>gravity <00:23.25>behind[00:26.40]
[00:22.10]把<00:22.55>重力 <00:23.25>留在身后[00:26.40]
[00:26.60]Aurora, <00:27.10>carry <00:27.60>me <00:27.85>higher[00:30.80]
[00:26.60]极光，<00:27.10>带我 <00:27.60>飞得 <00:27.85>更高[00:30.80]
[00:31.00]Paint <00:31.30>the <00:31.50>dark <00:31.80>in <00:32.00>violet <00:32.55>fire[00:35.20]
[00:31.00]把<00:31.30>黑夜 <00:31.50>染成 <00:31.80>紫色 <00:32.00>火焰[00:35.20]
[00:35.40]Every <00:35.70>heartbeat, <00:36.30>every <00:36.65>spark[00:39.60]
[00:35.40]每一次<00:35.70>心跳，<00:36.30>每一颗 <00:36.65>星火[00:39.60]
[00:39.80]Turns <00:40.10>the <00:40.30>quiet <00:40.80>into <00:41.15>art[00:44.00]
[00:39.80]让<00:40.10>寂静 <00:40.30>成为 <00:40.80>艺术[00:44.00]
[00:44.20]Hold <00:44.45>the <00:44.60>moment, <00:45.10>let <00:45.30>it <00:45.45>flow[00:48.40]
[00:44.20]留住<00:44.45>此刻，<00:44.60>让它 <00:45.10>流动[00:48.40]
[00:48.60]Where <00:48.85>the <00:49.00>northern <00:49.45>colours <00:49.95>go[00:52.80]
[00:48.60]去往<00:48.85>北方 <00:49.00>色彩 <00:49.45>消失的<00:49.95>地方[00:52.80]
[00:53.00]We <00:53.20>are <00:53.35>echoes <00:53.85>in <00:54.05>the <00:54.20>sky[00:57.20]
[00:53.00]我们<00:53.20>是 <00:53.35>天空 <00:53.85>中的 <00:54.05>回声[00:57.20]
[00:57.40]Learning <00:57.90>how <00:58.15>to <00:58.30>fly[01:01.60]
[00:57.40]学着<00:57.90>如何 <00:58.15>飞<00:58.30>翔[01:01.60]
[01:01.80]Aurora, <01:02.30>stay <01:02.60>a <01:02.75>little <01:03.15>longer[01:06.00]
[01:01.80]极光，<01:02.30>请 <01:02.60>再 <01:02.75>停留 <01:03.15>久一点[01:06.00]
[01:06.20]While <01:06.50>the <01:06.70>night <01:07.00>is <01:07.15>getting <01:07.65>stronger[01:10.40]
[01:06.20]当<01:06.50>夜色 <01:06.70>变得 <01:07.00>更加 <01:07.65>浓烈[01:10.40]
[01:10.60]Every <01:10.90>shadow, <01:11.45>every <01:11.85>star[01:14.80]
[01:10.60]每一道<01:10.90>影子，<01:11.45>每一颗 <01:11.85>星[01:14.80]
[01:15.00]Knows <01:15.25>exactly <01:15.80>who <01:16.00>we <01:16.15>are[01:19.20]
[01:15.00]都<01:15.25>知道 <01:15.80>我们 <01:16.00>是谁[01:19.20]
[01:21.00]Aurora, <01:21.55>carry <01:22.05>me <01:22.25>higher[01:25.20]
[01:21.00]极光，<01:21.55>带我 <01:22.05>飞得 <01:22.25>更高[01:25.20]
[01:25.40]Paint <01:25.70>the <01:25.90>dark <01:26.20>in <01:26.40>violet <01:26.95>fire[01:30.00]
[01:25.40]把<01:25.70>黑夜 <01:25.90>染成 <01:26.20>紫色 <01:26.40>火焰[01:30.00]
[01:30.20]Hold <01:30.45>the <01:30.60>moment, <01:31.10>let <01:31.30>it <01:31.45>flow[01:34.40]
[01:30.20]留住<01:30.45>此刻，<01:30.60>让它 <01:31.10>流动[01:34.40]
[01:34.60]We <01:34.80>are <01:34.95>echoes <01:35.45>in <01:35.65>the <01:35.80>sky[01:36.00]
[01:34.60]我们<01:34.80>是 <01:34.95>天空 <01:35.45>中的 <01:35.65>回声[01:36.00]
"""

GLASS_LRC = """[ti:Liquid Glass]
[ar:Mira Voss]
[al:Refraction]
[offset:0]
[00:07.00]Falling through the glass, the city bends
[00:07.00]穿过玻璃，城市开始弯曲
[00:11.40]Every colour melts into your hands
[00:11.40]所有色彩融化在你掌心
[00:15.80]I can see the sky inside your eyes
[00:15.80]我在你眼中看见整片天空
[00:20.20]Refracted into a thousand lives
[00:20.20]折射成一千种人生
[00:24.80]Liquid glass, liquid light
[00:24.80]液态玻璃，液态的光
[00:29.20]Hold me in the blur tonight
[00:29.20]今夜请把我拥入朦胧
[00:33.60]Nothing solid, nothing true
[00:33.60]没有实体，没有真实
[00:38.00]Only this reflection of you
[00:38.00]只有你的倒影
[00:42.60]Slide your fingers down the edge of time
[00:42.60]让指尖滑过时间的边缘
[00:47.00]Watch the world dissolve in violet wine
[00:47.00]看世界消融在紫色酒液里
[00:51.40]If the morning shatters, let it fall
[00:51.40]如果清晨碎裂，就让它落下
[00:55.80]We are beautiful, broken, after all
[00:55.80]我们终究美丽而破碎
[01:00.40]Liquid glass, liquid light
[01:00.40]液态玻璃，液态的光
[01:04.80]Hold me in the blur tonight
[01:04.80]今夜请把我拥入朦胧
[01:09.20]Nothing solid, nothing true
[01:09.20]没有实体，没有真实
[01:13.60]Only this reflection of you
[01:13.60]只有你的倒影
[01:18.00][01:22.40]Liquid glass, liquid light
[01:18.00][01:22.40]液态玻璃，液态的光
[01:22.40]Hold me in the blur tonight
"""

PAPER_LRC = """[ti:纸飞机穿过清晨]
[ar:Kite Ensemble]
[al:Paper Skies]
[offset:0]
[00:08.00]纸飞机穿过清晨的窗
[00:08.00]Paper planes through morning windows
[00:12.40]露水落在旧日的操场
[00:12.40]Dew settles on the playground of our youth
[00:16.80]我们把名字写进风里
[00:16.80]We wrote our names into the wind
[00:21.20]等一场不会迟到的雨
[00:21.20]Waiting for a rain that never comes late
[00:25.80]你说远方有白色的海
[00:25.80]You said there is a white sea far away
[00:30.20]潮汐会把心事轻轻拆
[00:30.20]The tide will gently take our worries apart
[00:34.60]于是我把昨天折起来
[00:34.60]So I folded yesterday away
[00:39.00]放进一只小小的口袋
[00:39.00]And put it in a little pocket
[00:43.60]纸飞机飞呀飞，飞过云的光
[00:43.60]Paper plane fly, fly over the light of clouds
[00:48.00]把没说出口的话送向远方
[00:48.00]Send the words I never said far away
[00:52.40]如果有一天你抬头看见
[00:52.40]If one day you look up and see
[00:56.80]那是我在说，别来无恙
[00:56.80]That is me saying, I hope you are well
[01:01.40]纸飞机飞呀飞，飞过旧时光
[01:01.40]Paper plane fly, fly over the old days
[01:05.80]把年少的勇敢还给月亮
[01:05.80]Give the courage of youth back to the moon
[01:10.20]等风停了，我们仍会记得
[01:10.20]When the wind stops, we will still remember
[01:14.60]那个清晨，纸飞机的方向
[01:14.60]That morning, the direction of the paper plane
"""

ZH_SRT = """1
00:00:01,500 --> 00:00:05,200
光沿着看不见的边界流动。

2
00:00:05,800 --> 00:00:10,300
每一种颜色，都在寻找自己的形状。

3
00:00:11,000 --> 00:00:15,600
我们在折射之中，看见彼此。

4
00:00:16,400 --> 00:00:21,000
液态的玻璃，收藏了整个夜空。

5
00:00:22,000 --> 00:00:26,800
当旋律升起，画面也开始呼吸。

6
00:00:27,500 --> 00:00:31,500
Asteria Visual Lab — Chromatic Fields
"""

EN_VTT = """WEBVTT

00:00:01.500 --> 00:00:05.200
Light flows along invisible edges.

00:00:05.800 --> 00:00:10.300
Every colour is searching for its own shape.

00:00:11.000 --> 00:00:15.600
We see each other through the refraction.

00:00:16.400 --> 00:00:21.000
Liquid glass keeps the whole night sky.

00:00:22.000 --> 00:00:26.800
As the melody rises, the picture begins to breathe.

00:00:27.500 --> 00:00:31.500
Asteria Visual Lab — Chromatic Fields
"""

JA_SRT = """1
00:00:01,500 --> 00:00:05,200
光は見えない境界に沿って流れる。

2
00:00:05,800 --> 00:00:10,300
すべての色が、自分の形を探している。

3
00:00:11,000 --> 00:00:15,600
屈折の中で、私たちは互いを見つける。

4
00:00:16,400 --> 00:00:21,000
液体のガラスが、夜空のすべてを抱いている。

5
00:00:22,000 --> 00:00:26,800
旋律が昇ると、映像も呼吸を始める。

6
00:00:27,500 --> 00:00:31,500
Asteria Visual Lab — Chromatic Fields
"""

DANMAKU_XML = """<?xml version="1.0" encoding="UTF-8"?>
<i>
  <chatserver>chat.asteria.local</chatserver>
  <chatid>1001</chatid>
  <mission>0</mission>
  <maxlimit>200</maxlimit>
  <state>0</state>
  <real_name>0</real_name>
  <source>k-v</source>
  <d p="1.2,1,25,16777215,0,0,0,0">液态玻璃太好看了</d>
  <d p="2.1,1,25,16724991,0,0,0,0">前排打卡 ✦</d>
  <d p="3.0,5,25,16777215,0,0,0,0">Asteria 视觉实验室出品</d>
  <d p="4.4,1,25,16776960,0,0,0,0">这个渐变色绝了</d>
  <d p="5.6,1,25,16777215,0,0,0,0">耳机党狂喜</d>
  <d p="6.8,1,25,65490,0,0,0,0">极光在流动欸</d>
  <d p="8.0,1,25,16777215,0,0,0,0">请把亮度调到 100% 再看</d>
  <d p="9.2,5,25,16777215,0,0,0,0">中文字幕同步率 100%</d>
  <d p="10.5,1,25,16724787,0,0,0,0">每一帧都能当壁纸</d>
  <d p="11.8,1,25,16777215,0,0,0,0">这个运镜是程序生成的吗</d>
  <d p="13.0,1,25,3407871,0,0,0,0">是，纯代码生成，没有素材</d>
  <d p="14.3,1,25,16777215,0,0,0,0">Aurora Drift 的姊妹篇？</d>
  <d p="15.6,5,25,16777215,0,0,0,0">字幕可以切换语言，试试设置</d>
  <d p="17.0,1,25,16711935,0,0,0,0">液态玻璃模式开起来！</d>
  <d p="18.2,1,25,16777215,0,0,0,0">底栏会自动隐藏，细节好评</d>
  <d p="19.5,1,25,16777215,0,0,0,0">把鼠标移到下面试试</d>
  <d p="20.8,1,25,16777216,0,0,0,0">音质是 48kHz 的，舒服</d>
  <d p="22.0,5,25,16777215,0,0,0,0">别发太快，挡住画面了</d>
  <d p="23.3,1,25,16776960,0,0,0,0">这段鼓点进来了</d>
  <d p="24.6,1,25,16777215,0,0,0,0">暂停截图成功</d>
  <d p="25.8,1,25,16777215,0,0,0,0">顶部弹幕和滚动弹幕可以分别关闭</d>
  <d p="27.0,1,25,16777215,0,0,0,0">纸飞机那张专辑也很好听</d>
  <d p="28.4,1,25,16777215,0,0,0,0">结尾字幕有彩蛋</d>
  <d p="29.8,1,25,16777215,0,0,0,0">再看一遍</d>
</i>
"""


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")
    print("text", path.name)


def tag_files() -> None:
    try:
        from mutagen.id3 import APIC, ID3, TALB, TIT2, TPE1, USLT
        from mutagen.flac import FLAC, Picture
    except ImportError:
        print("mutagen not installed: skipping embedded tags (sidecar files still work)")
        return

    aurora = AUDIO / "aurora-drift.mp3"
    try:
        tags = ID3(aurora)
    except Exception:
        tags = ID3()
    tags.delall("TIT2")
    tags.delall("TPE1")
    tags.delall("TALB")
    tags.delall("APIC")
    tags.add(TIT2(encoding=3, text="Aurora Drift"))
    tags.add(TPE1(encoding=3, text="Asteria"))
    tags.add(TALB(encoding=3, text="Neon Meridian"))
    tags.add(APIC(encoding=3, mime="image/jpeg", type=3, desc="Cover", data=(COVERS / "aurora-drift.jpg").read_bytes()))
    tags.save(aurora, v2_version=3)

    glass = AUDIO / "liquid-glass.mp3"
    try:
        tags = ID3(glass)
    except Exception:
        tags = ID3()
    for frame in ("TIT2", "TPE1", "TALB", "APIC", "USLT"):
        tags.delall(frame)
    tags.add(TIT2(encoding=3, text="Liquid Glass"))
    tags.add(TPE1(encoding=3, text="Mira Voss"))
    tags.add(TALB(encoding=3, text="Refraction"))
    tags.add(APIC(encoding=3, mime="image/jpeg", type=3, desc="Cover", data=(COVERS / "liquid-glass.jpg").read_bytes()))
    tags.add(USLT(encoding=3, lang="eng", desc="", text=GLASS_LRC))
    tags.save(glass, v2_version=3)

    paper = AUDIO / "paper-planes.flac"
    flac = FLAC(paper)
    flac["title"] = "纸飞机穿过清晨"
    flac["artist"] = "Kite Ensemble"
    flac["album"] = "Paper Skies"
    flac["lyrics"] = PAPER_LRC
    flac.clear_pictures()
    pic = Picture()
    pic.type = 3
    pic.mime = "image/jpeg"
    pic.desc = "Cover"
    pic.data = (COVERS / "paper-planes.jpg").read_bytes()
    flac.add_picture(pic)
    flac.save()
    print("embedded tags for 3 tracks")


def main() -> None:
    make_cover(COVERS / "aurora-drift.jpg", [(60, 220, 210), (96, 80, 220), (24, 40, 120)], 11, "Aurora Drift")
    make_cover(COVERS / "liquid-glass.jpg", [(255, 120, 190), (90, 210, 255), (40, 30, 90)], 22, "Liquid Glass")
    make_cover(COVERS / "paper-planes.jpg", [(255, 210, 140), (240, 140, 110), (80, 120, 190)], 33, "Paper Skies")
    make_cover(COVERS / "chromatic-fields.jpg", [(30, 210, 180), (80, 70, 220), (220, 60, 150)], 44, "Chromatic Fields")

    for name, arr, sr, bits in (
        ("aurora-drift.wav", render_aurora(), SR, 24),
        ("liquid-glass.wav", render_glass(), 44100, 24),
        ("paper-planes.wav", render_paper(), 48000, 24),
    ):
        write_wav(AUDIO / name, arr, sr, bits)
        print("wav", name, f"{arr.shape[0] / sr:.1f}s")

    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(AUDIO / "aurora-drift.wav"),
        "-codec:a", "libmp3lame", "-b:a", "320k", str(AUDIO / "aurora-drift.mp3"),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(AUDIO / "liquid-glass.wav"),
        "-codec:a", "libmp3lame", "-b:a", "256k", str(AUDIO / "liquid-glass.mp3"),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(AUDIO / "paper-planes.wav"),
        "-codec:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24", str(AUDIO / "paper-planes.flac"),
    ], check=True)

    write_text(AUDIO / "aurora-drift.spl", AURORA_SPL)
    write_text(AUDIO / "paper-planes.lrc", PAPER_LRC)
    write_text(AUDIO / "liquid-glass.embedded-note.txt",
               "Lyrics for Liquid Glass are stored in the ID3 USLT frame of the MP3, not in a sidecar.\n")
    write_text(SUBS / "chromatic-fields.zh.srt", ZH_SRT)
    write_text(SUBS / "chromatic-fields.en.vtt", EN_VTT)
    write_text(SUBS / "chromatic-fields.ja.srt", JA_SRT)
    write_text(DANMAKU / "chromatic-fields.xml", DANMAKU_XML)

    tag_files()

    render_video(AUDIO / "aurora-drift.wav")

    # Remove intermediate wav files; keep the encoded tracks.
    for wav in AUDIO.glob("*.wav"):
        wav.unlink()

    manifest = {
        "version": 1,
        "generatedAt": "2026-11-11",
        "tracks": [
            {
                "id": "aurora-drift",
                "type": "audio",
                "title": "Aurora Drift",
                "artist": "Asteria",
                "album": "Neon Meridian",
                "src": "demo/audio/aurora-drift.mp3",
                "cover": "demo/covers/aurora-drift.jpg",
                "lyrics": "demo/audio/aurora-drift.spl",
                "lyricsFormat": "spl",
                "duration": 96,
                "sampleRate": 48000,
                "bitDepth": 24,
                "bitrate": 320000,
                "format": "MP3",
                "accent": "#6ed8cf"
            },
            {
                "id": "liquid-glass",
                "type": "audio",
                "title": "Liquid Glass",
                "artist": "Mira Voss",
                "album": "Refraction",
                "src": "demo/audio/liquid-glass.mp3",
                "cover": "demo/covers/liquid-glass.jpg",
                "duration": 84,
                "sampleRate": 44100,
                "bitDepth": 24,
                "bitrate": 256000,
                "format": "MP3",
                "accent": "#ff9ad5"
            },
            {
                "id": "paper-planes",
                "type": "audio",
                "title": "纸飞机穿过清晨",
                "artist": "Kite Ensemble",
                "album": "Paper Skies",
                "src": "demo/audio/paper-planes.flac",
                "cover": "demo/covers/paper-planes.jpg",
                "lyrics": "demo/audio/paper-planes.lrc",
                "duration": 78,
                "sampleRate": 48000,
                "bitDepth": 24,
                "bitrate": 1200000,
                "format": "FLAC",
                "accent": "#ffc37a"
            },
            {
                "id": "chromatic-fields",
                "type": "video",
                "title": "Chromatic Fields",
                "artist": "Asteria Visual Lab",
                "album": "Motion Studies",
                "src": "demo/video/chromatic-fields.mp4",
                "cover": "demo/covers/chromatic-fields.jpg",
                "duration": 32,
                "width": 960,
                "height": 540,
                "sampleRate": 48000,
                "format": "MP4",
                "accent": "#69b9ff",
                "subtitles": [
                    { "lang": "zh-CN", "label": "简体中文", "src": "demo/subtitles/chromatic-fields.zh.srt" },
                    { "lang": "en", "label": "English", "src": "demo/subtitles/chromatic-fields.en.vtt" },
                    { "lang": "ja", "label": "日本語", "src": "demo/subtitles/chromatic-fields.ja.srt" }
                ],
                "danmaku": "demo/danmaku/chromatic-fields.xml"
            }
        ]
    }
    (DEMO / "library.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("manifest written")


if __name__ == "__main__":
    main()

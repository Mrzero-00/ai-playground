# Generated test media

These tiny files are generated test signals, with no user data or external assets:

- `tone.wav`: 0.1 seconds of 440Hz PCM audio.
- `tone.m4a`: the same signal encoded as AAC in an M4A container.
- `tone.mp3`: the same signal encoded as MP3.
- `blue.mp4`: three blue 32×32 H.264 frames, with no audio track.
- `blue.mov`: the same frames copied into a QuickTime container.

Generated using FFmpeg's `sine` and `color` sources. The tests read these files
directly; FFmpeg is not a test or runtime dependency. Container validation does
not guarantee playback of every codec accepted by an MP4/MOV file extension.

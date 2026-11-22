#!/usr/bin/env bash
# Composites the 300 captured brain frames (vid.js -> frames/f0001.jpg ...) over the hero background,
# plays them forward then backward for a seamless 20 s loop, then re-encodes small enough to email.
# Run from the folder that holds frames/; DECK is the deck folder.
set -euo pipefail
DECK=${DECK:-..}
ffmpeg -y -loglevel error -framerate 30 -i frames/f%04d.jpg -loop 1 -i "$DECK/build/img/bg-hero.jpg" -filter_complex \
 "[0:v]colorlevels=rimin=0.025:gimin=0.03:bimin=0.06,crop=1420:1080:0:0,pad=1920:1080:470:0:black,format=gbrp[b];[1:v]scale=1920:1080,format=gbrp[bg];[bg][b]blend=all_mode=screen:shortest=1,format=yuv420p,split[f][r0];[r0]reverse[r];[f][r]concat=n=2:v=1[out]" \
 -map "[out]" -c:v libx264 -crf 24 -preset slow -tune film -pix_fmt yuv420p -movflags +faststart /tmp/brain-hq.mp4
ffmpeg -y -loglevel error -i /tmp/brain-hq.mp4 -an -c:v libx264 -profile:v high -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart "$DECK/build/img/brain-loop.mp4"
ffmpeg -y -loglevel error -i /tmp/brain-hq.mp4 -vf "select=eq(n\,0)" -frames:v 1 -q:v 2 "$DECK/build/img/brain-poster.jpg"
ffmpeg -y -loglevel error -sseof -10.2 -i /tmp/brain-hq.mp4 -frames:v 1 -q:v 2 "$DECK/build/img/brain-alt.jpg"

# 🔊 Workout Sound Alerts

This directory contains sound files for workout transitions.

## Required Files (5 total)

You need to add these 5 MP3 files to this directory:

- ✅ **start.mp3** - Played when work interval begins
- ✅ **rest.mp3** - Played when rest interval begins
- ✅ **complete.mp3** - Played when workout completes
- ✅ **next.mp3** - Played when new exercise starts
- ✅ **round.mp3** - Played when 8 sets (1 round) completes

## Quick Setup

### Option 1: Free Sound Library (Recommended)

1. Go to [Mixkit.co](https://mixkit.co/free-sound-effects/app/)
2. Search for "beep notification"
3. Download 5 different short beep sounds
4. Rename them as listed above
5. Place them in this directory

**Estimated time: 10-15 minutes**

### Option 2: Text-to-Speech (Easiest for Testing)

1. Go to [TTSMaker](https://ttsmaker.com/)
2. Generate voice alerts:
   - "Start"
   - "Rest"
   - "Workout complete"
   - "Next exercise"
   - "Round complete"
3. Download as MP3 and rename accordingly

### Option 3: Create Your Own Beeps

Use [Online Tone Generator](https://www.szynalski.com/tone-generator/)

- **start.mp3**: 880Hz, 0.5s (high beep)
- **rest.mp3**: 440Hz, 1.0s (low tone)
- **complete.mp3**: 880Hz→1046Hz→1318Hz, 0.3s each (ascending chime)
- **next.mp3**: 660Hz→880Hz, 0.3s each (two beeps)
- **round.mp3**: 523Hz→659Hz→784Hz, 0.4s each (three tones)

## File Specifications

- **Format**: MP3
- **Duration**: 0.5-2.0 seconds
- **File Size**: < 100KB each
- **Sample Rate**: 44.1kHz
- **Bit Rate**: 128 kbps minimum
- **Naming**: Exact names as listed above (lowercase, .mp3 extension)

## Testing

After adding sound files:

1. Start the Expo dev server: `npm start`
2. Start a solo workout in the app
3. Listen for sounds at:
   - ✅ When "GET READY" ends → **start.mp3**
   - ✅ When "WORK" ends → **rest.mp3** or **round.mp3**
   - ✅ When "ROUND BREAK" ends → **next.mp3**
   - ✅ When workout completes → **complete.mp3**

## Troubleshooting

**Sound not playing?**
- Check file names are exactly correct (lowercase)
- Check files are in this directory
- Restart Expo: `npm start -- --clear`

**For detailed instructions**, see:
`DOCUMENTATION/DRAFTS_AND_NOTES/sound_files_guide.txt`

## License

Ensure your sound files are royalty-free or properly licensed for commercial use.

**Safe sources** (no attribution required):
- Mixkit.co
- Self-created sounds
- Public domain/CC0 sounds

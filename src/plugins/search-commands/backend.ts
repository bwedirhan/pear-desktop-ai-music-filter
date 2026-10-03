// Copyright (c) 2026 bwedirhan. MIT License.
import { getSongControls } from '@/providers/song-controls';
import { createBackend } from '@/utils';

export const backend = createBackend({
  // The `/play` command parses the URL in the renderer and hands the id here,
  // where the same song-controls path the tray and media keys use picks it up.
  start(ctx) {
    ctx.ipc.handle('search-commands:play', (videoId: string) =>
      getSongControls(ctx.window).loadVideo(videoId),
    );
  },

  stop(ctx) {
    ctx.ipc.removeHandler('search-commands:play');
  },
});

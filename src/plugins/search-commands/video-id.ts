const VIDEO_ID = /^[\w-]{11}$/;
const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtu\.be)$/;

/** A bare video id, a `youtu.be/<id>` link, or any watch URL carrying `?v=`. */
export const parseVideoId = (input: string): string | undefined => {
  if (VIDEO_ID.test(input)) return input;

  try {
    const url = new URL(input);
    if (!YOUTUBE_HOST.test(url.hostname)) return undefined;

    const id = url.hostname.endsWith('youtu.be')
      ? url.pathname.slice(1)
      : (url.searchParams.get('v') ?? '');

    return VIDEO_ID.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
};

// Optional VdoCipher v2 bridge. Loaded only when a configured provider returns an embed.
// https://www.vdocipher.com/docs/player/v2/api-reference/accessing-player/
export type VideoControl = Pick<
  HTMLVideoElement,
  "currentTime" | "paused" | "ended"
> & {
  pause(): void | Promise<void>;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};
type VdoApi = {
  getInstance(frame: HTMLIFrameElement): { video: VideoControl };
};
declare global {
  interface Window {
    VdoPlayer?: VdoApi;
  }
}
let loading: Promise<VdoApi> | undefined;
export function loadVideoBridge() {
  if (window.VdoPlayer) return Promise.resolve(window.VdoPlayer);
  if (!loading)
    loading = new Promise<VdoApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://player.vdocipher.com/v2/api.js";
      script.async = true;
      script.onload = () =>
        window.VdoPlayer
          ? resolve(window.VdoPlayer)
          : reject(new Error("Video player did not initialize."));
      script.onerror = () =>
        reject(
          new Error(
            "The protected video player could not load. Please try again.",
          ),
        );
      document.head.append(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

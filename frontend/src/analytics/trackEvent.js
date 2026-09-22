let trackModulePromise;

function loadTrackModule() {
  trackModulePromise ||= import("./track");
  return trackModulePromise;
}

export function track(name, context) {
  void loadTrackModule()
    .then((module) => module.track(name, context))
    .catch(() => {
      // Métricas nunca bloqueiam a experiência principal.
    });
}

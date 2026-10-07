// Decides, before the first paint, whether to play the intro: once per browser session,
// never for reduced-motion users or automated browsers (unless ?intro=1).
(function () {
  try {
    var force = /[?&]intro=1\b/.test(location.search);
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (force || (!navigator.webdriver && !reduce && !sessionStorage.getItem("epistudent-intro"))) {
      document.documentElement.classList.add("intro-on");
      sessionStorage.setItem("epistudent-intro", "1");
    }
  } catch (e) {
    /* storage blocked: no intro */
  }
})();

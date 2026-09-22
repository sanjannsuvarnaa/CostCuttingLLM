// Copy-to-clipboard buttons on every code block
document.querySelectorAll(".code-block").forEach(function (block) {
  var btn = document.createElement("button");
  btn.className = "copy-btn";
  btn.type = "button";
  btn.textContent = "Copy";
  btn.addEventListener("click", function () {
    var code = block.querySelector("pre code") || block.querySelector("pre");
    navigator.clipboard.writeText(code.textContent).then(function () {
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(function () {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 1200);
    });
  });
  block.appendChild(btn);
});

// Scroll progress bar
var progressBar = document.querySelector(".progress-bar");
function updateProgress() {
  var scrollable = document.documentElement.scrollHeight - window.innerHeight;
  var pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  progressBar.style.width = pct + "%";
}
window.addEventListener("scroll", updateProgress, { passive: true });
updateProgress();

// Reveal-on-scroll for sections, cards, and table rows
var revealTargets = document.querySelectorAll("main section, .tool-card, .stat");
revealTargets.forEach(function (el) { el.classList.add("reveal"); });

var revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

revealTargets.forEach(function (el) { revealObserver.observe(el); });

// Animated count-up for hero stats
document.querySelectorAll(".stat .num[data-target]").forEach(function (el) {
  var target = parseFloat(el.getAttribute("data-target"));
  var suffix = el.getAttribute("data-suffix") || "";
  var duration = 1000;
  var start = null;

  var counterObserver = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);

      function step(timestamp) {
        if (start === null) start = timestamp;
        var progress = Math.min((timestamp - start) / duration, 1);
        var value = target * progress;
        el.textContent = value.toFixed(1) + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target.toFixed(1) + suffix;
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });

  counterObserver.observe(el);
});

// Highlight the nav link for the section currently in view
var sections = document.querySelectorAll("main section[id]");
var navLinks = document.querySelectorAll('nav.links a[href^="#"]');

var navObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    var link = document.querySelector('nav.links a[href="#' + entry.target.id + '"]');
    if (!link) return;
    if (entry.isIntersecting) {
      navLinks.forEach(function (l) { l.classList.remove("active"); });
      link.classList.add("active");
    }
  });
}, { rootMargin: "-45% 0px -50% 0px" });

sections.forEach(function (s) { navObserver.observe(s); });

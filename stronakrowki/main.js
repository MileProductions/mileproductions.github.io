/* Krowki.pl – koncepcja nowej strony. Ilustracje SVG i drobne interakcje. */
(function () {
  "use strict";

  // ---------- Ilustracja: krówka w papierku ----------
  // Papierek krówki: środek (front) + boczne zakładki zagięte na końcach.
  function candy(o) {
    var bg = o.bg || "#f6ecdc", ink = o.ink || "#3b2417", acc = o.accent || "#b07a3c";
    var t = o.title || "KRÓWKA", s = o.sub || "z Milanówka", id = "c" + Math.random().toString(36).slice(2, 8);
    var pattern = "";
    if (o.pattern === "stripes") pattern = '<rect x="46" y="28" width="108" height="74" fill="url(#' + id + 'p)" opacity=".18"/>';
    if (o.pattern === "dots") pattern = '<rect x="46" y="28" width="108" height="74" fill="url(#' + id + 'd)" opacity=".22"/>';
    var photo = o.photo
      ? '<circle cx="100" cy="56" r="15" fill="' + acc + '" opacity=".35"/><circle cx="94" cy="53" r="5" fill="' + ink + '" opacity=".55"/><circle cx="106" cy="53" r="5" fill="' + ink + '" opacity=".45"/><path d="M86 68 q14 10 28 0" stroke="' + ink + '" stroke-width="2" fill="none" opacity=".5"/>'
      : "";
    var ty = o.photo ? 86 : 64, sy = o.photo ? 96 : 80;
    return (
      '<svg viewBox="0 0 200 130" role="img" aria-label="Krówka w papierku: ' + t + '" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>' +
      '<pattern id="' + id + 'p" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" fill="' + acc + '"/></pattern>' +
      '<pattern id="' + id + 'd" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.6" fill="' + acc + '"/></pattern>' +
      '<filter id="' + id + 's" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#3b2417" flood-opacity=".22"/></filter>' +
      "</defs>" +
      '<g filter="url(#' + id + 's)">' +
      // zakładki boczne
      '<path d="M46 30 L14 40 Q10 65 14 90 L46 100 Z" fill="' + bg + '"/>' +
      '<path d="M154 30 L186 40 Q190 65 186 90 L154 100 Z" fill="' + bg + '"/>' +
      '<path d="M46 30 L14 40 Q10 65 14 90 L46 100 Z" fill="#000" opacity=".07"/>' +
      '<path d="M154 30 L186 40 Q190 65 186 90 L154 100 Z" fill="#000" opacity=".07"/>' +
      '<path d="M22 46 L44 40 M20 65 L44 65 M22 84 L44 90 M178 46 L156 40 M180 65 L156 65 M178 84 L156 90" stroke="#000" stroke-opacity=".08" stroke-width="1.2"/>' +
      // front
      '<rect x="44" y="26" width="112" height="78" rx="6" fill="' + bg + '"/>' +
      pattern +
      '<rect x="44" y="26" width="112" height="78" rx="6" fill="url(#' + id + 'g)"/>' +
      '<rect x="51" y="33" width="98" height="64" rx="3" fill="none" stroke="' + acc + '" stroke-width="1"/>' +
      '<rect x="54" y="36" width="92" height="58" rx="2" fill="none" stroke="' + acc + '" stroke-width=".5" opacity=".7"/>' +
      photo +
      '<text x="100" y="' + ty + '" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="' + (o.photo ? 12 : 17) + '" font-weight="600" fill="' + ink + '" letter-spacing=".5">' + t + "</text>" +
      '<text x="100" y="' + sy + '" text-anchor="middle" font-family="Inter, sans-serif" font-size="6.5" fill="' + acc + '" letter-spacing="1.6">' + s.toUpperCase() + "</text>" +
      "</g></svg>"
    );
  }

  // Znak graficzny: krowa w medalionie (uproszczona, własna)
  function cowMark(color) {
    color = color || "#3b2417";
    return (
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="30" fill="none" stroke="' + color + '" stroke-width="1.5"/>' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="#b07a3c" stroke-width=".8"/>' +
      '<path d="M19 26 q-5 -6 -1 -9 q4 2 6 6 M45 26 q5 -6 1 -9 q-4 2 -6 6" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M22 24 q10 -6 20 0 q3 8 0 16 q-2 8 -10 8 q-8 0 -10 -8 q-3 -8 0 -16 Z" fill="none" stroke="' + color + '" stroke-width="1.6"/>' +
      '<ellipse cx="32" cy="42" rx="7" ry="4.5" fill="none" stroke="' + color + '" stroke-width="1.4"/>' +
      '<circle cx="29.5" cy="42" r=".9" fill="' + color + '"/><circle cx="34.5" cy="42" r=".9" fill="' + color + '"/>' +
      '<circle cx="27" cy="31" r="1.3" fill="' + color + '"/><circle cx="37" cy="31" r="1.3" fill="' + color + '"/>' +
      "</svg>"
    );
  }

  // Okrągła pieczęć „od 1921”
  function seal() {
    return (
      '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><path id="sealc" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/></defs>' +
      '<circle cx="60" cy="60" r="57" fill="#3b2417"/>' +
      '<circle cx="60" cy="60" r="52" fill="none" stroke="#d9b98a" stroke-width=".8"/>' +
      '<text font-family="Inter, sans-serif" font-size="9.2" letter-spacing="3.1" fill="#d9b98a"><textPath href="#sealc">RODZINNA MANUFAKTURA · MILANÓWEK · </textPath></text>' +
      '<text x="60" y="56" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="12" fill="#faf6ef" font-style="italic">od</text>' +
      '<text x="60" y="76" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="24" font-weight="600" fill="#faf6ef">1921</text>' +
      "</svg>"
    );
  }

  // Pudełko degustacyjne
  function box() {
    return (
      '<svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M30 70 L110 40 L190 70 L110 100 Z" fill="#e9d3b3"/>' +
      '<path d="M30 70 L110 100 L110 165 L30 135 Z" fill="#c99a62"/>' +
      '<path d="M190 70 L110 100 L110 165 L190 135 Z" fill="#b07a3c"/>' +
      '<path d="M70 55 L150 85" stroke="#3b2417" stroke-width="10" opacity=".85"/>' +
      '<path d="M150 85 L150 150" stroke="#3b2417" stroke-width="10" opacity=".7"/>' +
      '<text x="70" y="128" font-family="Cormorant Garamond, Georgia, serif" font-size="13" fill="#3b2417" transform="rotate(20 70 128)">GRATIS</text>' +
      "</svg>"
    );
  }

  window.KROWKI = { candy: candy, cowMark: cowMark, seal: seal, box: box };

  // Wstawianie ilustracji z atrybutów data-*
  document.querySelectorAll("[data-candy]").forEach(function (el) {
    var d = el.dataset;
    el.insertAdjacentHTML("beforeend", candy({
      bg: d.bg, ink: d.ink, accent: d.accent, title: d.title, sub: d.sub, pattern: d.pattern, photo: d.photo === "1"
    }));
  });
  document.querySelectorAll("[data-cow]").forEach(function (el) { el.innerHTML = cowMark(el.dataset.cow || undefined); });
  document.querySelectorAll("[data-seal]").forEach(function (el) { el.innerHTML = seal(); });
  document.querySelectorAll("[data-box]").forEach(function (el) { el.innerHTML = box(); });

  // ---------- Menu mobilne ----------
  var burger = document.querySelector(".burger"), menu = document.querySelector(".menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { menu.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); });
    });
  }

  // ---------- Animacje wejścia ----------
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: .12 }) : null;
  document.querySelectorAll(".reveal").forEach(function (el) { io ? io.observe(el) : el.classList.add("in"); });

  // ---------- Liczniki ----------
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var target = +el.dataset.count, suffix = el.dataset.suffix || "", prefix = el.dataset.prefix || "";
    function run() {
      if (reduce) { el.textContent = prefix + target + suffix; return; }
      var t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / 1400, 1), v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = prefix + v + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    if (io) {
      var o2 = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { run(); o2.disconnect(); } });
      o2.observe(el);
    } else run();
  });

  // ---------- Toast ----------
  window.krowkiToast = function (msg) {
    var t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("show"); }, 2600);
  };

  // Formularze demonstracyjne
  document.querySelectorAll("form[data-demo]").forEach(function (f) {
    f.addEventListener("submit", function (e) { e.preventDefault(); window.krowkiToast(f.dataset.demo); f.reset(); });
  });
})();

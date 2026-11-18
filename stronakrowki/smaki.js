/* Sekcja „Smaki”: dane, ilustracje kostek krówki i filtrowanie */
(function () {
  "use strict";
  var root = document.getElementById("flavourGrid");
  if (!root) return;

  // grupa: klasyczne | owocowe | orzechowe | korzenne | sezonowe
  var F = [
    { n: "Malina", d: "Kremowa ciągutka z posypką z liofilizowanej maliny.", c: "#c2364a", t: "dots", tc: "#e75a73", g: "owocowe" },
    { n: "Truskawka", d: "Słodka, letnia, z kawałkami liofilizowanych truskawek.", c: "#df5b6a", t: "dots", tc: "#ff8f9a", g: "owocowe" },
    { n: "Czerwona porzeczka", d: "Lekko kwaskowa nuta, która świetnie równoważy karmel.", c: "#8f1d2c", t: "dots", tc: "#c43a4f", g: "owocowe" },
    { n: "Pistacja", d: "Kremowa, z wyraźnymi kawałkami pistacji.", c: "#9fae63", t: "chunks", tc: "#6f8a3a", g: "orzechowe" },
    { n: "Peanut butter", d: "Dla fanów masła orzechowego: słodko i lekko słono.", c: "#c4955a", t: "chunks", tc: "#8f6332", g: "orzechowe" },
    { n: "Sezam", d: "Delikatnie orzechowa, z prażonym sezamem.", c: "#e3cf9f", t: "seeds", tc: "#fff6df", g: "orzechowe" },
    { n: "Słony karmel", d: "Słodko-słona, z kryształkami soli.", c: "#a8642b", t: "salt", tc: "#ffffff", g: "klasyczne" },
    { n: "Czekoladowa", d: "Mleczna ciągutka z dodatkiem kakao.", c: "#5a3422", t: "", tc: "", g: "klasyczne" },
    { n: "Imbir", d: "Z wyraźną, rozgrzewającą nutą imbiru.", c: "#d8a548", t: "dust", tc: "#9b6a1e", g: "korzenne" },
    { n: "Cynamonowa", d: "Świąteczna klasyka z cynamonem.", c: "#9b5b34", t: "dust", tc: "#5e3216", g: "korzenne", tag: "sezonowa · święta" },
    { n: "Pumpkin Spiced Latte", d: "Dynia, cynamon, goździki, imbir i gałka muszkatołowa.", c: "#d27a2c", t: "dust", tc: "#8a3d12", g: "sezonowe", tag: "limitowana · jesień" }
  ];

  // Kostka krówki w rzucie izometrycznym, w kolorze smaku, z posypką
  function cube(c, t, tc, big) {
    var top = "M60 18 L102 38 L60 58 L18 38 Z", left = "M18 38 L60 58 L60 96 L18 76 Z", right = "M60 58 L102 38 L102 76 L60 96 Z";
    var tops = "";
    var rnd = (function (seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; })(c.length * 97 + c.charCodeAt(1));
    function onTop() { // losowy punkt na górnej ścianie (romb)
      var u = rnd(), v = rnd(); return [60 + (u - v) * 40, 18 + (u + v) * 19.5 + 0.5];
    }
    var i, p;
    if (t === "dots") for (i = 0; i < 16; i++) { p = onTop(); tops += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (1.4 + rnd() * 1.6).toFixed(1) + '" fill="' + tc + '"/>'; }
    if (t === "chunks") for (i = 0; i < 9; i++) { p = onTop(); tops += '<rect x="' + (p[0] - 2.5).toFixed(1) + '" y="' + (p[1] - 1.6).toFixed(1) + '" width="5" height="3.2" rx="1" fill="' + tc + '" transform="rotate(' + Math.round(rnd() * 90) + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"/>'; }
    if (t === "seeds") for (i = 0; i < 22; i++) { p = onTop(); tops += '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="1.9" ry=".9" fill="' + tc + '" transform="rotate(' + Math.round(rnd() * 180) + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"/>'; }
    if (t === "salt") for (i = 0; i < 14; i++) { p = onTop(); tops += '<rect x="' + (p[0] - 1).toFixed(1) + '" y="' + (p[1] - 1).toFixed(1) + '" width="2" height="2" fill="' + tc + '" opacity=".9" transform="rotate(45 ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"/>'; }
    if (t === "dust") for (i = 0; i < 40; i++) { p = onTop(); tops += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r=".7" fill="' + tc + '" opacity=".7"/>'; }
    return '<svg viewBox="0 0 120 110" aria-hidden="true"' + (big ? ' class="cube-big"' : "") + ">" +
      '<ellipse cx="60" cy="100" rx="40" ry="6" fill="#3b2417" opacity=".12"/>' +
      '<path d="' + left + '" fill="' + c + '"/><path d="' + left + '" fill="#000" opacity=".18"/>' +
      '<path d="' + right + '" fill="' + c + '"/><path d="' + right + '" fill="#000" opacity=".32"/>' +
      '<path d="' + top + '" fill="' + c + '"/><path d="' + top + '" fill="#fff" opacity=".18"/>' +
      tops +
      '<path d="M18 38 L60 58 L102 38 M60 58 L60 96" stroke="#fff" stroke-opacity=".25" stroke-width=".8" fill="none"/>' +
      "</svg>";
  }
  window.KROWKI && (window.KROWKI.cube = cube);

  var feat = document.getElementById("flavourFeatured");
  if (feat) feat.insertAdjacentHTML("afterbegin", cube("#d9b17a", "", "", true));

  root.innerHTML = F.map(function (f) {
    return '<article class="fl-card" data-g="' + f.g + '">' + '<div class="fl-cube">' + cube(f.c, f.t, f.tc) + "</div>" +
      '<div class="fl-body"><h3>' + f.n + "</h3><p>" + f.d + "</p>" +
      (f.tag ? '<span class="tag">' + f.tag + "</span>" : "") + "</div></article>";
  }).join("");

  var chips = document.querySelectorAll(".fl-filter button");
  chips.forEach(function (b) {
    b.addEventListener("click", function () {
      chips.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var g = b.dataset.g;
      root.querySelectorAll(".fl-card").forEach(function (card) { card.hidden = !(g === "all" || card.dataset.g === g); });
    });
  });
})();

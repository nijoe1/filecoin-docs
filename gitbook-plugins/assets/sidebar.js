require(["gitbook"], function (gitbook) {
  var STORAGE_KEY = "gitbook-sidebar-state";

  function getState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) {}
  }

  function getDirectChild(parent, selector) {
    for (var i = 0; i < parent.children.length; i++) {
      if (parent.children[i].matches && parent.children[i].matches(selector)) {
        return parent.children[i];
      }
    }
    return null;
  }

  function init() {
    var summary = document.querySelector(".book-summary .summary");
    if (!summary) return;

    var state = getState();
    var items = summary.querySelectorAll("li.chapter");

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var sublist = getDirectChild(item, "ul");
      if (!sublist) continue;
      if (item.classList.contains("sidebar-initialized")) continue;

      var link = getDirectChild(item, "a") || getDirectChild(item, "span");
      if (!link) continue;

      item.classList.add("sidebar-initialized", "has-children");

      var wrapper = document.createElement("div");
      wrapper.className = "fil-nav-item-row";

      var toggle = document.createElement("button");
      toggle.className = "fil-nav-toggle";
      toggle.setAttribute("aria-label", "Toggle submenu");
      toggle.setAttribute("type", "button");
      toggle.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      // Move link into wrapper
      item.insertBefore(wrapper, link);
      wrapper.appendChild(toggle);
      wrapper.appendChild(link);

      // Determine initial state
      var path = link.getAttribute("href") || link.textContent.trim();
      var hasActive = item.classList.contains("active") || item.querySelector(".active");
      var isExpanded = hasActive || state[path] === true;

      if (isExpanded) {
        item.classList.add("expanded");
        toggle.setAttribute("aria-expanded", "true");
      } else {
        toggle.setAttribute("aria-expanded", "false");
      }

      // Click handler with closure
      (function(btn, el, p) {
        btn.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          var expanded = el.classList.toggle("expanded");
          btn.setAttribute("aria-expanded", expanded ? "true" : "false");
          var s = getState();
          s[p] = expanded;
          saveState(s);
        });
      })(toggle, item, path);
    }

    // Expand parents of active item
    var active = summary.querySelector("li.active");
    while (active) {
      if (active.classList.contains("has-children")) {
        active.classList.add("expanded");
        var btn = active.querySelector(".fil-nav-toggle");
        if (btn) btn.setAttribute("aria-expanded", "true");
      }
      active = active.parentElement;
      if (active === summary) break;
    }
  }

  gitbook.events.bind("start", init);
  gitbook.events.bind("page.change", init);
});

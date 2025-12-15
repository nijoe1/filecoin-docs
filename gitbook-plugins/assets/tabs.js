require(["gitbook"], function (gitbook) {
  /**
   * Tabs Component with Accessibility Support
   * - ARIA roles: tablist, tab, tabpanel
   * - Keyboard navigation: Arrow keys, Home, End
   * - Focus management
   */

  function generateId() {
    return "tab-" + Math.random().toString(36).substr(2, 9);
  }

  function initTabs() {
    var containers = document.querySelectorAll(".tabs-container");

    containers.forEach(function (container) {
      // Skip if already initialized
      if (container.hasAttribute("data-tabs-initialized")) return;
      container.setAttribute("data-tabs-initialized", "true");

      var tabsHeader = container.querySelector(".tabs-header");
      var tabsBody = container.querySelector(".tabs-body");
      var headerTabs = container.querySelectorAll(".tabs-header .tab");
      var contentTabs = container.querySelectorAll(".tabs-body .tab-content");

      if (!tabsHeader || !tabsBody || headerTabs.length === 0) return;

      // Generate unique ID prefix for this container
      var containerId = generateId();

      // Set up ARIA roles on container elements
      tabsHeader.setAttribute("role", "tablist");

      // Set up each tab button and panel
      headerTabs.forEach(function (tab, index) {
        var tabIndex = tab.getAttribute("data-tab") || index;
        var tabId = containerId + "-tab-" + tabIndex;
        var panelId = containerId + "-panel-" + tabIndex;
        var isActive = tab.classList.contains("active");

        // Tab button attributes
        tab.setAttribute("role", "tab");
        tab.setAttribute("id", tabId);
        tab.setAttribute("aria-controls", panelId);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.setAttribute("tabindex", isActive ? "0" : "-1");

        // Find corresponding panel
        var panel = container.querySelector(
          '.tabs-body .tab-content[data-tab="' + tabIndex + '"]'
        );
        if (panel) {
          panel.setAttribute("role", "tabpanel");
          panel.setAttribute("id", panelId);
          panel.setAttribute("aria-labelledby", tabId);
          panel.setAttribute("tabindex", "0");
          if (!isActive) {
            panel.setAttribute("hidden", "");
          }
        }
      });

      // Activate a specific tab
      function activateTab(tab) {
        var tabIndex = tab.getAttribute("data-tab");

        // Deactivate all tabs
        headerTabs.forEach(function (t) {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
          t.setAttribute("tabindex", "-1");
        });

        contentTabs.forEach(function (panel) {
          panel.classList.remove("active");
          panel.setAttribute("hidden", "");
        });

        // Activate selected tab
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        tab.setAttribute("tabindex", "0");
        tab.focus();

        var panel = container.querySelector(
          '.tabs-body .tab-content[data-tab="' + tabIndex + '"]'
        );
        if (panel) {
          panel.classList.add("active");
          panel.removeAttribute("hidden");
        }
      }

      // Click handler
      headerTabs.forEach(function (tab) {
        tab.addEventListener("click", function (e) {
          e.preventDefault();
          activateTab(this);
        });
      });

      // Keyboard navigation
      tabsHeader.addEventListener("keydown", function (e) {
        var currentTab = document.activeElement;
        if (!currentTab || !currentTab.classList.contains("tab")) return;

        var tabsArray = Array.prototype.slice.call(headerTabs);
        var currentIndex = tabsArray.indexOf(currentTab);
        var newIndex;

        switch (e.key) {
          case "ArrowLeft":
          case "ArrowUp":
            e.preventDefault();
            newIndex = currentIndex - 1;
            if (newIndex < 0) newIndex = tabsArray.length - 1;
            activateTab(tabsArray[newIndex]);
            break;

          case "ArrowRight":
          case "ArrowDown":
            e.preventDefault();
            newIndex = currentIndex + 1;
            if (newIndex >= tabsArray.length) newIndex = 0;
            activateTab(tabsArray[newIndex]);
            break;

          case "Home":
            e.preventDefault();
            activateTab(tabsArray[0]);
            break;

          case "End":
            e.preventDefault();
            activateTab(tabsArray[tabsArray.length - 1]);
            break;
        }
      });
    });
  }

  gitbook.events.bind("start", function () {
    setTimeout(initTabs, 50);
  });

  gitbook.events.bind("page.change", function () {
    setTimeout(initTabs, 50);
  });
});

require(["gitbook"], function (gitbook) {
  var MOBILE_BREAKPOINT = 768;
  var DESKTOP_BREAKPOINT = 1024;

  function getCSSVariable(name) {
    var value = getComputedStyle(document.documentElement)
      .getPropertyValue("--" + name)
      .trim();
    return parseInt(value, 10) || 0;
  }

  function isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  function isDesktopOrLarger() {
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  }

  function ensureNavbar() {
    // Navbar goes OUTSIDE the book container (before it)
    var existingNavbar = document.querySelector(".fil-navbar");
    if (existingNavbar) return;

    var book = document.querySelector(".book");
    if (!book) return;

    var navbar = document.createElement("header");
    navbar.className = "fil-navbar";
    navbar.innerHTML = '\
      <div class="fil-navbar-inner">\
        <div class="fil-navbar-left">\
          <button class="fil-menu-btn" aria-label="Toggle sidebar" type="button">\
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\
              <line x1="3" y1="6" x2="21" y2="6"></line>\
              <line x1="3" y1="12" x2="21" y2="12"></line>\
              <line x1="3" y1="18" x2="21" y2="18"></line>\
            </svg>\
          </button>\
          <a href="/" class="fil-logo">\
            <img class="fil-logo-icon" width="32" height="32" src="https://docs.filecoin.io/~gitbook/image?url=https%3A%2F%2F3376433986-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FxNWFG7bQkjLkl5BBGjbD%252Ficon%252FMFhg0h7DDwlyjF3FRItf%252FFilecoin.svg.png%3Falt%3Dmedia%26token%3Db79c504b-c727-4a40-8fc0-7598a5263d24&width=32&dpr=1&quality=100&sign=fd823773&sv=2" alt="Filecoin" />\
            <span class="fil-logo-text">Filecoin Docs</span>\
          </a>\
        </div>\
      </div>\
    ';

    // Insert navbar BEFORE the book container
    book.parentNode.insertBefore(navbar, book);
    setupNavbarEvents(navbar);
  }

  function setupNavbarEvents(navbar) {
    var menuBtn = navbar.querySelector(".fil-menu-btn");
    if (menuBtn) {
      menuBtn.addEventListener("click", function () {
        toggleSidebar();
      });
    }
  }

  function ensureOverlay() {
    if (document.querySelector(".fil-sidebar-overlay")) return;

    var overlay = document.createElement("div");
    overlay.className = "fil-sidebar-overlay";
    overlay.addEventListener("click", function () {
      toggleSidebar();
    });

    // Insert overlay in document.body (NOT inside grid container)
    // This prevents it from being a grid item and interfering with layout
    document.body.appendChild(overlay);
  }

  function ensureLayoutClass() {
    var book = document.querySelector(".book");
    if (!book) return;

    if (!book.classList.contains("fil-layout")) {
      book.classList.add("fil-layout");
    }
  }

  function ensureMainScrollContainer() {
    var book = document.querySelector(".book");
    var bookBody = document.querySelector(".book-body");

    if (!book || !bookBody) return;

    var existingScroll = document.querySelector(".fil-main-scroll");
    if (existingScroll) return;

    var mainScroll = document.createElement("div");
    mainScroll.className = "fil-main-scroll";

    book.insertBefore(mainScroll, bookBody);
    mainScroll.appendChild(bookBody);
  }

  function scrollMainToTop() {
    // Scroll the browser window to top
    window.scrollTo(0, 0);
  }

  function createTableOfContents() {
    var book = document.querySelector(".book");
    var markdownSection = document.querySelector(".markdown-section");

    var existingToc = document.querySelector(".fil-toc");
    if (existingToc) existingToc.remove();

    if (!book) return;

    if (!isDesktopOrLarger()) return;

    var headers = markdownSection ? markdownSection.querySelectorAll("h2, h3") : [];

    var toc = document.createElement("aside");
    toc.className = "fil-toc";
    toc.innerHTML = '<div class="fil-toc-header">On this page</div><nav class="fil-toc-nav"></nav>';

    var tocNav = toc.querySelector(".fil-toc-nav");

    // Only populate content if there are enough headers
    if (headers && headers.length >= 2) {
      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        var level = parseInt(header.tagName.charAt(1));

        if (!header.id) {
          header.id = header.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        }

        var item = document.createElement("a");
        item.className = "fil-toc-item fil-toc-level-" + level;
        item.href = "#" + header.id;
        item.textContent = header.textContent;

        tocNav.appendChild(item);

        (function (target) {
          item.addEventListener("click", function (e) {
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            history.pushState(null, null, "#" + target.id);
          });
        })(header);
      }

      setupScrollSpy(headers, tocNav);
    }

    // Append TOC to body since it's fixed position
    document.body.appendChild(toc);
  }

  function setupScrollSpy(headers, tocNav) {
    var tocItems = tocNav.querySelectorAll(".fil-toc-item");
    var headerArray = Array.prototype.slice.call(headers);
    var tocItemArray = Array.prototype.slice.call(tocItems);
    var ticking = false;
    var lastActiveId = null;

    // Clean up any previous scroll handlers
    if (window._filScrollCleanup) {
      window._filScrollCleanup();
    }

    function updateActiveItem() {
      ticking = false;

      var activeId = null;
      var offset = getCSSVariable("layout-toc-scroll-offset") || 150;

      // Find which header is currently in view
      for (var i = headerArray.length - 1; i >= 0; i--) {
        var header = headerArray[i];
        if (!header || !header.getBoundingClientRect) continue;

        var rect = header.getBoundingClientRect();
        // Header is considered active if it's above the offset line
        if (rect.top <= offset) {
          activeId = header.id;
          break;
        }
      }

      // If no header found above offset, use the first one
      if (!activeId && headerArray.length > 0 && headerArray[0].id) {
        activeId = headerArray[0].id;
      }

      // Only update if changed
      if (activeId !== lastActiveId) {
        lastActiveId = activeId;

        // Update TOC items
        for (var j = 0; j < tocItemArray.length; j++) {
          var item = tocItemArray[j];
          var href = item.getAttribute("href");
          if (href === "#" + activeId) {
            item.classList.add("active");
          } else {
            item.classList.remove("active");
          }
        }
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateActiveItem);
      }
    }

    // Listen on window since we use browser scroll
    window.addEventListener("scroll", onScroll, { passive: true });

    window._filScrollCleanup = function() {
      window.removeEventListener("scroll", onScroll);
    };

    // Initial update
    updateActiveItem();
  }

  function toggleSidebar() {
    var book = document.querySelector(".book");
    if (!book) return;

    var isOpen = book.classList.toggle("fil-sidebar-open");

    // Also toggle on body for CSS selector support
    document.body.classList.toggle("fil-sidebar-open", isOpen);

    var menuBtn = document.querySelector(".fil-menu-btn");
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  function closeSidebarOnMobile() {
    if (isMobile()) {
      var book = document.querySelector(".book");
      if (book) {
        book.classList.remove("fil-sidebar-open");
      }
      document.body.classList.remove("fil-sidebar-open");
    }
  }

  function createBottomNavigation() {
    // Find existing navigation elements
    var prevNav = document.querySelector('.navigation-prev');
    var nextNav = document.querySelector('.navigation-next');
    var pageInner = document.querySelector('.page-inner');

    if (!pageInner) return;

    // Remove any existing bottom navigation
    var existing = pageInner.querySelector('.navigation-bottom');
    if (existing) existing.remove();

    // Get navigation info
    var prevHref = prevNav ? prevNav.getAttribute('href') : null;
    var nextHref = nextNav ? nextNav.getAttribute('href') : null;

    // Get page titles from sidebar
    var prevTitle = '';
    var nextTitle = '';

    if (prevHref) {
      var prevLink = document.querySelector('.book-summary a[href="' + prevHref + '"]');
      if (prevLink) {
        prevTitle = prevLink.textContent.trim();
      }
    }

    if (nextHref) {
      var nextLink = document.querySelector('.book-summary a[href="' + nextHref + '"]');
      if (nextLink) {
        nextTitle = nextLink.textContent.trim();
      }
    }

    // Only create if we have at least one nav link
    if (!prevHref && !nextHref) return;

    // Create bottom navigation container
    var navBottom = document.createElement('div');
    navBottom.className = 'navigation-bottom';

    if (prevHref && prevTitle) {
      var prevLinkEl = document.createElement('a');
      prevLinkEl.className = 'fil-nav-bottom-link prev';
      prevLinkEl.href = prevHref;
      prevLinkEl.innerHTML =
        '<span class="fil-nav-bottom-label">' +
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>' +
          'Previous' +
        '</span>' +
        '<span class="fil-nav-bottom-title">' + prevTitle + '</span>';
      navBottom.appendChild(prevLinkEl);
    }

    if (nextHref && nextTitle) {
      var nextLinkEl = document.createElement('a');
      nextLinkEl.className = 'fil-nav-bottom-link next';
      nextLinkEl.href = nextHref;
      nextLinkEl.innerHTML =
        '<span class="fil-nav-bottom-label">' +
          'Next' +
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>' +
        '</span>' +
        '<span class="fil-nav-bottom-title">' + nextTitle + '</span>';
      navBottom.appendChild(nextLinkEl);
    }

    // Append to page content
    pageInner.appendChild(navBottom);
  }

  function setupCodeCopyButtons() {
    var markdownSection = document.querySelector(".markdown-section");
    if (!markdownSection) return;

    var codeBlocks = markdownSection.querySelectorAll("pre");

    codeBlocks.forEach(function(pre) {
      if (pre.parentElement && pre.parentElement.classList.contains("fil-code-block-wrapper")) {
        return;
      }

      var wrapper = document.createElement("div");
      wrapper.className = "fil-code-block-wrapper";

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var copyBtn = document.createElement("button");
      copyBtn.className = "fil-code-copy-btn";
      copyBtn.type = "button";
      copyBtn.setAttribute("aria-label", "Copy code");

      var copyIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      copyIcon.setAttribute("viewBox", "0 0 24 24");
      copyIcon.setAttribute("fill", "none");
      copyIcon.setAttribute("stroke", "currentColor");
      copyIcon.setAttribute("stroke-width", "2");
      copyIcon.setAttribute("stroke-linecap", "round");
      copyIcon.setAttribute("stroke-linejoin", "round");
      copyIcon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';

      var checkIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      checkIcon.setAttribute("viewBox", "0 0 24 24");
      checkIcon.setAttribute("fill", "none");
      checkIcon.setAttribute("stroke", "currentColor");
      checkIcon.setAttribute("stroke-width", "2");
      checkIcon.setAttribute("stroke-linecap", "round");
      checkIcon.setAttribute("stroke-linejoin", "round");
      checkIcon.style.display = "none";
      checkIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';

      copyBtn.appendChild(copyIcon);
      copyBtn.appendChild(checkIcon);
      wrapper.appendChild(copyBtn);

      copyBtn.addEventListener("click", function() {
        var code = pre.querySelector("code");
        var text = code ? code.textContent : pre.textContent;

        navigator.clipboard.writeText(text).then(function() {
          copyBtn.classList.add("copied");
          copyIcon.style.display = "none";
          checkIcon.style.display = "block";

          var copyDuration = getCSSVariable("layout-copy-feedback-duration") || 2000;
          setTimeout(function() {
            copyBtn.classList.remove("copied");
            copyIcon.style.display = "block";
            checkIcon.style.display = "none";
          }, copyDuration);
        }).catch(function(err) {
          console.error("Failed to copy:", err);
        });
      });
    });
  }

  function transformCardTables() {
    var markdownSection = document.querySelector(".markdown-section");
    if (!markdownSection) return;

    var cardTables = markdownSection.querySelectorAll('table[data-view="cards"]');

    cardTables.forEach(function(table) {
      // Skip if already transformed
      if (table.dataset.transformed) return;
      table.dataset.transformed = "true";

      // Get header row to understand column structure
      var headerCells = table.querySelectorAll("thead th");
      var columnInfo = [];
      headerCells.forEach(function(th, index) {
        columnInfo.push({
          index: index,
          isHidden: th.hasAttribute("data-hidden"),
          isCardCover: th.hasAttribute("data-card-cover"),
          isCardTarget: th.hasAttribute("data-card-target")
        });
      });

      // Find column indices
      var coverIndex = -1;
      var targetIndex = -1;
      var titleIndex = -1;
      var descIndex = -1;

      columnInfo.forEach(function(col, i) {
        if (col.isCardCover) coverIndex = i;
        if (col.isCardTarget) targetIndex = i;
        if (!col.isHidden && !col.isCardCover && !col.isCardTarget) {
          if (titleIndex === -1) {
            titleIndex = i;
          } else if (descIndex === -1) {
            descIndex = i;
          }
        }
      });

      // Create card grid container
      var cardGrid = document.createElement("div");
      cardGrid.className = "fil-card-grid";

      // Process each row
      var rows = table.querySelectorAll("tbody tr");
      rows.forEach(function(row) {
        var cells = row.querySelectorAll("td");

        // Create card element
        var card = document.createElement("div");
        card.className = "fil-card";

        // Get target link
        var targetLink = null;
        if (targetIndex >= 0 && cells[targetIndex]) {
          var linkEl = cells[targetIndex].querySelector("a");
          if (linkEl) {
            targetLink = linkEl.getAttribute("href");
          }
        }

        // Create cover image
        if (coverIndex >= 0 && cells[coverIndex]) {
          var coverCell = cells[coverIndex];
          var coverDiv = document.createElement("div");
          coverDiv.className = "fil-card-cover";

          var img = coverCell.querySelector("img");
          var imgLink = coverCell.querySelector("a");

          if (img) {
            var newImg = document.createElement("img");
            newImg.src = img.src;
            newImg.alt = img.alt || "";
            coverDiv.appendChild(newImg);
          } else if (imgLink) {
            // Image might be referenced by link text (GitBook asset reference)
            var imgSrc = imgLink.getAttribute("href");
            if (imgSrc && (imgSrc.endsWith(".svg") || imgSrc.endsWith(".png") || imgSrc.endsWith(".jpg") || imgSrc.endsWith(".webp"))) {
              var newImg = document.createElement("img");
              newImg.src = imgSrc;
              newImg.alt = "";
              coverDiv.appendChild(newImg);
            }
          }

          card.appendChild(coverDiv);
        }

        // Create card content
        var contentDiv = document.createElement("div");
        contentDiv.className = "fil-card-content";

        // Add title
        if (titleIndex >= 0 && cells[titleIndex]) {
          var titleDiv = document.createElement("div");
          titleDiv.className = "fil-card-title";
          titleDiv.textContent = cells[titleIndex].textContent.trim();
          contentDiv.appendChild(titleDiv);
        }

        // Add description
        if (descIndex >= 0 && cells[descIndex]) {
          var descText = cells[descIndex].textContent.trim();
          if (descText) {
            var descDiv = document.createElement("div");
            descDiv.className = "fil-card-desc";
            descDiv.textContent = descText;
            contentDiv.appendChild(descDiv);
          }
        }

        card.appendChild(contentDiv);

        // Make card clickable
        if (targetLink) {
          var linkOverlay = document.createElement("a");
          linkOverlay.className = "fil-card-link";
          linkOverlay.href = targetLink;
          if (targetLink.startsWith("http")) {
            linkOverlay.target = "_blank";
            linkOverlay.rel = "noopener noreferrer";
          }
          card.appendChild(linkOverlay);
        }

        cardGrid.appendChild(card);
      });

      // Replace table with card grid
      table.parentNode.replaceChild(cardGrid, table);
    });
  }

  function getPageDescription() {
    // Look for description data element INSIDE the current markdown section
    // This ensures we get the description for the current page, not a stale one
    var markdownSection = document.querySelector(".markdown-section");
    if (markdownSection) {
      // Check for hidden description element injected by server-side hook
      var descEl = markdownSection.querySelector(".page-description-data");
      if (descEl) {
        return descEl.textContent.trim();
      }

      // Check for data attribute
      if (markdownSection.dataset.description) {
        return markdownSection.dataset.description;
      }
    }

    // No description found for this page
    return "";
  }

  function createPageHeader() {
    var pageInner = document.querySelector(".page-inner");
    if (!pageInner) return;

    // Remove existing header
    var existing = document.querySelector(".fil-page-header");
    if (existing) existing.remove();

    var activeLink = document.querySelector(".book-summary li.active > a, .book-summary li.active > .fil-nav-item-row > a");
    if (!activeLink) return;

    var summaryTitle = activeLink.textContent.trim();
    if (!summaryTitle) return;

    // Remove the first H1 from markdown content (we use SUMMARY.md title instead)
    var markdownSection = document.querySelector(".markdown-section");
    if (markdownSection) {
      var firstH1 = markdownSection.querySelector("h1");
      if (firstH1) {
        firstH1.remove();
      }
    }

    // Get page description
    var description = getPageDescription();

    // Create header element
    var header = document.createElement("header");
    header.className = "fil-page-header";

    var titleEl = document.createElement("h1");
    titleEl.className = "fil-page-title";
    titleEl.textContent = summaryTitle;
    header.appendChild(titleEl);

    if (description) {
      var descEl = document.createElement("p");
      descEl.className = "fil-page-description";
      descEl.textContent = description;
      header.appendChild(descEl);
    }

    // Insert after breadcrumb or at start of section
    var section = pageInner.querySelector("section");
    if (section) {
      var breadcrumb = section.querySelector(".fil-breadcrumb");
      if (breadcrumb && breadcrumb.nextSibling) {
        section.insertBefore(header, breadcrumb.nextSibling);
      } else if (breadcrumb) {
        section.appendChild(header);
      } else {
        section.insertBefore(header, section.firstChild);
      }
    }
  }

  function createBreadcrumb() {
    var pageInner = document.querySelector(".page-inner");
    if (!pageInner) return;

    var existing = document.querySelector(".fil-breadcrumb");
    if (existing) existing.remove();

    var activeLink = document.querySelector(".book-summary li.active > a, .book-summary li.active > .fil-nav-item-row > a");
    if (!activeLink) return;

    var breadcrumb = document.createElement("nav");
    breadcrumb.className = "fil-breadcrumb";
    breadcrumb.setAttribute("aria-label", "Breadcrumb");

    var items = [];

    // Find the section header that contains this item
    // GitBook uses li.header for section headers (## in SUMMARY.md)
    var activeItem = activeLink.closest("li.chapter");
    var sectionText = null;
    if (activeItem) {
      var summary = document.querySelector("ul.summary");
      if (summary) {
        // Look for li.header elements (section headers like "Basics", "Builders", etc.)
        var allHeaders = summary.querySelectorAll("li.header");
        for (var p = allHeaders.length - 1; p >= 0; p--) {
          var header = allHeaders[p];
          // Check if activeItem comes after this header in DOM order
          if (header.compareDocumentPosition(activeItem) & Node.DOCUMENT_POSITION_FOLLOWING) {
            sectionText = header.textContent.trim();
            break;
          }
        }
      }
    }

    // Add section header as first breadcrumb item (e.g., "Basics")
    if (sectionText) {
      items.push('<span class="fil-breadcrumb-item">' + sectionText + '</span>');
    }

    // Collect parent chapters AND the current page
    var currentItem = activeLink.closest("li.chapter");
    var allItems = [];

    // Walk up to collect all ancestors
    var item = currentItem;
    while (item) {
      var link = item.querySelector(":scope > a, :scope > .fil-nav-item-row > a");
      if (link) {
        allItems.unshift({
          href: link.getAttribute("href") || "#",
          text: link.textContent.trim(),
          isCurrent: link === activeLink
        });
      }
      item = item.parentElement.closest("li.chapter");
    }

    // Add all items to breadcrumb
    for (var i = 0; i < allItems.length; i++) {
      var navItem = allItems[i];
      if (navItem.isCurrent) {
        // Current page - not a link
        items.push('<span class="fil-breadcrumb-item fil-breadcrumb-current">' + navItem.text + '</span>');
      } else {
        // Parent - make it a link
        items.push('<a href="' + navItem.href + '" class="fil-breadcrumb-item">' + navItem.text + '</a>');
      }
    }

    breadcrumb.innerHTML = items.join('<span class="fil-breadcrumb-sep">/</span>');

    var section = pageInner.querySelector("section");
    if (section) {
      section.insertBefore(breadcrumb, section.firstChild);
    }
  }

  function setupResizeHandler() {
    if (window._filResizeHandler) return;

    var resizeTimeout;
    var resizeDebounce = getCSSVariable("layout-resize-debounce") || 100;
    window._filResizeHandler = function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        if (isMobile()) {
          var book = document.querySelector(".book");
          if (book) book.classList.remove("fil-sidebar-open");
          document.body.classList.remove("fil-sidebar-open");
        }
        createTableOfContents();
      }, resizeDebounce);
    };
    window.addEventListener("resize", window._filResizeHandler);
  }

  function init() {
    ensureLayoutClass();
    ensureMainScrollContainer();
    ensureNavbar();
    ensureOverlay();
    setupResizeHandler();
    createBreadcrumb();
    createPageHeader();
    setupCodeCopyButtons();
    transformCardTables();

    // Create bottom navigation before TOC (affects page height)
    createBottomNavigation();

    // Create TOC after content height is finalized
    createTableOfContents();

    closeSidebarOnMobile();
  }

  /* ============================================
     Page Transitions - Content area only
     Sidebar and navbar are NEVER affected
     ============================================ */
  var TRANSITION_DURATION = 120; // ms - matches CSS transition

  function fadeOutContent() {
    // Add class to .book (NOT .page-wrapper) because GitBook AJAX replaces .page-wrapper
    // CSS uses .book.fil-page-transitioning to hide content AND .book-body scrollbar
    var book = document.querySelector(".book");
    if (book) {
      book.classList.add("fil-page-transitioning");
    }
  }

  function fadeInContent() {
    var book = document.querySelector(".book");
    if (!book) return;

    // Show content - removing class from .book restores visibility and scrollbar
    requestAnimationFrame(function() {
      book.classList.remove("fil-page-transitioning");
    });
  }

  function setupLinkTransitions() {
    // Only set up once
    if (document.body.dataset.transitionsSetup) return;
    document.body.dataset.transitionsSetup = "true";

    document.body.addEventListener("click", function(e) {
      // Skip if this is our re-dispatched event
      if (e._skipTransition) return;

      var link = e.target.closest("a");
      if (!link) return;

      var href = link.getAttribute("href");

      // Skip external links, anchors, javascript
      if (!href) return;
      if (href.startsWith("http") || href.startsWith("//")) return;
      if (href.startsWith("#")) return;
      if (href.startsWith("javascript:")) return;

      // Skip if modifier keys (open in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      // Skip if clicking on the current/active page
      var isActive = link.closest("li.active") || link.classList.contains("active");
      if (isActive) return;

      // Only apply to internal navigation links
      var isInternal = link.closest(".book-summary") ||
                       link.closest(".navigation-bottom") ||
                       link.closest(".fil-breadcrumb");

      if (isInternal) {
        e.preventDefault();
        e.stopPropagation();

        // Start fade out
        fadeOutContent();

        // Wait for fade out, then trigger GitBook's native click
        setTimeout(function() {
          var event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          event._skipTransition = true;
          link.dispatchEvent(event);
        }, TRANSITION_DURATION);
      }
    }, true); // Use capture phase
  }

  gitbook.events.bind("start", function () {
    var initDelay = getCSSVariable("layout-init-delay") || 50;
    setTimeout(function() {
      init();
      setupLinkTransitions();
    }, initDelay);
  });

  gitbook.events.bind("page.change", function () {
    var initDelay = getCSSVariable("layout-init-delay") || 50;
    setTimeout(function () {
      ensureLayoutClass();
      ensureMainScrollContainer();
      ensureNavbar();
      ensureOverlay();
      createBreadcrumb();
      createPageHeader();
      setupCodeCopyButtons();
      transformCardTables();

      // Create bottom navigation BEFORE fadeInContent (affects page height)
      createBottomNavigation();

      // Create TOC after content height is finalized
      createTableOfContents();

      closeSidebarOnMobile();
      fadeInContent();
      scrollMainToTop();
    }, initDelay);
  });
});

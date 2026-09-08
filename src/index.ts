import { Plugin, showMessage, getFrontend } from "siyuan";
import "@/index.scss";
import { SettingUtils } from "./libs/setting-utils";



const STORAGE_NAME = "menu-config";
let hideTimer = null;
let isScrollBarActive = false;

export default class SiyuanDatabaseLandscape_scrollbar extends Plugin {
  private isMobile: boolean;
  private settingUtils: SettingUtils;
  private scrollbarContainer: HTMLElement | null = null;
  private scrollbarThumb: HTMLElement | null = null;
  private activeTable: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;

  private scrollContainers: NodeListOf<Element> = document.querySelectorAll('.none-exist');
  private scrollRafPending = false;
  
  async onload() {
    this.data[STORAGE_NAME] = { readonlyText: "Readonly" };
    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
    this.settingUtils = new SettingUtils({
      plugin: this,
      name: STORAGE_NAME,
    });
    this.settingUtils.addItem({
      key: "begging",
      value: "",
      type: "hint",
      title: this.i18n.beggingTitle,
      description: this.i18n.beggingDesc,
    });
    this.settingUtils.addItem({
      key: "Hint",
      value: "",
      type: "hint",
      title: "About",
      description: "AGPL-3.0 @zxkmm.  <br><a href='https://github.com/zxkmm/siyuan_database_landscape_scrollbar' target='_blank'>https://github.com/zxkmm/siyuan_database_landscape_scrollbar</a>",
    });
    try {
      this.settingUtils.load();
    } catch (error) {
      console.error(
        "Error loading settings storage, probably empty config json:",
        error
      );
    }

    // Create scrollbar elements
    this.createScrollbar();
    
    // Initialize table event listeners
    this.initTableListeners();
    
    // Initialize resize observer
    this.initResizeObserver();
    
    // Initialize mutation observer to detect new tables
    this.initMutationObserver();
  }

  onLayoutReady() {
    this.settingUtils.load();
    // Refresh table listeners when layout is ready
    this.initTableListeners();
    window.addEventListener("resize", this.correction_position.bind(this));
  }

  async onunload() {
    // Remove scrollbar
    this.removeScrollbar();
    
    // Disconnect observers
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    
    // Clear any pending timers
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  uninstall() {
    // Nothing specific needed for uninstall
  }
  
  private createScrollbar() {
    this.scrollbarContainer = document.createElement('div');
    this.scrollbarContainer.className = 'custom-horizontal-scrollbar';
    this.scrollbarContainer.style.position = 'fixed';
    this.scrollbarContainer.style.height = '8px';   // TUNE: hit-area height (keep >= THUMB_HOVER_HEIGHT)
    this.scrollbarContainer.style.overflow = 'hidden';
    this.scrollbarContainer.style.display = 'none';
    this.scrollbarContainer.style.opacity = '0';
    this.scrollbarContainer.style.transition = 'opacity 0.3s ease-in-out';
    this.scrollbarContainer.style.zIndex = '9999';

    this.scrollbarThumb = document.createElement('div');
    this.scrollbarThumb.className = 'custom-horizontal-scrollbar-thumb';
    this.scrollbarThumb.style.position = 'absolute';
    this.scrollbarThumb.style.top = '50%';
    this.scrollbarThumb.style.transform = 'translateY(-50%)';  // keeps thumb centered in hit-area on expand
    this.scrollbarThumb.style.left = '0';
    this.scrollbarThumb.style.height = '3px';        // TUNE: thumb height when idle (thin appearance)
    this.scrollbarThumb.style.backgroundColor = 'var(--b3-theme-on-surface-light)';
    this.scrollbarThumb.style.transition = 'height 0.15s ease, width 0.2s ease-out, opacity 0.3s ease-in-out';
    this.scrollbarThumb.style.borderRadius = '6px';
    this.scrollbarThumb.style.cursor = 'pointer';

    this.scrollbarContainer.appendChild(this.scrollbarThumb);
    this.initScrollbarEvents();
  }
  
  private removeScrollbar() {
    if (this.scrollbarContainer && this.scrollbarContainer.parentNode) {
      this.scrollbarContainer.parentNode.removeChild(this.scrollbarContainer);
      this.scrollbarContainer = null;
      this.scrollbarThumb = null;
    }
  }

  private getScrollContainer(block: HTMLElement): HTMLElement | null {
    if (block.getAttribute('data-av-type') === 'table') {
      return block.querySelector('.av__scroll') as HTMLElement | null;
    }
    if (block.getAttribute('data-type') === 'NodeCodeBlock') {
      return block.querySelector('.hljs') as HTMLElement | null;
    }
    return null;
  }

  private correction_position() {
    requestAnimationFrame(() => {
      if (this.scrollbarContainer) {
        const editorContainer = document.querySelector(".fn__flex-column.fn__flex.fn__flex-1.layout__wnd--active") as HTMLElement | null;
        if (editorContainer) {
          const rect = editorContainer.getBoundingClientRect();
          const marginX = rect.width * 0.01;  // TUNE: horizontal inset (fraction of editor width)
          this.scrollbarContainer.style.left = `${rect.left + marginX}px`;
          this.scrollbarContainer.style.width = `${rect.width - marginX * 2}px`;
          // translateY(-100%) anchors bottom of hit-area to (editor bottom - BOTTOM_GAP)
          const BOTTOM_GAP = 2;  // TUNE: px gap between scrollbar and editor bottom edge
          this.scrollbarContainer.style.top = `${rect.bottom - BOTTOM_GAP}px`;
          this.scrollbarContainer.style.transform = 'translateY(-100%)';
        }
      }

      if (this.activeTable) {
        const scrollContainer = this.getScrollContainer(this.activeTable);
        if (scrollContainer) {
          this.updateScrollbarThumb(scrollContainer);
        }
      }
    });
  }
  
  private showScrollbar(tableElement: HTMLElement) {
    if (!this.scrollbarContainer || !this.scrollbarThumb) return;

    this.activeTable = tableElement;
    const scrollContainer = this.getScrollContainer(tableElement);
    if (!scrollContainer) return;

    if (!document.body.contains(this.scrollbarContainer)) {
      document.body.appendChild(this.scrollbarContainer);
    }

    this.correction_position();
    
    this.updateScrollbarThumb(scrollContainer);
    
    // Make visible first with display block
    this.scrollbarContainer.style.display = 'block';
    
    // Use requestAnimationFrame to ensure the display change is applied before changing opacity
    requestAnimationFrame(() => {
      if (this.scrollbarContainer) {
        this.scrollbarContainer.style.opacity = '1';
      }
    });
    
    isScrollBarActive = true;

    // clear
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }
  
  private hideScrollbar() {
    if (hideTimer) {
      clearTimeout(hideTimer);
    }
    
    hideTimer = setTimeout(() => {
      if (this.scrollbarContainer) {
        // First fade out with opacity
        this.scrollbarContainer.style.opacity = '0';
        
        // After transition completes, then hide element
        setTimeout(() => {
          if (this.scrollbarContainer) {
            this.scrollbarContainer.style.display = 'none';
            isScrollBarActive = false;
            this.activeTable = null;
          }
        }, 300); // This should match the transition duration
      }
      hideTimer = null;
    }, 1000);
  }
  
  private updateScrollbarThumb(scrollContainer: HTMLElement) {
    // console.log("updateScrollbarThumb");
    if (!this.scrollbarThumb || !scrollContainer || !this.scrollbarContainer) return;
    
    const scrollWidth = scrollContainer.scrollWidth;
    const clientWidth = scrollContainer.clientWidth;
    
    // Only show scrollbar if content is wider than container
    if (scrollWidth <= clientWidth) {
      this.scrollbarContainer.style.opacity = '0';
      // Don't immediately hide with display:none to allow the fade-out animation
      setTimeout(() => {
        if (this.scrollbarContainer && scrollWidth <= clientWidth) {
          this.scrollbarContainer.style.display = 'none';
        }
      }, 300);
      return;
    }
    
    // Get the actual width of the scrollbar container instead of using window width
    const containerWidth = this.scrollbarContainer.clientWidth;
    
    // Calculate thumb width based on content vs viewport ratio using container width
    const thumbWidth = Math.max(50, (clientWidth / scrollWidth) * containerWidth);
    this.scrollbarThumb.style.width = `${thumbWidth}px`;
    
    // Calculate thumb position based on scroll position
    const scrollLeft = scrollContainer.scrollLeft;
    const maxScroll = scrollWidth - clientWidth;
    const scrollRatio = scrollLeft / maxScroll;
    const maxScrollbarScroll = containerWidth - thumbWidth;
    const thumbPosition = scrollRatio * maxScrollbarScroll;
    
    this.scrollbarThumb.style.left = `${thumbPosition}px`;
  }
  
  private initScrollbarEvents() {
    if (!this.scrollbarThumb || !this.scrollbarContainer) return;
    
    let isDragging = false;
    let startX = 0;
    let startLeft = 0;
    let dragRafPending = false;

    this.scrollbarThumb.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startLeft = parseInt(this.scrollbarThumb!.style.left || '0', 10);

      // Prevent text selection during drag
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging || !this.activeTable || !this.scrollbarContainer) return;
      if (dragRafPending) return;
      dragRafPending = true;

      const clientX = e.clientX;
      requestAnimationFrame(() => {
        dragRafPending = false;
        if (!isDragging || !this.activeTable || !this.scrollbarContainer) return;

        const scrollContainer = this.getScrollContainer(this.activeTable);
        if (!scrollContainer) return;

        const deltaX = clientX - startX;
        const containerWidth = this.scrollbarContainer.clientWidth;
        const newLeft = Math.max(0, Math.min(startLeft + deltaX, containerWidth - parseInt(this.scrollbarThumb!.style.width || '50', 10)));

        this.scrollbarThumb!.style.left = `${newLeft}px`;

        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        const thumbMaxTravel = containerWidth - parseInt(this.scrollbarThumb!.style.width || '50', 10);
        const scrollRatio = newLeft / thumbMaxTravel;
        scrollContainer.scrollLeft = scrollRatio * maxScroll;
      });
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        // if mouse ended outside the container, revert to thin mode
        if (this.scrollbarContainer && !this.scrollbarContainer.matches(':hover')) {
          this.scrollbarThumb!.style.height = '3px';  // back to idle (keep in sync with createScrollbar)
          if (this.activeTable && !this.activeTable.matches(':hover')) {
            this.hideScrollbar();
          }
        }
      }
    });

    this.scrollbarContainer.addEventListener('mouseenter', () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      this.scrollbarThumb!.style.height = '8px';  // TUNE: thumb height when hovered (thick appearance)
    });

    this.scrollbarContainer.addEventListener('mouseleave', () => {
      if (isDragging) return;  // stay thick while dragging; mouseup handler will revert
      this.scrollbarThumb!.style.height = '3px';  // back to idle (keep in sync with createScrollbar)
      if (this.activeTable && !this.activeTable.matches(':hover')) {
        this.hideScrollbar();
      }
    });
  }
  
  private initTableListeners() {
    const tables = document.querySelectorAll('div[data-av-type="table"], div[data-type="NodeCodeBlock"]');

    tables.forEach(table => {
      this.attachTableListeners(table as HTMLElement);
    });
  }

  private attachTableListeners(table: HTMLElement) {
    table.removeEventListener('mouseenter', this.handleTableMouseEnter);
    table.removeEventListener('mouseleave', this.handleTableMouseLeave);

    table.addEventListener('mouseenter', this.handleTableMouseEnter);
    table.addEventListener('mouseleave', this.handleTableMouseLeave);

    const scrollContainer = this.getScrollContainer(table);
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', this.handleTableScroll);
      scrollContainer.addEventListener('scroll', this.handleTableScroll);
    }
  }
  
  private handleTableMouseEnter = (e: MouseEvent) => {
    const table = e.currentTarget as HTMLElement;
    this.showScrollbar(table);
  }
  
  private handleTableMouseLeave = () => {
    this.hideScrollbar();
  }
  
  private handleTableScroll = (e: Event) => {
    if (this.scrollRafPending) return;
    this.scrollRafPending = true;
    requestAnimationFrame(() => {
      this.scrollRafPending = false;
      this.updateScrollbarThumb(e.target as HTMLElement);
    });
  }
  
  private initResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      // Update scrollbar on resize if it's active
      if (isScrollBarActive && this.activeTable) {
        const scrollContainer = this.getScrollContainer(this.activeTable);
        if (scrollContainer) {
          this.updateScrollbarThumb(scrollContainer);
        }
      }
    });
    
    // Observe document body to catch all resize events
    this.resizeObserver.observe(document.body);
  }
  
  private initMutationObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldRefresh = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              // Check if the added node is a table/codeblock or contains one
              if (element.getAttribute('data-av-type') === 'table' ||
                  element.getAttribute('data-type') === 'NodeCodeBlock' ||
                  element.querySelector('[data-av-type="table"]') ||
                  element.querySelector('[data-type="NodeCodeBlock"]')) {
                shouldRefresh = true;
              }
            }
          });
        }
      });
      
      if (shouldRefresh) {
        this.initTableListeners();
      }
    });
    
    // Observe the entire document for changes
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}
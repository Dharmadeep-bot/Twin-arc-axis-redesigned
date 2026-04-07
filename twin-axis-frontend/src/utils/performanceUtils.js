/**
 * Debounce and throttle utilities for performance optimization
 * Used across resizable components to defer expensive operations
 */

/**
 * Debounce - delays execution until after wait ms have elapsed since last call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @param {boolean} immediate - Trigger on leading edge instead of trailing
 * @returns {Function} Debounced function with cancel method
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  
  function debounced(...args) {
    const context = this;
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(context, args);
  }
  
  debounced.cancel = () => {
    clearTimeout(timeout);
    timeout = null;
  };
  
  return debounced;
}

/**
 * Throttle - limits execution to once per wait ms
 * @param {Function} func - Function to throttle
 * @param {number} wait - Minimum ms between calls
 * @returns {Function} Throttled function with cancel method
 */
export function throttle(func, wait) {
  let timeout = null;
  let lastArgs = null;
  let lastTime = 0;
  
  function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - lastTime);
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastTime = now;
      func.apply(this, args);
    } else if (!timeout) {
      lastArgs = args;
      timeout = setTimeout(() => {
        lastTime = Date.now();
        timeout = null;
        func.apply(this, lastArgs);
      }, remaining);
    }
  }
  
  throttled.cancel = () => {
    clearTimeout(timeout);
    timeout = null;
    lastArgs = null;
  };
  
  return throttled;
}

/**
 * Create a resize observer that debounces callbacks
 * Useful for deferring expensive layout recalculations
 * @param {Function} callback - Callback when resize settles
 * @param {number} delay - Debounce delay in ms
 * @returns {Object} Observer with observe/unobserve/disconnect methods
 */
export function createDebouncedResizeObserver(callback, delay = 150) {
  const debouncedCallback = debounce(callback, delay);
  
  const observer = new ResizeObserver((entries) => {
    debouncedCallback(entries);
  });
  
  return {
    observe: (element) => observer.observe(element),
    unobserve: (element) => observer.unobserve(element),
    disconnect: () => {
      debouncedCallback.cancel();
      observer.disconnect();
    }
  };
}

/**
 * Hook-friendly debounce that returns current "is-debouncing" state
 * @param {number} delay - Debounce delay in ms
 * @returns {Object} { trigger, isDebouncing, cancel }
 */
export function createResizeDebouncer(delay = 150) {
  let timeout = null;
  let isDebouncing = false;
  let onSettleCallback = null;
  
  return {
    trigger: (callback) => {
      isDebouncing = true;
      onSettleCallback = callback;
      
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        isDebouncing = false;
        if (onSettleCallback) {
          onSettleCallback();
        }
        timeout = null;
      }, delay);
      
      return isDebouncing;
    },
    
    isActive: () => isDebouncing,
    
    cancel: () => {
      clearTimeout(timeout);
      timeout = null;
      isDebouncing = false;
    }
  };
}

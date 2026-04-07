import { useState, useRef, useCallback, useEffect } from 'react';
import { debounce } from '../utils/performanceUtils';

/**
 * Custom hook for debounced resize operations
 * Provides immediate visual feedback while deferring expensive recalculations
 * 
 * @param {Object} initialDimensions - { width, height }
 * @param {Object} options - Configuration options
 * @param {number} options.debounceDelay - Ms to wait before triggering settle callback (default: 150)
 * @param {Object} options.minDimensions - { width, height } minimum bounds
 * @param {Object} options.maxDimensions - { width, height } maximum bounds
 * @param {Function} options.onResizeSettle - Called when resize stops (for expensive operations)
 * @returns {Object} Resize state and handlers
 */
export function useDebouncedResize(initialDimensions, options = {}) {
  const {
    debounceDelay = 150,
    minDimensions = { width: 200, height: 200 },
    maxDimensions = { width: 2000, height: 1500 },
    onResizeSettle = null,
    useSkeleton = false // Enable skeleton mode for performance
  } = options;
  
  const [dimensions, setDimensions] = useState(initialDimensions);
  const [isResizing, setIsResizing] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  
  const startPosRef = useRef({ x: 0, y: 0 });
  const startDimRef = useRef(initialDimensions);
  
  // Debounced settle callback
  const debouncedSettle = useRef(
    debounce((newDimensions) => {
      setIsSettling(false);
      setShowSkeleton(false); // Hide skeleton after settle
      if (onResizeSettle) {
        onResizeSettle(newDimensions);
      }
    }, debounceDelay)
  ).current;
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSettle.cancel();
    };
  }, []);
  
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    if (useSkeleton) {
      setShowSkeleton(true); // Show skeleton immediately when resize starts
    }
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startDimRef.current = { ...dimensions };
    
    if (e.target.setPointerCapture) {
      e.target.setPointerCapture(e.pointerId);
    }
  }, [dimensions, useSkeleton]);
  
  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;
    
    requestAnimationFrame(() => {
      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;
      
      const newWidth = Math.max(
        minDimensions.width, 
        Math.min(maxDimensions.width, startDimRef.current.width + deltaX)
      );
      const newHeight = Math.max(
        minDimensions.height, 
        Math.min(maxDimensions.height, startDimRef.current.height + deltaY)
      );
      
      const newDimensions = { width: newWidth, height: newHeight };
      
      // Immediate visual update
      setDimensions(newDimensions);
      
      // Mark as settling and trigger debounced callback
      setIsSettling(true);
      debouncedSettle(newDimensions);
    });
  }, [isResizing, minDimensions, maxDimensions]);
  
  const handleResizeEnd = useCallback((e) => {
    setIsResizing(false);
    if (e.target.releasePointerCapture) {
      e.target.releasePointerCapture(e.pointerId);
    }
    // Trigger debounced settle immediately on end
    debouncedSettle(dimensions);
  }, [dimensions, debouncedSettle]);
  
  return {
    dimensions,
    setDimensions,
    isResizing,
    isSettling, // True while waiting for debounced callback
    showSkeleton, // True when skeleton should be displayed
    handlers: {
      onPointerDown: handleResizeStart,
      onPointerMove: handleResizeMove,
      onPointerUp: handleResizeEnd,
      onPointerCancel: handleResizeEnd
    }
  };
}

/**
 * Hook to observe element resize with debounced callback
 * Useful for container-based resize detection
 * 
 * @param {Function} callback - Called with new dimensions when resize settles
 * @param {number} delay - Debounce delay in ms
 * @returns {Object} { ref, isResizing }
 */
export function useResizeObserver(callback, delay = 150) {
  const elementRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const debouncedCallback = debounce((entry) => {
      setIsResizing(false);
      const { width, height } = entry.contentRect;
      callback({ width, height });
    }, delay);
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setIsResizing(true);
        debouncedCallback(entry);
      }
    });
    
    observer.observe(element);
    
    return () => {
      debouncedCallback.cancel();
      observer.disconnect();
    };
  }, [callback, delay]);
  
  return { ref: elementRef, isResizing };
}

class CountdownTimer extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    // Defer with a zero-delay to run after the current render pass.
    setTimeout(() => this.scanAndInitTimers(), 0);
  }

  scanAndInitTimers() {
    const timers = this.querySelectorAll('.countdown-timer:not([data-initialized])');
    timers.forEach(timer => {
      timer.dataset.initialized = 'true';
      this.initTimer(timer);
    });
  }

  initTimer(timer) {
    const endDate = new Date(timer.dataset.endDate).getTime();

    // Clear any existing interval on this element before starting a new one
    const existingIntervalId = parseInt(timer.dataset.intervalId, 10);
    if (existingIntervalId) {
      clearInterval(existingIntervalId);
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = endDate - now;

      if (distance < 0) {
        // We need to access the intervalId, which is defined after this function.
        // We can get it from the timer's dataset.
        clearInterval(parseInt(timer.dataset.intervalId, 10));
        timer.innerHTML = "EXPIRED";
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      timer.innerHTML = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // 1. Run the timer logic immediately to populate the content.
    updateTimer();
    
    // 2. Make the timer visible now that it has content.
    timer.style.visibility = 'visible';

    // 3. Set the interval for all subsequent updates.
    const intervalId = setInterval(updateTimer, 1000);
    timer.dataset.intervalId = intervalId;
  }
}

if (!customElements.get('countdown-timer-component')) {
  customElements.define('countdown-timer-component', CountdownTimer);
}

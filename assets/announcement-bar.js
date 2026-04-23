import { Component } from '@theme/component';

/**
 * Announcement banner custom element that creates a continuous 3D tumbling effect.
 *
 * @extends {Component}
 */
export class AnnouncementBar extends Component {
  constructor() {
    super();
    this.sourceSlides = [];
    this.activeSlides = [];
    this.currentIndex = 0;
    this.interval = null;
    this.contentWrapper = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.contentWrapper = this.querySelector('.announcement-bar__content-wrapper');
    this.sourceSlides = this.contentWrapper ? Array.from(this.contentWrapper.children) : [];
    this.speed = parseInt(this.dataset.speed, 10) * 1000; // Convert to ms

    if (this.sourceSlides.length > 1) {
      // Use a timeout to ensure the component has been rendered and has a height
      setTimeout(() => this.init(), 0);
    }
  }

  init() {
    const height = this.offsetHeight;
    const radius = height / 2;
    const angle = 90;
    const numSourceSlides = this.sourceSlides.length;
    const numActiveSlides = 4;

    // Clear the wrapper and create 4 new "active" slides
    this.contentWrapper.innerHTML = '';
    this.activeSlides = [];

    for (let i = 0; i < numActiveSlides; i++) {
      const slide = document.createElement('div');
      slide.className = 'announcement-bar__slide';
      
      // Populate with initial content
      const sourceIndex = i % numSourceSlides;
      slide.innerHTML = this.sourceSlides[sourceIndex].innerHTML;
      
      this.contentWrapper.appendChild(slide);
      this.activeSlides.push(slide);
      
      // Arrange slides in a 4-sided prism
      const rotation = i * angle;
      slide.style.transform = `rotateX(${rotation}deg) translateZ(${radius}px)`;
    }

    // Notify the countdown component to initialize new timers
    const countdownParent = this.closest('countdown-timer-component');
    if (countdownParent && typeof countdownParent.scanAndInitTimers === 'function') {
      countdownParent.scanAndInitTimers();
    }

    // Make the content visible now that it's been initialized
    this.contentWrapper.style.visibility = 'visible';

    this.start();

    this.addEventListener('mouseenter', this.pause.bind(this));
    this.addEventListener('mouseleave', this.start.bind(this));
    document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
  }

  cycle() {
    const numSourceSlides = this.sourceSlides.length;
    const numActiveSlides = 4;

    // If there are 4 or fewer slides, we don't need the complex update logic.
    if (numSourceSlides <= numActiveSlides) {
      this.currentIndex++;
      const angle = 90;
      const wrapperRotation = this.currentIndex * -angle;
      this.contentWrapper.style.transform = `rotateX(${wrapperRotation}deg)`;
      return;
    }

    // --- Complex logic for > 4 slides ---

    // The slide at the back is the one to update. Its position is 180 degrees
    // from the front-facing slide. In 2 cycles, it will be the front slide.
    const slideToUpdateIndex = (this.currentIndex + 2) % numActiveSlides;
    const slideToUpdate = this.activeSlides[slideToUpdateIndex];

    // The content it needs is for the slide that will be at the front in 2 cycles.
    const sourceContentIndex = (this.currentIndex + 2) % numSourceSlides;
    
    // Update the content of the slide at the back.
    slideToUpdate.innerHTML = this.sourceSlides[sourceContentIndex].innerHTML;

    // Notify the countdown component to initialize the new timer
    const countdownParent = this.closest('countdown-timer-component');
    if (countdownParent && typeof countdownParent.scanAndInitTimers === 'function') {
      countdownParent.scanAndInitTimers();
    }

    this.currentIndex++;
    
    // Apply the rotation
    const angle = 90;
    const wrapperRotation = this.currentIndex * -angle;
    this.contentWrapper.style.transform = `rotateX(${wrapperRotation}deg)`;
  }

  start() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.cycle(), this.speed);
  }

  pause() {
    clearInterval(this.interval);
  }

  onVisibilityChange() {
    if (document.hidden) {
      this.pause();
    } else {
      this.start();
    }
  }

  disconnectedCallback() {
    this.pause();
    document.removeEventListener('visibilitychange', this.onVisibilityChange.bind(this));
  }
}

if (!customElements.get('announcement-bar-component')) {
  customElements.define('announcement-bar-component', AnnouncementBar);
}

import { Component } from '@theme/component';
import { onAnimationEnd } from '@theme/utilities';
import { ThemeEvents, CartUpdateEvent } from '@theme/events';

/**
 * A custom element that displays a cart icon.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} cartBubble - The cart bubble element.
 * @property {HTMLElement} cartBubbleText - The cart bubble text element.
 * @property {HTMLElement} cartBubbleCount - The cart bubble count element.
 *
 * @extends {Component<Refs>}
 */
class CartIcon extends Component {
  requiredRefs = ['cartBubble', 'cartBubbleText', 'cartBubbleCount'];

  /** @type {number} */
  get currentCartCount() {
    return Number(this.dataset.cartCount ?? this.refs.cartBubbleCount.textContent ?? 0);
  }

  set currentCartCount(value) {
    // Keep the exact total even when the visual bubble becomes a dot at 100+.
    this.dataset.cartCount = String(value);
    this.refs.cartBubbleCount.textContent = value < 100 ? String(value) : '';
  }

  connectedCallback() {
    super.connectedCallback();

    document.addEventListener(ThemeEvents.cartUpdate, this.onCartUpdate);
    document.addEventListener('cart:updated', this.onCartUpdate);
    this.ensureCartBubbleIsCorrect();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener(ThemeEvents.cartUpdate, this.onCartUpdate);
    document.removeEventListener('cart:updated', this.onCartUpdate);
  }

  /**
   * Handles the cart update event.
   * @param {CartUpdateEvent | CustomEvent} event - The cart update event.
   */
  onCartUpdate = async (event) => {
    const detail = event.detail ?? {};
    const rawItemCount =
      detail.data?.itemCount ?? detail.cart?.item_count ?? detail.resource?.item_count ?? detail.data?.item_count;
    const itemCount = Number(rawItemCount);

    // Some legacy integrations use cart:update as a refresh signal without a
    // cart payload. An unknown count must never be interpreted as an empty cart.
    if (
      (typeof rawItemCount !== 'number' && typeof rawItemCount !== 'string') ||
      String(rawItemCount).trim() === '' ||
      !Number.isSafeInteger(itemCount) ||
      itemCount < 0
    ) return;

    const comingFromProductForm = detail.data?.source === 'product-form-component';

    this.renderCartBubble(itemCount, comingFromProductForm);
  };

  /**
   * Renders the cart bubble.
   * @param {number} itemCount - The number of items in the cart.
   * @param {boolean} comingFromProductForm - Whether the cart update is coming from the product form.
   */
  renderCartBubble = async (itemCount, comingFromProductForm, animate = true) => {
    // Product forms send a delta; cart pages and other integrations send an absolute total.
    // Consume both contracts here without redispatching a refresh event.
    const nextCount = comingFromProductForm ? this.currentCartCount + itemCount : itemCount;

    this.refs.cartBubbleCount.classList.toggle('hidden', nextCount === 0);
    this.refs.cartBubble.classList.toggle('visually-hidden', nextCount === 0);
    this.refs.cartBubble.classList.toggle('cart-bubble--animating', nextCount > 0 && animate);

    this.currentCartCount = nextCount;

    this.classList.toggle('header-actions__cart-icon--has-cart', nextCount > 0);

    const countText = this.querySelector('[data-cart-count-text]');
    if (countText && this.dataset.cartCountLabel) {
      countText.textContent = `${this.dataset.cartCountLabel}: ${nextCount}`;
    }
    const action = this.closest('a[aria-label], button[aria-label]');
    const actionLabel = action?.getAttribute('aria-label');
    if (actionLabel) {
      // Preserve the translated action name (cart link or drawer trigger).
      action.setAttribute('aria-label', actionLabel.replace(/\d+\s*$/, String(nextCount)));
    }

    sessionStorage.setItem(
      'cart-count',
      JSON.stringify({
        value: String(this.currentCartCount),
        timestamp: Date.now(),
      })
    );

    if (!animate) return;
    await onAnimationEnd(this.refs.cartBubbleText);

    this.refs.cartBubble.classList.remove('cart-bubble--animating');
  };

  /**
   * Checks if the cart count is correct.
   */
  ensureCartBubbleIsCorrect = () => {
    const sessionStorageCount = sessionStorage.getItem('cart-count');
    const visibleCount = this.refs.cartBubbleCount.textContent;

    if (sessionStorageCount === visibleCount || sessionStorageCount === null) return;

    try {
      const { value, timestamp } = JSON.parse(sessionStorageCount);

      if (Date.now() - timestamp < 10000) {
        const count = parseInt(value, 10);

        if (count >= 0) {
          this.renderCartBubble(count, false, false);
        }
      }
    } catch (_) {
      // no-op
    }
  };
}

if (!customElements.get('cart-icon')) {
  customElements.define('cart-icon', CartIcon);
}

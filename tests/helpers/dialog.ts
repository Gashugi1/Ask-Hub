/**
 * jsdom has no `<dialog>` implementation: `showModal` and `close` are absent,
 * so a component that opens one throws. These make the two methods toggle
 * the `open` attribute and fire `close`, which is all the components need
 * and enough for `screen` queries to see the dialog's children. Call once
 * at the top of a test file, before rendering.
 */
export function polyfillDialog(): void {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

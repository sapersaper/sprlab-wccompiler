if (typeof document !== 'undefined') {
  document.addEventListener('wcc:model', (e) => {
    const { prop, value } = e.detail;
    e.target.dispatchEvent(new CustomEvent(`${prop}Change`, {
      detail: value,
      bubbles: true
    }));
  });
}

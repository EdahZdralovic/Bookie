document.documentElement.classList.add('js');

const menu = document.getElementById('mobile-menu');
const openButton = document.querySelector('[data-menu-open]');
const closeButtons = document.querySelectorAll('[data-menu-close]');

function setMenu(open) {
  if (!menu || !openButton) return;
  menu.classList.toggle('is-open', open);
  document.body.classList.toggle('menu-open', open);
  menu.setAttribute('aria-hidden', String(!open));
  openButton.setAttribute('aria-expanded', String(open));
}

openButton?.addEventListener('click', () => setMenu(true));
closeButtons.forEach((button) => button.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

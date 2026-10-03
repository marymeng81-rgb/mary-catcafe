document.getElementById('year').textContent = new Date().getFullYear();
const lightbox = document.getElementById('lightbox');
document.querySelectorAll('[data-photo]').forEach(button => {
  button.addEventListener('click', () => {
    const image = button.querySelector('img');
    const enlarged = document.getElementById('large-photo');
    enlarged.src = button.dataset.photo;
    enlarged.alt = image.alt;
    document.getElementById('photo-caption').textContent = button.querySelector('span').textContent.replace(' ↗', '');
    lightbox.showModal();
  });
});
lightbox.querySelector('.close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox) { const box = lightbox.getBoundingClientRect(); if(event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) lightbox.close(); } });

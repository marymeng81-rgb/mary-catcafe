'use client';
import { useEffect } from 'react';
import SiteHeader from './components/SiteHeader';
export default function Home() {
  useEffect(() => {
    const lightbox = document.getElementById('lightbox');
    const close = lightbox.querySelector('.close');
    const buttons = [...document.querySelectorAll('[data-photo]')];
    const openPhoto = event => {
      const button = event.currentTarget;
      const image = button.querySelector('img');
      const enlarged = document.getElementById('large-photo');
      enlarged.src = button.dataset.photo;
      enlarged.alt = image.alt;
      document.getElementById('photo-caption').textContent = button.querySelector('span').textContent.replace(' ↗', '');
      lightbox.showModal();
    };
    const closePhoto = () => lightbox.close();
    const closeBackdrop = event => {
      if (event.target !== lightbox) return;
      const box = lightbox.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) lightbox.close();
    };
    buttons.forEach(button => button.addEventListener('click', openPhoto));
    close.addEventListener('click', closePhoto);
    lightbox.addEventListener('click', closeBackdrop);
    return () => {
      buttons.forEach(button => button.removeEventListener('click', openPhoto));
      close.removeEventListener('click', closePhoto);
      lightbox.removeEventListener('click', closeBackdrop);
    };
  }, []);
  return (<>
<SiteHeader />
  <main>
    <section className="hero" id="home">
      <div className="hero-copy"><p className="eyebrow">WELCOME TO MARY’S CAT CAFÉ</p><h1>Your happy<br />little <em>purr</em> place.</h1><p className="intro">Slow down, settle in, and meet your new furry friends. A cosy corner for good coffee and even better company.</p><a className="button" href="#cats">Meet our cats <span>↗</span></a><div className="hero-note"><span className="heart">♡</span> Made with love by Mary. Approved by the cats.</div></div>
      <div className="hero-photo"><img src="/Image_20261003112536_49_2.jpg" alt="Ginger Gao, Mary's orange cat, relaxing with a little toy" /><div className="photo-label">Our resident sunshine <span>Ginger Gao ♡</span></div><div className="round-note">COFFEE & CATS<br /><span>☕</span><br />HAPPINESS, DAILY</div></div>
    </section>
    <div className="ribbon"><span>Good coffee</span><i>✳</i><span>Gentle paws</span><i>✳</i><span>Cosy moments</span><i>✳</i><span>A little more joy</span><i>✳</i></div>
    <section className="story section" id="about"><div><p className="eyebrow">A NOTE FROM MARY</p><h2>A café with a<br />little more <em>heart.</em></h2></div><div className="story-copy"><p>Hello, I’m Mary — the human behind the café, and the very proud cat mum of Ginger Gao, Kelly Gao and Traveller Gao.</p><p>This little space brings together the things I love: cats, a comforting cuppa, and time to enjoy the small things. Come get to know my three furry companions. They’re the heart of it all.</p><span className="signature">With love, Mary ♡</span></div></section>
    <section className="cats section" id="cats"><div className="section-heading"><div><p className="eyebrow">THE REAL STARS OF THE SHOW</p><h2>Meet your <em>hosts.</em></h2></div><p>Three lovely cats.<br />Three reasons to smile.</p></div><div className="cat-grid"><article className="cat-card"><div className="cat-image"><img src="/Image_20261003112536_49_2.jpg" alt="Ginger Gao looking at the camera" loading="lazy" /><span>01 / THE GINGER ONE</span></div><div className="cat-caption"><div><h3>Ginger Gao</h3><p>A little sunshine in a fur coat.</p></div><span>♡</span></div></article><article className="cat-card"><div className="cat-image"><img src="/Image_20261003112411_41_2.jpg" alt="Kelly Gao lying on the carpet with fluffy paws outstretched" loading="lazy" /><span>02 / THE FLUFFY ONE</span></div><div className="cat-caption"><div><h3>Kelly Gao</h3><p>Fluffy paws. Expert-level lounging.</p></div><span>♡</span></div></article><article className="cat-card"><div className="cat-image"><img src="/traveler.jpg" alt="Traveller Gao, an orange tabby cat, looking up beside trailing leaves" loading="lazy" /><span>03 / THE CURIOUS ONE</span></div><div className="cat-caption"><div><h3>Traveller Gao</h3><p>A curious little face, full of wonder.</p></div><span>♡</span></div></article></div></section>
    <section className="welcome"><p className="eyebrow">TAKE A BREATH. STAY A WHILE.</p><h2>Life feels better<br />with a cat <em>nearby.</em></h2><p>Leave a little room in your day for a quiet moment<br />and some whiskered company.</p><a href="#gallery" className="text-link">A peek into our world <span>↗</span></a></section>
    <section className="section gallery" id="gallery"><div className="section-heading"><div><p className="eyebrow">THE LITTLE THINGS</p><h2>Everyday <em>magic.</em></h2></div><p>A few favourite moments from Mary’s camera.</p></div><div className="gallery-grid"><button data-photo="/Image_20261003112543_52_2.jpg" aria-label="Enlarge photo of Ginger Gao"><img src="/Image_20261003112543_52_2.jpg" alt="Ginger Gao sitting up with eyes closed and whiskers lifted" loading="lazy" /><span>A quiet afternoon ↗</span></button><button data-photo="/Image_20261003112411_41_2.jpg" aria-label="Enlarge photo of Kelly Gao"><img src="/Image_20261003112411_41_2.jpg" alt="Kelly Gao stretching out for a rest" loading="lazy" /><span>The art of doing nothing ↗</span></button><button data-photo="/Image_20261003112513_47_2.jpg" aria-label="Enlarge another photo of Kelly Gao"><img src="/Image_20261003112513_47_2.jpg" alt="Kelly Gao relaxing on blue cushions on the sofa" loading="lazy" /><span>Paws, relax, repeat ↗</span></button><button data-photo="/traveler.jpg" aria-label="Enlarge photo of Traveller Gao"><img src="/traveler.jpg" alt="Traveller Gao looking up at trailing leaves with one paw lifted" loading="lazy" /><span>A little moment of wonder with Traveller Gao ↗</span></button></div></section>
    <section className="section video-moment" id="video"><div className="section-heading"><div><p className="eyebrow">A LITTLE MOMENT IN MOTION</p><h2>A little <em>happiness.</em></h2></div><p>A happy little moment from Mary’s camera.</p></div><video controls playsInline preload="metadata" poster="/cafe-video-poster.jpg" aria-label="Cat video with cheerful instrumental music"><source src="/cafe-happy-moments.mp4" type="video/mp4" />Your browser does not support video playback. <a href="/cafe-happy-moments.mp4">Download the video</a>.</video></section>
    <section className="visit section" id="visit"><div><p className="eyebrow">SOMETHING COSY IS COMING</p><h2>See you for<br />a <em>cuppa?</em></h2><p>We’re getting our little café ready.<br />Opening hours and location will be shared here soon.</p><span className="status"><span></span> Visit details coming soon</span></div><div className="etiquette"><span className="eyebrow">A LITTLE CAT KINDNESS</span><h3>Happy cats, happy café.</h3><p>Let the cats come to you, give sleepy cats their space, and keep treats for the humans. A gentle hello goes a long way.</p><div>♡ &nbsp; Thank you for being a lovely guest.</div></div></section>
  </main>
  <footer><a className="footer-brand" href="#home">Mary’s cat café <span>♡</span></a><p>Coffee, company & cats.</p><a href="#home">Back to top ↑</a><small>© <span id="year" suppressHydrationWarning>{new Date().getFullYear()}</span> Mary’s Cat Café. Made with love.</small></footer>
  <dialog id="lightbox" aria-label="Cat photo viewer"><button className="close" aria-label="Close photo viewer">×</button><img id="large-photo" alt="" /><p id="photo-caption"></p></dialog>
</>);
}

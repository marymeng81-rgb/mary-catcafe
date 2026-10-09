import Link from 'next/link';

export default function SiteHeader({ opportunities = false }) {
  const home = opportunities ? '/' : '';
  return <>
    <div className="announcement">A little coffee. A little company. A whole lot of cats. <span>♡</span></div>
    <header className="header">
      <Link className="brand" href={`${home}#home`} aria-label="Mary's Cat Café home"><svg viewBox="0 0 60 58" aria-hidden="true"><path d="M12 27 9 7l17 12h9L51 7l-3 22c8 22-7 26-18 26S5 49 12 27Z"/><path d="M19 32h3m16 0h3M28 39l3 3 3-3M8 38l11 3M7 46l12-1m22-4 12-3m-12 7 13 1"/></svg><span>Mary’s <b>cat café</b></span></Link>
      <nav aria-label="Main navigation"><Link href={`${home}#about`}>Our story</Link><Link href={`${home}#cats`}>Meet the cats</Link><Link href={`${home}#gallery`}>Little moments</Link><Link href="/opportunities" aria-current={opportunities ? 'page' : undefined}>Opportunities</Link></nav>
      <Link className="button small" href={`${home}#visit`}>Plan a visit <span>↗</span></Link>
    </header>
  </>;
}

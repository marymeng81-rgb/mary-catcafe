import SiteHeader from '../components/SiteHeader';
import Opportunities from './Opportunities';

export const metadata = { title: 'Opportunities · Mary’s Cat Café', description: 'Current opportunities chosen around your interests and checked against official sources.' };
export default function OpportunitiesPage() {
  return <>
    <SiteHeader opportunities />
    <main className="opportunities-page section"><Opportunities /></main>
    <footer><a className="footer-brand" href="/">Mary’s cat café <span>♡</span></a><p>Coffee, company & cats.</p><a href="/">Back to the café ↗</a><small>A little room for new possibilities.</small></footer>
  </>;
}

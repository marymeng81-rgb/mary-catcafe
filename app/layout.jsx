import './globals.css';
import './opportunities/opportunities.css';
export const metadata = {
  title: 'Mary’s Cat Café · Coffee, company & cats',
  description: "Welcome to Mary's Cat Café. Meet Ginger Gao, Kelly Gao and Traveller Gao, and discover a little place for coffee, company and cats.",
};
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}

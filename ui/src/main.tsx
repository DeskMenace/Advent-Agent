import { render } from 'preact';
import '@fontsource/fraunces/latin-400.css';
import '@fontsource/fraunces/latin-400-italic.css';
import '@fontsource/fraunces/latin-500.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/fraunces/latin-900.css';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-500.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/instrument-sans/latin-700.css';
import './styles/base.css';
import './styles/calendar.css';
import './styles/gift.css';
import { Toast } from './components/Toast.js';
import { CalendarPage } from './pages/Calendar.js';
import { GiftPage } from './pages/Gift.js';
import { LabReviewPage } from './pages/LabReview.js';
import { SettingsPage } from './pages/Settings.js';
import { SetupPage } from './pages/Setup.js';
import { ShelfPage } from './pages/Shelf.js';
import { Link, useRoute } from './router.js';
import { Header } from './components/Header.js';

function App() {
  const route = useRoute();
  let page;
  switch (route.name) {
    case 'calendar': page = <CalendarPage door={route.params.door ? Number(route.params.door) : undefined} />; break;
    case 'setup': page = <SetupPage />; break;
    case 'settings': page = <SettingsPage />; break;
    case 'gift': page = <GiftPage season={route.params.season ? Number(route.params.season) : undefined} day={Number(route.params.day)} key={route.path} />; break;
    case 'shelf': page = <ShelfPage />; break;
    case 'lab': page = <LabReviewPage />; break;
    default: page = <div class="shell"><Header /><p class="empty">This door does not exist. <Link href="/">Back to the calendar</Link>.</p></div>;
  }
  return <>{page}<Toast /></>;
}

render(<App />, document.getElementById('app')!);

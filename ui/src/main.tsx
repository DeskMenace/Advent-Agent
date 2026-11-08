import { render } from 'preact';
import './styles/base.css';
import './styles/calendar.css';
import './styles/gift.css';
import { Toast } from './components/Toast.js';
import { CalendarPage } from './pages/Calendar.js';
import { DoorPage } from './pages/Door.js';
import { GiftPage } from './pages/Gift.js';
import { LabReviewPage } from './pages/LabReview.js';
import { SettingsPage } from './pages/Settings.js';
import { SetupPage } from './pages/Setup.js';
import { ArchivePage, ShelfPage } from './pages/Shelf.js';
import { Link, useRoute } from './router.js';
import { Header } from './components/Header.js';

function App() {
  const route = useRoute();
  let page;
  switch (route.name) {
    case 'calendar': page = <CalendarPage />; break;
    case 'setup': page = <SetupPage />; break;
    case 'settings': page = <SettingsPage />; break;
    case 'door': page = <DoorPage day={Number(route.params.day)} key={route.params.day} />; break;
    case 'gift': page = <GiftPage season={Number(route.params.season)} day={Number(route.params.day)} key={route.path} />; break;
    case 'shelf': page = <ShelfPage />; break;
    case 'archive': page = <ArchivePage />; break;
    case 'archiveSeason': page = <ArchivePage season={Number(route.params.season)} />; break;
    case 'lab': page = <LabReviewPage />; break;
    default: page = <div class="shell"><Header /><p class="empty">This door does not exist. <Link href="/">Back to the calendar</Link>.</p></div>;
  }
  return <>{page}<Toast /></>;
}

render(<App />, document.getElementById('app')!);

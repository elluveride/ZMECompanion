import { AppStateProvider, useApp } from './state';
import { TopBar, Footer } from './components/Shell';
import { DelPage } from './pages/Del';
import { GndPage } from './pages/Gnd';
import { TwrPage } from './pages/Twr';
import { AppPage } from './pages/AppDep';
import { CtrPage } from './pages/Ctr';
import { StripPage } from './pages/Strip';
import { LibraryPage } from './pages/Library';
import { IssuesPage } from './pages/Issues';

const PAGES = { del: DelPage, gnd: GndPage, twr: TwrPage, app: AppPage, ctr: CtrPage, strip: StripPage, library: LibraryPage, issues: IssuesPage };

function Routed() {
  const { view } = useApp();
  const Page = PAGES[view.page];
  return (
    <main className={`page page-${view.page}`}>
      <Page />
    </main>
  );
}

export function App() {
  return (
    <AppStateProvider>
      <TopBar />
      <Routed />
      <Footer />
    </AppStateProvider>
  );
}

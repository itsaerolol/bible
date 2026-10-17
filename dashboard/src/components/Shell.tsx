import type { ReactNode } from "react";
import { loadDataset } from "@/lib/data";
import { Icon, Logo } from "./Icon";
import { NavLinks } from "./NavLinks";
import { SyncInfo } from "./SyncInfo";
import { ThemeToggle } from "./ThemeToggle";

export function Shell({ children }: { children: ReactNode }) {
  const ds = loadDataset();
  const nVideos = ds.videos.length;
  const nSnaps = ds.videos.reduce((n, v) => n + v.snapshots.length, 0);
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <div>
            <b>Shorts analytics</b>
            <small>Private dashboard</small>
          </div>
        </div>
        <nav aria-label="Primary">
          <NavLinks variant="side" />
        </nav>
        <div className="side-foot">
          {nVideos} video{nVideos === 1 ? "" : "s"} · {nSnaps} snapshot{nSnaps === 1 ? "" : "s"}
          <br />
          YouTube data only. Advice only, nothing here edits your episodes.
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="brand-sm">
            <Logo size={26} />
            <span>Shorts</span>
          </div>
          <SyncInfo lastSyncAt={ds.lastSyncAt} dataThrough={ds.dataThrough} mock={ds.mock} />
          <ThemeToggle />
          <form method="post" action="/api/logout">
            <button className="icon-btn" type="submit" aria-label="Sign out" title="Sign out">
              <Icon name="logout" />
            </button>
          </form>
        </header>
        {ds.mock && (
          <div className="banner mock" role="status">
            <Icon name="alert" size={18} />
            <div>
              <strong>MOCK DATA.</strong> Every number, title and recommendation on this site is fabricated sample data. The first real sync replaces it.
            </div>
          </div>
        )}
        {ds.warnings.length > 0 && (
          <div className="banner" role="alert">
            <Icon name="alert" size={18} />
            <div>
              <strong>Some data files could not be read.</strong> {ds.warnings.slice(0, 3).join(" ")}
            </div>
          </div>
        )}
        <main id="main">{children}</main>
      </div>
      <nav className="tabbar" aria-label="Primary">
        <NavLinks variant="tab" />
      </nav>
    </div>
  );
}

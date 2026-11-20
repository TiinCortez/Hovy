import Header from './Header';
import Sidebar from './SideBar';

export default function DashboardLayout({ children }) {
  return (
    // Wrapper general ocupando el 100% del viewport
    <div className="d-flex flex-column vh-100 overflow-hidden">
      <Header />
      <div className="d-flex flex-grow-1 overflow-hidden">
        <Sidebar />
        
        {/* Área central donde se renderizan las páginas */}
        <main className="hovy-content-wrapper flex-grow-1 overflow-auto px-3 px-lg-4 py-4">
          <div className="container-fluid max-w-1440 mx-auto px-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
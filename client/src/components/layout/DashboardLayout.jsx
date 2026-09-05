import Header from './Header';
import Sidebar from './Sidebar';

export default function DashboardLayout({ children }) {
  return (
    // Wrapper general ocupando el 100% del viewport
    <div className="d-flex flex-column vh-100 overflow-hidden">
      <Header />
      <div className="d-flex flex-grow-1 overflow-hidden">
        <Sidebar />
        
        {/* Área central donde se renderizan las páginas */}
        <main className="hovy-content-wrapper flex-grow-1 overflow-auto p-4 p-md-5">
          <div className="container-fluid max-w-1280 mx-auto px-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
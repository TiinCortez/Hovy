import AppRoutes from './routes/AppRoutes.jsx';
import AvisosProvider from './components/ui/AvisosProvider.jsx';

function App() {
  // Contextos globales de la app: los avisos flotantes (useAvisos) envuelven todas las rutas.
  return (
    <AvisosProvider>
      <AppRoutes />
    </AvisosProvider>
  );
}

export default App;

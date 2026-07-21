import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import './styles/formulario.css';
import './styles/login.css';
import './styles/administrativo.css';

const elementoRaiz = document.getElementById('root');
const raizReact = createRoot(elementoRaiz);

raizReact.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

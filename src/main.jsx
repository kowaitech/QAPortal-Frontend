import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles.css';
import DialogProvider from './components/DialogProvider';

const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={qc}>
    <BrowserRouter basename="/">
      <DialogProvider>
        <App />
      </DialogProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

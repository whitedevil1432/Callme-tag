/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import FinderPage from './components/FinderPage';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [route] = useState<{ type: 'finder' | 'admin'; qrId?: string }>(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    // 1. Support query parameter ?qr=... OR ?tag=... OR ?c=...
    const qrQuery = searchParams.get('qr') || searchParams.get('tag') || searchParams.get('c');
    if (qrQuery) {
      return { type: 'finder', qrId: qrQuery };
    }
    
    // 2. Support either "/c/qr_id" or "/c/qr_id/"
    if (path.startsWith('/c/')) {
      const qrId = path.split('/c/')[1]?.split('/')[0] || '';
      if (qrId) {
        return { type: 'finder', qrId };
      }
    }

    // 3. Support hash router pattern if URL is like /#c/D617859 or /#/c/D617859 or /#D617859
    if (hash) {
      const cleanHash = hash.replace(/^#\/?/, ''); // remove leading # and /
      if (cleanHash.startsWith('c/')) {
        const qrId = cleanHash.split('c/')[1]?.split('/')[0] || '';
        if (qrId) return { type: 'finder', qrId };
      } else if (cleanHash) {
        return { type: 'finder', qrId: cleanHash };
      }
    }
    
    return { type: 'admin' };
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" id="app-root-container">
      {route.type === 'finder' && route.qrId ? (
        <FinderPage qrId={route.qrId} />
      ) : (
        <AdminPanel />
      )}
    </div>
  );
}

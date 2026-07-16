import type { ReactNode } from 'react'; import { Providers } from './providers';
export const metadata={title:'AI Paper Trading',description:'Auditable US equity paper trading dashboard'};
export default function Layout({children}:{children:ReactNode}) { return <html lang="ko"><body style={{margin:0}}><Providers>{children}</Providers></body></html>; }

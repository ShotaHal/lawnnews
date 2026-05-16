// app/layout.js
import './globals.css'

export const metadata = {
  title: 'World Monitor | Investment Intelligence Dashboard',
  description: 'エネルギー地政学・原油価格・芝刈機ビジネス影響分析ダッシュボード',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}

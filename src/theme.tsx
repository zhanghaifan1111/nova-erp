import React, { createContext, useContext, useState, useEffect } from 'react'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'

type ThemeCtx = { dark: boolean; toggle: () => void; lang: 'zh' | 'en'; setLang: (l: 'zh' | 'en') => void }
const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {}, lang: 'zh', setLang: () => {} })
export const useAppTheme = () => useContext(Ctx)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem('nova-theme') === 'dark')
  const [lang, setLang] = useState<'zh' | 'en'>(() => (localStorage.getItem('nova-lang') === 'en' ? 'en' : 'zh'))
  useEffect(() => {
    localStorage.setItem('nova-theme', dark ? 'dark' : 'light')
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  useEffect(() => { localStorage.setItem('nova-lang', lang); document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en' }, [lang])

  return (
    <Ctx.Provider value={{ dark, toggle: () => setDark((d) => !d), lang, setLang }}>
      <ConfigProvider
        locale={lang === 'zh' ? zhCN : enUS}
        theme={{
          algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#4f6ef7',
            colorInfo: '#4f6ef7',
            colorSuccess: '#16b364',
            colorWarning: '#f79009',
            colorError: '#f04438',
            borderRadius: 8,
            fontSize: 14,
          },
          components: {
            Layout: { siderBg: dark ? '#11162a' : '#001529', headerBg: dark ? '#161c33' : '#ffffff' },
            Menu: { darkItemBg: dark ? '#11162a' : '#001529' },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </Ctx.Provider>
  )
}

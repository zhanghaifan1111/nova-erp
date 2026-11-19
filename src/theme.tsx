import React, { createContext, useContext, useState, useEffect } from 'react'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'

type ThemeCtx = { dark: boolean; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} })
export const useAppTheme = () => useContext(Ctx)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem('nova-theme') === 'dark')
  useEffect(() => {
    localStorage.setItem('nova-theme', dark ? 'dark' : 'light')
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  return (
    <Ctx.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      <ConfigProvider
        locale={zhCN}
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

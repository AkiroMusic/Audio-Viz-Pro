import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { zh, en, type Translations } from '../locales'

type Language = 'zh' | 'en'

const translations: Record<Language, Translations> = { zh, en }

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('audioviz-language')
    return (saved === 'en' || saved === 'zh') ? saved : 'zh'
  })

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('audioviz-language', lang)
  }, [])

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

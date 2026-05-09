import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'pt-BR', label: 'PT', name: 'Português' },
    { code: 'es', label: 'ES', name: 'Español' },
  ];

  const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={compact
            ? "gap-1 bg-slate-900 border-slate-700 hover:bg-slate-800 px-2"
            : "gap-2 bg-slate-900 border-slate-700 hover:bg-slate-800"
          }
        >
          <Globe className="w-4 h-4" />
          {!compact && <span className="text-xs font-semibold">LANGUAGE</span>}
          <span className="px-1.5 py-0.5 text-xs font-bold bg-amber-500 text-slate-900 rounded">
            {currentLanguage.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`cursor-pointer ${
              i18n.language === lang.code
                ? 'bg-amber-500/20 text-amber-500'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span>{lang.name}</span>
              {i18n.language === lang.code && (
                <span className="text-xs font-bold px-2 py-1 bg-amber-500 text-slate-900 rounded">
                  {lang.label}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

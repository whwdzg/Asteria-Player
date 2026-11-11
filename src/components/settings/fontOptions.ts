import type { DropdownOption } from '../common/Dropdown';
import type { I18nValue } from '../../i18n/I18nProvider';

export function fontOptions(t: I18nValue['t']): DropdownOption[] {
  return [
    { value: 'display', label: t('settings.font.display') },
    { value: 'sans', label: t('settings.font.sans') },
    { value: 'serif', label: t('settings.font.serif') },
    { value: 'rounded', label: t('settings.font.rounded') },
    { value: 'mono', label: t('settings.font.mono') },
  ];
}

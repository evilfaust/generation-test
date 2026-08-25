import LabEmbed from './LabEmbed';

const GRIST_URL = import.meta.env.VITE_LAB_GRIST_URL || 'https://grist.l.oipav.ru/o/lemma/';

export default function GristSection() {
  return (
    <LabEmbed
      title="Grist — таблицы"
      url={GRIST_URL}
      hintKey="grist"
      hint="При первом входе браузер спросит логин и пароль. Если окно входа не появилось (браузеры не показывают его внутри встроенной страницы) — нажмите «В новой вкладке», войдите там один раз, и таблицы заработают прямо здесь."
    />
  );
}

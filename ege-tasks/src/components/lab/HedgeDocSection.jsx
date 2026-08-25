import LabEmbed from './LabEmbed';

const PAD_URL = import.meta.env.VITE_LAB_PAD_URL || 'https://pad.l.oipav.ru/';

export default function HedgeDocSection() {
  return (
    <LabEmbed
      title="HedgeDoc — совместные заметки"
      url={PAD_URL}
      hintKey="hedgedoc"
      hint="Заметки редактируются вдвоём-втроём одновременно, поддерживают формулы KaTeX и раздаются по ссылке. Вход — по логину и паролю HedgeDoc (заводит администратор)."
    />
  );
}

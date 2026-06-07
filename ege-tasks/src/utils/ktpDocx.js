// Экспорт КТП в Word (.docx). docx грузится динамически (тяжёлый — не в main-бандл).

function fmtDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

export async function exportKtpToWord(course, entries, group) {
  const docx = await import('docx');
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, HeadingLevel, WidthType, AlignmentType,
  } = docx;

  const headerCells = ['№', 'Тема', 'Часы', 'Неделя', 'Дата', 'Планируемые результаты'];
  const widths = [6, 38, 8, 9, 13, 26]; // проценты

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerCells.map((t, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: t, bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
        })],
      }),
    ),
  });

  let n = 0;
  const bodyRows = entries.map((e) => {
    if (e.is_section) {
      return new TableRow({
        children: [new TableCell({
          columnSpan: headerCells.length,
          children: [new Paragraph({
            children: [new TextRun({ text: e.title || '', bold: true, size: 22 })],
          })],
          shading: { fill: 'EFEFEF' },
        })],
      });
    }
    n += 1;
    const topicTitle = e.expand?.topic?.title;
    const cells = [
      String(n),
      topicTitle && topicTitle !== e.title ? `${e.title}\n(${topicTitle})` : (e.title || ''),
      e.hours != null ? String(e.hours) : '',
      e.week_no != null ? String(e.week_no) : '',
      fmtDate(e.planned_date),
      e.planned_results || '',
    ];
    return new TableRow({
      children: cells.map((t, i) =>
        new TableCell({
          width: { size: widths[i], type: WidthType.PERCENTAGE },
          children: String(t).split('\n').map((line) =>
            new Paragraph({
              children: [new TextRun({ text: line, size: 20 })],
              alignment: i === 0 || i === 2 || i === 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
            }),
          ),
        }),
      ),
    });
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });

  const totalHours = entries
    .filter((e) => !e.is_section && e.hours != null)
    .reduce((s, e) => s + Number(e.hours || 0), 0);

  const subtitleParts = [
    group?.name ? `Класс: ${group.name}` : null,
    course?.year ? `Учебный год: ${course.year}` : null,
    totalHours ? `Всего часов: ${totalHours}` : null,
  ].filter(Boolean);

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: 'landscape' } } },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: course?.title || 'КТП', bold: true })],
        }),
        ...(subtitleParts.length
          ? [new Paragraph({ children: [new TextRun({ text: subtitleParts.join('    ·    '), size: 22 })] })]
          : []),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        table,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fname = `КТП_${(course?.title || 'план').replace(/[^\wа-яёА-ЯЁ\- ]/gi, '').trim() || 'план'}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

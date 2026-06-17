import { useState } from 'react';
import { App } from 'antd';
import html2pdf from 'html2pdf.js';
import { api } from '../services/pocketbase';

/**
 * Хук для действий с листами работ (сохранение, печать, экспорт)
 */
export const useWorksheetActions = () => {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  /**
   * Печать листа
   */
  const handlePrint = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const styleId = 'worksheet-print-page-size';
    document.getElementById(styleId)?.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@media print { @page { size: A4 portrait; margin: 10mm 0 0 0; } }';
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  /**
   * Экспорт в PDF — клиентский рендеринг через html2pdf.js.
   * (Серверная PDF-генерация через Puppeteer/Chromium выпилена — браузерная
   *  печать «Печать» + этот клиентский экспорт покрывают потребность.)
   */
  const handleExportPDF = async (printRef, filename = 'Лист задач') => {
    if (!printRef?.current) {
      message.error('Не найден элемент для экспорта');
      return false;
    }

    setExporting(true);
    message.loading({ content: 'Генерируем PDF (Legacy)...', key: 'pdf', duration: 0 });

    try {
      const opt = {
        margin: [7, 7, 7, 7], // мм
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: {
          scale: 3,
          useCORS: true,
          logging: false,
          letterRendering: true,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        },
        pagebreak: {
          mode: 'css',
          before: '.page-break',
          avoid: ['.task-item', '.variant-header']
        }
      };

      await html2pdf().set(opt).from(printRef.current).save();
      message.success({ content: 'PDF успешно сохранён', key: 'pdf', duration: 2 });
      return true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      message.error({ content: 'Ошибка при генерации PDF', key: 'pdf', duration: 2 });
      return false;
    } finally {
      setExporting(false);
    }
  };

  /**
   * Сохранение работы в БД
   */
  const handleSaveWork = async (workData, variants) => {
    setSaving(true);
    try {
      const work = await api.createWork({
        title: workData.title || 'Контрольная работа',
        topic: workData.topic || null,
        time_limit: workData.timeLimit ? parseInt(workData.timeLimit) : null,
      });

      for (const variant of variants) {
        const taskIds = variant.tasks.map(t => t.id);
        const order = variant.tasks.map((t, idx) => ({
          taskId: t.id,
          position: idx,
          ...(t.kimImageSize ? { imageSize: t.kimImageSize } : {}),
        }));

        await api.createVariant({
          work: work.id,
          number: variant.number,
          tasks: taskIds,
          order: order,
        });
      }

      message.success(`Работа "${workData.title}" успешно сохранена с ${variants.length} вариантами`);
      return work;
    } catch (error) {
      console.error('Error saving work:', error);
      message.error('Ошибка при сохранении работы');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Обновление существующей работы в БД
   */
  const handleUpdateWork = async (workId, workData, variants) => {
    setSaving(true);
    try {
      await api.updateWork(workId, {
        title: workData.title || 'Контрольная работа',
        topic: workData.topic || null,
        time_limit: workData.timeLimit ? parseInt(workData.timeLimit) : null,
      });

      const existingVariants = await api.getVariantsByWork(workId);
      const existingByNumber = new Map(existingVariants.map(v => [v.number, v]));
      const incomingNumbers = new Set();

      for (const variant of variants) {
        const taskIds = variant.tasks.map(t => t.id);
        const order = variant.tasks.map((t, idx) => ({
          taskId: t.id,
          position: idx,
          ...(t.kimImageSize ? { imageSize: t.kimImageSize } : {}),
        }));
        const payload = {
          work: workId,
          number: variant.number,
          tasks: taskIds,
          order: order,
        };

        incomingNumbers.add(variant.number);
        const existing = existingByNumber.get(variant.number);
        if (existing) {
          await api.updateVariant(existing.id, payload);
        } else {
          await api.createVariant(payload);
        }
      }

      for (const variant of existingVariants) {
        if (!incomingNumbers.has(variant.number)) {
          await api.deleteVariant(variant.id);
        }
      }

      message.success(`Работа "${workData.title}" успешно обновлена`);
    } catch (error) {
      console.error('Error updating work:', error);
      message.error('Ошибка при обновлении работы');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Загрузка сохранённых работ
   */
  const handleLoadWorks = async () => {
    try {
      const works = await api.getWorks();
      return works;
    } catch (error) {
      console.error('Error loading works:', error);
      message.error('Ошибка при загрузке работ');
      throw error;
    }
  };

  /**
   * Загрузка конкретной работы
   */
  const handleLoadWork = async (workId) => {
    try {
      const work = await api.getWork(workId);
      const variantsData = await api.getVariantsByWork(workId);

      const loadedVariants = [];
      for (const variantData of variantsData) {
        const tasksIds = variantData.tasks || [];
        const order = variantData.order || [];

        const tasks = [];
        for (const taskId of tasksIds) {
          const task = await api.getTask(taskId);
          if (task) {
            // Восстанавливаем сохранённый размер картинки в КИМ (см. order.imageSize)
            const imageSize = order.find(o => o.taskId === task.id)?.imageSize;
            tasks.push(imageSize ? { ...task, kimImageSize: imageSize } : task);
          }
        }

        // Сортируем по order
        if (order.length > 0) {
          tasks.sort((a, b) => {
            const posA = order.find(o => o.taskId === a.id)?.position ?? 999;
            const posB = order.find(o => o.taskId === b.id)?.position ?? 999;
            return posA - posB;
          });
        }

        loadedVariants.push({
          number: variantData.number,
          tasks: tasks,
        });
      }

      return { work, variants: loadedVariants };
    } catch (error) {
      console.error('Error loading work:', error);
      message.error('Ошибка при загрузке работы');
      throw error;
    }
  };

  /**
   * Удаление работы
   */
  const handleDeleteWork = async (workId) => {
    try {
      const variantsData = await api.getVariantsByWork(workId);
      for (const variant of variantsData) {
        await api.deleteVariant(variant.id);
      }

      await api.deleteWork(workId);
      message.success('Работа удалена');
    } catch (error) {
      console.error('Error deleting work:', error);
      message.error('Ошибка при удалении работы');
      throw error;
    }
  };

  return {
    saving,
    exporting,
    handlePrint,
    handleExportPDF,
    handleSaveWork,
    handleUpdateWork,
    handleLoadWorks,
    handleLoadWork,
    handleDeleteWork,
  };
};
